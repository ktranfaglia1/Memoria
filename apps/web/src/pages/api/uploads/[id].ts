import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { PhotoId, inboxKey } from "@memoria/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../../../lib/server/db.ts";
import { json, jsonError } from "../../../lib/server/http.ts";
import { photos } from "../../../lib/server/schema.ts";

/**
 * Step 2 of an upload: the photo's bytes, streamed into the R2 inbox. R2
 * checks them against the SHA-256 recorded in step 1 and rejects a mismatch.
 */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = PhotoId.safeParse(params.id);
  if (!id.success) return jsonError(404, "Unknown photo.");

  const photo = await db
    .select()
    .from(photos)
    .where(eq(photos.id, id.data))
    .get();
  if (!photo) return jsonError(404, "Unknown photo.");
  // A retry after a dropped response: the first attempt already worked.
  if (photo.status !== "pending") return json({ ok: true });

  const length = Number(request.headers.get("content-length"));
  if (!request.body || length !== photo.size) {
    return jsonError(400, "File size doesn't match.");
  }

  try {
    await env.BUCKET.put(
      inboxKey(photo.id),
      request.body.pipeThrough(new FixedLengthStream(photo.size)),
      {
        sha256: photo.sha256,
        httpMetadata: { contentType: photo.contentType },
      },
    );
  } catch {
    // Usually a checksum mismatch (the bytes changed in transit) or a dropped connection.
    return jsonError(422, "Upload failed its integrity check. Try again.");
  }

  await db
    .update(photos)
    .set({ status: "in_cloud", originalInCloud: true, uploadedAt: Date.now() })
    .where(and(eq(photos.id, photo.id), eq(photos.status, "pending")));
  return json({ ok: true });
};
