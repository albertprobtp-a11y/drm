import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requestOtpSchema, verifyOtpSchema } from "@secureview/shared";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { generateOtpCode, storeOtp, checkOtp } from "../../lib/otp.js";
import { sendOtpEmail } from "../../lib/mailer.js";
import { recordAuditEvent } from "../../lib/audit.js";
import { logger } from "../../lib/logger.js";
import { computeShareState } from "../shares/state.js";

const shareIdParamsSchema = z.object({ shareId: z.string() });

export async function recipientAuthRoutes(app: FastifyInstance) {
  app.get("/shares/:shareId/status", async (request, reply) => {
    const { shareId } = shareIdParamsSchema.parse(request.params);
    const share = await prisma.share.findUnique({
      where: { id: shareId },
      include: { document: { select: { title: true } } },
    });
    if (!share) return reply.status(404).send({ error: "Lien introuvable." });

    reply.send({
      state: computeShareState(share),
      documentTitle: share.document.title,
      recipientName: share.recipientName,
    });
  });

  app.post(
    "/recipient-auth/otp/request",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_OTP_MAX,
          timeWindow: env.RATE_LIMIT_OTP_WINDOW_MS,
          keyGenerator: (request: { body?: unknown; ip: string }) =>
            `otp-request:${request.ip}:${(request.body as { shareToken?: string } | undefined)?.shareToken ?? ""}`,
        },
      },
    },
    async (request, reply) => {
      const body = requestOtpSchema.parse(request.body);
      const share = await prisma.share.findUnique({ where: { id: body.shareToken } });
      if (!share) return reply.status(404).send({ error: "Lien introuvable." });

      const state = computeShareState(share);
      if (state !== "ACTIVE") {
        return reply.status(403).send({ error: "Ce lien n'est plus actif.", state });
      }

      const code = generateOtpCode();
      await storeOtp(share.id, code);
      await sendOtpEmail(share.recipientEmail, code, "votre document");
      await recordAuditEvent(share.id, "OTP_SENT", { ip: request.ip });

      logger.info({ shareId: share.id }, "OTP envoyé");
      reply.send({ ok: true, sentTo: maskEmail(share.recipientEmail) });
    },
  );

  app.post(
    "/recipient-auth/otp/verify",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_OTP_MAX,
          timeWindow: env.RATE_LIMIT_OTP_WINDOW_MS,
          keyGenerator: (request: { body?: unknown; ip: string }) =>
            `otp-verify:${request.ip}:${(request.body as { shareToken?: string } | undefined)?.shareToken ?? ""}`,
        },
      },
    },
    async (request, reply) => {
      const body = verifyOtpSchema.parse(request.body);
      const share = await prisma.share.findUnique({
        where: { id: body.shareToken },
        include: { document: { select: { title: true, pageCount: true } } },
      });
      if (!share) return reply.status(404).send({ error: "Lien introuvable." });

      const state = computeShareState(share);
      if (state !== "ACTIVE") {
        return reply.status(403).send({ error: "Ce lien n'est plus actif.", state });
      }

      const result = await checkOtp(share.id, body.code);
      if (result !== "valid") {
        await recordAuditEvent(share.id, "OTP_FAILED", { ip: request.ip, reason: result });
        const messages: Record<typeof result, string> = {
          invalid: "Code incorrect.",
          expired: "Code expiré, veuillez en redemander un.",
          locked: "Trop de tentatives, veuillez redemander un code.",
        };
        return reply.status(401).send({ error: messages[result], reason: result });
      }

      const sessionExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h de lecture
      const session = await prisma.shareSession.create({
        data: {
          shareId: share.id,
          token: randomUUID(),
          ip: request.ip,
          userAgent: request.headers["user-agent"] ?? "unknown",
          deviceFingerprint: body.deviceFingerprint ?? null,
          otpVerifiedAt: new Date(),
          expiresAt: sessionExpiresAt,
        },
      });

      await prisma.share.update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } });
      await recordAuditEvent(share.id, "OTP_VERIFIED", { ip: request.ip }, session.id);
      await recordAuditEvent(share.id, "OPENED", { ip: request.ip }, session.id);

      logger.info({ shareId: share.id, sessionId: session.id }, "session destinataire ouverte");

      reply.send({
        sessionToken: session.token,
        expiresAt: session.expiresAt.toISOString(),
        documentTitle: share.document.title,
        pageCount: share.document.pageCount,
        canPrint: share.canPrint,
        recipientName: share.recipientName,
        recipientEmail: share.recipientEmail,
      });
    },
  );
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}
