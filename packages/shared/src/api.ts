import { z } from "zod";
import {
  MAX_FILES_PER_BATCH,
  MAX_PHOTO_BYTES,
  PhotoId,
  PhotoTypeSchema,
  Sha256Hex,
} from "./photos.ts";

// ── Uploads (browser → API) ──────────────────────────────────────────────

export const UploadFile = z.object({
  /** Chosen by the browser so it can match results to files. */
  clientId: z.string().min(1).max(64),
  sha256: Sha256Hex,
  size: z.int().positive().max(MAX_PHOTO_BYTES),
  contentType: PhotoTypeSchema,
  name: z.string().min(1).max(255),
});
export type UploadFile = z.infer<typeof UploadFile>;

export const UploadRequest = z.object({
  files: z.array(UploadFile).min(1).max(MAX_FILES_PER_BATCH),
});
export type UploadRequest = z.infer<typeof UploadRequest>;

/**
 * What to do with each file:
 * - upload: send the bytes with `PUT /api/uploads/<photoId>`
 * - duplicate: the library already has this photo; skip it
 * - inbox_full: the cloud inbox is full until the home PC syncs
 */
export const UploadSlot = z.discriminatedUnion("action", [
  z.object({
    clientId: z.string(),
    action: z.literal("upload"),
    photoId: PhotoId,
  }),
  z.object({ clientId: z.string(), action: z.literal("duplicate") }),
  z.object({ clientId: z.string(), action: z.literal("inbox_full") }),
]);
export type UploadSlot = z.infer<typeof UploadSlot>;

export const UploadResponse = z.object({ slots: z.array(UploadSlot) });
export type UploadResponse = z.infer<typeof UploadResponse>;

// ── Sync agent (home PC → API) ───────────────────────────────────────────

export const QueuedPhoto = z.object({
  id: PhotoId,
  sha256: Sha256Hex,
  size: z.int().positive(),
  contentType: PhotoTypeSchema,
  originalName: z.string(),
  /** When the upload finished (ms since epoch); the fallback "date taken". */
  uploadedAt: z.int(),
});
export type QueuedPhoto = z.infer<typeof QueuedPhoto>;

export const AgentQueueResponse = z.object({ photos: z.array(QueuedPhoto) });
export type AgentQueueResponse = z.infer<typeof AgentQueueResponse>;

export const ArchivedRequest = z.object({
  sha256: Sha256Hex,
  /** Relative to the library folder, e.g. Photos/2026/2026-11-27_<id>.heic */
  drivePath: z
    .string()
    .regex(/^Photos\/\d{4}\/\d{4}-\d{2}-\d{2}_[a-z2-7]{16}\.[a-z]+$/),
  /** From the photo's EXIF data, when it has one (ms since epoch). */
  takenAt: z.int().nullable(),
});
export type ArchivedRequest = z.infer<typeof ArchivedRequest>;

export const ApiError = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiError>;
