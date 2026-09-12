import { z } from "zod";

/** Le lien reçu par le destinataire encode ce token opaque (id du Share, non l'id brut en DB). */
export const requestOtpSchema = z.object({
  shareToken: z.string().min(1),
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  shareToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/, "Le code doit contenir 6 chiffres."),
  deviceFingerprint: z.string().max(256).optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const verifyOtpResponseSchema = z.object({
  sessionToken: z.string(),
  expiresAt: z.string(),
  documentTitle: z.string(),
  pageCount: z.number().int().nonnegative(),
  canPrint: z.boolean(),
  recipientName: z.string(),
  recipientEmail: z.string().email(),
});
export type VerifyOtpResponse = z.infer<typeof verifyOtpResponseSchema>;
