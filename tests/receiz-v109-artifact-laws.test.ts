import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  RECEIZ_V109_ARTIFACT_LAWS,
  RECEIZ_V109_REGISTRY_DIGEST,
  RECEIZ_V109_RELEASE_AUTHORITY
} from "@receiz/sdk";

const read = (path: string) => readFileSync(path, "utf8");

test("ARTIFACT-001 through ARTIFACT-011 are pinned to the active v109 constitutional context", () => {
  assert.deepEqual(RECEIZ_V109_ARTIFACT_LAWS, Array.from(
    { length: 11 },
    (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`
  ));
  assert.equal(RECEIZ_V109_REGISTRY_DIGEST, "17f76b37c9fcd46f710239b5c1660b03cc34ec64bed30d1cc45c18d5d40eab70");
  assert.deepEqual({
    proofObjectFirst: RECEIZ_V109_RELEASE_AUTHORITY.proofObjectFirst,
    receizComReferenceBeforeDeveloperRails: RECEIZ_V109_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails,
    queuedCommandIsGlobalCommitment: RECEIZ_V109_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment,
    registryPayloadIsProofAuthority: RECEIZ_V109_RELEASE_AUTHORITY.registryPayloadIsProofAuthority,
    localArtifactVerificationRequiresNetwork: RECEIZ_V109_RELEASE_AUTHORITY.localArtifactVerificationRequiresNetwork,
    historicalDeveloperSdkInstallable: RECEIZ_V109_RELEASE_AUTHORITY.historicalDeveloperSdkInstallable
  }, {
    proofObjectFirst: true,
    receizComReferenceBeforeDeveloperRails: true,
    queuedCommandIsGlobalCommitment: false,
    registryPayloadIsProofAuthority: false,
    localArtifactVerificationRequiresNetwork: false,
    historicalDeveloperSdkInstallable: false
  });
});

test("the eleven-law custody matrix has executable repository evidence", () => {
  const custody = read("src/lib/receiz/wildz-artifact-custody.ts");
  const exportSource = read("src/lib/receiz/wildz-proof-object-export.ts");
  const codec = read("src/lib/receiz/wildz-artifact-codec.ts");
  const history = read("src/lib/receiz/wildz-artifact-history.ts");
  const ownership = read("src/lib/receiz/wildz-bearer-ownership.ts");
  const route = read("app/api/market/claims/route.ts");
  const evidence: Record<(typeof RECEIZ_V109_ARTIFACT_LAWS)[number], boolean> = {
    "ARTIFACT-001": /assets\.createProofObject|createProofObject/.test(exportSource),
    "ARTIFACT-002": /downloadAndReopenWildzArtifact/.test(exportSource),
    "ARTIFACT-003": /sha256WildzArtifactBytes/.test(custody),
    "ARTIFACT-004": /verifyAndOpen/.test(custody),
    "ARTIFACT-005": /verifiedPayload\.bytes/.test(custody) && /admitted\.payloadBytes/.test(codec),
    "ARTIFACT-006": /signatureVersion !== 4/.test(custody),
    "ARTIFACT-007": /ownerReceizId/.test(custody) && /claimId/.test(custody) && /verifyPath/.test(custody),
    "ARTIFACT-008": /verified-legacy-read/.test(custody) && !/extractLegacyReceizPortableAssetDocument/.test(codec),
    "ARTIFACT-009": /wildz_artifact_history_conflict/.test(history) && /artifactBytes/.test(history),
    "ARTIFACT-010": /claimBearerAsset\(\{ artifact: opened\.sealedArtifact \}\)/.test(ownership)
      && /multipart\/form-data/.test(route),
    "ARTIFACT-011": /verifyAndOpen/.test(custody) && !/fetch\(/.test(custody)
  };
  assert.deepEqual(Object.keys(evidence), RECEIZ_V109_ARTIFACT_LAWS);
  assert.ok(Object.values(evidence).every(Boolean), JSON.stringify(evidence));
});

test("v109 MCP and AI Skills expose the same current artifact and bearer operation map", () => {
  const mcpOperations = read("node_modules/@receiz/mcp-server/dist/operations.d.ts");
  const aiManifest = JSON.parse(read("node_modules/@receiz/ai-skills/receiz-portable-artifacts/manifest.json")) as {
    version: string;
    artifactLaws: string[];
    requires: { registryDigest: string };
  };
  for (const tool of [
    "receiz_artifact_record_seal_plan",
    "receiz_artifact_record_seal_execute",
    "receiz_artifact_verify",
    "receiz_artifact_extract_verified",
    "receiz_artifact_round_trip_check",
    "receiz_artifact_explain",
    "receiz_bearer_asset_claim_plan",
    "receiz_bearer_asset_claim_execute"
  ]) assert.match(mcpOperations, new RegExp(tool));
  assert.equal(aiManifest.version, "109.0.0");
  assert.deepEqual(aiManifest.artifactLaws, RECEIZ_V109_ARTIFACT_LAWS);
  assert.equal(aiManifest.requires.registryDigest, RECEIZ_V109_REGISTRY_DIGEST);
});
