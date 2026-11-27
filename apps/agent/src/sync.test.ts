import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArchivedRequest, QueuedPhoto } from "@memoria/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentApi } from "./api.ts";
import { savePhoto, syncOnce } from "./sync.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const sha = (data: Uint8Array) =>
  createHash("sha256").update(data).digest("hex");

function photo(id: string, data: Uint8Array): QueuedPhoto {
  return {
    id,
    sha256: sha(data),
    size: data.byteLength,
    contentType: "image/jpeg",
    originalName: "IMG_0001.JPG",
    uploadedAt: new Date(2026, 10, 27, 12).getTime(),
  };
}

/** In-memory server: photos stay queued until marked archived. */
class FakeApi implements AgentApi {
  queued = new Map<string, QueuedPhoto>();
  contents = new Map<string, Uint8Array>();
  archived: { id: string; body: ArchivedRequest }[] = [];
  failArchive = false;

  add(p: QueuedPhoto, data: Uint8Array) {
    this.queued.set(p.id, p);
    this.contents.set(p.id, data);
  }
  async queue() {
    return [...this.queued.values()];
  }
  async download(id: string) {
    const data = this.contents.get(id)!;
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data.slice(0, 3));
        controller.enqueue(data.slice(3));
        controller.close();
      },
    });
  }
  async markArchived(id: string, body: ArchivedRequest) {
    if (this.failArchive) throw new Error("network down");
    this.archived.push({ id, body });
    this.queued.delete(id);
  }
}

const noDate = async () => null;
const silent = () => {};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "memoria-agent-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("savePhoto", () => {
  it("saves under Photos/YYYY with a sidecar and marks it archived", async () => {
    const api = new FakeApi();
    const data = bytes("pretend this is a photo");
    const p = photo("aaaaaaaaaaaaaaaa", data);
    api.add(p, data);

    const path = await savePhoto(api, dir, p, noDate);

    expect(path).toBe("Photos/2026/2026-11-27_aaaaaaaaaaaaaaaa.jpg");
    expect(await readFile(join(dir, path))).toEqual(Buffer.from(data));
    const sidecar = JSON.parse(
      await readFile(join(dir, `${path}.json`), "utf8"),
    );
    expect(sidecar.sha256).toBe(p.sha256);
    expect(api.archived).toEqual([
      { id: p.id, body: { sha256: p.sha256, drivePath: path, takenAt: null } },
    ]);
    expect(await readdir(join(dir, ".memoria-tmp"))).toEqual([]);
  });

  it("files by the photo's date taken when it has one", async () => {
    const api = new FakeApi();
    const data = bytes("old photo");
    const p = photo("bbbbbbbbbbbbbbbb", data);
    api.add(p, data);
    const takenAt = new Date(2019, 6, 4, 18).getTime();

    const path = await savePhoto(api, dir, p, async () => takenAt);

    expect(path).toBe("Photos/2019/2019-07-04_bbbbbbbbbbbbbbbb.jpg");
    expect(api.archived[0]!.body.takenAt).toBe(takenAt);
  });

  it("rejects a corrupted download and leaves nothing behind", async () => {
    const api = new FakeApi();
    const p = photo("cccccccccccccccc", bytes("expected"));
    api.add(p, bytes("tampered"));

    await expect(savePhoto(api, dir, p, noDate)).rejects.toThrow(
      "doesn't match",
    );
    expect(api.archived).toEqual([]);
    expect(await readdir(dir)).toEqual([".memoria-tmp"]);
  });

  it("finishes the job after a crash between saving and reporting", async () => {
    const api = new FakeApi();
    const data = bytes("saved but not reported");
    const p = photo("dddddddddddddddd", data);
    api.add(p, data);

    api.failArchive = true;
    await expect(savePhoto(api, dir, p, noDate)).rejects.toThrow(
      "network down",
    );
    api.failArchive = false;

    const path = await savePhoto(api, dir, p, noDate);
    expect(api.archived).toHaveLength(1);
    expect(await readFile(join(dir, path))).toEqual(Buffer.from(data));
  });

  it("never overwrites a different file", async () => {
    const api = new FakeApi();
    const data = bytes("new photo");
    const p = photo("eeeeeeeeeeeeeeee", data);
    api.add(p, data);
    await mkdir(join(dir, "Photos", "2026"), { recursive: true });
    const existing = join(dir, "Photos/2026/2026-11-27_eeeeeeeeeeeeeeee.jpg");
    await writeFile(existing, "something else");

    await expect(savePhoto(api, dir, p, noDate)).rejects.toThrow(
      "not overwriting",
    );
    expect(await readFile(existing, "utf8")).toBe("something else");
    expect(api.archived).toEqual([]);
  });
});

describe("syncOnce", () => {
  it("saves every queued photo and retries failures only on the next run", async () => {
    const api = new FakeApi();
    for (const id of ["ffffffffffffffff", "gggggggggggggggg"]) {
      const data = bytes(`photo ${id}`);
      api.add(photo(id, data), data);
    }
    const bad = photo("hhhhhhhhhhhhhhhh", bytes("good"));
    api.add(bad, bytes("bad"));

    const result = await syncOnce(api, dir, noDate, silent);

    expect(result).toEqual({ saved: 2, failed: 1 });
    expect([...api.queued.keys()]).toEqual(["hhhhhhhhhhhhhhhh"]);
  });
});
