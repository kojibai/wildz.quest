import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  RECEIZ_V110_ARTIFACT_LAWS,
  RECEIZ_V110_REGISTRY_DIGEST,
  RECEIZ_V110_RELEASE_AUTHORITY
} from "@receiz/sdk";

const read = (path: string) => readFileSync(path, "utf8");

test("ARTIFACT-001 through ARTIFACT-015 are pinned to the active v110 constitutional context", () => {
  assert.deepEqual(RECEIZ_V110_ARTIFACT_LAWS, Array.from(
    { length: 15 },
    (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`
  ));
  assert.equal(RECEIZ_V110_REGISTRY_DIGEST, "824aa4af849c4840ba94535798eab36e45d514703b6ae0cd30d4aa53f3c896e4");
  assert.deepEqual({
    proofObjectFirst: RECEIZ_V110_RELEASE_AUTHORITY.proofObjectFirst,
    receizComReferenceBeforeDeveloperRails: RECEIZ_V110_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails,
    queuedCommandIsGlobalCommitment: RECEIZ_V110_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment,
    registryPayloadIsProofAuthority: RECEIZ_V110_RELEASE_AUTHORITY.registryPayloadIsProofAuthority,
    localArtifactVerificationRequiresNetwork: RECEIZ_V110_RELEASE_AUTHORITY.localArtifactVerificationRequiresNetwork,
    historicalDeveloperSdkInstallable: RECEIZ_V110_RELEASE_AUTHORITY.historicalDeveloperSdkInstallable,
    unifiedArtifactAdmission: RECEIZ_V110_RELEASE_AUTHORITY.unifiedArtifactAdmission,
    recoveryPlanIsProofAuthority: RECEIZ_V110_RELEASE_AUTHORITY.recoveryPlanIsProofAuthority,
    proofExplanationIsProofAuthority: RECEIZ_V110_RELEASE_AUTHORITY.proofExplanationIsProofAuthority,
    recoveryCommitRequiresVerifiedCapability: RECEIZ_V110_RELEASE_AUTHORITY.recoveryCommitRequiresVerifiedCapability,
    recoveryCommitIsAtomic: RECEIZ_V110_RELEASE_AUTHORITY.recoveryCommitIsAtomic
  }, {
    proofObjectFirst: true,
    receizComReferenceBeforeDeveloperRails: true,
    queuedCommandIsGlobalCommitment: false,
    registryPayloadIsProofAuthority: false,
    localArtifactVerificationRequiresNetwork: false,
    historicalDeveloperSdkInstallable: false,
    unifiedArtifactAdmission: true,
    recoveryPlanIsProofAuthority: false,
    proofExplanationIsProofAuthority: false,
    recoveryCommitRequiresVerifiedCapability: true,
    recoveryCommitIsAtomic: true
  });
});

test("the fifteen-law custody matrix has executable repository evidence", () => {
  const custody = read("src/lib/receiz/wildz-artifact-custody.ts");
  const exportSource = read("src/lib/receiz/wildz-proof-object-export.ts");
  const codec = read("src/lib/receiz/wildz-artifact-codec.ts");
  const history = read("src/lib/receiz/wildz-artifact-history.ts");
  const ownership = read("src/lib/receiz/wildz-bearer-ownership.ts");
  const route = read("app/api/market/claims/route.ts");
  const adapter = read("src/lib/receiz/adapter.ts");
  const evidence: Record<(typeof RECEIZ_V110_ARTIFACT_LAWS)[number], boolean> = {
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
    "ARTIFACT-011": /verifyAndOpen/.test(custody) && !/fetch\(/.test(custody),
    "ARTIFACT-012": /admitArtifact/.test(adapter),
    "ARTIFACT-013": /planArtifactRecovery/.test(adapter),
    "ARTIFACT-014": /commitArtifactRecovery/.test(adapter),
    "ARTIFACT-015": /admitAndRecoverArtifact/.test(adapter)
  };
  assert.deepEqual(Object.keys(evidence), RECEIZ_V110_ARTIFACT_LAWS);
  assert.ok(Object.values(evidence).every(Boolean), JSON.stringify(evidence));
});

test("v110 MCP and AI Skills expose the same current artifact and bearer operation map", () => {
  const mcpOperations = read("node_modules/@receiz/mcp-server/dist/operations.d.ts");
  const aiManifest = JSON.parse(read("node_modules/@receiz/ai-skills/receiz-portable-artifacts/manifest.json")) as {
    version: string;
    artifactLaws: string[];
    requires: { registryDigest: string };
  };
  for (const operation of ["admit", "planRecovery", "admitAndRecover", "commitRecovery"]) {
    assert.match(mcpOperations, new RegExp(operation));
  }
  assert.equal(aiManifest.version, "110.0.0");
  assert.deepEqual(aiManifest.artifactLaws, RECEIZ_V110_ARTIFACT_LAWS);
  assert.equal(aiManifest.requires.registryDigest, RECEIZ_V110_REGISTRY_DIGEST);
});
