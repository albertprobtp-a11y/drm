import { randomUUID, createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { loginSchema, registerSchema } from "@secureview/shared";
import { prisma } from "../../db/prisma.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt.js";
import { logger } from "../../lib/logger.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieMaxAgeMs,
  cookieOptions,
  refreshCookieMaxAgeMs,
} from "./cookies.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueSession(userId: string, email: string) {
  const accessToken = signAccessToken({ sub: userId, email });

  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, jti });
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshCookieMaxAgeMs()),
    },
  });

  return { accessToken, refreshToken, jti };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ error: "Un compte existe déjà avec cet email." });
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, name: body.name },
    });

    const { accessToken, refreshToken } = await issueSession(user.id, user.email);
    reply
      .setCookie(ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: accessCookieMaxAgeMs() / 1000 })
      .setCookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: refreshCookieMaxAgeMs() / 1000 })
      .status(201)
      .send({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.status(401).send({ error: "Email ou mot de passe incorrect." });
    }

    const { accessToken, refreshToken } = await issueSession(user.id, user.email);
    reply
      .setCookie(ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: accessCookieMaxAgeMs() / 1000 })
      .setCookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: refreshCookieMaxAgeMs() / 1000 })
      .send({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
  });

  app.post("/auth/refresh", async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) return reply.status(401).send({ error: "Session expirée." });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return reply.status(401).send({ error: "Session invalide." });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.tokenHash !== hashToken(token)) {
      return reply.status(401).send({ error: "Session invalide." });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return reply.status(401).send({ error: "Session invalide." });

    // Rotation : on révoque l'ancien refresh token et on en émet un nouveau.
    const { accessToken, refreshToken, jti: newJti } = await issueSession(user.id, user.email);
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: newJti },
    });

    reply
      .setCookie(ACCESS_COOKIE, accessToken, { ...cookieOptions, maxAge: accessCookieMaxAgeMs() / 1000 })
      .setCookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions, maxAge: refreshCookieMaxAgeMs() / 1000 })
      .send({ ok: true });
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await prisma.refreshToken.updateMany({
          where: { id: payload.jti },
          data: { revokedAt: new Date() },
        });
      } catch (err) {
        logger.debug({ err }, "logout: refresh token déjà invalide");
      }
    }
    reply.clearCookie(ACCESS_COOKIE, cookieOptions).clearCookie(REFRESH_COOKIE, cookieOptions).send({ ok: true });
  });

  app.get("/auth/me", { preHandler: app.requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.sub } });
    reply.send({ id: user.id, email: user.email, name: user.name, createdAt: user.createdAt });
  });
}
