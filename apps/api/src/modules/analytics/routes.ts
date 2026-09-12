import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ShareAnalytics } from "@secureview/shared";
import { prisma } from "../../db/prisma.js";

const shareIdParamsSchema = z.object({ shareId: z.string() });

export async function analyticsRoutes(app: FastifyInstance) {
  app.get("/shares/:shareId/analytics", { preHandler: app.requireAuth }, async (request, reply) => {
    const { shareId } = shareIdParamsSchema.parse(request.params);

    const share = await prisma.share.findFirst({
      where: { id: shareId, document: { userId: request.user!.sub } },
    });
    if (!share) return reply.status(404).send({ error: "Partage introuvable." });

    const [pageViews, sessions, events] = await Promise.all([
      prisma.pageView.findMany({ where: { shareId } }),
      prisma.shareSession.findMany({ where: { shareId }, orderBy: { createdAt: "desc" } }),
      prisma.auditEvent.findMany({
        where: { shareId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    const heatByPage = new Map<number, { totalDurationMs: number; viewCount: number }>();
    for (const view of pageViews) {
      const entry = heatByPage.get(view.pageNumber) ?? { totalDurationMs: 0, viewCount: 0 };
      entry.totalDurationMs += view.durationMs;
      entry.viewCount += 1;
      heatByPage.set(view.pageNumber, entry);
    }
    const pageHeat = Array.from(heatByPage.entries())
      .map(([pageNumber, v]) => ({ pageNumber, ...v }))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    const durationBySession = new Map<string, number>();
    for (const view of pageViews) {
      durationBySession.set(
        view.shareSessionId,
        (durationBySession.get(view.shareSessionId) ?? 0) + view.durationMs,
      );
    }

    const payload: ShareAnalytics = {
      share: {
        id: share.id,
        documentId: share.documentId,
        recipientName: share.recipientName,
        recipientEmail: share.recipientEmail,
      },
      pageHeat,
      sessions: sessions.map((s) => ({
        id: s.id,
        ip: s.ip,
        userAgent: s.userAgent,
        otpVerifiedAt: s.otpVerifiedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        revokedAt: s.revokedAt?.toISOString() ?? null,
        totalDurationMs: durationBySession.get(s.id) ?? 0,
      })),
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        payload: e.payload as Record<string, unknown>,
        createdAt: e.createdAt.toISOString(),
      })),
    };

    reply.send(payload);
  });
}
