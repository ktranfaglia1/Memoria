import { describe, expect, it } from "vitest";
import { HealthResponse, overallStatus } from "./health.ts";

describe("overallStatus", () => {
  it("is ok when every check is ok", () => {
    expect(overallStatus({ database: "ok", storage: "ok" })).toBe("ok");
  });

  it("is error when any check fails", () => {
    expect(overallStatus({ database: "ok", storage: "error" })).toBe("error");
    expect(overallStatus({ database: "error", storage: "ok" })).toBe("error");
  });
});

describe("HealthResponse", () => {
  it("accepts a valid body", () => {
    const body = {
      status: "ok",
      checks: { database: "ok", storage: "ok" },
      schemaVersion: 1,
    };
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it("rejects unknown status values", () => {
    const body = {
      status: "fine",
      checks: { database: "ok", storage: "ok" },
      schemaVersion: 1,
    };
    expect(HealthResponse.safeParse(body).success).toBe(false);
  });
});
