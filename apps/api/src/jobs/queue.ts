import { Queue } from "bullmq";
import { createBullConnection } from "../lib/redis.js";

export const RENDER_QUEUE_NAME = "document-render";

export interface RenderJobData {
  documentId: string;
}

export const renderQueue = new Queue<RenderJobData>(RENDER_QUEUE_NAME, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export async function enqueueRenderJob(documentId: string): Promise<void> {
  await renderQueue.add("render", { documentId }, { jobId: documentId });
}
