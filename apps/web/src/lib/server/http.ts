import type { ApiError } from "@memoria/shared";
import type { z } from "zod";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function jsonError(status: number, error: string): Response {
  const body: ApiError = { error };
  return Response.json(body, { status, headers: NO_STORE });
}

/** Parses a JSON body with a Zod schema; returns an error Response on failure. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError(400, "Expected a JSON body.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError(400, "Invalid request.");
  return parsed.data;
}
