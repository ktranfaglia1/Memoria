import { z } from "zod";

/** Status of one dependency the API relies on. */
export const CheckStatus = z.enum(["ok", "error"]);

/** Response body of `GET /api/health`. Deliberately reveals no data or config. */
export const HealthResponse = z.object({
  status: CheckStatus,
  checks: z.object({
    database: CheckStatus,
    storage: CheckStatus,
  }),
  schemaVersion: z.number().int().nullable(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;

/** Overall status is "ok" only when every individual check is "ok". */
export function overallStatus(
  checks: HealthResponse["checks"],
): HealthResponse["status"] {
  return Object.values(checks).every((c) => c === "ok") ? "ok" : "error";
}
