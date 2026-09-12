import { z } from "zod";
import { DOCUMENT_STATUS } from "../constants.js";

export const documentStatusSchema = z.enum(DOCUMENT_STATUS);

export const documentSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  originalFilename: z.string(),
  pageCount: z.number().int().nonnegative(),
  status: documentStatusSchema,
  processingError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  shareCount: z.number().int().nonnegative(),
  totalViews: z.number().int().nonnegative(),
});
export type DocumentSummary = z.infer<typeof documentSummarySchema>;

export const createDocumentUploadSchema = z.object({
  title: z.string().min(1).max(200),
  filename: z.string().min(1).max(255),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024, "Le fichier ne doit pas dépasser 100 Mo."),
});
export type CreateDocumentUploadInput = z.infer<typeof createDocumentUploadSchema>;
