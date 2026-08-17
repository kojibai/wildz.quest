#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const strictLive = process.argv.includes("--strict-live");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ["scripts/next-runtime-guard.mjs", "assert-idle"]);
run("pnpm", ["receiz:architecture-lock"]);
run("pnpm", ["test"]);
run("pnpm", ["typecheck"]);
run("pnpm", ["receiz:check"]);
run("pnpm", ["receiz:conformance"]);
run("pnpm", ["lint"]);
run("pnpm", ["secret:scan"]);
run("pnpm", ["build"]);
run("pnpm", [strictLive ? "receiz:doctor:strict" : "receiz:doctor"]);
