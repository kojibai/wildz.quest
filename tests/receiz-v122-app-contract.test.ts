import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_GENERATED_V122_REGISTRY_DIGEST,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_SDK_VERSION,
  RECEIZ_V122_APPLICATION_OPERATIONS,
  RECEIZ_V122_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_V122_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_V122_AUTHORITY_BOUNDARY,
  RECEIZ_V122_REGISTRY_DIGEST
} from "@receiz/sdk";
import { compileReceizAppContract, defineReceizApp } from "@receiz/sdk/compiler";

describe("Receiz v122 application contract", () => {
  it("pins the coordinated v122 release identity and artifact-first authority", () => {
    assert.equal(RECEIZ_SDK_VERSION, "122.0.0");
    assert.equal(RECEIZ_RELEASE_VERSION, "122.0.0");
    assert.equal(RECEIZ_RULESET_VERSION, "122.0.0");
    assert.equal(RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version, "122.0.0");
    assert.equal(RECEIZ_V122_REGISTRY_DIGEST, "ed65956a16dd5f0d76d04db2f4a651fc43eb0a71cef64afd53576aa782dc9896");
    assert.equal(RECEIZ_GENERATED_V122_REGISTRY_DIGEST, RECEIZ_V122_REGISTRY_DIGEST);
    assert.equal(RECEIZ_V122_APPLICATION_OPERATION_MATRIX_DIGEST, "bd1d7ccf1543e2484df68e3025c7376f8ae37cafe1ca0d7c9cd9f52f6342b325");
    assert.equal(RECEIZ_V122_APP_COMPATIBLE_SDK_RANGE, ">=122.0.0 <123.0.0");
    assert.equal(RECEIZ_V122_APPLICATION_OPERATIONS.length, 30);
    assert.equal(RECEIZ_V122_AUTHORITY_BOUNDARY.authority.enclosingArtifact, "strongest");
    assert.equal(RECEIZ_V122_AUTHORITY_BOUNDARY.authority.projectionIsAuthority, false);
    assert.equal(RECEIZ_V122_AUTHORITY_BOUNDARY.authority.multiSubjectEffectsAreAtomic, true);
    assert.equal(RECEIZ_V122_AUTHORITY_BOUNDARY.authority.settledSurfaceNeverWaitsForProjection, true);

    const contract = defineReceizApp(JSON.parse(readFileSync("receiz.app.json", "utf8")));
    const plan = compileReceizAppContract(contract, { targetSdkVersion: "122.0.0" });
    assert.equal(plan.targetSdkVersion, "122.0.0");
    assert.equal(contract.authority.mode, "artifact-first");
    assert.equal(contract.authority.allowDatabaseAuthority, false);
    assert.deepEqual(contract.operations?.map((operation: { operation: string }) => operation.operation), RECEIZ_V122_APPLICATION_OPERATIONS);
    assert.ok(contract.operations?.every((operation: { compatibleSdkRange: string }) => operation.compatibleSdkRange === ">=122.0.0 <123.0.0"));
  });

  it("passes the v122 repository integration checker", () => {
    const result = spawnSync(process.execPath, ["scripts/receiz-v122-check.mjs"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout) as { ok: boolean; blockingFindings: unknown[]; releaseIdentity: Record<string, string> };
    assert.equal(report.ok, true);
    assert.deepEqual(report.blockingFindings, []);
    assert.deepEqual(report.releaseIdentity, {
      releaseVersion: "122.0.0",
      rulesetVersion: "122.0.0",
      registryDigest: RECEIZ_V122_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V122_APPLICATION_OPERATION_MATRIX_DIGEST
    });
  });

  it("wires the v122 checker into the release gate", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const releaseCheck = readFileSync("scripts/release-check.mjs", "utf8");
    assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v122-check.mjs");
    assert.match(releaseCheck, /["']receiz:check["']/);
  });
});
