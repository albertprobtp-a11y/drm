import { Worker } from "bullmq";
import { createBullConnection } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { renderDocument } from "./render.js";
import { RENDER_QUEUE_NAME, type RenderJobData } from "./queue.js";

const worker = new Worker<RenderJobData>(
  RENDER_QUEUE_NAME,
  async (job) => {
    logger.info({ jobId: job.id, documentId: job.data.documentId }, "traitement du job de rendu");
    await renderDocument(job.data.documentId);
  },
  { connection: createBullConnection(), concurrency: 2 },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "job de rendu terminé");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err: err.message }, "job de rendu échoué");
});

logger.info("worker de rendu démarré");
