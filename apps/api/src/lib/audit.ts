import type { Prisma } from "@prisma/client";
import type { AuditEventType } from "@secureview/shared";
import { prisma } from "../db/prisma.js";

export function recordAuditEvent(
  shareId: string,
  type: AuditEventType,
  payload: Record<string, unknown> = {},
  shareSessionId?: string,
) {
  return prisma.auditEvent.create({
    data: {
      shareId,
      type,
      payload: payload as Prisma.InputJsonValue,
      shareSessionId: shareSessionId ?? null,
    },
  });
}
