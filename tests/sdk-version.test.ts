import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  version?: string;
};

function readJson(path: string): PackageManifest {
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

function installedVersion(packageName: string) {
  try {
    return readJson(`node_modules/${packageName}/package.json`).version ?? null;
  } catch {
    return null;
  }
}

function major(version: string) {
  const match = version.match(/^[~^]?(\d+)\./);
  assert.ok(match, `expected a semver version, received ${version}`);
  return Number(match[1]);
}

test("SDK and operational MCP packages request and install Receiz major 101", () => {
  const pkg = readJson("package.json");
  const docs = readFileSync("docs/MCP.md", "utf8");
  const requestedSdk = pkg.dependencies?.["@receiz/sdk"];
  const requestedMcp = pkg.devDependencies?.["@receiz/mcp-server"];
  const installedSdk = installedVersion("@receiz/sdk");
  const installedMcp = installedVersion("@receiz/mcp-server");

  assert.equal(requestedSdk, "^101.0.0");
  assert.equal(requestedMcp, "101.0.0");
  assert.equal(installedSdk, "101.0.0");
  assert.equal(installedMcp, "101.0.0");
  assert.equal(major(requestedSdk), 101);
  assert.equal(major(requestedMcp), 101);
  assert.equal(major(installedSdk), 101);
  assert.equal(major(installedMcp), 101);
  assert.match(docs, /@receiz\/sdk@\^101\.0\.0/);
  assert.match(docs, /@receiz\/mcp-server@101\.0\.0/);
});

test("Receiz doctor verifies requested and installed SDK/MCP major 101", () => {
  const result = spawnSync(process.execPath, ["scripts/receiz-doctor.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    versions: {
      targetMajor: number;
      compatible: boolean;
      sdk: { requested: string; installed: string; requestedMajor: number; installedMajor: number };
      mcp: { requested: string; installed: string; requestedMajor: number; installedMajor: number };
    };
  };
  assert.deepEqual(report.versions, {
    targetMajor: 101,
    compatible: true,
    sdk: {
      requested: "^101.0.0",
      installed: "101.0.0",
      requestedMajor: 101,
      installedMajor: 101
    },
    mcp: {
      requested: "101.0.0",
      installed: "101.0.0",
      requestedMajor: 101,
      installedMajor: 101
    }
  });
});
