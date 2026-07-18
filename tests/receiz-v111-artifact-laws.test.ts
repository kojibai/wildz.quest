import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  RECEIZ_V111_ARTIFACT_LAWS,
  RECEIZ_V111_REGISTRY_DIGEST,
  RECEIZ_V111_RELEASE_AUTHORITY
} from "@receiz/sdk";

const read = (path: string) => readFileSync(path, "utf8");

test("ARTIFACT-001 through ARTIFACT-020 are pinned to the active v111 constitutional context", () => {
  assert.deepEqual(RECEIZ_V111_ARTIFACT_LAWS, Array.from(
    { length: 20 },
    (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`
  ));
  assert.equal(RECEIZ_V111_REGISTRY_DIGEST, "cf02d0bce6ad1541cfe84e27bfb1036777b29616bf8a1e5aeafb899a945e359a");
  assert.deepEqual({
    proofObjectFirst: RECEIZ_V111_RELEASE_AUTHORITY.proofObjectFirst,
    receizComReferenceBeforeDeveloperRails: RECEIZ_V111_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails,
    queuedCommandIsGlobalCommitment: RECEIZ_V111_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment,
    registryPayloadIsProofAuthority: RECEIZ_V111_RELEASE_AUTHORITY.registryPayloadIsProofAuthority,
    localArtifactVerificationRequiresNetwork: RECEIZ_V111_RELEASE_AUTHORITY.localArtifactVerificationRequiresNetwork,
    historicalDeveloperSdkInstallable: RECEIZ_V111_RELEASE_AUTHORITY.historicalDeveloperSdkInstallable,
    unifiedArtifactAdmission: RECEIZ_V111_RELEASE_AUTHORITY.unifiedArtifactAdmission,
    recoveryPlanIsProofAuthority: RECEIZ_V111_RELEASE_AUTHORITY.recoveryPlanIsProofAuthority,
    proofExplanationIsProofAuthority: RECEIZ_V111_RELEASE_AUTHORITY.proofExplanationIsProofAuthority,
    recoveryCommitRequiresVerifiedCapability: RECEIZ_V111_RELEASE_AUTHORITY.recoveryCommitRequiresVerifiedCapability,
    recoveryCommitIsAtomic: RECEIZ_V111_RELEASE_AUTHORITY.recoveryCommitIsAtomic,
    admissionDerivedFromCanonicalExactBytes: RECEIZ_V111_RELEASE_AUTHORITY.admissionDerivedFromCanonicalExactBytes,
    recoveryHistoryRequiresIndependentEvidenceRoots: RECEIZ_V111_RELEASE_AUTHORITY.recoveryHistoryRequiresIndependentEvidenceRoots,
    canonicalIdentityRequiresSigningChallenge: RECEIZ_V111_RELEASE_AUTHORITY.canonicalIdentityRequiresSigningChallenge,
    planIdentityDistinctFromAttemptIdentity: RECEIZ_V111_RELEASE_AUTHORITY.planIdentityDistinctFromAttemptIdentity,
    terminalMcpAttemptConfirmationReusable: RECEIZ_V111_RELEASE_AUTHORITY.terminalMcpAttemptConfirmationReusable
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
    recoveryCommitIsAtomic: true,
    admissionDerivedFromCanonicalExactBytes: true,
    recoveryHistoryRequiresIndependentEvidenceRoots: true,
    canonicalIdentityRequiresSigningChallenge: true,
    planIdentityDistinctFromAttemptIdentity: true,
    terminalMcpAttemptConfirmationReusable: false
  });
});

test("the twenty-law custody matrix has executable repository evidence", () => {
  const custody = read("src/lib/receiz/wildz-artifact-custody.ts");
  const exportSource = read("src/lib/receiz/wildz-proof-object-export.ts");
  const codec = read("src/lib/receiz/wildz-artifact-codec.ts");
  const history = read("src/lib/receiz/wildz-artifact-history.ts");
  const ownership = read("src/lib/receiz/wildz-bearer-ownership.ts");
  const route = read("app/api/market/claims/route.ts");
  const adapter = read("src/lib/receiz/adapter.ts");
  const evidence: Record<(typeof RECEIZ_V111_ARTIFACT_LAWS)[number], boolean> = {
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
    "ARTIFACT-015": /admitAndRecoverArtifact/.test(adapter),
    "ARTIFACT-016": /file\.arrayBuffer\(\)/.test(custody) && /artifact_digest_mismatch/.test(custody),
    "ARTIFACT-017": RECEIZ_V111_RELEASE_AUTHORITY.recoveryHistoryRequiresIndependentEvidenceRoots,
    "ARTIFACT-018": /challengeB64Url/.test(adapter),
    "ARTIFACT-019": RECEIZ_V111_RELEASE_AUTHORITY.planIdentityDistinctFromAttemptIdentity,
    "ARTIFACT-020": !RECEIZ_V111_RELEASE_AUTHORITY.terminalMcpAttemptConfirmationReusable
  };
  assert.deepEqual(Object.keys(evidence), RECEIZ_V111_ARTIFACT_LAWS);
  assert.ok(Object.values(evidence).every(Boolean), JSON.stringify(evidence));
});

test("v111 MCP and AI Skills expose the same current artifact and bearer operation map", () => {
  const mcpOperations = read("node_modules/@receiz/mcp-server/dist/operations.d.ts");
  const aiManifest = JSON.parse(read("node_modules/@receiz/ai-skills/receiz-portable-artifacts/manifest.json")) as {
    version: string;
    artifactLaws: string[];
    requires: { registryDigest: string };
  };
  for (const operation of ["admit", "planRecovery", "admitAndRecover", "commitRecovery"]) {
    assert.match(mcpOperations, new RegExp(operation));
  }
  assert.equal(aiManifest.version, "111.0.0");
  assert.deepEqual(aiManifest.artifactLaws, RECEIZ_V111_ARTIFACT_LAWS);
  assert.equal(aiManifest.requires.registryDigest, RECEIZ_V111_REGISTRY_DIGEST);
});
