import type { APIRoute } from "astro";
import { UploadRequest, type UploadResponse } from "@memoria/shared";
import { db } from "../../../lib/server/db.ts";
import { json, readJson } from "../../../lib/server/http.ts";
import { createUploads } from "../../../lib/server/uploads.ts";

/** Step 1 of an upload: say which files to send, skip duplicates, enforce the cap. */
export const POST: APIRoute = async ({ request, locals }) => {
  const body = await readJson(request, UploadRequest);
  if (body instanceof Response) return body;

  const slots = await createUploads(db, locals.user!.id, body.files);
  const response: UploadResponse = { slots };
  return json(response);
};
