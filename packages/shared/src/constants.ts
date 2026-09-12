export const DOCUMENT_STATUS = ["PENDING", "PROCESSING", "READY", "FAILED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number];

export const AUDIT_EVENT_TYPE = [
  "OTP_SENT",
  "OTP_FAILED",
  "OTP_VERIFIED",
  "OPENED",
  "PAGE_VIEWED",
  "BLURRED",
  "PRINT_ATTEMPT",
  "DENIED",
  "EXPIRED",
  "REVOKED",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPE)[number];

/** Durée de vie d'une URL de page signée (secondes). Volontairement très courte. */
export const PAGE_SIGNED_URL_TTL_SECONDS = 45;

/** Durée de mise en cache Redis d'une page filigranée déjà générée. */
export const PAGE_CACHE_TTL_SECONDS = 15 * 60;

/** DPI de rasterisation des pages PDF. */
export const RENDER_DPI = 150;

/** Qualité de sortie WebP des pages filigranées. */
export const WATERMARK_WEBP_QUALITY = 82;

/** Nombre de pages suivantes préchargées dans le viewer. */
export const VIEWER_PREFETCH_PAGES = 2;

export const DEFAULT_OTP_LENGTH = 6;
export const DEFAULT_OTP_TTL_SECONDS = 600;
export const DEFAULT_OTP_MAX_ATTEMPTS = 5;
