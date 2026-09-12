import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createShareSchema, updateShareSchema, type ShareSummary } from "@secureview/shared";
import type { Share } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { logger } from "../../lib/logger.js";
import { computeShareState } from "./state.js";

const idParamsSchema = z.object({ documentId: z.string() });
const shareIdParamsSchema = z.object({ shareId: z.string() });

function toSummary(share: Share & { document: { title: string } }): ShareSummary {
  const state = computeShareState(share);
  return {
    id: share.id,
    documentId: share.documentId,
    documentTitle: share.document.title,
    recipientEmail: share.recipientEmail,
    recipientName: share.recipientName,
    canPrint: share.canPrint,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    maxViews: share.maxViews,
    viewCount: share.viewCount,
    revokedAt: share.revokedAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
    isExpired: state === "EXPIRED",
    isActive: state === "ACTIVE",
  };
}

async function assertDocumentOwnership(userId: string, documentId: string) {
  const document = await prisma.document.findFirst({ where: { id: documentId, userId } });
  if (!document) {
    const err = new Error("Document introuvable.");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  return document;
}

export async function shareRoutes(app: FastifyInstance) {
  app.post(
    "/documents/:documentId/shares",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const { documentId } = idParamsSchema.parse(request.params);
      await assertDocumentOwnership(request.user!.sub, documentId);
      const body = createShareSchema.parse(request.body);

      const share = await prisma.share.create({
        data: {
          documentId,
          recipientEmail: body.recipientEmail,
          recipientName: body.recipientName,
          canPrint: body.canPrint,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          maxViews: body.maxViews ?? null,
        },
        include: { document: { select: { title: true } } },
      });

      logger.info({ shareId: share.id, documentId }, "partage créé");
      reply.status(201).send(toSummary(share));
    },
  );

  app.get(
    "/documents/:documentId/shares",
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const { documentId } = idParamsSchema.parse(request.params);
      await assertDocumentOwnership(request.user!.sub, documentId);

      const shares = await prisma.share.findMany({
        where: { documentId },
        include: { document: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
      });

      reply.send(shares.map(toSummary));
    },
  );

  app.patch("/shares/:shareId", { preHandler: app.requireAuth }, async (request, reply) => {
    const { shareId } = shareIdParamsSchema.parse(request.params);
    const body = updateShareSchema.parse(request.body);

    const existing = await prisma.share.findFirst({
      where: { id: shareId, document: { userId: request.user!.sub } },
    });
    if (!existing) return reply.status(404).send({ error: "Partage introuvable." });

    const share = await prisma.share.update({
      where: { id: shareId },
      data: {
        ...(body.canPrint !== undefined ? { canPrint: body.canPrint } : {}),
        ...(body.expiresAt !== undefined
          ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
          : {}),
        ...(body.maxViews !== undefined ? { maxViews: body.maxViews } : {}),
      },
      include: { document: { select: { title: true } } },
    });

    reply.send(toSummary(share));
  });

  app.post("/shares/:shareId/revoke", { preHandler: app.requireAuth }, async (request, reply) => {
    const { shareId } = shareIdParamsSchema.parse(request.params);

    const existing = await prisma.share.findFirst({
      where: { id: shareId, document: { userId: request.user!.sub } },
    });
    if (!existing) return reply.status(404).send({ error: "Partage introuvable." });

    const share = await prisma.$transaction(async (tx) => {
      const updated = await tx.share.update({
        where: { id: shareId },
        data: { revokedAt: new Date() },
        include: { document: { select: { title: true } } },
      });
      await tx.auditEvent.create({
        data: { shareId, type: "REVOKED", payload: { by: "sender" } },
      });
      return updated;
    });

    app.revokeShareSessions(shareId, "Accès révoqué par l'expéditeur.");

    logger.info({ shareId }, "partage révoqué");
    reply.send(toSummary(share));
  });
}
