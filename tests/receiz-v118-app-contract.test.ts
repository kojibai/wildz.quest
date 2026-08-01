import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_SDK_VERSION,
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_V118_REGISTRY_DIGEST,
  RECEIZ_V118_RELEASE_AUTHORITY
} from "@receiz/sdk";
import {
  checkReceizIntegration,
  compileReceizAppContract,
  defineReceizApp,
  generateNextjsAppRouterFiles,
  RECEIZ_V118_APPLICATION_OPERATIONS,
  RECEIZ_V118_APPLICATION_OPERATION_MATRIX_DIGEST
} from "@receiz/sdk/compiler";

const expectedFeatures = [
  "identity",
  "proof",
  "proofMemory",
  "publicStore",
  "commerce"
] as const;

const artifactLaws = RECEIZ_CURRENT_CONSTITUTION_REGISTRY.laws
  .map((law) => law.id)
  .filter((id) => /^ARTIFACT-\d{3}$/.test(id));

describe("Receiz v118 application contract", () => {
  it("compiles the truthful Wildz artifact-first contract through SDK v118", () => {
    assert.equal(RECEIZ_SDK_VERSION, "118.0.0");
    assert.equal(RECEIZ_RELEASE_VERSION, "118.0.0");
    assert.equal(RECEIZ_RULESET_VERSION, "118.0.0");
    assert.equal(
      RECEIZ_V118_REGISTRY_DIGEST,
      "c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360"
    );
    assert.equal(RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version, "118.0.0");
    assert.equal(
      RECEIZ_CURRENT_CONSTITUTION_REGISTRY.previousRegistryDigest,
      "598ee0fa4dc31b8394fdd2b7b8fe713c8ee8c4b33e6ecdd92101a1a93d8787a8"
    );
    assert.deepEqual(artifactLaws, Array.from(
      { length: 30 },
      (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`
    ));
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.proofObjectFirst, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.admissionIsOperationAuthority, false);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.commitDomainNamedAndAtomic, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.receiptIsOperationAuthority, false);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.globalMeansNamedCoordinationDomain, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.offlineDivergenceResolution, "structural-only");
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.profileShowcaseLiteralIdentity, "profile-showcase:<owner>");
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.profileShowcaseArtifactIdentityIsPayloadDigest, false);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.profileShowcaseSuccessorHistoryTravelsInSealedBytes, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.profileShowcaseIntroducesNewSignerIssuerOrHeadAuthority, false);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.nativeCaptureAttestsDedicatedCameraCeremonyOnly, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.pbiAuthorshipRequiresCanonicalEnclosingPredecessor, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.pbiAuthorshipChangesOwnership, false);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.pbiAuthorshipChangesMediaTruth, false);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.pbiAuthorshipAppendsInVerifiedOrder, true);
    assert.equal(RECEIZ_V118_RELEASE_AUTHORITY.offlineSettlementWaitsForGlobalPublication, false);
    assert.equal(RECEIZ_V118_APPLICATION_OPERATIONS.length, 16);
    assert.equal(typeof defineReceizApp, "function");
    assert.equal(typeof compileReceizAppContract, "function");

    const input = JSON.parse(readFileSync("receiz.app.json", "utf8"));
    const contract = defineReceizApp(input);
    const plan = compileReceizAppContract(contract, { targetSdkVersion: "118.0.0" });

    assert.equal(plan.targetSdkVersion, "118.0.0");
    assert.deepEqual(contract.features, expectedFeatures);
    assert.equal(contract.authority.mode, "artifact-first");
    assert.equal(contract.authority.allowDatabaseAuthority, false);
    assert.deepEqual(
      contract.operations?.map((operation: { operation: string }) => operation.operation),
      RECEIZ_V118_APPLICATION_OPERATIONS
    );
    assert.ok(contract.operations?.every(
      (operation: { compatibleSdkRange: string }) => operation.compatibleSdkRange === ">=118.0.0 <119.0.0"
    ));
    assert.equal(plan.authority.proofCreation, "authenticated-native-record-before-seal");
    assert.equal(plan.authority.databaseAuthority, false);
    assert.ok(plan.verificationCommands.length > 0);
  });

  it("passes the v118 repository integration checker with evidence-backed rails", async () => {
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
    const result = spawnSync(process.execPath, ["scripts/receiz-v118-check.mjs"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.blockingFindings, []);
    assert.equal(report.ok, true);
    assert.deepEqual(report.releaseIdentity, {
      releaseVersion: "118.0.0",
      rulesetVersion: "118.0.0",
      registryDigest: "c284bd39a891c1a828b532523bd548507570819c32e307d79b8043f06d2d3360",
      operationMatrixDigest: RECEIZ_V118_APPLICATION_OPERATION_MATRIX_DIGEST
    });
    assert.deepEqual(report.artifactLaws, artifactLaws);
  });

  it("enforces the v118 checker and browser compiler guard in release configuration", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const releaseCheck = readFileSync("scripts/release-check.mjs", "utf8");
    const nextConfig = readFileSync("next.config.mjs", "utf8");

    assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v118-check.mjs");
    assert.equal(pkg.scripts?.["receiz:conformance"], "receiz conformance");
    assert.match(releaseCheck, /["']receiz:check["']/);
    assert.match(nextConfig, /NormalModuleReplacementPlugin/);
    for (const moduleName of ["assert", "crypto", "fs", "path", "test"]) {
      assert.match(nextConfig, new RegExp(`${moduleName.replace("/", "\\/")}\\s*:\\s*false`));
    }
  });
});
