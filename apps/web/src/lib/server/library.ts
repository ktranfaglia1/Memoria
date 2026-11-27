import { INBOX_CAP_BYTES } from "@memoria/shared";
import { isNull, max, sql } from "drizzle-orm";
import type { Db } from "./db.ts";
import { inboxBytes } from "./uploads.ts";
import { agentTokens, photos } from "./schema.ts";

export interface LibrarySummary {
  inCloud: number;
  onDrive: number;
  inboxBytes: number;
  inboxCapBytes: number;
  agentLastSeen: number | null;
}

export async function librarySummary(db: Db): Promise<LibrarySummary> {
  const [counts, agent, bytes] = await Promise.all([
    db
      .select({
        inCloud: sql<number>`count(*) filter (where ${photos.status} = 'in_cloud')`,
        onDrive: sql<number>`count(*) filter (where ${photos.status} = 'on_drive')`,
      })
      .from(photos)
      .get(),
    db
      .select({ lastSeen: max(agentTokens.lastSeenAt) })
      .from(agentTokens)
      .where(isNull(agentTokens.revokedAt))
      .get(),
    inboxBytes(db),
  ]);
  return {
    inCloud: counts?.inCloud ?? 0,
    onDrive: counts?.onDrive ?? 0,
    inboxBytes: bytes,
    inboxCapBytes: INBOX_CAP_BYTES,
    agentLastSeen: agent?.lastSeen ?? null,
  };
}
