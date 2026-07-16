import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

function webhookEnvironment(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const env = { ...process.env };
  for (const name of ["RECEIZ_BASE_URL", "RECEIZ_ACCESS_TOKEN", "RECEIZ_WEBHOOK_URL", "RECEIZ_WEBHOOK_EVENT_TYPES"]) {
    delete env[name];
  }
  return { ...env, ...overrides };
}

test("webhook creator fails closed without printing configured credentials", () => {
  const token = ["configured", "webhook", "token", "must", "not", "print"].join("-");
  const result = spawnSync(process.execPath, ["scripts/receiz-create-webhooks.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: webhookEnvironment({ RECEIZ_ACCESS_TOKEN: token })
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout) as { ok: boolean; action: string; missingEnvironment: string[] };
  assert.equal(report.ok, false);
  assert.equal(report.action, "configuration-required");
  assert.ok(report.missingEnvironment.includes("RECEIZ_WEBHOOK_URL"));
  assert.equal(`${result.stdout}${result.stderr}`.includes(token), false);
});

test("webhook creator offers a credential-free non-mutating dry run", () => {
  const token = ["dry", "run", "token", "must", "not", "print"].join("-");
  const result = spawnSync(process.execPath, ["scripts/receiz-create-webhooks.mjs", "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: webhookEnvironment({
      RECEIZ_BASE_URL: "https://receiz.com",
      RECEIZ_ACCESS_TOKEN: token,
      RECEIZ_WEBHOOK_URL: "https://wildz.quest/api/receiz/webhook",
      RECEIZ_WEBHOOK_EVENT_TYPES: "payment.settled,asset.created"
    })
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    action: "dry-run",
    eventCount: 2
  });
  assert.equal(`${result.stdout}${result.stderr}`.includes(token), false);
});

test("webhook creator is idempotent and stores new credentials outside tracked files", () => {
  const source = readFileSync("scripts/receiz-create-webhooks.mjs", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };

  assert.equal(pkg.scripts?.["receiz:webhooks:create"], "node scripts/receiz-create-webhooks.mjs");
  assert.match(source, /webhookEndpoints\.list\(\)/);
  assert.match(source, /webhookEndpoints\.create\(/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /mode:\s*0o600/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:secret|accessToken|credentials)/i);
  assert.doesNotMatch(source, /JSON\.stringify\((?:response|created|credentials)\)/);
});
