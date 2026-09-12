import { z } from "zod";

export const signedPageUrlSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string(),
  pageNumber: z.number().int().positive(),
});
export type SignedPageUrl = z.infer<typeof signedPageUrlSchema>;

export const reportPageViewSchema = z.object({
  pageNumber: z.number().int().positive(),
  durationMs: z.number().int().nonnegative().max(1000 * 60 * 60),
});
export type ReportPageViewInput = z.infer<typeof reportPageViewSchema>;

/** Messages poussés au viewer via websocket. */
export const wsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("revoked"), reason: z.string() }),
  z.object({ type: z.literal("expired") }),
  z.object({ type: z.literal("pong") }),
]);
export type WsServerMessage = z.infer<typeof wsServerMessageSchema>;

export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribe"), sessionToken: z.string() }),
  z.object({ type: z.literal("ping") }),
]);
export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;
