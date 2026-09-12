import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DocumentSummary } from "@secureview/shared";
import type { Document } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { putObject, buckets } from "../../lib/s3.js";
import { generateDataKey, wrapDataKey, encryptDocument, sha256 } from "../../lib/crypto.js";
import { enqueueRenderJob } from "../../jobs/queue.js";
import { logger } from "../../lib/logger.js";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const idParamsSchema = z.object({ documentId: z.string() });

function toSummary(
  document: Document & { _count: { shares: number }; shares: { viewCount: number }[] },
): DocumentSummary {
  return {
    id: document.id,
    title: document.title,
    originalFilename: document.originalFilename,
    pageCount: document.pageCount,
    status: document.status,
    processingError: document.processingError,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    shareCount: document._count.shares,
    totalViews: document.shares.reduce((sum, s) => sum + s.viewCount, 0),
  };
}

export async function documentRoutes(app: FastifyInstance) {
  app.post("/documents", { preHandler: app.requireAuth }, async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!file) return reply.status(400).send({ error: "Aucun fichier reçu." });
    if (file.mimetype !== "application/pdf") {
      return reply.status(400).send({ error: "Seuls les fichiers PDF sont acceptés." });
    }

    const title = (file.fields.title as { value?: string } | undefined)?.value?.trim() || file.filename;
    const buffer = await file.toBuffer();
    if (file.file.truncated) {
      return reply.status(413).send({ error: "Le fichier dépasse la taille maximale de 100 Mo." });
    }

    const dataKey = generateDataKey();
    const { ciphertext, iv, authTag } = encryptDocument(buffer, dataKey);
    const checksum = sha256(buffer);

    const document = await prisma.document.create({
      data: {
        userId: request.user!.sub,
        title,
        originalFilename: file.filename,
        s3KeyEncrypted: "",
        dataKeyWrapped: wrapDataKey(dataKey),
        encryptionIv: iv,
        encryptionAuthTag: authTag,
        checksumSha256: checksum,
        status: "PENDING",
      },
    });

    const s3KeyEncrypted = `${document.id}/original.pdf.enc`;
    await putObject(buckets.documents, s3KeyEncrypted, ciphertext, "application/octet-stream");
    await prisma.document.update({ where: { id: document.id }, data: { s3KeyEncrypted } });

    await enqueueRenderJob(document.id);
    logger.info({ documentId: document.id, userId: request.user!.sub }, "document téléversé, rendu mis en file");

    reply.status(201).send(
      toSummary({ ...document, s3KeyEncrypted, _count: { shares: 0 }, shares: [] }),
    );
  });

  app.get("/documents", { preHandler: app.requireAuth }, async (request, reply) => {
    const documents = await prisma.document.findMany({
      where: { userId: request.user!.sub },
      include: { _count: { select: { shares: true } }, shares: { select: { viewCount: true } } },
      orderBy: { createdAt: "desc" },
    });
    reply.send(documents.map(toSummary));
  });

  app.get("/documents/:documentId", { preHandler: app.requireAuth }, async (request, reply) => {
    const { documentId } = idParamsSchema.parse(request.params);
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId: request.user!.sub },
      include: { _count: { select: { shares: true } }, shares: { select: { viewCount: true } } },
    });
    if (!document) return reply.status(404).send({ error: "Document introuvable." });
    reply.send(toSummary(document));
  });
}
