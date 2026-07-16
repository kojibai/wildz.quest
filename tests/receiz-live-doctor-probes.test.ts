import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const STRICT_ENVIRONMENT = [
  "NEXT_PUBLIC_RECEIZ_MODE",
  "RECEIZ_BASE_URL",
  "RECEIZ_CLIENT_ID",
  "RECEIZ_CLIENT_SECRET",
  "RECEIZ_OAUTH_STATE_SECRET",
  "NEXT_PUBLIC_AUTH_MODE",
  "RECEIZ_AUTH_MODE",
  "RECEIZ_ID_CALLBACK_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_CHECKOUT_MODE",
  "RECEIZ_CHECKOUT_MODE",
  "RECEIZ_ACCESS_TOKEN",
  "WILDS_PULSE_TICK_SECRET",
  "RECEIZ_CONNECT_ACCESS_TOKEN"
] as const;

function strictEnvironment(accessToken: string, acceptedToken: string) {
  const env = { ...process.env };
  for (const key of STRICT_ENVIRONMENT) delete env[key];
  const loader = pathToFileURL(resolve("scripts/test-fixtures/receiz-live-probe-fetch.mjs")).href;
  return {
    ...env,
    NODE_OPTIONS: `--import=${loader}`,
    RECEIZ_DOCTOR_TEST_TOKEN: acceptedToken,
    NEXT_PUBLIC_RECEIZ_MODE: "live",
    RECEIZ_BASE_URL: "https://receiz-doctor.test",
    RECEIZ_CLIENT_ID: "wildz.quest",
    RECEIZ_CLIENT_SECRET: "test-client-secret-not-for-output",
    RECEIZ_OAUTH_STATE_SECRET: "test-oauth-state-secret-longer-than-thirty-two-bytes",
    NEXT_PUBLIC_AUTH_MODE: "receiz_id",
    RECEIZ_AUTH_MODE: "receiz_id",
    RECEIZ_ID_CALLBACK_URL: "https://wildz.quest/api/auth/receiz/callback",
    NEXT_PUBLIC_SITE_URL: "https://wildz.quest",
    NEXT_PUBLIC_CHECKOUT_MODE: "receiz",
    RECEIZ_CHECKOUT_MODE: "receiz",
    RECEIZ_ACCESS_TOKEN: accessToken,
    WILDS_PULSE_TICK_SECRET: "test-pulse-secret-longer-than-thirty-two-bytes",
    RECEIZ_CONNECT_ACCESS_TOKEN: accessToken
  };
}

test("strict-live doctor proves bounded authenticated read rails", () => {
  const token = "test-release-token-that-must-not-print";
  const result = spawnSync(process.execPath, ["scripts/receiz-doctor.mjs", "--strict-live"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: strictEnvironment(token, token)
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    ok: boolean;
    liveProbes: Record<string, string>;
    liveProbeIssueCodes: string[];
  };
  assert.equal(report.ok, true);
  assert.deepEqual(Object.keys(report.liveProbes).sort(), [
    "identity",
    "payments",
    "portability",
    "proofStore",
    "releases",
    "wallet",
    "world"
  ]);
  assert.ok(Object.values(report.liveProbes).every((status) => status === "verified"));
  assert.deepEqual(report.liveProbeIssueCodes, []);
  assert.equal(`${result.stdout}${result.stderr}`.includes(token), false);
});

test("strict-live doctor rejects a configured but unauthenticated token", () => {
  const rejected = "test-rejected-token-that-must-not-print";
  const accepted = "different-test-token";
  const result = spawnSync(process.execPath, ["scripts/receiz-doctor.mjs", "--strict-live"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: strictEnvironment(rejected, accepted)
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    ok: boolean;
    liveProbes: Record<string, string>;
    liveProbeIssueCodes: string[];
  };
  assert.equal(report.ok, false);
  assert.ok(Object.values(report.liveProbes).some((status) => status === "failed"));
  assert.ok(report.liveProbeIssueCodes.length > 0);
  assert.equal(`${result.stdout}${result.stderr}`.includes(rejected), false);
  assert.equal(`${result.stdout}${result.stderr}`.includes(accepted), false);
});
