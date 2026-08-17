import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  pnpm?: { overrides?: Record<string, string> };
  schema?: string;
  scripts?: Record<string, string>;
  version?: string;
};

const STRICT_RECEIZ_ENVIRONMENT = [
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

function cleanStrictReceizEnvironment() {
  const env = { ...process.env };
  for (const name of STRICT_RECEIZ_ENVIRONMENT) delete env[name];
  return env;
}

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

test("SDK, operational MCP, and AI skills request and install only Receiz v120", () => {
  const pkg = readJson("package.json");
  const docs = readFileSync("docs/MCP.md", "utf8");
  const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
  const requestedSdk = pkg.dependencies?.["@receiz/sdk"];
  const requestedMcp = pkg.devDependencies?.["@receiz/mcp-server"];
  const requestedAiSkills = pkg.devDependencies?.["@receiz/ai-skills"];
  const installedSdk = installedVersion("@receiz/sdk");
  const installedMcp = installedVersion("@receiz/mcp-server");
  const installedAiSkills = installedVersion("@receiz/ai-skills");
  const installedSdkPackage = readJson("node_modules/@receiz/sdk/package.json");
  const installedMcpPackage = readJson("node_modules/@receiz/mcp-server/package.json");
  const installedAiSkillsIndex = readJson("node_modules/@receiz/ai-skills/skills.json");

  assert.equal(requestedSdk, "120.0.0");
  assert.equal(requestedMcp, "120.0.0");
  assert.equal(requestedAiSkills, "120.0.0");
  assert.equal(installedSdk, "120.0.0");
  assert.equal(installedMcp, "120.0.0");
  assert.equal(installedAiSkills, "120.0.0");
  assert.equal(installedSdkPackage.dependencies?.["@receiz/ai-skills"], "120.0.0");
  assert.equal(installedMcpPackage.dependencies?.["@receiz/sdk"], "120.0.0");
  assert.equal(installedMcpPackage.dependencies?.["@receiz/ai-skills"], "120.0.0");
  assert.equal(installedAiSkillsIndex.schema, "receiz.ai-skills-index.v120");
  assert.equal(installedAiSkillsIndex.version, "120.0.0");
  assert.equal(pkg.pnpm?.overrides?.["@receiz/sdk"], undefined);
  assert.equal(pkg.pnpm?.overrides?.["@receiz/mcp-server"], undefined);
  assert.equal(pkg.pnpm?.overrides?.["@receiz/ai-skills"], undefined);
  assert.doesNotMatch(lockfile, /file:vendor\/receiz-v120/);
  assert.ok(lockfile.includes("sha512-pParTNrsm0ak9HIPfH/nnClJBC/88o2mb9s5SN6F7jiDuO2LnllR2llKqMPWtrXzVJOYqZ4WdPy3mmmg/aLEmA=="));
  assert.ok(lockfile.includes("sha512-8Wpkg+jAuzhetTnLzXkg5JE/wBbzwu8jOhAJtiDABM4GaeLNSZG65EKghJ2HYWJTd7MRU4bidz6NvLClch04ew=="));
  assert.ok(lockfile.includes("sha512-xGd6m9wnqHut/cjQP2/MMYc03JD2TrVAN1T5vqfXjd5ta+XfCW61eUhOQ5FmzmyzieSnrpQBCpvLlJlC30tQhA=="));
  assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v120-check.mjs");
  assert.equal(pkg.scripts?.["receiz:conformance"], "receiz conformance");
  for (const version of [requestedSdk, requestedMcp, requestedAiSkills, installedSdk, installedMcp, installedAiSkills]) {
    assert.equal(major(version), 120);
  }
  assert.match(docs, /@receiz\/sdk@120\.0\.0/);
  assert.match(docs, /@receiz\/mcp-server@120\.0\.0/);
  assert.match(docs, /@receiz\/ai-skills@120\.0\.0/);
});

test("the production env template contains only standalone Wildz variables and an opt-in doctor token", () => {
  const template = readFileSync(".env.example", "utf8");
  const configuredNames = template
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")));

  assert.deepEqual(configuredNames, [
    "NEXT_PUBLIC_RECEIZ_MODE",
    "RECEIZ_BASE_URL",
    "RECEIZ_CLIENT_ID",
    "RECEIZ_CLIENT_SECRET",
    "RECEIZ_OAUTH_STATE_SECRET",
    "NEXT_PUBLIC_AUTH_MODE",
    "RECEIZ_AUTH_MODE",
    "RECEIZ_ID_CALLBACK_URL",
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_WILDZ_SW_RELEASE",
    "WILDS_PULSE_TICK_SECRET",
    "RECEIZ_CONNECT_ACCESS_TOKEN",
    "RECEIZ_CREATURE_TWIN_HANDLE",
    "RECEIZ_CREATURE_VOICE_API_KEY",
    "NEXT_PUBLIC_CHECKOUT_MODE",
    "RECEIZ_CHECKOUT_MODE"
  ]);
  assert.match(template, /Record\/Seal\/Verify[\s\S]*receiz:record[\s\S]*receiz:seal[\s\S]*receiz:verify/);
  assert.match(template, /strict-live configuration and production activation sentinels/i);
  assert.match(template, /^# RECEIZ_ACCESS_TOKEN=$/m);
});

test("Receiz doctor verifies requested and installed SDK/MCP/AI-skills major 120", () => {
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
      aiSkills: { requested: string; installed: string; requestedMajor: number; installedMajor: number };
    };
  };
  assert.deepEqual(report.versions, {
    targetMajor: 120,
    compatible: true,
    sdk: {
      requested: "120.0.0",
      installed: "120.0.0",
      requestedMajor: 120,
      installedMajor: 120
    },
    mcp: {
      requested: "120.0.0",
      installed: "120.0.0",
      requestedMajor: 120,
      installedMajor: 120
    },
    aiSkills: {
      requested: "120.0.0",
      installed: "120.0.0",
      requestedMajor: 120,
      installedMajor: 120
    }
  });
});

test("strict-live Receiz doctor fails closed with sanitized missing configuration", () => {
  const clientSecret = ["strict", "client", "secret", "must", "not", "print"].join("-");
  const result = spawnSync(process.execPath, ["scripts/receiz-doctor.mjs", "--strict-live"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...cleanStrictReceizEnvironment(), RECEIZ_CLIENT_SECRET: clientSecret }
  });

  assert.equal(result.status, 1, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout) as {
    mode: string;
    ok: boolean;
    missingEnvironment: string[];
  };
  assert.equal(report.mode, "strict-live");
  assert.equal(report.ok, false);
  assert.ok(report.missingEnvironment.includes("RECEIZ_ACCESS_TOKEN"));
  assert.ok(report.missingEnvironment.includes("RECEIZ_OAUTH_STATE_SECRET"));
  assert.ok(report.missingEnvironment.includes("WILDS_PULSE_TICK_SECRET"));
  assert.ok(report.missingEnvironment.includes("RECEIZ_CONNECT_ACCESS_TOKEN"));
  assert.equal(`${result.stdout}${result.stderr}`.includes(clientSecret), false);
});
