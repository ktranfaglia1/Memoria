import type { APIRoute } from "astro";
import { ArchivedRequest, PhotoId } from "@memoria/shared";
import { eq } from "drizzle-orm";
import { requireAgent } from "../../../../../lib/server/agent-auth.ts";
import { db } from "../../../../../lib/server/db.ts";
import { json, jsonError, readJson } from "../../../../../lib/server/http.ts";
import { photos } from "../../../../../lib/server/schema.ts";

/**
 * The home PC saved this photo and verified its hash. The cloud original is
 * kept: Phase 2 deletes it only after a WD backup also includes the photo.
 */
export const POST: APIRoute = async ({ params, request }) => {
  const agent = await requireAgent(request);
  if (agent instanceof Response) return agent;

  const id = PhotoId.safeParse(params.id);
  if (!id.success) return jsonError(404, "Unknown photo.");
  const body = await readJson(request, ArchivedRequest);
  if (body instanceof Response) return body;

  const photo = await db
    .select()
    .from(photos)
    .where(eq(photos.id, id.data))
    .get();
  if (!photo) return jsonError(404, "Unknown photo.");
  if (body.sha256 !== photo.sha256) {
    return jsonError(409, "Hash doesn't match the uploaded photo.");
  }
  if (!body.drivePath.includes(`_${photo.id}.`)) {
    return jsonError(400, "Drive path doesn't name this photo.");
  }
  if (photo.status === "pending")
    return jsonError(409, "Upload hasn't finished.");

  // Idempotent: a repeat (e.g. after a lost response) changes nothing.
  if (photo.status === "in_cloud") {
    await db
      .update(photos)
      .set({
        status: "on_drive",
        drivePath: body.drivePath,
        takenAt: body.takenAt,
        archivedAt: Date.now(),
      })
      .where(eq(photos.id, photo.id));
  }
  return json({ ok: true });
};
