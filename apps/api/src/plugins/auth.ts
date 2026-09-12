import fp from "fastify-plugin";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";
import { ACCESS_COOKIE } from "../modules/auth/cookies.js";

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[ACCESS_COOKIE];
    if (!token) {
      return reply.status(401).send({ error: "Authentification requise." });
    }
    try {
      request.user = verifyAccessToken(token);
    } catch {
      return reply.status(401).send({ error: "Session invalide ou expirée." });
    }
  });
});
