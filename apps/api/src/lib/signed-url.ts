import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { PAGE_SIGNED_URL_TTL_SECONDS } from "@secureview/shared";
import { env } from "../config/env.js";
import { redis } from "./redis.js";

interface PageTokenPayload {
  shareSessionId: string;
  pageNumber: number;
  jti: string;
  exp: number; // unix seconds
}

function sign(payload: string): string {
  return createHmac("sha256", env.PAGE_URL_SIGNING_SECRET).update(payload).digest("base64url");
}

/** Génère un token signé HMAC pour une page, valable PAGE_SIGNED_URL_TTL_SECONDS. */
export function generatePageToken(shareSessionId: string, pageNumber: number): {
  token: string;
  expiresAt: Date;
} {
  const exp = Math.floor(Date.now() / 1000) + PAGE_SIGNED_URL_TTL_SECONDS;
  const payload: PageTokenPayload = { shareSessionId, pageNumber, jti: randomUUID(), exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  return { token: `${payloadB64}.${signature}`, expiresAt: new Date(exp * 1000) };
}

export type TokenVerificationResult =
  | { ok: true; payload: PageTokenPayload }
  | { ok: false; reason: "malformed" | "signature" | "expired" | "already_used" };

/**
 * Vérifie un token de page ET le consomme (usage unique) via une clé Redis
 * SET NX. Un même token ne peut donc jamais servir deux fois, même s'il
 * n'a pas encore expiré.
 */
export async function verifyAndConsumePageToken(token: string): Promise<TokenVerificationResult> {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, signature] = parts;
  if (!payloadB64 || !signature) return { ok: false, reason: "malformed" };

  const expectedSignature = sign(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "signature" };
  }

  let payload: PageTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const consumedKey = `page-token-used:${payload.jti}`;
  const remainingTtl = Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
  const firstUse = await redis.set(consumedKey, "1", "EX", remainingTtl, "NX");
  if (firstUse !== "OK") {
    return { ok: false, reason: "already_used" };
  }

  return { ok: true, payload };
}
