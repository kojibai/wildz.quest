import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_OIDC_SCOPES_BY_RAIL,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_SDK_VERSION,
  RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX,
  RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_CURRENT_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_V125_AUTHORITY_BOUNDARY,
  RECEIZ_CURRENT_REGISTRY_DIGEST
} from "@receiz/sdk";
import { RECEIZ_PUBLIC_SDK_FUNCTION_INVENTORY } from "@receiz/sdk/function-inventory";
import { compileReceizAppContract, defineReceizApp } from "@receiz/sdk/compiler";
import { RECEIZ_V125_MCP_REQUIRED_SCOPES, RECEIZ_V125_MCP_TOOL_NAMES, RECEIZ_V124_MCP_REQUIRED_SCOPES, RECEIZ_V124_MCP_TOOL_NAMES } from "@receiz/mcp-server";

describe("Receiz v128 application contract", () => {
  it("pins the coordinated v128 release identity and artifact-first authority", () => {
    assert.equal(RECEIZ_SDK_VERSION, "128.0.0");
    assert.equal(RECEIZ_RELEASE_VERSION, "128.0.0");
    assert.equal(RECEIZ_RULESET_VERSION, "127.0.0");
    assert.equal(RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version, "127.0.0");
    assert.equal(RECEIZ_CURRENT_REGISTRY_DIGEST, "8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065");
    assert.equal(RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX_DIGEST, "940c316b5b7d6212240e699d03b3c1fd419cbbecc6ee51ddd7aa7783d9e523b0");
    assert.equal(RECEIZ_CURRENT_APP_COMPATIBLE_SDK_RANGE, ">=128.0.0 <129.0.0");
    assert.equal(RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX.map((entry) => entry.operation).length, 60);
    assert.equal(RECEIZ_V125_AUTHORITY_BOUNDARY.authority.enclosingArtifact, "strongest");
    assert.equal(RECEIZ_V125_AUTHORITY_BOUNDARY.authority.projectionIsAuthority, false);
    assert.equal(RECEIZ_V125_AUTHORITY_BOUNDARY.authority.multiSubjectEffectsAreAtomic, true);
    assert.equal(RECEIZ_V125_AUTHORITY_BOUNDARY.authority.settledSurfaceNeverWaitsForProjection, true);

    const checkedIn = JSON.parse(readFileSync("receiz.app.json", "utf8"));
    const contract = defineReceizApp(checkedIn);
    const plan = compileReceizAppContract(contract, { targetSdkVersion: "128.0.0" });
    assert.equal(plan.targetSdkVersion, "128.0.0");
    assert.equal(contract.authority.mode, "artifact-first");
    assert.equal(contract.authority.allowDatabaseAuthority, false);
    assert.deepEqual(contract.operations?.map((operation: { operation: string }) => operation.operation), RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX.map((entry) => entry.operation));
    assert.ok(contract.operations?.every((operation: { compatibleSdkRange: string }) => operation.compatibleSdkRange === ">=128.0.0 <129.0.0"));
    assert.deepEqual(contract.operations, RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX);
    assert.deepEqual(contract.features, ["identity", "proof", "proofMemory", "publicStore", "commerce", "media", "world", "subjects"]);
  });

  it("binds generated evidence and the public function catalog to the current release", () => {
    const generated = JSON.parse(readFileSync("receiz.generated.json", "utf8"));
    assert.equal(generated.compatibleSdkRange, RECEIZ_CURRENT_APP_COMPATIBLE_SDK_RANGE);
    assert.deepEqual(generated.operationAuthorityMatrix, RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX);
    assert.equal(RECEIZ_PUBLIC_SDK_FUNCTION_INVENTORY.releaseVersion, RECEIZ_RELEASE_VERSION);
    assert.equal(RECEIZ_PUBLIC_SDK_FUNCTION_INVENTORY.functions.length, 680);
    assert.equal(RECEIZ_PUBLIC_SDK_FUNCTION_INVENTORY.digest, "687bdd064b49bf7df1c32eb4ab3c0f1389c80c8bc90d7cfbec32147db1cc73ad");
    assert.equal(RECEIZ_PUBLIC_SDK_FUNCTION_INVENTORY.authority.inventoryIsProofAuthority, false);
    assert.equal(RECEIZ_PUBLIC_SDK_FUNCTION_INVENTORY.authority.sdkRuntimeCustodyMustBePreserved, true);
  });

  it("passes the v128 repository integration checker", () => {
    const result = spawnSync(process.execPath, ["scripts/receiz-v128-check.mjs"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout) as { ok: boolean; blockingFindings: unknown[]; releaseIdentity: Record<string, string> };
    assert.equal(report.ok, true);
    assert.deepEqual(report.blockingFindings, []);
    assert.deepEqual(report.releaseIdentity, {
      releaseVersion: "128.0.0",
      rulesetVersion: "127.0.0",
      registryDigest: RECEIZ_CURRENT_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_CURRENT_APPLICATION_OPERATION_MATRIX_DIGEST
    });
  });

  it("exposes the complete v128.0.0 authority, execution, and private-world surface", () => {
    assert.equal(RECEIZ_V124_MCP_TOOL_NAMES.length, 26);
    for (const tool of [
      "receiz_v124_proof_authority_challenge_create",
      "receiz_v124_execution_execute",
      "receiz_v124_runtime_authority_session_open",
      "receiz_v124_domain_verified_private_additions",
      "receiz_v124_identity_public_recipient_resolve",
      "receiz_v124_source_publish_sealed"
    ] as const) {
      assert.ok(RECEIZ_V124_MCP_TOOL_NAMES.includes(tool), tool);
    }
    assert.deepEqual(RECEIZ_V124_MCP_REQUIRED_SCOPES.receiz_v124_domain_verified_private_additions, ["receiz:world.private"]);
    assert.deepEqual(RECEIZ_OIDC_SCOPES_BY_RAIL.wallet, ["receiz:wallet.read", "receiz:wallet.transfer"]);
    assert.ok(RECEIZ_OIDC_SCOPES_BY_RAIL.twin.includes("receiz:twin.execute"));
    assert.ok(RECEIZ_OIDC_SCOPES_BY_RAIL.twin.includes("receiz:creator.execute"));
    assert.ok(RECEIZ_OIDC_SCOPES_BY_RAIL.world.includes("receiz:world.private"));
  });

  it("exposes v128 lawful-action custody without replacing retained v124 rails", () => {
    assert.equal(RECEIZ_V125_MCP_TOOL_NAMES.length, 13);
    assert.ok(RECEIZ_V125_MCP_TOOL_NAMES.includes("receiz_v125_lawful_action_admit"));
    assert.ok(RECEIZ_V125_MCP_TOOL_NAMES.includes("receiz_v125_edge_value_settlement_receive"));
    assert.deepEqual(RECEIZ_V125_MCP_REQUIRED_SCOPES.receiz_v125_lawful_action_admit, ["receiz:lawful-actions.write"]);
    assert.equal(RECEIZ_V125_AUTHORITY_BOUNDARY.authority.developersMayDeclarePhiAmount, false);
    assert.equal(RECEIZ_V125_AUTHORITY_BOUNDARY.authority.activationMintsValue, false);
    assert.equal(RECEIZ_V125_AUTHORITY_BOUNDARY.authority.lawfulActionValueHeadsRequireEnclosingProof, true);
  });

  it("wires the v128 checker into the release gate", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> };
    const releaseCheck = readFileSync("scripts/release-check.mjs", "utf8");
    assert.equal(pkg.scripts?.["receiz:check"], "node scripts/receiz-v128-check.mjs");
    assert.match(releaseCheck, /["']receiz:check["']/);
  });
});
