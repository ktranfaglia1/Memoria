import {
  MAX_FILES_PER_BATCH,
  MAX_PHOTO_BYTES,
  PHOTO_TYPES,
  UploadResponse,
  type PhotoType,
  type UploadFile,
  type UploadSlot,
} from "@memoria/shared";

const EXTENSION_TYPES: Record<string, PhotoType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  heic: "image/heic",
  heif: "image/heif",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  tif: "image/tiff",
  tiff: "image/tiff",
  dng: "image/x-adobe-dng",
};

/** The photo's type, from the browser or (when it doesn't know) the extension. */
export function detectType(
  name: string,
  browserType: string,
): PhotoType | null {
  if (browserType in PHOTO_TYPES) return browserType as PhotoType;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
}

export function unsupportedReason(file: File): string | null {
  if (!detectType(file.name, file.type)) return "Not a supported photo type";
  if (file.size === 0) return "Empty file";
  if (file.size > MAX_PHOTO_BYTES) return "Larger than 75 MB";
  return null;
}

export async function sha256OfFile(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Network failures, server errors, rate limits and failed integrity checks are worth retrying. */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof HttpError)) return true;
  return (
    error.status >= 500 ||
    error.status === 408 ||
    error.status === 429 ||
    error.status === 422
  );
}

export async function withRetry<T>(
  task: () => Promise<T>,
  { attempts = 4, baseDelayMs = 1000, sleep = defaultSleep } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      await sleep(baseDelayMs * 3 ** (attempt - 1));
    }
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

/** Step 1: ask the API which files to send. */
export async function requestSlots(files: UploadFile[]): Promise<UploadSlot[]> {
  const slots: UploadSlot[] = [];
  for (let i = 0; i < files.length; i += MAX_FILES_PER_BATCH) {
    const batch = files.slice(i, i + MAX_FILES_PER_BATCH);
    const response = await withRetry(async () => {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: batch }),
      });
      if (!res.ok) throw new HttpError(res.status, await errorMessage(res));
      return res;
    });
    slots.push(...UploadResponse.parse(await response.json()).slots);
  }
  return slots;
}

/** Step 2: send one photo's bytes. XHR rather than fetch, for upload progress. */
export function putPhoto(
  photoId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/uploads/${photoId}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = xhr.statusText;
      try {
        message =
          (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        // keep statusText
      }
      reject(new HttpError(xhr.status, message));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Timed out"));
    xhr.timeout = 10 * 60 * 1000;
    xhr.send(file);
  });
}

/** Runs tasks with at most `limit` in flight. */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) await worker(items[next++]!);
    },
  );
  await Promise.all(lanes);
}
