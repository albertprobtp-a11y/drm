import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ShareSession, Share } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { computeShareState } from "../modules/shares/state.js";

declare module "fastify" {
  interface FastifyInstance {
    requireShareSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    shareSession?: ShareSession & { share: Share & { document: { title: string; pageCount: number } } };
  }
}

function extractToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return null;
}

export default fp(async function shareSessionAuthPlugin(app: FastifyInstance) {
  app.decorate("requireShareSession", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractToken(request);
    if (!token) return reply.status(401).send({ error: "Session destinataire requise." });

    const session = await prisma.shareSession.findUnique({
      where: { token },
      include: { share: { include: { document: { select: { title: true, pageCount: true } } } } },
    });

    if (!session) return reply.status(401).send({ error: "Session invalide." });
    if (session.revokedAt) return reply.status(403).send({ error: "Session révoquée.", state: "REVOKED" });
    if (session.expiresAt < new Date()) {
      return reply.status(403).send({ error: "Session expirée.", state: "EXPIRED" });
    }

    const shareState = computeShareState(session.share);
    if (shareState !== "ACTIVE") {
      return reply.status(403).send({ error: "Ce lien n'est plus actif.", state: shareState });
    }

    request.shareSession = session;
  });
});
