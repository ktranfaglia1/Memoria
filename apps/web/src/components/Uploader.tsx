import { useCallback, useEffect, useRef, useState } from "react";
import type { UploadFile } from "@memoria/shared";
import {
  detectType,
  putPhoto,
  requestSlots,
  runPool,
  sha256OfFile,
  unsupportedReason,
  withRetry,
} from "../lib/client/upload.ts";

type Status =
  | "checking"
  | "waiting"
  | "uploading"
  | "done"
  | "duplicate"
  | "inbox_full"
  | "skipped"
  | "failed";

interface Item {
  id: string;
  file: File;
  status: Status;
  progress: number;
  note?: string;
}

const STATUS_LABEL: Record<Status, string> = {
  checking: "Checking…",
  waiting: "Waiting",
  uploading: "Uploading",
  done: "Uploaded",
  duplicate: "Already in library",
  inbox_full: "Inbox full",
  skipped: "Skipped",
  failed: "Failed",
};

const PARALLEL_UPLOADS = 3;

export default function Uploader() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((all) =>
      all.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  // Uploads only run while the page is open (iOS has no background uploads),
  // so warn before leaving and keep the screen on.
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      ?.request("screen")
      .then((sentinel) => (lock = sentinel))
      .catch(() => {});
    return () => {
      window.removeEventListener("beforeunload", warn);
      void lock?.release();
    };
  }, [busy]);

  async function start(files: File[]) {
    setNotice(null);
    setBusy(true);
    const batch: Item[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "checking",
      progress: 0,
    }));
    setItems((all) => [...batch, ...all]);

    try {
      // Hash one file at a time to keep memory low on phones.
      const requests: UploadFile[] = [];
      for (const item of batch) {
        const reason = unsupportedReason(item.file);
        if (reason) {
          update(item.id, { status: "skipped", note: reason });
          continue;
        }
        requests.push({
          clientId: item.id,
          sha256: await sha256OfFile(item.file),
          size: item.file.size,
          contentType: detectType(item.file.name, item.file.type)!,
          name: item.file.name.slice(0, 255),
        });
      }
      if (requests.length === 0) return;

      const slots = await requestSlots(requests);
      const toUpload: { item: Item; photoId: string }[] = [];
      for (const slot of slots) {
        const item = batch.find((b) => b.id === slot.clientId)!;
        if (slot.action === "upload") {
          update(item.id, { status: "waiting" });
          toUpload.push({ item, photoId: slot.photoId });
        } else {
          update(item.id, {
            status: slot.action,
            progress: slot.action === "duplicate" ? 1 : 0,
          });
        }
      }
      if (slots.some((s) => s.action === "inbox_full")) {
        setNotice(
          "The cloud inbox is full. The rest will upload after the home PC syncs; try again later.",
        );
      }

      await runPool(toUpload, PARALLEL_UPLOADS, async ({ item, photoId }) => {
        update(item.id, { status: "uploading", progress: 0 });
        try {
          await withRetry(() =>
            putPhoto(photoId, item.file, (progress) =>
              update(item.id, { progress }),
            ),
          );
          update(item.id, { status: "done", progress: 1 });
        } catch (error) {
          update(item.id, {
            status: "failed",
            note: error instanceof Error ? error.message : "Upload failed",
          });
        }
      });
    } catch (error) {
      setNotice(
        `Couldn't start the upload: ${error instanceof Error ? error.message : "unknown error"}.`,
      );
      setItems((all) =>
        all.map((item) =>
          item.status === "checking" || item.status === "waiting"
            ? { ...item, status: "failed" }
            : item,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function retryFailed() {
    const failed = items.filter(
      (item) => item.status === "failed" || item.status === "inbox_full",
    );
    setItems((all) => all.filter((item) => !failed.includes(item)));
    void start(failed.map((item) => item.file));
  }

  const count = (...statuses: Status[]) =>
    items.filter((i) => statuses.includes(i.status)).length;
  const finished = count(
    "done",
    "duplicate",
    "skipped",
    "failed",
    "inbox_full",
  );
  const failedCount = count("failed", "inbox_full");

  return (
    <section aria-labelledby="upload-heading" className="mt-8">
      <h2 id="upload-heading" className="sr-only">
        Upload photos
      </h2>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.heic,.heif,.dng"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = "";
          if (files.length > 0) void start(files);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl bg-accent px-5 py-4 text-lg font-semibold text-canvas disabled:opacity-60"
      >
        {busy ? "Uploading… keep this screen open" : "Choose photos"}
      </button>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-line bg-surface p-3 text-sm"
        >
          {notice}
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between text-sm">
            <p aria-live="polite">
              {finished} of {items.length} done · {count("done")} uploaded ·{" "}
              {count("duplicate")} already saved
            </p>
            {!busy && failedCount > 0 && (
              <button
                type="button"
                onClick={retryFailed}
                className="font-medium text-accent"
              >
                Retry {failedCount}
              </button>
            )}
          </div>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{item.file.name}</span>
                  <span className="shrink-0 text-fg-muted">
                    {item.status === "uploading"
                      ? `${Math.round(item.progress * 100)}%`
                      : STATUS_LABEL[item.status]}
                  </span>
                </div>
                {item.note && (
                  <p className="mt-1 text-xs text-fg-muted">{item.note}</p>
                )}
                {item.status === "uploading" && (
                  <div className="mt-2 h-1 overflow-hidden rounded bg-line">
                    <div
                      className="h-full bg-accent transition-[width]"
                      style={{ width: `${item.progress * 100}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
