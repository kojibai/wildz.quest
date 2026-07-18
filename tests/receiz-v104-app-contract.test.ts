import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_SDK_VERSION,
  RECEIZ_V108_ARTIFACT_LAWS,
  RECEIZ_V108_REGISTRY_DIGEST,
  RECEIZ_V108_RELEASE_AUTHORITY
} from "@receiz/sdk";
import {
  checkReceizIntegration,
  compileReceizAppContract,
  defineReceizApp,
  generateNextjsAppRouterFiles
} from "@receiz/sdk/compiler";

const expectedFeatures = [
  "identity",
  "proof",
  "proofMemory",
  "publicStore",
  "commerce"
] as const;

describe("Receiz v108 application contract", () => {
  it("compiles the truthful Wildz artifact-first contract through SDK v108", () => {
    assert.equal(RECEIZ_SDK_VERSION, "108.0.0");
    assert.equal(RECEIZ_RELEASE_VERSION, "108.0.0");
    assert.equal(RECEIZ_RULESET_VERSION, "108.0.0");
    assert.equal(
      RECEIZ_V108_REGISTRY_DIGEST,
      "126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79"
    );
    assert.deepEqual(RECEIZ_V108_ARTIFACT_LAWS, [
      "ARTIFACT-001", "ARTIFACT-002", "ARTIFACT-003", "ARTIFACT-004", "ARTIFACT-005",
      "ARTIFACT-006", "ARTIFACT-007", "ARTIFACT-008", "ARTIFACT-009", "ARTIFACT-010"
    ]);
    assert.equal(RECEIZ_V108_RELEASE_AUTHORITY.proofObjectFirst, true);
    assert.equal(RECEIZ_V108_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails, true);
    assert.equal(RECEIZ_V108_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment, false);
    assert.equal(typeof defineReceizApp, "function");
    assert.equal(typeof compileReceizAppContract, "function");

    const input = JSON.parse(readFileSync("receiz.app.json", "utf8"));
    const contract = defineReceizApp(input);
    const plan = compileReceizAppContract(contract, { targetSdkVersion: "108.0.0" });

    assert.equal(plan.targetSdkVersion, "108.0.0");
    assert.deepEqual(contract.features, expectedFeatures);
    assert.equal(contract.authority.mode, "artifact-first");
    assert.equal(contract.authority.allowDatabaseAuthority, false);
    assert.equal(plan.authority.proofCreation, "authenticated-native-record-before-seal");
    assert.equal(plan.authority.databaseAuthority, false);
    assert.ok(plan.verificationCommands.length > 0);
  });

  it("passes the v108 repository integration checker with evidence-backed rails", async () => {
    const generated = JSON.parse(readFileSync("receiz.generated.json", "utf8"));
    const contract = defineReceizApp(JSON.parse(readFileSync("receiz.app.json", "utf8")));
    const generatedFile = generateNextjsAppRouterFiles(contract)
      .find((file) => file.path === "receiz.generated.json");

    assert.equal(generated.adapterCreated, true);
    assert.equal(generated.recordBeforeSeal, true);
    assert.equal(generated.proofMemoryPersistence, "durable");
    assert.equal(generated.webhookVerification, false);
    assert.equal(generated.continuityVerification, true);
    assert.equal(generated.idempotency, true);
    assert.equal(generated.serverSecretsBrowserSafe, true);
    assert.ok(generatedFile);
    assert.deepEqual(generated, JSON.parse(generatedFile.content));

    assert.equal(typeof checkReceizIntegration, "function");
    const result = spawnSync(process.execPath, ["scripts/receiz-v108-check.mjs"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.blockingFindings, []);
    assert.equal(report.ok, true);
    assert.deepEqual(report.releaseIdentity, {
      releaseVersion: "108.0.0",
      rulesetVersion: "108.0.0",
      registryDigest: "126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79"
    });
    assert.deepEqual(report.artifactLaws, RECEIZ_V108_ARTIFACT_LAWS);
  });

  it("enforces the v108 checker and browser compiler guard in release configuration", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const releaseCheck = readFileSync("scripts/release-check.mjs", "utf8");
    const nextConfig = readFileSync("next.config.mjs", "utf8");

    assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v108-check.mjs");
    assert.equal(pkg.scripts?.["receiz:conformance"], "receiz conformance");
    assert.match(releaseCheck, /["']receiz:check["']/);
    assert.match(nextConfig, /NormalModuleReplacementPlugin/);
    for (const moduleName of ["assert", "crypto", "fs", "path", "test"]) {
      assert.match(nextConfig, new RegExp(`${moduleName.replace("/", "\\/")}\\s*:\\s*false`));
    }
  });
});
