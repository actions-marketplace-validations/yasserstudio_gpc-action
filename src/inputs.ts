import * as core from "@actions/core";

/** A fully resolved invocation plan for the gpc binary. */
export interface Plan {
  serviceAccount: string;
  packageName: string;
  file: string;
  /** Flags appended to `gpc releases upload <file> --ci`. */
  flags: string[];
  preflight: boolean;
  preflightFailOn: string;
  gpcVersion: string;
  workingDirectory: string;
  /** When non-empty, run `gpc <rawArgs>` and ignore the opinionated mapping. */
  rawArgs: string[];
}

/** r0adkll input names that GPC's `releases upload` has no equivalent for. */
const UNSUPPORTED = ["tracks", "existingEditId", "debugSymbols"];

/** Read a canonical input, falling back to compatibility aliases. */
function alias(canonical: string, ...aliases: string[]): string {
  const primary = core.getInput(canonical);
  if (primary) return primary;
  for (const a of aliases) {
    const v = core.getInput(a);
    if (v) return v;
  }
  return "";
}

function parseBool(v: string): boolean {
  return /^(true|1|yes)$/i.test(v.trim());
}

/** Build the gpc invocation plan from the action inputs. Throws on missing required inputs. */
export function buildPlan(): Plan {
  const serviceAccount = alias(
    "service-account-json",
    "serviceAccountJson",
    "serviceAccountJsonPlainText",
  );
  if (!serviceAccount) {
    throw new Error(
      'Missing required input "service-account-json" (service account JSON key contents).',
    );
  }

  const packageName = alias("package-name", "packageName");
  if (!packageName) {
    throw new Error('Missing required input "package-name" (e.g. com.example.app).');
  }

  const gpcVersion = core.getInput("gpc-version");
  const workingDirectory = core.getInput("working-directory");

  // Escape hatch: run an arbitrary gpc command, skip the opinionated upload mapping.
  const rawArgsInput = core.getInput("args");
  if (rawArgsInput) {
    return {
      serviceAccount,
      packageName,
      file: "",
      flags: [],
      preflight: false,
      preflightFailOn: "error",
      gpcVersion,
      workingDirectory,
      rawArgs: splitArgs(rawArgsInput),
    };
  }

  const releaseFiles = alias("release-files", "releaseFiles", "releaseFile");
  if (!releaseFiles) {
    throw new Error('Missing required input "release-files" (path to the .aab/.apk).');
  }
  const file = pickSingleFile(releaseFiles);

  for (const u of UNSUPPORTED) {
    if (core.getInput(u)) {
      core.warning(`Input "${u}" is not supported by gpc-action v1 and will be ignored.`);
    }
  }

  const flags: string[] = [];
  const push = (flag: string, value: string) => {
    if (value) flags.push(flag, value);
  };

  push("--track", core.getInput("track"));
  push("--status", core.getInput("status"));
  push("--rollout", resolveRollout());
  push("--notes", core.getInput("release-notes"));
  push("--notes-dir", alias("release-notes-dir", "whatsNewDirectory"));
  push("--name", alias("name", "releaseName"));
  push("--mapping", alias("mapping", "mappingFile"));
  push("--in-app-update-priority", alias("in-app-update-priority", "inAppUpdatePriority"));
  push("--retain-version-codes", alias("retain-version-codes", "versionCodesToRetain"));

  if (parseBool(alias("changes-not-sent-for-review", "changesNotSentForReview"))) {
    flags.push("--changes-not-sent-for-review");
  }

  // Non-destructive preview: validate against Play without committing a release.
  if (parseBool(core.getInput("dry-run"))) {
    flags.push("--dry-run");
  }

  const preflightRaw = core.getInput("preflight");
  const preflight = preflightRaw === "" ? true : parseBool(preflightRaw);
  const preflightFailOn = core.getInput("preflight-fail-on") || "error";

  return {
    serviceAccount,
    packageName,
    file,
    flags,
    preflight,
    preflightFailOn,
    gpcVersion,
    workingDirectory,
    rawArgs: [],
  };
}

/** Resolve `rollout` (percent) or convert r0adkll's `userFraction` (0.0-1.0) to a percent. */
export function resolveRollout(): string {
  const rollout = core.getInput("rollout");
  if (rollout) return rollout;

  const fraction = alias("user-fraction", "userFraction");
  if (!fraction) return "";

  const f = Number(fraction);
  if (Number.isNaN(f) || f <= 0 || f > 1) {
    throw new Error(`user-fraction must be a number between 0 and 1 (got "${fraction}").`);
  }
  // Convert to percent, preserving small fractions and avoiding float noise.
  const pct = Math.round(f * 100 * 1e4) / 1e4;
  core.info(`Converted user-fraction ${fraction} to --rollout ${pct} (percent)`);
  return String(pct);
}

/** Take a single file path from a CSV/newline list, warning on multiple files or globs. */
export function pickSingleFile(input: string): string {
  const parts = input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.some((p) => /[*?[\]]/.test(p))) {
    core.warning(
      "Glob patterns in release-files are not supported in gpc-action v1; pass an explicit file path.",
    );
  }
  if (parts.length > 1) {
    core.warning(
      `gpc-action v1 uploads a single file; using the first of ${parts.length}: ${parts[0]}`,
    );
  }
  return parts[0] ?? "";
}

/** Split a command string into argv, honoring simple single/double quoting. */
export function splitArgs(input: string): string[] {
  const matches = input.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return matches.map((m) => m.replace(/^["']|["']$/g, ""));
}
