/**
 * Build the child environment for gpc. gpc lets an active config profile override the
 * GPC_SERVICE_ACCOUNT/GPC_APP env vars, so we point XDG_CONFIG_HOME at an isolated
 * (empty) directory and drop GPC_PROFILE. That guarantees the explicit credentials and
 * target app win on ANY runner -- including self-hosted ones that already have a gpc
 * profile configured (otherwise the action could publish to the wrong app).
 */
export function buildChildEnv(
  serviceAccount: string,
  packageName: string,
  configDir: string,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "GPC_PROFILE") env[key] = value;
  }
  env.XDG_CONFIG_HOME = configDir;
  env.GPC_SERVICE_ACCOUNT = serviceAccount;
  env.GPC_APP = packageName;
  return env;
}
