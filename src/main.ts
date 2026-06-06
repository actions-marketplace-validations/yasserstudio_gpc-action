import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildPlan } from "./inputs";
import { resolveGpcBinary } from "./gpc";
import { parseResult, summarizeResult } from "./result";
import { buildChildEnv } from "./env";

/** Capture stdout from a gpc invocation and set the result-derived outputs. */
function applyOutputs(stdout: string): void {
  const result = parseResult(stdout);
  if (!result) return;
  core.setOutput("result", JSON.stringify(result));

  const summary = summarizeResult(result);
  if (summary.versionCode) core.setOutput("version-code", summary.versionCode);
  if (summary.track) core.setOutput("track", summary.track);
  if (summary.status) core.setOutput("status", summary.status);

  if (summary.dryRun) {
    core.info(`Dry run: validated for track ${summary.track ?? "?"}; no release committed.`);
  } else {
    core.info(
      `Uploaded versionCode ${summary.versionCode ?? "?"} to track ${summary.track ?? "?"}.`,
    );
  }
}

async function run(): Promise<void> {
  try {
    const plan = buildPlan();

    // Mask the credential so it can never surface in logs, then pass it via env.
    core.setSecret(plan.serviceAccount);
    const configDir = fs.mkdtempSync(
      path.join(process.env.RUNNER_TEMP || os.tmpdir(), "gpc-action-"),
    );
    const env = buildChildEnv(plan.serviceAccount, plan.packageName, configDir);

    const bin = await resolveGpcBinary(plan.gpcVersion);
    const baseOptions: exec.ExecOptions = { env, ignoreReturnCode: true };
    if (plan.workingDirectory) baseOptions.cwd = plan.workingDirectory;

    const runGpc = async (args: string[]): Promise<{ code: number; stdout: string }> => {
      let stdout = "";
      const code = await exec.exec(bin, args, {
        ...baseOptions,
        listeners: { stdout: (data: Buffer) => (stdout += data.toString()) },
      });
      return { code, stdout };
    };

    // Escape hatch: run an arbitrary gpc command, still wiring outputs.
    if (plan.rawArgs.length > 0) {
      core.setOutput("preflight-passed", "skipped");
      const { code, stdout } = await runGpc(plan.rawArgs);
      applyOutputs(stdout);
      if (code !== 0) core.setFailed(`gpc exited with code ${code}.`);
      return;
    }

    // Compliance gate. Preflight sets exit code 6 when findings meet the fail threshold.
    if (plan.preflight) {
      const passed = await core.group("Preflight", async () => {
        const code = await exec.exec(
          bin,
          ["preflight", plan.file, "--ci", "--fail-on", plan.preflightFailOn],
          baseOptions,
        );
        return code === 0;
      });
      core.setOutput("preflight-passed", String(passed));
      if (!passed) {
        core.setFailed(
          "Preflight failed. Fix the findings, lower preflight-fail-on, or set preflight: false.",
        );
        return;
      }
    } else {
      core.setOutput("preflight-passed", "skipped");
    }

    // Upload (or dry-run preview).
    const { code, stdout } = await runGpc([
      "releases",
      "upload",
      plan.file,
      "--ci",
      ...plan.flags,
    ]);
    applyOutputs(stdout);
    if (code !== 0) {
      core.setFailed(`gpc releases upload failed (exit ${code}).`);
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

void run();
