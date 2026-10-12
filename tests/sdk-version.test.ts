import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  RECEIZ_CURRENT_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX,
  RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_CURRENT_REGISTRY_DIGEST,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION
} from "@receiz/sdk";
import {
  RECEIZ_MARKETPLACE_NONFINANCIAL_TOOL_NAMES,
  RECEIZ_MCP_TOOLS,
  describeReceizMcpCapabilityParity
} from "@receiz/mcp-server";

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

test("SDK, operational MCP, and AI skills request and install only Receiz v129", () => {
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

  assert.equal(requestedSdk, "129.0.0");
  assert.equal(requestedMcp, "129.0.0");
  assert.equal(requestedAiSkills, "129.0.0");
  assert.equal(installedSdk, "129.0.0");
  assert.equal(installedMcp, "129.0.0");
  assert.equal(installedAiSkills, "129.0.0");
  assert.equal(installedSdkPackage.dependencies?.["@receiz/ai-skills"], "129.0.0");
  assert.equal(installedMcpPackage.dependencies?.["@receiz/sdk"], "129.0.0");
  assert.equal(installedMcpPackage.dependencies?.["@receiz/ai-skills"], "129.0.0");
  assert.equal(installedAiSkillsIndex.schema, "receiz.ai-skills-index.v129");
  assert.equal(installedAiSkillsIndex.version, "129.0.0");
  assert.equal(pkg.pnpm?.overrides?.["@receiz/sdk"], undefined);
  assert.equal(pkg.pnpm?.overrides?.["@receiz/mcp-server"], undefined);
  assert.equal(pkg.pnpm?.overrides?.["@receiz/ai-skills"], undefined);
  assert.doesNotMatch(lockfile, /file:.*receiz/);
  assert.ok(lockfile.includes("sha512-Y8WMYMVim5LrMpsCP85kxYdR6yQpBmIgt0DIWqXy320BqCECxg8du+AOUwzWJsAOQeJSorIPkysdoTnQPsWsrQ=="));
  assert.ok(lockfile.includes("sha512-BN+x3ETZ8DeaEi4ARWOEpw8uUWI88m3BFSOrzPyy06DPbCfT2DdP4rdaWgixVYtVh4OPlPOurEapxm0thxDGEg=="));
  assert.ok(lockfile.includes("sha512-EMWSpxTTZCMIoGeXHaMj4Lw0XQIcQIhekRYZkpNOEG5T6gavtrm920zqmmxwI7dLNNbap6p75hlYV8iqtXRDOQ=="));
  assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v128-check.mjs");
  assert.equal(pkg.scripts?.["receiz:conformance"], "receiz conformance");
  for (const version of [requestedSdk, requestedMcp, requestedAiSkills, installedSdk, installedMcp, installedAiSkills]) {
    assert.equal(major(version), 129);
  }
  assert.match(docs, /@receiz\/sdk@129\.0\.0/);
  assert.match(docs, /@receiz\/mcp-server@129\.0\.0/);
  assert.match(docs, /@receiz\/ai-skills@129\.0\.0/);
});

test("v129 release binding retains the shipped v127 constitutional registry", () => {
  assert.equal(RECEIZ_RELEASE_VERSION, "129.0.0");
  assert.equal(RECEIZ_RULESET_VERSION, "127.0.0");
  assert.equal(RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version, "127.0.0");
  assert.equal(RECEIZ_CURRENT_REGISTRY_DIGEST, "8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065");
  assert.equal(RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX_DIGEST, "c4e0cff348b62f31db2bb2ffdeec533a92ca3a6d476757bb9b559ac58a7875e1");
  assert.equal(RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX.length, 60);
  assert.equal(RECEIZ_CURRENT_APP_COMPATIBLE_SDK_RANGE, ">=129.0.0 <130.0.0");
  const appContract = JSON.parse(readFileSync("receiz.app.json", "utf8"));
  assert.deepEqual(appContract.operations, RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX);
  const manifest = JSON.parse(readFileSync("node_modules/@receiz/ai-skills/receiz-release/manifest.json", "utf8"));
  assert.deepEqual(manifest.requires, {
    sdk: RECEIZ_CURRENT_APP_COMPATIBLE_SDK_RANGE,
    mcp: RECEIZ_CURRENT_APP_COMPATIBLE_SDK_RANGE,
    ruleset: RECEIZ_RULESET_VERSION,
    registryDigest: RECEIZ_CURRENT_REGISTRY_DIGEST,
    operationMatrixDigest: RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX_DIGEST
  });
});

test("v129 full MCP schemas keep checkout, bearer custody and local valuation boundaries distinct", () => {
  const parity = describeReceizMcpCapabilityParity();
  assert.equal(parity.releaseVersion, RECEIZ_RELEASE_VERSION);
  assert.equal(parity.sdkPublicFunctionInventory.releaseVersion, RECEIZ_RELEASE_VERSION);
  assert.equal(parity.sdkClientCapabilityInventory.releaseVersion, RECEIZ_RELEASE_VERSION);
  assert.deepEqual(parity.mcpToolInventory, RECEIZ_MCP_TOOLS.map((tool) => tool.name));
  const savedDescriptors = JSON.parse(readFileSync("docs/release/receiz-v129-mcp-market-tools.json", "utf8")) as {
    releaseVersion: string;
    deploymentQualified: boolean;
    tools: typeof RECEIZ_MCP_TOOLS;
  };
  assert.equal(savedDescriptors.releaseVersion, RECEIZ_RELEASE_VERSION);
  assert.equal(savedDescriptors.deploymentQualified, false);
  assert.equal(savedDescriptors.tools.length, 13);
  for (const descriptor of savedDescriptors.tools) {
    assert.deepEqual(descriptor, RECEIZ_MCP_TOOLS.find((tool) => tool.name === descriptor.name));
  }
  const tool = (name: string) => {
    const result = RECEIZ_MCP_TOOLS.find((entry) => entry.name === name);
    assert.ok(result, `installed full MCP tool is missing: ${name}`);
    return result;
  };
  for (const name of ["receiz_connect_checkout", "receiz_payments_embedded_checkout", "receiz_commerce_one_click_checkout"]) {
    const checkout = tool(name);
    assert.deepEqual(checkout.inputSchema.required, ["body"]);
    assert.equal(checkout.inputSchema.additionalProperties, false);
    assert.equal(checkout.annotations?.readOnlyHint, false);
    assert.equal(RECEIZ_MARKETPLACE_NONFINANCIAL_TOOL_NAMES.includes(name), false);
  }
  assert.deepEqual(tool("receiz_connect_checkout_session").inputSchema.required, ["query"]);
  const claim = tool("receiz_bearer_artifact_claim");
  assert.deepEqual(claim.inputSchema.required, ["artifactReference"]);
  assert.deepEqual(Object.keys(claim.inputSchema.properties as object), ["artifactReference", "confirmation"]);
  assert.equal(claim.inputSchema.additionalProperties, false);
  assert.equal(RECEIZ_MARKETPLACE_NONFINANCIAL_TOOL_NAMES.includes(claim.name), false);
  for (const [name, required] of [
    ["receiz_proof_value_inspect", ["artifactReference", "valuationKaiUPulse"]],
    ["receiz_proof_value_sample", ["artifactReference", "valuationKaiUPulses"]],
    ["receiz_proof_value_replay_verify", ["replayReference"]]
  ] as const) {
    const reader = tool(name);
    assert.deepEqual(reader.inputSchema.required, required);
    assert.equal(reader.inputSchema.additionalProperties, false);
    assert.deepEqual(reader.annotations, { readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    assert.equal(RECEIZ_MARKETPLACE_NONFINANCIAL_TOOL_NAMES.includes(name), false);
  }
  for (const name of ["receiz_v123_value_execute_settlement", "receiz_v123_value_execute_reserve", "receiz_v123_value_execution_by_idempotency"]) {
    assert.deepEqual(tool(name).inputSchema.required, ["input"]);
  }
  assert.equal(RECEIZ_MARKETPLACE_NONFINANCIAL_TOOL_NAMES.includes("receiz_v123_value_execute_settlement"), false);
  assert.equal(RECEIZ_MARKETPLACE_NONFINANCIAL_TOOL_NAMES.includes("receiz_v123_value_execute_reserve"), false);
  assert.equal(RECEIZ_MARKETPLACE_NONFINANCIAL_TOOL_NAMES.includes("receiz_v123_value_execution_by_idempotency"), true);
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
    "NEXT_PUBLIC_CHECKOUT_MODE",
    "RECEIZ_CHECKOUT_MODE",
    "WILDS_PUSH_VAPID_PUBLIC_KEY",
    "WILDS_PUSH_VAPID_PRIVATE_KEY",
    "WILDS_PUSH_VAPID_SUBJECT",
    "WILDS_PUSH_REDIS_URL",
    "WILDS_PUSH_REDIS_TOKEN"
  ]);
  assert.match(template, /Record\/Seal\/Verify[\s\S]*receiz:record[\s\S]*receiz:seal[\s\S]*receiz:verify/);
  assert.match(template, /strict-live configuration and production activation sentinels/i);
  assert.match(template, /^# RECEIZ_ACCESS_TOKEN=$/m);
});

test("Receiz doctor verifies requested and installed SDK/MCP/AI-skills major 129", () => {
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
    targetMajor: 129,
    compatible: true,
    sdk: {
      requested: "129.0.0",
      installed: "129.0.0",
      requestedMajor: 129,
      installedMajor: 129
    },
    mcp: {
      requested: "129.0.0",
      installed: "129.0.0",
      requestedMajor: 129,
      installedMajor: 129
    },
    aiSkills: {
      requested: "129.0.0",
      installed: "129.0.0",
      requestedMajor: 129,
      installedMajor: 129
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
