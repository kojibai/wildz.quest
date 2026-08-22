import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_SDK_VERSION,
  RECEIZ_V123_APPLICATION_OPERATIONS,
  RECEIZ_V123_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_V123_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_V123_AUTHORITY_BOUNDARY,
  RECEIZ_V123_REGISTRY_DIGEST
} from "@receiz/sdk";
import { compileReceizAppContract, defineReceizApp } from "@receiz/sdk/compiler";

describe("Receiz v123 application contract", () => {
  it("pins the coordinated v123 release identity and artifact-first authority", () => {
    assert.equal(RECEIZ_SDK_VERSION, "123.0.0");
    assert.equal(RECEIZ_RELEASE_VERSION, "123.0.0");
    assert.equal(RECEIZ_RULESET_VERSION, "123.0.0");
    assert.equal(RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version, "123.0.0");
    assert.equal(RECEIZ_V123_REGISTRY_DIGEST, "945a581d1fc49c2dc18fbe8c129771ef464b8a58b96188bce561e88ae8b6ceeb");
    assert.equal(RECEIZ_V123_APPLICATION_OPERATION_MATRIX_DIGEST, "e08cec3e3ad22c20ddd6c08169ece19f094c366214d6d6b4dc432cd97558e2c5");
    assert.equal(RECEIZ_V123_APP_COMPATIBLE_SDK_RANGE, ">=123.0.0 <124.0.0");
    assert.equal(RECEIZ_V123_APPLICATION_OPERATIONS.length, 36);
    assert.equal(RECEIZ_V123_AUTHORITY_BOUNDARY.authority.enclosingArtifact, "strongest");
    assert.equal(RECEIZ_V123_AUTHORITY_BOUNDARY.authority.projectionIsAuthority, false);
    assert.equal(RECEIZ_V123_AUTHORITY_BOUNDARY.authority.multiSubjectEffectsAreAtomic, true);
    assert.equal(RECEIZ_V123_AUTHORITY_BOUNDARY.authority.settledSurfaceNeverWaitsForProjection, true);

    const contract = defineReceizApp(JSON.parse(readFileSync("receiz.app.json", "utf8")));
    const plan = compileReceizAppContract(contract, { targetSdkVersion: "123.0.0" });
    assert.equal(plan.targetSdkVersion, "123.0.0");
    assert.equal(contract.authority.mode, "artifact-first");
    assert.equal(contract.authority.allowDatabaseAuthority, false);
    assert.deepEqual(contract.operations?.map((operation: { operation: string }) => operation.operation), RECEIZ_V123_APPLICATION_OPERATIONS);
    assert.ok(contract.operations?.every((operation: { compatibleSdkRange: string }) => operation.compatibleSdkRange === ">=123.0.0 <124.0.0"));
  });

  it("passes the v123 repository integration checker", () => {
    const result = spawnSync(process.execPath, ["scripts/receiz-v123-check.mjs"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout) as { ok: boolean; blockingFindings: unknown[]; releaseIdentity: Record<string, string> };
    assert.equal(report.ok, true);
    assert.deepEqual(report.blockingFindings, []);
    assert.deepEqual(report.releaseIdentity, {
      releaseVersion: "123.0.0",
      rulesetVersion: "123.0.0",
      registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V123_APPLICATION_OPERATION_MATRIX_DIGEST
    });
  });

  it("wires the v123 checker into the release gate", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const releaseCheck = readFileSync("scripts/release-check.mjs", "utf8");
    assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v123-check.mjs");
    assert.match(releaseCheck, /["']receiz:check["']/);
  });
});
