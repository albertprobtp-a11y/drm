import { env } from "../../config/env.js";

export const ACCESS_COOKIE = "sv_access";
export const REFRESH_COOKIE = "sv_refresh";

export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parseur minimal pour des durées type "15m", "30d", "45s" (format utilisé par nos .env). */
function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Format de durée invalide : "${value}" (attendu ex: "15m", "30d")`);
  const [, amount = "0", unit = "s"] = match;
  const unitMs = UNIT_MS[unit] ?? UNIT_MS.s!;
  return Number(amount) * unitMs;
}

export function accessCookieMaxAgeMs(): number {
  return parseDurationMs(env.JWT_ACCESS_TTL);
}

export function refreshCookieMaxAgeMs(): number {
  return parseDurationMs(env.JWT_REFRESH_TTL);
}
