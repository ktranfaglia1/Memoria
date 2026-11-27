import { describe, expect, it } from "vitest";
import { ArchivedRequest, UploadRequest } from "./api.ts";
import { PhotoId, inboxKey, libraryPath, newPhotoId } from "./photos.ts";

describe("newPhotoId", () => {
  it("makes valid, distinct ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, newPhotoId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(PhotoId.safeParse(id).success).toBe(true);
  });
});

describe("libraryPath", () => {
  it("files photos by local date", () => {
    const date = new Date(2026, 0, 5, 23, 59);
    expect(libraryPath(date, "abcdefghijklmnop", "image/heic")).toBe(
      "Photos/2026/2026-01-05_abcdefghijklmnop.heic",
    );
  });

  it("produces paths the API accepts", () => {
    const drivePath = libraryPath(new Date(), newPhotoId(), "image/jpeg");
    const parsed = ArchivedRequest.safeParse({
      sha256: "a".repeat(64),
      drivePath,
      takenAt: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects paths that escape the library", () => {
    const parsed = ArchivedRequest.safeParse({
      sha256: "a".repeat(64),
      drivePath: "Photos/../../Windows/x.jpg",
      takenAt: null,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("inboxKey", () => {
  it("keeps originals under inbox/", () => {
    expect(inboxKey("abcdefghijklmnop")).toBe("inbox/abcdefghijklmnop");
  });
});

describe("UploadRequest", () => {
  const file = {
    clientId: "1",
    sha256: "b".repeat(64),
    size: 3_000_000,
    contentType: "image/heic",
    name: "IMG_0001.HEIC",
  };

  it("accepts a normal photo", () => {
    expect(UploadRequest.safeParse({ files: [file] }).success).toBe(true);
  });

  it("rejects videos and oversized files", () => {
    expect(
      UploadRequest.safeParse({
        files: [{ ...file, contentType: "video/quicktime" }],
      }).success,
    ).toBe(false);
    expect(
      UploadRequest.safeParse({ files: [{ ...file, size: 200 * 1024 ** 2 }] })
        .success,
    ).toBe(false);
  });

  it("rejects uppercase or short hashes", () => {
    expect(
      UploadRequest.safeParse({ files: [{ ...file, sha256: "B".repeat(64) }] })
        .success,
    ).toBe(false);
  });
});
