import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { PhotoId, inboxKey } from "@memoria/shared";
import { requireAgent } from "../../../../../lib/server/agent-auth.ts";
import { jsonError } from "../../../../../lib/server/http.ts";

/** Streams an original from the R2 inbox to the home PC. */
export const GET: APIRoute = async ({ params, request }) => {
  const agent = await requireAgent(request);
  if (agent instanceof Response) return agent;

  const id = PhotoId.safeParse(params.id);
  if (!id.success) return jsonError(404, "Unknown photo.");

  const object = await env.BUCKET.get(inboxKey(id.data));
  if (!object) return jsonError(404, "Original not in the cloud inbox.");

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(object.size),
      "Cache-Control": "no-store",
    },
  });
};
