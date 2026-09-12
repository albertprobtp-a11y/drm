import { z } from "zod";

/** Types d'événements que le viewer peut lui-même déclencher côté client. */
export const clientAuditEventTypeSchema = z.enum(["BLURRED", "PRINT_ATTEMPT"]);
export type ClientAuditEventType = z.infer<typeof clientAuditEventTypeSchema>;

export const reportClientEventSchema = z.object({
  type: clientAuditEventTypeSchema,
});
export type ReportClientEventInput = z.infer<typeof reportClientEventSchema>;
