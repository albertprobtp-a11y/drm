import { z } from "zod";

export const createShareSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().min(1).max(120),
  canPrint: z.boolean().default(false),
  expiresAt: z.string().datetime().nullable().optional(),
  maxViews: z.number().int().positive().nullable().optional(),
});
export type CreateShareInput = z.infer<typeof createShareSchema>;

export const updateShareSchema = z.object({
  canPrint: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxViews: z.number().int().positive().nullable().optional(),
});
export type UpdateShareInput = z.infer<typeof updateShareSchema>;

export const shareSummarySchema = z.object({
  id: z.string(),
  documentId: z.string(),
  documentTitle: z.string(),
  recipientEmail: z.string().email(),
  recipientName: z.string(),
  canPrint: z.boolean(),
  expiresAt: z.string().nullable(),
  maxViews: z.number().int().nullable(),
  viewCount: z.number().int(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  isExpired: z.boolean(),
  isActive: z.boolean(),
});
export type ShareSummary = z.infer<typeof shareSummarySchema>;

export const shareStateSchema = z.enum(["ACTIVE", "REVOKED", "EXPIRED", "VIEW_LIMIT_REACHED"]);
export type ShareState = z.infer<typeof shareStateSchema>;

export const shareStatusSchema = z.object({
  state: shareStateSchema,
  documentTitle: z.string(),
  recipientName: z.string(),
});
export type ShareStatus = z.infer<typeof shareStatusSchema>;
