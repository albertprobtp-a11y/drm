import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { wsClientMessageSchema, type WsServerMessage } from "@secureview/shared";
import { prisma } from "../db/prisma.js";
import { redis, createBullConnection } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

declare module "fastify" {
  interface FastifyInstance {
    revokeShareSessions: (shareId: string, reason: string) => void;
  }
}

const REVOCATION_CHANNEL = "secureview:share-events";

interface ShareEventMessage {
  shareId: string;
  type: "revoked" | "expired";
  reason: string;
}

/** Sockets actifs regroupés par shareId, pour couper toutes les sessions d'un partage révoqué. */
const socketsByShareId = new Map<string, Set<WebSocket>>();

function addSocket(shareId: string, socket: WebSocket) {
  let set = socketsByShareId.get(shareId);
  if (!set) {
    set = new Set();
    socketsByShareId.set(shareId, set);
  }
  set.add(socket);
}

function removeSocket(shareId: string, socket: WebSocket) {
  const set = socketsByShareId.get(shareId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) socketsByShareId.delete(shareId);
}

function send(socket: WebSocket, message: WsServerMessage) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export default fp(async function realtimePlugin(app: FastifyInstance) {
  const subscriber = createBullConnection();
  await subscriber.subscribe(REVOCATION_CHANNEL);

  subscriber.on("message", (_channel, raw) => {
    let event: ShareEventMessage;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    const sockets = socketsByShareId.get(event.shareId);
    if (!sockets) return;
    for (const socket of sockets) {
      send(socket, { type: event.type, reason: event.reason });
      socket.close(1000, event.type);
    }
    socketsByShareId.delete(event.shareId);
  });

  app.addHook("onClose", async () => {
    await subscriber.quit();
  });

  app.decorate("revokeShareSessions", (shareId: string, reason: string) => {
    const event: ShareEventMessage = { shareId, type: "revoked", reason };
    redis.publish(REVOCATION_CHANNEL, JSON.stringify(event)).catch((err) => {
      logger.error({ err, shareId }, "échec de publication de l'événement de révocation");
    });
  });

  app.get("/ws", { websocket: true }, (socket) => {
    let subscribedShareId: string | null = null;

    socket.on("message", (raw: Buffer) => {
      void (async () => {
        let message;
        try {
          message = wsClientMessageSchema.parse(JSON.parse(raw.toString()));
        } catch {
          return;
        }

        if (message.type === "ping") {
          send(socket, { type: "pong" });
          return;
        }

        if (message.type === "subscribe") {
          const session = await prisma.shareSession.findUnique({
            where: { token: message.sessionToken },
            select: { shareId: true, revokedAt: true, expiresAt: true },
          });
          if (!session || session.revokedAt || session.expiresAt < new Date()) {
            send(socket, { type: "expired" });
            socket.close(1008, "invalid-session");
            return;
          }
          subscribedShareId = session.shareId;
          addSocket(session.shareId, socket);
        }
      })();
    });

    socket.on("close", () => {
      if (subscribedShareId) removeSocket(subscribedShareId, socket);
    });
  });
});
