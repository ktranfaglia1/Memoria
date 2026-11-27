import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

const token = "t".repeat(43);

describe("loadConfig", () => {
  it("uses the production API and a 5 minute poll by default", () => {
    const config = loadConfig({}, { libraryDir: "D:\\Memoria", token });
    expect(config.apiUrl).toBe("https://memoria.kyletranfaglia.top");
    expect(config.pollMinutes).toBe(5);
  });

  it("lets environment variables override the file", () => {
    const config = loadConfig(
      { MEMORIA_LIBRARY_DIR: "E:\\Other", MEMORIA_POLL_MINUTES: "15" },
      { libraryDir: "D:\\Memoria", token },
    );
    expect(config.libraryDir).toBe("E:\\Other");
    expect(config.pollMinutes).toBe(15);
  });

  it("requires a library folder and a token", () => {
    expect(() => loadConfig({}, { token })).toThrow();
    expect(() => loadConfig({}, { libraryDir: "D:\\Memoria" })).toThrow();
  });

  it("rejects an invalid API URL", () => {
    expect(() =>
      loadConfig(
        { MEMORIA_API_URL: "not a url" },
        { libraryDir: "D:\\", token },
      ),
    ).toThrow();
  });
});
