import type { Share } from "@prisma/client";
import type { ShareState } from "@secureview/shared";

export function computeShareState(share: Pick<Share, "revokedAt" | "expiresAt" | "maxViews" | "viewCount">): ShareState {
  if (share.revokedAt) return "REVOKED";
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return "EXPIRED";
  if (share.maxViews !== null && share.viewCount >= share.maxViews) return "VIEW_LIMIT_REACHED";
  return "ACTIVE";
}

export function isShareActive(share: Pick<Share, "revokedAt" | "expiresAt" | "maxViews" | "viewCount">): boolean {
  return computeShareState(share) === "ACTIVE";
}
