import type { UploadFile } from "@memoria/shared";
import { describe, expect, it } from "vitest";
import { planUploads } from "./uploads.ts";

const file = (n: number, size = 1000): UploadFile => ({
  clientId: `c${n}`,
  sha256: String(n).padStart(64, "0"),
  size,
  contentType: "image/jpeg",
  name: `IMG_${n}.JPG`,
});

let counter = 0;
const makeId = () => `id${++counter}`;

describe("planUploads", () => {
  it("uploads new photos", () => {
    const { slots, newRows } = planUploads([file(1), file(2)], [], 0, makeId);
    expect(slots.map((s) => s.action)).toEqual(["upload", "upload"]);
    expect(newRows).toHaveLength(2);
  });

  it("skips photos already in the library", () => {
    const existing = [
      { id: "old", sha256: file(1).sha256, status: "on_drive" },
    ];
    const { slots, newRows } = planUploads([file(1)], existing, 0, makeId);
    expect(slots).toEqual([{ clientId: "c1", action: "duplicate" }]);
    expect(newRows).toHaveLength(0);
  });

  it("resumes an unfinished upload into the same row", () => {
    const existing = [
      { id: "half", sha256: file(1).sha256, status: "pending" },
    ];
    const { slots, newRows } = planUploads([file(1)], existing, 0, makeId);
    expect(slots).toEqual([
      { clientId: "c1", action: "upload", photoId: "half" },
    ]);
    expect(newRows).toHaveLength(0);
  });

  it("treats a repeat within one batch as a duplicate", () => {
    const repeat = { ...file(1), clientId: "again" };
    const { slots } = planUploads([file(1), repeat], [], 0, makeId);
    expect(slots[1]).toEqual({ clientId: "again", action: "duplicate" });
  });

  it("stops at the inbox cap but still fits smaller files", () => {
    const { slots } = planUploads(
      [file(1, 600), file(2, 600), file(3, 300)],
      [],
      100,
      makeId,
      1000,
    );
    expect(slots.map((s) => s.action)).toEqual([
      "upload",
      "inbox_full",
      "upload",
    ]);
  });
});
