/** A normalized view of a gpc upload/dry-run result for outputs and logging. */
export interface ResultSummary {
  dryRun: boolean;
  versionCode?: string;
  track?: string;
  status?: string;
}

/**
 * Parse the gpc `--ci` JSON result from stdout. gpc prints pretty (multi-line) JSON,
 * so we parse the whole buffer first, then fall back to the largest `{...}` span if
 * there is surrounding noise. Only plain objects are accepted.
 */
export function parseResult(stdout: string): Record<string, unknown> | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;

  const asObject = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  try {
    return asObject(JSON.parse(trimmed));
  } catch {
    // fall through to span extraction
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return asObject(JSON.parse(trimmed.slice(start, end + 1)));
    } catch {
      // give up
    }
  }
  return null;
}

/**
 * Normalize a gpc result into outputs. A normal upload exposes `versionCode`/`status`
 * at the top level; a dry-run exposes `dryRun: true` with `status` nested under
 * `plannedRelease` and no version code.
 */
export function summarizeResult(result: Record<string, unknown>): ResultSummary {
  const dryRun = result.dryRun === true;
  const track = typeof result.track === "string" ? result.track : undefined;

  if (dryRun) {
    const planned = result.plannedRelease as Record<string, unknown> | undefined;
    const status = planned && typeof planned.status === "string" ? planned.status : undefined;
    return { dryRun, track, status };
  }

  return {
    dryRun,
    versionCode: result.versionCode != null ? String(result.versionCode) : undefined,
    track,
    status: typeof result.status === "string" ? result.status : undefined,
  };
}
