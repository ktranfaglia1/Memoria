import {
  INBOX_CAP_BYTES,
  newPhotoId,
  type UploadFile,
  type UploadSlot,
} from "@memoria/shared";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import type { Db } from "./db.ts";
import { photos } from "./schema.ts";

/** An upload that never finished stops counting toward the cap after this long. */
export const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** Bytes of originals in the R2 inbox, plus uploads started in the last day. */
export async function inboxBytes(db: Db, now = Date.now()): Promise<number> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${photos.size}), 0)` })
    .from(photos)
    .where(
      or(
        eq(photos.originalInCloud, true),
        and(
          eq(photos.status, "pending"),
          gt(photos.createdAt, now - PENDING_TTL_MS),
        ),
      ),
    )
    .get();
  return row?.total ?? 0;
}

type ExistingPhoto = { id: string; sha256: string; status: string };

/**
 * Decides what happens to each file, without touching the database. Pure, so
 * it is unit tested on its own.
 * - Already in the library (any status but pending): duplicate.
 * - Pending from an earlier attempt: upload again into the same row.
 * - Repeated within the batch: duplicate.
 * - Would push the inbox past the cap: inbox_full.
 */
export function planUploads(
  files: UploadFile[],
  existing: ExistingPhoto[],
  currentInboxBytes: number,
  makeId: () => string = newPhotoId,
  cap = INBOX_CAP_BYTES,
): { slots: UploadSlot[]; newRows: (UploadFile & { id: string })[] } {
  const bySha = new Map(existing.map((row) => [row.sha256, row]));
  const seen = new Set<string>();
  const slots: UploadSlot[] = [];
  const newRows: (UploadFile & { id: string })[] = [];
  let bytes = currentInboxBytes;

  for (const file of files) {
    const { clientId } = file;
    if (seen.has(file.sha256)) {
      slots.push({ clientId, action: "duplicate" });
      continue;
    }
    seen.add(file.sha256);

    const row = bySha.get(file.sha256);
    if (row && row.status !== "pending") {
      slots.push({ clientId, action: "duplicate" });
    } else if (row) {
      slots.push({ clientId, action: "upload", photoId: row.id });
    } else if (bytes + file.size > cap) {
      slots.push({ clientId, action: "inbox_full" });
    } else {
      const id = makeId();
      bytes += file.size;
      newRows.push({ ...file, id });
      slots.push({ clientId, action: "upload", photoId: id });
    }
  }
  return { slots, newRows };
}

/** Plans the batch, records new photos as pending, and returns one slot per file. */
export async function createUploads(
  db: Db,
  userId: string,
  files: UploadFile[],
): Promise<UploadSlot[]> {
  const shas = [...new Set(files.map((f) => f.sha256))];
  const findExisting = () =>
    db
      .select({ id: photos.id, sha256: photos.sha256, status: photos.status })
      .from(photos)
      .where(inArray(photos.sha256, shas))
      .all();

  const now = Date.now();
  const { slots, newRows } = planUploads(
    files,
    await findExisting(),
    await inboxBytes(db, now),
  );
  if (newRows.length === 0) return slots;

  const inserts = newRows.map((file) =>
    db
      .insert(photos)
      .values({
        id: file.id,
        sha256: file.sha256,
        size: file.size,
        contentType: file.contentType,
        originalName: file.name,
        uploadedBy: userId,
        status: "pending",
        createdAt: now,
      })
      // Someone else may have started the same photo a moment ago.
      .onConflictDoNothing({ target: photos.sha256 }),
  );
  await db.batch(inserts as [(typeof inserts)[number], ...typeof inserts]);

  // Use whichever row actually won for each hash.
  const winners = new Map(
    (await findExisting()).map((row) => [row.sha256, row]),
  );
  const shaByClientId = new Map(files.map((f) => [f.clientId, f.sha256]));
  return slots.map((slot) => {
    if (slot.action !== "upload") return slot;
    const winner = winners.get(shaByClientId.get(slot.clientId) ?? "");
    if (!winner) return { clientId: slot.clientId, action: "inbox_full" };
    if (winner.status !== "pending")
      return { clientId: slot.clientId, action: "duplicate" };
    return { ...slot, photoId: winner.id };
  });
}
