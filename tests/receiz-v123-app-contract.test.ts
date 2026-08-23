import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_SDK_VERSION,
  RECEIZ_V124_APPLICATION_OPERATIONS,
  RECEIZ_V124_APPLICATION_OPERATION_MATRIX,
  RECEIZ_V124_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_V124_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_V124_AUTHORITY_BOUNDARY,
  RECEIZ_V124_REGISTRY_DIGEST
} from "@receiz/sdk";
import { compileReceizAppContract, defineReceizApp } from "@receiz/sdk/compiler";

describe("Receiz v124 application contract", () => {
  it("pins the coordinated v124 release identity and artifact-first authority", () => {
    assert.equal(RECEIZ_SDK_VERSION, "124.0.0");
    assert.equal(RECEIZ_RELEASE_VERSION, "124.0.0");
    assert.equal(RECEIZ_RULESET_VERSION, "124.0.0");
    assert.equal(RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version, "124.0.0");
    assert.equal(RECEIZ_V124_REGISTRY_DIGEST, "d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247");
    assert.equal(RECEIZ_V124_APPLICATION_OPERATION_MATRIX_DIGEST, "540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5");
    assert.equal(RECEIZ_V124_APP_COMPATIBLE_SDK_RANGE, ">=124.0.0 <125.0.0");
    assert.equal(RECEIZ_V124_APPLICATION_OPERATIONS.length, 53);
    assert.equal(RECEIZ_V124_AUTHORITY_BOUNDARY.authority.enclosingArtifact, "strongest");
    assert.equal(RECEIZ_V124_AUTHORITY_BOUNDARY.authority.projectionIsAuthority, false);
    assert.equal(RECEIZ_V124_AUTHORITY_BOUNDARY.authority.multiSubjectEffectsAreAtomic, true);
    assert.equal(RECEIZ_V124_AUTHORITY_BOUNDARY.authority.settledSurfaceNeverWaitsForProjection, true);

    const checkedIn = JSON.parse(readFileSync("receiz.app.json", "utf8"));
    const contract = defineReceizApp({ ...checkedIn, operations: RECEIZ_V124_APPLICATION_OPERATION_MATRIX });
    const plan = compileReceizAppContract(contract, { targetSdkVersion: "124.0.0" });
    assert.equal(plan.targetSdkVersion, "124.0.0");
    assert.equal(contract.authority.mode, "artifact-first");
    assert.equal(contract.authority.allowDatabaseAuthority, false);
    assert.deepEqual(contract.operations?.map((operation: { operation: string }) => operation.operation), RECEIZ_V124_APPLICATION_OPERATIONS);
    assert.ok(contract.operations?.every((operation: { compatibleSdkRange: string }) => operation.compatibleSdkRange === ">=124.0.0 <125.0.0"));
  });

  it("passes the v124 repository integration checker", () => {
    const result = spawnSync(process.execPath, ["scripts/receiz-v124-check.mjs"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout) as { ok: boolean; blockingFindings: unknown[]; releaseIdentity: Record<string, string> };
    assert.equal(report.ok, true);
    assert.deepEqual(report.blockingFindings, []);
    assert.deepEqual(report.releaseIdentity, {
      releaseVersion: "124.0.0",
      rulesetVersion: "124.0.0",
      registryDigest: RECEIZ_V124_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V124_APPLICATION_OPERATION_MATRIX_DIGEST
    });
  });

  it("wires the v124 checker into the release gate", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const releaseCheck = readFileSync("scripts/release-check.mjs", "utf8");
    assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v124-check.mjs");
    assert.match(releaseCheck, /["']receiz:check["']/);
  });
});
