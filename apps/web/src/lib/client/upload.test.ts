import { describe, expect, it, vi } from "vitest";
import { HttpError, detectType, runPool, withRetry } from "./upload.ts";

describe("detectType", () => {
  it("trusts a supported browser type", () => {
    expect(detectType("x.bin", "image/png")).toBe("image/png");
  });

  it("falls back to the extension when the browser doesn't know (HEIC on some browsers)", () => {
    expect(detectType("IMG_0001.HEIC", "")).toBe("image/heic");
  });

  it("rejects videos and unknown files", () => {
    expect(detectType("clip.mov", "video/quicktime")).toBeNull();
    expect(detectType("notes.txt", "text/plain")).toBeNull();
  });
});

describe("withRetry", () => {
  const sleep = vi.fn(async () => {});

  it("retries network failures, then succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        if (++calls < 3) throw new Error("Network error");
        return "ok";
      },
      { sleep },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("doesn't retry a client error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new HttpError(400, "bad");
        },
        { sleep },
      ),
    ).rejects.toThrow("bad");
    expect(calls).toBe(1);
  });

  it("gives up after the last attempt", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new HttpError(503, "down");
        },
        { attempts: 3, sleep },
      ),
    ).rejects.toThrow("down");
    expect(calls).toBe(3);
  });
});

describe("runPool", () => {
  it("runs every item with limited concurrency", async () => {
    let active = 0;
    let peak = 0;
    const done: number[] = [];
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      done.push(n);
      active--;
    });
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBe(3);
  });
});
