import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { libraryPath, type QueuedPhoto } from "@memoria/shared";
import type { AgentApi } from "./api.ts";

/** Reads the photo's "date taken" (ms since epoch), or null when it has none. */
export type ReadTakenAt = (path: string) => Promise<number | null>;

export type Log = (message: string) => void;

const TMP_DIR = ".memoria-tmp";

export async function sha256OfFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path))
    hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Streams a download to `path`, returning its SHA-256 and size. Flushed to disk before returning. */
async function download(stream: ReadableStream<Uint8Array>, path: string) {
  const hash = createHash("sha256");
  let size = 0;
  const file = await open(path, "w");
  try {
    for await (const chunk of stream) {
      hash.update(chunk);
      size += chunk.byteLength;
      await file.write(chunk);
    }
    await file.sync();
  } finally {
    await file.close();
  }
  return { sha256: hash.digest("hex"), size };
}

/**
 * Saves one photo to the library and marks it archived. Safe to repeat: if a
 * crash happened after the file was saved, the next run finds the identical
 * file and only reports it. Never overwrites a different file.
 */
export async function savePhoto(
  api: AgentApi,
  libraryDir: string,
  photo: QueuedPhoto,
  readTakenAt: ReadTakenAt,
): Promise<string> {
  const tmpDir = join(libraryDir, TMP_DIR);
  await mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `${photo.id}.part`);

  try {
    const received = await download(await api.download(photo.id), tmpPath);
    if (received.size !== photo.size || received.sha256 !== photo.sha256) {
      throw new Error(
        `${photo.id}: download doesn't match its hash; will retry`,
      );
    }

    const takenAt = await readTakenAt(tmpPath).catch(() => null);
    const drivePath = libraryPath(
      new Date(takenAt ?? photo.uploadedAt),
      photo.id,
      photo.contentType,
    );
    const finalPath = join(libraryDir, ...drivePath.split("/"));

    if (await exists(finalPath)) {
      if ((await sha256OfFile(finalPath)) !== photo.sha256) {
        throw new Error(
          `${drivePath} already exists with different contents; not overwriting`,
        );
      }
      await rm(tmpPath, { force: true });
    } else {
      await mkdir(dirname(finalPath), { recursive: true });
      await rename(tmpPath, finalPath);
      // Read it back from the drive: the hash must still match.
      if ((await sha256OfFile(finalPath)) !== photo.sha256) {
        await rm(finalPath, { force: true });
        throw new Error(
          `${drivePath} failed verification after saving; will retry`,
        );
      }
    }

    const sidecar = {
      id: photo.id,
      sha256: photo.sha256,
      size: photo.size,
      contentType: photo.contentType,
      originalName: photo.originalName,
      uploadedAt: new Date(photo.uploadedAt).toISOString(),
      takenAt: takenAt === null ? null : new Date(takenAt).toISOString(),
    };
    const sidecarTmp = join(tmpDir, `${photo.id}.json.part`);
    await writeFile(sidecarTmp, `${JSON.stringify(sidecar, null, 2)}\n`);
    await rename(sidecarTmp, `${finalPath}.json`);

    await api.markArchived(photo.id, {
      sha256: photo.sha256,
      drivePath,
      takenAt,
    });
    return drivePath;
  } finally {
    await rm(tmpPath, { force: true });
  }
}

export interface SyncResult {
  saved: number;
  failed: number;
}

/** Saves everything in the queue. A photo that fails is retried on the next run. */
export async function syncOnce(
  api: AgentApi,
  libraryDir: string,
  readTakenAt: ReadTakenAt,
  log: Log = console.log,
): Promise<SyncResult> {
  const failedIds = new Set<string>();
  // Each photo is tried at most once per run, so a stuck one can't loop forever.
  const triedIds = new Set<string>();
  let saved = 0;

  for (;;) {
    const queue = (await api.queue()).filter(
      (photo) => !triedIds.has(photo.id),
    );
    if (queue.length === 0) break;

    for (const photo of queue) {
      triedIds.add(photo.id);
      try {
        const path = await savePhoto(api, libraryDir, photo, readTakenAt);
        saved++;
        log(`saved ${path}`);
      } catch (error) {
        failedIds.add(photo.id);
        log(`failed ${photo.id}: ${(error as Error).message}`);
      }
    }
  }
  return { saved, failed: failedIds.size };
}
