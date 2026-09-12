import { z } from "zod";
import { AUDIT_EVENT_TYPE } from "../constants.js";

export const auditEventTypeSchema = z.enum(AUDIT_EVENT_TYPE);

export const auditEventSchema = z.object({
  id: z.string(),
  type: auditEventTypeSchema,
  payload: z.record(z.unknown()),
  createdAt: z.string(),
});
export type AuditEventDto = z.infer<typeof auditEventSchema>;

export const pageHeatEntrySchema = z.object({
  pageNumber: z.number().int().positive(),
  totalDurationMs: z.number().int().nonnegative(),
  viewCount: z.number().int().nonnegative(),
});
export type PageHeatEntry = z.infer<typeof pageHeatEntrySchema>;

export const sessionSummarySchema = z.object({
  id: z.string(),
  ip: z.string(),
  userAgent: z.string(),
  otpVerifiedAt: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
  totalDurationMs: z.number().int().nonnegative(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const shareAnalyticsSchema = z.object({
  share: z.object({
    id: z.string(),
    documentId: z.string(),
    recipientName: z.string(),
    recipientEmail: z.string().email(),
  }),
  pageHeat: z.array(pageHeatEntrySchema),
  sessions: z.array(sessionSummarySchema),
  events: z.array(auditEventSchema),
});
export type ShareAnalytics = z.infer<typeof shareAnalyticsSchema>;
