import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db.ts";
import { jsonError } from "./http.ts";
import { agentTokens } from "./schema.ts";

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Checks the `Authorization: Bearer <token>` header against agent_tokens.
 * Returns the token's id, or a 401 Response.
 */
export async function requireAgent(
  request: Request,
): Promise<string | Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token.length < 32)
    return jsonError(401, "Missing or invalid agent token.");

  const row = await db
    .select({ id: agentTokens.id })
    .from(agentTokens)
    .where(
      and(
        eq(agentTokens.tokenHash, await sha256Hex(token)),
        isNull(agentTokens.revokedAt),
      ),
    )
    .get();
  if (!row) return jsonError(401, "Missing or invalid agent token.");

  await db
    .update(agentTokens)
    .set({ lastSeenAt: Date.now() })
    .where(eq(agentTokens.id, row.id));
  return row.id;
}
