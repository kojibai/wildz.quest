import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type PackageManifest = {
  scripts?: Record<string, string>;
};

test("release check runs the deterministic production gates and stops on failure", () => {
  const source = readFileSync("scripts/release-check.mjs", "utf8");
  const commands = [
    'run(process.execPath, ["scripts/next-runtime-guard.mjs", "assert-idle"])',
    'run("pnpm", ["test"])',
    'run("pnpm", ["typecheck"])',
    'run("pnpm", ["lint"])',
    'run("pnpm", ["secret:scan"])',
    'run("pnpm", ["build"])'
  ];

  let priorIndex = -1;
  for (const command of commands) {
    const index = source.indexOf(command);
    assert.ok(index > priorIndex, `${command} must appear once in release order`);
    priorIndex = index;
  }
  assert.match(source, /spawnSync\([\s\S]*stdio:\s*"inherit"/);
  assert.match(source, /if \(result\.status !== 0\) process\.exit\(result\.status \?\? 1\)/);
  assert.match(source, /strictLive \? "receiz:doctor:strict" : "receiz:doctor"/);
  assert.doesNotMatch(source, /release:check|\bdev\b|\bstart\b/);
});

test("package exposes local and strict-live release doctor commands", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as PackageManifest;

  assert.equal(pkg.scripts?.["release:check"], "node scripts/release-check.mjs");
  assert.equal(pkg.scripts?.["receiz:doctor:strict"], "node scripts/receiz-doctor.mjs --strict-live");
});
