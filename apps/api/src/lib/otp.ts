import { randomInt } from "node:crypto";
import { env } from "../config/env.js";
import { redis } from "./redis.js";

interface OtpRecord {
  code: string;
  attempts: number;
}

function otpKey(shareId: string): string {
  return `otp:${shareId}`;
}

export function generateOtpCode(): string {
  const max = 10 ** env.OTP_LENGTH;
  const code = randomInt(0, max);
  return code.toString().padStart(env.OTP_LENGTH, "0");
}

export async function storeOtp(shareId: string, code: string): Promise<void> {
  const record: OtpRecord = { code, attempts: 0 };
  await redis.set(otpKey(shareId), JSON.stringify(record), "EX", env.OTP_TTL_SECONDS);
}

export type OtpCheckResult = "valid" | "invalid" | "expired" | "locked";

/** Vérifie le code OTP et incrémente le compteur de tentatives en cas d'échec. */
export async function checkOtp(shareId: string, code: string): Promise<OtpCheckResult> {
  const raw = await redis.get(otpKey(shareId));
  if (!raw) return "expired";

  const record: OtpRecord = JSON.parse(raw);
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) return "locked";

  if (record.code !== code) {
    record.attempts += 1;
    const ttl = await redis.ttl(otpKey(shareId));
    await redis.set(otpKey(shareId), JSON.stringify(record), "EX", ttl > 0 ? ttl : env.OTP_TTL_SECONDS);
    return record.attempts >= env.OTP_MAX_ATTEMPTS ? "locked" : "invalid";
  }

  await redis.del(otpKey(shareId));
  return "valid";
}
