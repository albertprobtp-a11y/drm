import sharp from "sharp";
import { WATERMARK_WEBP_QUALITY } from "@secureview/shared";

export interface WatermarkInfo {
  name: string;
  email: string;
  ip: string;
  /** Horodatage déjà arrondi à la minute, formaté pour affichage (ex: "12/09/2026 14:32"). */
  timestamp: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Construit un SVG de filigrane répété en diagonale sur toute la page. */
function buildWatermarkSvg(width: number, height: number, info: WatermarkInfo): string {
  const label = escapeXml(`${info.name} · ${info.email} · ${info.ip} · ${info.timestamp}`);
  const tileWidth = 480;
  const tileHeight = 220;
  const cols = Math.ceil(width / tileWidth) + 2;
  const rows = Math.ceil(height / tileHeight) + 2;

  const texts: string[] = [];
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const x = col * tileWidth;
      const y = row * tileHeight;
      texts.push(
        `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="rgba(120,120,120,0.34)" transform="rotate(-32 ${x} ${y})">${label}</text>`,
      );
    }
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${texts.join("")}</svg>`;
}

/**
 * Compose un filigrane nominatif (nom + email + IP + horodatage) en diagonale
 * répétée sur une page rasterisée "propre", et encode le résultat en WebP.
 */
export async function applyWatermark(cleanPagePng: Buffer, info: WatermarkInfo): Promise<Buffer> {
  const image = sharp(cleanPagePng);
  const metadata = await image.metadata();
  const width = metadata.width ?? 1240;
  const height = metadata.height ?? 1754;

  const svg = buildWatermarkSvg(width, height, info);

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .webp({ quality: WATERMARK_WEBP_QUALITY })
    .toBuffer();
}
