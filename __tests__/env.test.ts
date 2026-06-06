import { describe, it, expect, afterEach } from "vitest";
import { buildChildEnv } from "../src/env";

describe("buildChildEnv", () => {
  afterEach(() => {
    delete process.env.GPC_PROFILE;
  });

  it("sets the credential, app, and isolated config dir", () => {
    const env = buildChildEnv("{json}", "com.example.app", "/tmp/isolated");
    expect(env.GPC_SERVICE_ACCOUNT).toBe("{json}");
    expect(env.GPC_APP).toBe("com.example.app");
    expect(env.XDG_CONFIG_HOME).toBe("/tmp/isolated");
  });

  it("drops an ambient GPC_PROFILE so it cannot shadow the explicit credentials", () => {
    process.env.GPC_PROFILE = "some-profile";
    const env = buildChildEnv("{json}", "com.example.app", "/tmp/isolated");
    expect(env.GPC_PROFILE).toBeUndefined();
  });
});
