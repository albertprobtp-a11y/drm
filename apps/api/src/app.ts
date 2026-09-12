import Fastify, { type FastifyError } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import authPlugin from "./plugins/auth.js";
import shareSessionAuthPlugin from "./plugins/share-session-auth.js";
import realtimePlugin from "./plugins/realtime.js";
import { authRoutes } from "./modules/auth/routes.js";
import { documentRoutes } from "./modules/documents/routes.js";
import { shareRoutes } from "./modules/shares/routes.js";
import { recipientAuthRoutes } from "./modules/recipient-auth/routes.js";
import { viewerRoutes } from "./modules/viewer/routes.js";
import { analyticsRoutes } from "./modules/analytics/routes.js";

export async function buildApp() {
  const app = Fastify({ loggerInstance: logger, trustProxy: true });

  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } });
  await app.register(rateLimit, { global: false });
  await app.register(websocket);

  await app.register(authPlugin);
  await app.register(shareSessionAuthPlugin);
  await app.register(realtimePlugin);

  app.setErrorHandler((error: FastifyError | ZodError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "Requête invalide.", details: error.flatten() });
    }
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      logger.error({ err: error, url: request.url }, "erreur serveur");
      return reply.status(500).send({ error: "Erreur interne." });
    }
    reply.status(statusCode).send({ error: error.message });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(documentRoutes);
      await api.register(shareRoutes);
      await api.register(recipientAuthRoutes);
      await api.register(viewerRoutes);
      await api.register(analyticsRoutes);
    },
    { prefix: "/api" },
  );

  return app;
}
