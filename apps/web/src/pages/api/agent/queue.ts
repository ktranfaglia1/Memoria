import type { APIRoute } from "astro";
import type { AgentQueueResponse, PhotoType } from "@memoria/shared";
import { asc, eq } from "drizzle-orm";
import { requireAgent } from "../../../lib/server/agent-auth.ts";
import { db } from "../../../lib/server/db.ts";
import { json } from "../../../lib/server/http.ts";
import { photos } from "../../../lib/server/schema.ts";

const MAX_BATCH = 100;

/** Photos in the cloud inbox that the home PC hasn't saved yet, oldest first. */
export const GET: APIRoute = async ({ request }) => {
  const agent = await requireAgent(request);
  if (agent instanceof Response) return agent;

  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.status, "in_cloud"))
    .orderBy(asc(photos.uploadedAt))
    .limit(MAX_BATCH)
    .all();

  const body: AgentQueueResponse = {
    photos: rows.map((row) => ({
      id: row.id,
      sha256: row.sha256,
      size: row.size,
      contentType: row.contentType as PhotoType,
      originalName: row.originalName,
      uploadedAt: row.uploadedAt ?? row.createdAt,
    })),
  };
  return json(body);
};
