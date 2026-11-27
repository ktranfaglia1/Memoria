import { z } from "zod";

/** Uploads pause once originals waiting in the cloud inbox reach this size. */
export const INBOX_CAP_BYTES = 9 * 1024 ** 3;

/** Largest single photo accepted (Workers on the free plan cap request bodies at 100 MB). */
export const MAX_PHOTO_BYTES = 75 * 1024 ** 2;

/** Most files accepted in one upload request. */
export const MAX_FILES_PER_BATCH = 200;

/** Image types accepted in v1, mapped to the extension used on the home drive. */
export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "image/x-adobe-dng": "dng",
} as const;

export type PhotoType = keyof typeof PHOTO_TYPES;

export const PhotoTypeSchema = z.enum(
  Object.keys(PHOTO_TYPES) as [PhotoType, ...PhotoType[]],
);

/**
 * Where a photo is on its way to the home drive.
 * - pending: the row exists and the upload has not finished
 * - in_cloud: the original is in the R2 inbox, waiting for the PC
 * - on_drive: the PC saved it and verified its hash
 */
export const PhotoStatus = z.enum(["pending", "in_cloud", "on_drive"]);
export type PhotoStatus = z.infer<typeof PhotoStatus>;

export const Sha256Hex = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected a lowercase hex SHA-256");

/** Photo ids: 16 characters of lowercase base32 (80 random bits). */
export const PhotoId = z.string().regex(/^[a-z2-7]{16}$/, "invalid photo id");

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export function newPhotoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let id = "";
  for (const byte of bytes) id += ID_ALPHABET[byte & 31];
  return id;
}

/** R2 key of a photo's original while it waits in the inbox. */
export function inboxKey(id: string): string {
  return `inbox/${id}`;
}

/**
 * Path of a photo on the home drive, relative to the library folder:
 * `Photos/YYYY/YYYY-MM-DD_<id>.<ext>`. `date` is read in local time, the way
 * the photo's own "date taken" is written.
 */
export function libraryPath(date: Date, id: string, type: PhotoType): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `Photos/${year}/${year}-${month}-${day}_${id}.${PHOTO_TYPES[type]}`;
}
