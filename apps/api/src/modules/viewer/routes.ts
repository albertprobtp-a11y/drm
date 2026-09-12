import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { reportPageViewSchema, reportClientEventSchema } from "@secureview/shared";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { getObject, buckets } from "../../lib/s3.js";
import { applyWatermark } from "../../jobs/watermark.js";
import { getCachedPage, setCachedPage } from "../../lib/page-cache.js";
import { generatePageToken, verifyAndConsumePageToken } from "../../lib/signed-url.js";
import { recordAuditEvent } from "../../lib/audit.js";
import { computeShareState } from "../shares/state.js";
import { logger } from "../../lib/logger.js";

const pageParamsSchema = z.object({ pageNumber: z.coerce.number().int().positive() });
const rawQuerySchema = z.object({ token: z.string().min(1) });

function formatMinuteTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

async function getOrRenderWatermarkedPage(
  shareId: string,
  pageNumber: number,
  info: { name: string; email: string; ip: string },
): Promise<Buffer> {
  const cached = await getCachedPage(shareId, pageNumber);
  if (cached) return cached;

  const page = await prisma.documentPage.findFirst({
    where: { document: { shares: { some: { id: shareId } } }, pageNumber },
  });
  if (!page) throw new Error(`Page ${pageNumber} introuvable pour le partage ${shareId}`);

  const cleanPng = await getObject(buckets.pages, page.s3Key);
  const watermarked = await applyWatermark(cleanPng, {
    ...info,
    timestamp: formatMinuteTimestamp(new Date()),
  });

  await setCachedPage(shareId, pageNumber, watermarked);
  return watermarked;
}

export async function viewerRoutes(app: FastifyInstance) {
  // Étape 1 : le viewer demande une URL signée à courte durée de vie pour une page.
  app.get(
    "/viewer/pages/:pageNumber",
    {
      preHandler: app.requireShareSession,
      config: {
        rateLimit: { max: env.RATE_LIMIT_PAGE_MAX, timeWindow: env.RATE_LIMIT_PAGE_WINDOW_MS },
      },
    },
    async (request, reply) => {
      const { pageNumber } = pageParamsSchema.parse(request.params);
      const session = request.shareSession!;

      if (pageNumber > session.share.document.pageCount) {
        return reply.status(404).send({ error: "Page introuvable." });
      }

      // Génère (ou réutilise le cache) la page filigranée pour amorcer le cache,
      // avant même que le client n'aille chercher les octets via l'URL signée.
      await getOrRenderWatermarkedPage(session.shareId, pageNumber, {
        name: session.share.recipientName,
        email: session.share.recipientEmail,
        ip: session.ip,
      });

      const { token, expiresAt } = generatePageToken(session.id, pageNumber);
      reply.send({
        url: `/api/viewer/pages/raw?token=${encodeURIComponent(token)}`,
        expiresAt: expiresAt.toISOString(),
        pageNumber,
      });
    },
  );

  // Étape 2 : récupération des octets de la page, via un token à usage unique.
  app.get(
    "/viewer/pages/raw",
    {
      config: {
        rateLimit: { max: env.RATE_LIMIT_PAGE_MAX, timeWindow: env.RATE_LIMIT_PAGE_WINDOW_MS },
      },
    },
    async (request, reply) => {
      const { token } = rawQuerySchema.parse(request.query);
      const result = await verifyAndConsumePageToken(token);
      if (!result.ok) {
        return reply.status(403).send({ error: "Lien de page invalide ou expiré." });
      }

      const session = await prisma.shareSession.findUnique({
        where: { id: result.payload.shareSessionId },
        include: { share: true },
      });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return reply.status(403).send({ error: "Session invalide." });
      }
      if (computeShareState(session.share) !== "ACTIVE") {
        return reply.status(403).send({ error: "Ce lien n'est plus actif." });
      }

      const watermarked = await getOrRenderWatermarkedPage(session.shareId, result.payload.pageNumber, {
        name: session.share.recipientName,
        email: session.share.recipientEmail,
        ip: session.ip,
      });

      reply
        .header("Cache-Control", "no-store")
        .header("Content-Type", "image/webp")
        .send(watermarked);
    },
  );

  app.post("/viewer/page-views", { preHandler: app.requireShareSession }, async (request, reply) => {
    const body = reportPageViewSchema.parse(request.body);
    const session = request.shareSession!;

    await prisma.pageView.create({
      data: {
        shareId: session.shareId,
        shareSessionId: session.id,
        pageNumber: body.pageNumber,
        durationMs: body.durationMs,
      },
    });
    await recordAuditEvent(
      session.shareId,
      "PAGE_VIEWED",
      { pageNumber: body.pageNumber, durationMs: body.durationMs },
      session.id,
    );

    reply.status(204).send();
  });

  app.post("/viewer/events", { preHandler: app.requireShareSession }, async (request, reply) => {
    const body = reportClientEventSchema.parse(request.body);
    const session = request.shareSession!;

    await recordAuditEvent(session.shareId, body.type, { ip: session.ip }, session.id);
    logger.info({ shareId: session.shareId, type: body.type }, "événement client enregistré");

    reply.status(204).send();
  });
}
