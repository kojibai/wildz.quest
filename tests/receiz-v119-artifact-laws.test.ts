import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_V113_GLOBAL_COMMIT_DOMAIN,
  RECEIZ_V114_PROTOCOL_LIMITS,
  RECEIZ_V119_REGISTRY_DIGEST,
  RECEIZ_V119_RELEASE_AUTHORITY,
  RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS
} from "@receiz/sdk";
import {
  RECEIZ_V119_APPLICATION_OPERATIONS,
  RECEIZ_V119_APPLICATION_OPERATION_MATRIX_DIGEST
} from "@receiz/sdk/compiler";

const read = (path: string) => readFileSync(path, "utf8");
const artifactLaws = RECEIZ_CURRENT_CONSTITUTION_REGISTRY.laws
  .map((law) => law.id)
  .filter((id) => /^ARTIFACT-\d{3}$/.test(id));

test("ARTIFACT-001 through ARTIFACT-030 are pinned to the active v119 constitutional context", () => {
  assert.deepEqual(artifactLaws, Array.from(
    { length: 30 },
    (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`
  ));
  assert.equal(RECEIZ_V119_REGISTRY_DIGEST, "49c167a437ec7c0e486412dd62c54af4abdf94eda1ebc18d263a027d105cecd9");
  assert.equal(RECEIZ_V119_APPLICATION_OPERATION_MATRIX_DIGEST, "53cf9d6862b2396e2fe7864f8607c00c4e3b6e31b082ab5c5c8dff088fcb52c1");
  assert.equal(RECEIZ_V113_GLOBAL_COMMIT_DOMAIN.value, "receiz.com/global/v1");
  assert.equal(RECEIZ_V114_PROTOCOL_LIMITS.exactArtifactBytes, 524_288_000);
  assert.equal(RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS.exactArtifactBytes, 16_777_216);
  assert.deepEqual({
    admissionIsOperationAuthority: RECEIZ_V119_RELEASE_AUTHORITY.admissionIsOperationAuthority,
    transitionDigestExcludesPlanCoordination: RECEIZ_V119_RELEASE_AUTHORITY.transitionDigestExcludesPlanCoordination,
    effectsDerivedByRegistryOperationLaw: RECEIZ_V119_RELEASE_AUTHORITY.effectsDerivedByRegistryOperationLaw,
    commitDomainNamedAndAtomic: RECEIZ_V119_RELEASE_AUTHORITY.commitDomainNamedAndAtomic,
    receiptIsOperationAuthority: RECEIZ_V119_RELEASE_AUTHORITY.receiptIsOperationAuthority,
    browserAdmissionStoreCarriesProofObjects: RECEIZ_V119_RELEASE_AUTHORITY.browserAdmissionStoreCarriesProofObjects,
    globalMeansNamedCoordinationDomain: RECEIZ_V119_RELEASE_AUTHORITY.globalMeansNamedCoordinationDomain,
    databaseManufacturesArtifactTruth: RECEIZ_V119_RELEASE_AUTHORITY.databaseManufacturesArtifactTruth,
    connectTokenIsArtifactAuthority: RECEIZ_V119_RELEASE_AUTHORITY.connectTokenIsArtifactAuthority,
    offlineDivergenceResolution: RECEIZ_V119_RELEASE_AUTHORITY.offlineDivergenceResolution,
    profileShowcaseArtifactIdentityIsPayloadDigest:
      RECEIZ_V119_RELEASE_AUTHORITY.profileShowcaseArtifactIdentityIsPayloadDigest,
    profileShowcaseLiteralIdentity: RECEIZ_V119_RELEASE_AUTHORITY.profileShowcaseLiteralIdentity,
    profileShowcaseSuccessorHistoryTravelsInSealedBytes:
      RECEIZ_V119_RELEASE_AUTHORITY.profileShowcaseSuccessorHistoryTravelsInSealedBytes,
    profileShowcaseIntroducesNewSignerIssuerOrHeadAuthority:
      RECEIZ_V119_RELEASE_AUTHORITY.profileShowcaseIntroducesNewSignerIssuerOrHeadAuthority,
    nativeCaptureAttestsDedicatedCameraCeremonyOnly:
      RECEIZ_V119_RELEASE_AUTHORITY.nativeCaptureAttestsDedicatedCameraCeremonyOnly,
    pbiAuthorshipRequiresCanonicalEnclosingPredecessor:
      RECEIZ_V119_RELEASE_AUTHORITY.pbiAuthorshipRequiresCanonicalEnclosingPredecessor,
    pbiAuthorshipChangesOwnership: RECEIZ_V119_RELEASE_AUTHORITY.pbiAuthorshipChangesOwnership,
    pbiAuthorshipChangesMediaTruth: RECEIZ_V119_RELEASE_AUTHORITY.pbiAuthorshipChangesMediaTruth,
    pbiAuthorshipAppendsInVerifiedOrder: RECEIZ_V119_RELEASE_AUTHORITY.pbiAuthorshipAppendsInVerifiedOrder,
    offlineSettlementWaitsForGlobalPublication:
      RECEIZ_V119_RELEASE_AUTHORITY.offlineSettlementWaitsForGlobalPublication
  }, {
    admissionIsOperationAuthority: false,
    transitionDigestExcludesPlanCoordination: true,
    effectsDerivedByRegistryOperationLaw: true,
    commitDomainNamedAndAtomic: true,
    receiptIsOperationAuthority: false,
    browserAdmissionStoreCarriesProofObjects: false,
    globalMeansNamedCoordinationDomain: true,
    databaseManufacturesArtifactTruth: false,
    connectTokenIsArtifactAuthority: false,
    offlineDivergenceResolution: "structural-only",
    profileShowcaseArtifactIdentityIsPayloadDigest: false,
    profileShowcaseLiteralIdentity: "profile-showcase:<owner>",
    profileShowcaseSuccessorHistoryTravelsInSealedBytes: true,
    profileShowcaseIntroducesNewSignerIssuerOrHeadAuthority: false,
    nativeCaptureAttestsDedicatedCameraCeremonyOnly: true,
    pbiAuthorshipRequiresCanonicalEnclosingPredecessor: true,
    pbiAuthorshipChangesOwnership: false,
    pbiAuthorshipChangesMediaTruth: false,
    pbiAuthorshipAppendsInVerifiedOrder: true,
    offlineSettlementWaitsForGlobalPublication: false
  });
});

test("the thirty-law custody matrix has executable repository and SDK evidence", () => {
  const custody = read("src/lib/receiz/wildz-artifact-custody.ts");
  const exportSource = read("src/lib/receiz/wildz-proof-object-export.ts");
  const codec = read("src/lib/receiz/wildz-artifact-codec.ts");
  const history = read("src/lib/receiz/wildz-artifact-history.ts");
  const ownership = read("src/lib/receiz/wildz-bearer-ownership.ts");
  const route = read("app/api/market/claims/route.ts");
  const adapter = read("src/lib/receiz/adapter.ts");
  const evidence: Record<string, boolean> = {
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
    "ARTIFACT-017": RECEIZ_V119_RELEASE_AUTHORITY.recoveryHistoryRequiresIndependentEvidenceRoots,
    "ARTIFACT-018": /challengeB64Url/.test(adapter),
    "ARTIFACT-019": RECEIZ_V119_RELEASE_AUTHORITY.planIdentityDistinctFromAttemptIdentity,
    "ARTIFACT-020": !RECEIZ_V119_RELEASE_AUTHORITY.terminalMcpAttemptConfirmationReusable,
    "ARTIFACT-021": !RECEIZ_V119_RELEASE_AUTHORITY.admissionIsOperationAuthority,
    "ARTIFACT-022": RECEIZ_V119_RELEASE_AUTHORITY.transitionDigestExcludesPlanCoordination,
    "ARTIFACT-023": RECEIZ_V119_RELEASE_AUTHORITY.canonicalIdentityRequiresSigningChallenge,
    "ARTIFACT-024": RECEIZ_V119_RELEASE_AUTHORITY.recoveryHistoryRequiresIndependentEvidenceRoots,
    "ARTIFACT-025": RECEIZ_V119_RELEASE_AUTHORITY.recoveryCommitIsAtomic,
    "ARTIFACT-026": RECEIZ_V119_RELEASE_AUTHORITY.commitDomainNamedAndAtomic,
    "ARTIFACT-027": RECEIZ_V113_GLOBAL_COMMIT_DOMAIN.scheme === "receiz-commit-domain.v1",
    "ARTIFACT-028": /idempotencyKey/.test(adapter),
    "ARTIFACT-029": !RECEIZ_V119_RELEASE_AUTHORITY.receiptIsOperationAuthority,
    "ARTIFACT-030": RECEIZ_V119_APPLICATION_OPERATIONS.includes("artifact.global.resolve")
      && RECEIZ_V119_APPLICATION_OPERATIONS.includes("artifact.offline.reconcile")
      && RECEIZ_V119_APPLICATION_OPERATIONS.includes("profile-showcase.genesis.plan")
      && RECEIZ_V119_APPLICATION_OPERATIONS.includes("profile-showcase.append.plan")
      && RECEIZ_V119_APPLICATION_OPERATIONS.includes("economy-showcase.genesis.plan")
      && RECEIZ_V119_APPLICATION_OPERATIONS.includes("economy-showcase.append.plan")
      && RECEIZ_V119_APPLICATION_OPERATIONS.includes("economy-showcase.merge.plan")
  };
  assert.deepEqual(Object.keys(evidence), artifactLaws);
  assert.ok(Object.values(evidence).every(Boolean), JSON.stringify(evidence));
});

test("v119 MCP and AI Skills expose the same nine-tool artifact operation map", () => {
  const mcpOperations = read("node_modules/@receiz/mcp-server/dist/operations.d.ts");
  const aiIndex = JSON.parse(read("node_modules/@receiz/ai-skills/skills.json")) as {
    version: string;
    registryDigest: string;
    operationMatrixDigest: string;
    currentMcpArtifactTools: string[];
  };
  const expectedTools = [
    "receiz_artifact_verify",
    "receiz_artifact_admit",
    "receiz_artifact_append_plan",
    "receiz_artifact_transition_seal_and_stage",
    "receiz_artifact_transition_commit",
    "receiz_artifact_global_resolve",
    "receiz_artifact_reconcile_plan",
    "receiz_artifact_reconcile_stage",
    "receiz_artifact_reconcile_commit"
  ];
  assert.deepEqual(aiIndex.currentMcpArtifactTools, expectedTools);
  for (const operation of expectedTools) assert.match(mcpOperations, new RegExp(operation));
  assert.equal(aiIndex.version, "119.0.0");
  assert.equal(aiIndex.registryDigest, RECEIZ_V119_REGISTRY_DIGEST);
  assert.equal(aiIndex.operationMatrixDigest, RECEIZ_V119_APPLICATION_OPERATION_MATRIX_DIGEST);
});
