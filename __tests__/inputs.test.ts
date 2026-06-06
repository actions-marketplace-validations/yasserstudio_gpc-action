import { describe, it, expect, beforeEach } from "vitest";
import { buildPlan, resolveRollout, pickSingleFile, splitArgs } from "../src/inputs";

function setInput(name: string, value: string): void {
  process.env[`INPUT_${name.replace(/ /g, "_").toUpperCase()}`] = value;
}

function clearInputs(): void {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("INPUT_")) delete process.env[k];
  }
}

describe("buildPlan", () => {
  beforeEach(clearInputs);

  it("maps canonical inputs to gpc flags", () => {
    setInput("service-account-json", '{"type":"service_account"}');
    setInput("package-name", "com.example.app");
    setInput("release-files", "app-release.aab");
    setInput("track", "internal");
    setInput("status", "draft");
    setInput("rollout", "25");
    setInput("release-notes", "hello");
    setInput("in-app-update-priority", "3");

    const plan = buildPlan();
    expect(plan.packageName).toBe("com.example.app");
    expect(plan.file).toBe("app-release.aab");
    expect(plan.preflight).toBe(true);
    expect(plan.preflightFailOn).toBe("error");
    expect(plan.flags).toEqual([
      "--track",
      "internal",
      "--status",
      "draft",
      "--rollout",
      "25",
      "--notes",
      "hello",
      "--in-app-update-priority",
      "3",
    ]);
  });

  it("accepts r0adkll camelCase aliases and converts userFraction", () => {
    setInput("serviceAccountJson", '{"type":"service_account"}');
    setInput("packageName", "com.example.app");
    setInput("releaseFiles", "app.aab");
    setInput("userFraction", "0.1");
    setInput("whatsNewDirectory", "distribution/whatsnew");
    setInput("releaseName", "1.2.3");
    setInput("changesNotSentForReview", "true");

    const plan = buildPlan();
    expect(plan.file).toBe("app.aab");
    expect(plan.flags).toEqual([
      "--rollout",
      "10",
      "--notes-dir",
      "distribution/whatsnew",
      "--name",
      "1.2.3",
      "--changes-not-sent-for-review",
    ]);
  });

  it("appends --dry-run when dry-run is set", () => {
    setInput("service-account-json", "{}");
    setInput("package-name", "com.example.app");
    setInput("release-files", "app.aab");
    setInput("dry-run", "true");
    const plan = buildPlan();
    expect(plan.flags).toContain("--dry-run");
  });

  it("throws when service-account-json is missing", () => {
    setInput("package-name", "com.example.app");
    setInput("release-files", "app.aab");
    expect(() => buildPlan()).toThrow(/service-account-json/);
  });

  it("throws when package-name is missing", () => {
    setInput("service-account-json", "{}");
    setInput("release-files", "app.aab");
    expect(() => buildPlan()).toThrow(/package-name/);
  });

  it("throws when release-files is missing and no args", () => {
    setInput("service-account-json", "{}");
    setInput("package-name", "com.example.app");
    expect(() => buildPlan()).toThrow(/release-files/);
  });

  it("uses the args escape hatch and skips upload mapping", () => {
    setInput("service-account-json", "{}");
    setInput("package-name", "com.example.app");
    setInput("args", "releases promote --from internal --to production");

    const plan = buildPlan();
    expect(plan.rawArgs).toEqual([
      "releases",
      "promote",
      "--from",
      "internal",
      "--to",
      "production",
    ]);
    expect(plan.file).toBe("");
    expect(plan.flags).toEqual([]);
  });
});

describe("resolveRollout", () => {
  beforeEach(clearInputs);

  it("prefers an explicit percentage", () => {
    setInput("rollout", "50");
    setInput("userFraction", "0.1");
    expect(resolveRollout()).toBe("50");
  });

  it("converts a fraction to a percentage", () => {
    setInput("userFraction", "0.25");
    expect(resolveRollout()).toBe("25");
  });

  it("preserves sub-percent fractions without float noise", () => {
    setInput("userFraction", "0.155");
    expect(resolveRollout()).toBe("15.5");
  });

  it("rejects an out-of-range fraction", () => {
    setInput("user-fraction", "1.5");
    expect(() => resolveRollout()).toThrow(/between 0 and 1/);
  });
});

describe("pickSingleFile", () => {
  beforeEach(clearInputs);

  it("returns the only file", () => {
    expect(pickSingleFile("app.aab")).toBe("app.aab");
  });

  it("returns the first of several", () => {
    expect(pickSingleFile("a.aab, b.aab")).toBe("a.aab");
  });
});

describe("splitArgs", () => {
  it("splits on whitespace", () => {
    expect(splitArgs("releases upload app.aab")).toEqual(["releases", "upload", "app.aab"]);
  });

  it("honors quotes", () => {
    expect(splitArgs('--notes "hello world"')).toEqual(["--notes", "hello world"]);
  });
});
