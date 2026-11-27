import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { overallStatus, type HealthResponse } from "@memoria/shared";

/**
 * Confirms the Worker can reach D1 and R2. Public on purpose (used by uptime
 * checks), so it reports only ok/error and the schema version: no data,
 * object names, or error messages.
 */
export const GET: APIRoute = async () => {
  let database: "ok" | "error" = "ok";
  let storage: "ok" | "error" = "ok";
  let schemaVersion: number | null = null;

  try {
    const row = await env.DB.prepare(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
    ).first<{ value: string }>();
    schemaVersion = row ? Number(row.value) : null;
  } catch {
    database = "error";
  }

  try {
    await env.BUCKET.list({ limit: 1 });
  } catch {
    storage = "error";
  }

  const checks = { database, storage };
  const body: HealthResponse = {
    status: overallStatus(checks),
    checks,
    schemaVersion,
  };

  return Response.json(body, {
    status: body.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
};
