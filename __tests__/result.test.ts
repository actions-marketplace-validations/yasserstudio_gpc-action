import { describe, it, expect } from "vitest";
import { parseResult, summarizeResult } from "../src/result";

describe("parseResult", () => {
  it("parses a whole-buffer JSON object", () => {
    expect(parseResult('{"versionCode":42,"track":"internal"}')).toEqual({
      versionCode: 42,
      track: "internal",
    });
  });

  it("parses pretty-printed JSON amid leading log output", () => {
    const out = [
      "Processing bundle...",
      "done",
      "{",
      '  "versionCode": 7,',
      '  "track": "beta"',
      "}",
    ].join("\n");
    expect(parseResult(out)).toEqual({ versionCode: 7, track: "beta" });
  });

  it("returns null for non-object JSON", () => {
    expect(parseResult("[1,2,3]")).toBeNull();
    expect(parseResult('"a string"')).toBeNull();
    expect(parseResult("42")).toBeNull();
  });

  it("returns null when there is no JSON", () => {
    expect(parseResult("just some logs\nno json here")).toBeNull();
    expect(parseResult("")).toBeNull();
  });
});

describe("summarizeResult", () => {
  it("summarizes a normal upload", () => {
    expect(summarizeResult({ versionCode: 12, track: "internal", status: "draft" })).toEqual({
      dryRun: false,
      versionCode: "12",
      track: "internal",
      status: "draft",
    });
  });

  it("summarizes a dry-run (status nested under plannedRelease, no versionCode)", () => {
    const result = {
      dryRun: true,
      track: "production",
      plannedRelease: { status: "inProgress" },
    };
    expect(summarizeResult(result)).toEqual({
      dryRun: true,
      track: "production",
      status: "inProgress",
    });
  });
});
