import { PAGE_CACHE_TTL_SECONDS } from "@secureview/shared";
import { redis } from "./redis.js";

function cacheKey(shareId: string, pageNumber: number): string {
  return `page:${shareId}:${pageNumber}`;
}

export async function getCachedPage(shareId: string, pageNumber: number): Promise<Buffer | null> {
  const value = await redis.getBuffer(cacheKey(shareId, pageNumber));
  return value ?? null;
}

export async function setCachedPage(
  shareId: string,
  pageNumber: number,
  webp: Buffer,
): Promise<void> {
  await redis.set(cacheKey(shareId, pageNumber), webp, "EX", PAGE_CACHE_TTL_SECONDS);
}
