import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("uses the production API by default", () => {
    const config = loadConfig({ MEMORIA_LIBRARY_DIR: "D:\\Memoria" });
    expect(config.apiUrl).toBe("https://memoria.kyletranfaglia.top");
    expect(config.libraryDir).toBe("D:\\Memoria");
  });

  it("requires a library folder", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("rejects an invalid API URL", () => {
    expect(() =>
      loadConfig({ MEMORIA_API_URL: "not a url", MEMORIA_LIBRARY_DIR: "D:\\" }),
    ).toThrow();
  });
});
