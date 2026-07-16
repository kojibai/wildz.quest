import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

function runGit(cwd: string, args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("release secret scan rejects OAuth state and refresh-token environment assignments", () => {
  const script = resolve("scripts/release-secret-scan.mjs");
  for (const name of ["RECEIZ_OAUTH_STATE_SECRET", "RECEIZ_REFRESH_TOKEN"]) {
    const cwd = mkdtempSync(join(tmpdir(), "wildz-secret-scan-"));
    const value = ["fixture", "private", "value", "must", "not", "print"].join("-");
    try {
      runGit(cwd, ["init", "-q"]);
      writeFileSync(join(cwd, "fixture.env"), `${name}=${value}\n`, "utf8");
      runGit(cwd, ["add", "fixture.env"]);

      const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });

      assert.equal(result.status, 1, `${name}: ${result.stderr || result.stdout}`);
      assert.match(result.stderr, /fixture\.env/);
      assert.equal(`${result.stdout}${result.stderr}`.includes(value), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});

test("release secret scan includes untracked release files before they are staged", () => {
  const script = resolve("scripts/release-secret-scan.mjs");
  const cwd = mkdtempSync(join(tmpdir(), "wildz-secret-scan-untracked-"));
  const value = ["untracked", "private", "value", "must", "not", "print"].join("-");
  try {
    runGit(cwd, ["init", "-q"]);
    writeFileSync(join(cwd, "release.env"), `RECEIZ_CLIENT_SECRET=${value}\n`, "utf8");

    const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });

    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /release\.env/);
    assert.equal(`${result.stdout}${result.stderr}`.includes(value), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("release secret scan ignores tracked paths already removed from the worktree", () => {
  const script = resolve("scripts/release-secret-scan.mjs");
  const cwd = mkdtempSync(join(tmpdir(), "wildz-secret-scan-deleted-"));
  try {
    runGit(cwd, ["init", "-q"]);
    writeFileSync(join(cwd, "retired.test.ts"), "export const retired = true;\n", "utf8");
    runGit(cwd, ["add", "retired.test.ts"]);
    unlinkSync(join(cwd, "retired.test.ts"));

    const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Secret scan passed/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
