import * as mupdf from "mupdf";
import { RENDER_DPI } from "@secureview/shared";
import { prisma } from "../db/prisma.js";
import { getObject, putObject, buckets } from "../lib/s3.js";
import { decryptDocument, unwrapDataKey } from "../lib/crypto.js";
import { logger } from "../lib/logger.js";

const PDF_BASE_DPI = 72;

/**
 * Pipeline de rendu : récupère le PDF chiffré, le déchiffre en mémoire,
 * rasterise chaque page à 150 DPI, et stocke les pages "propres" (sans
 * filigrane) en S3. Le PDF déchiffré ne touche jamais le disque et n'est
 * jamais journalisé.
 */
export async function renderDocument(documentId: string): Promise<void> {
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PROCESSING", processingError: null },
  });

  try {
    const encrypted = await getObject(buckets.documents, document.s3KeyEncrypted);
    const dataKey = unwrapDataKey(document.dataKeyWrapped);
    const plaintext = decryptDocument(
      { ciphertext: encrypted, iv: document.encryptionIv, authTag: document.encryptionAuthTag },
      dataKey,
    );

    const pdf = mupdf.Document.openDocument(plaintext, "application/pdf");
    const pageCount = pdf.countPages();
    const scale = RENDER_DPI / PDF_BASE_DPI;
    const matrix = mupdf.Matrix.scale(scale, scale);

    for (let pageNumber = 0; pageNumber < pageCount; pageNumber++) {
      const page = pdf.loadPage(pageNumber);
      const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
      const png = Buffer.from(pixmap.asPNG());
      const width = pixmap.getWidth();
      const height = pixmap.getHeight();

      const s3Key = `${documentId}/${pageNumber + 1}.png`;
      await putObject(buckets.pages, s3Key, png, "image/png");

      await prisma.documentPage.upsert({
        where: { documentId_pageNumber: { documentId, pageNumber: pageNumber + 1 } },
        create: { documentId, pageNumber: pageNumber + 1, s3Key, width, height },
        update: { s3Key, width, height },
      });
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "READY", pageCount, processingError: null },
    });

    logger.info({ documentId, pageCount }, "document rendu avec succès");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de rendu inconnue";
    logger.error({ documentId, err: message }, "échec du rendu du document");
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "FAILED", processingError: message },
    });
    throw err;
  }
}
