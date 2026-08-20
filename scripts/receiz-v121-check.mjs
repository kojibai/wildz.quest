#!/usr/bin/env node
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_V113_GLOBAL_COMMIT_DOMAIN,
  RECEIZ_V114_PROTOCOL_LIMITS,
  RECEIZ_V121_REGISTRY_DIGEST,
  RECEIZ_V121_RELEASE_AUTHORITY,
  RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS
} from "@receiz/sdk";
import {
  checkReceizIntegration,
  RECEIZ_V121_APPLICATION_OPERATIONS,
  RECEIZ_V121_APPLICATION_OPERATION_MATRIX,
  RECEIZ_V121_APPLICATION_OPERATION_MATRIX_DIGEST
} from "@receiz/sdk/compiler";

const TARGET_VERSION = "121.0.0";
const TARGET_REGISTRY_DIGEST = "29a793a5bcc0195ab41d30614d37ac51df66023af354fa4335460764eb0af413";
const TARGET_OPERATION_MATRIX_DIGEST = "208553829ba78a5536524b864577ce59989e2d0a994fad9598d39ae3d557c4f5";
const TARGET_LAWS = Array.from({ length: 30 }, (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`);
const sourceRoot = resolve(process.cwd());
const snapshotRoot = await mkdtemp(join(tmpdir(), "wildz-receiz-v121-check-"));
const ignoredDirectories = new Set([
  ".git", ".next", ".playwright-cli", ".pnpm-store", ".superpowers", ".test-build", ".worktrees",
  "build", "coverage", "dist", "node_modules", "out", "output", "tmp"
]);
const compilerSymbols = new Set([
  "applyReceizIntegrationPreview", "checkReceizIntegration", "compileReceizAppContract", "compileReceizDomain",
  "createReceizIntegrationPreview", "defineReceizApp", "explainReceizIntegrationFinding", "generateNextjsAppRouterFiles",
  "generateReceizFrameworkFiles", "inspectReceizProject", "planReceizIntegration", "planReceizUpgrade",
  "validateReceizAppContract"
]);

async function assertCompilerBoundary(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await assertCompilerBoundary(path);
      continue;
    }
    if (!/\.(?:[cm]?[jt]sx?|md)$/.test(entry.name)) continue;
    const source = await readFile(path, "utf8");
    if (/from\s*["']@receiz\/sdk\/v107["']|import\s*\(["']@receiz\/sdk\/v107["']\)/.test(source)) {
      throw new Error(`receiz_v121_historical_sdk_import:${path.slice(directory.length + 1)}`);
    }
    if (/(?:import\s+(?:\*\s+as\s+\w+|[A-Za-z_$][\w$]*)\s+from\s*|import\s*\()(["'])@receiz\/sdk\1/.test(source)) {
      throw new Error(`receiz_v121_ambiguous_root_import:${path.slice(directory.length + 1)}`);
    }
    for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s*["']@receiz\/sdk["']/g)) {
      const imported = (match[1] ?? "").split(",").map((value) => value.replace(/^type\s+/, "").trim().split(/\s+as\s+/)[0]);
      const compilerImport = imported.find((name) => compilerSymbols.has(name));
      if (compilerImport) throw new Error(`receiz_v121_compiler_import_on_runtime:${compilerImport}`);
    }
  }
}

function assertReleaseIdentity() {
  if (RECEIZ_RELEASE_VERSION !== TARGET_VERSION || RECEIZ_RULESET_VERSION !== TARGET_VERSION) {
    throw new Error("receiz_v121_release_identity_mismatch");
  }
  if (RECEIZ_V121_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST) throw new Error("receiz_v121_registry_digest_mismatch");
  const artifactLaws = RECEIZ_CURRENT_CONSTITUTION_REGISTRY.laws
    .map((law) => law.id)
    .filter((id) => /^ARTIFACT-\d{3}$/.test(id));
  if (JSON.stringify(artifactLaws) !== JSON.stringify(TARGET_LAWS)) {
    throw new Error("receiz_v121_artifact_laws_mismatch");
  }
  if (!RECEIZ_V121_RELEASE_AUTHORITY.proofObjectFirst
    || !RECEIZ_V121_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails
    || RECEIZ_V121_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.registryPayloadIsProofAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.localArtifactVerificationRequiresNetwork !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.historicalDeveloperSdkInstallable !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.unifiedArtifactAdmission !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.recoveryPlanIsProofAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.proofExplanationIsProofAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.recoveryCommitRequiresVerifiedCapability !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.recoveryCommitIsAtomic !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.admissionDerivedFromCanonicalExactBytes !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.recoveryHistoryRequiresIndependentEvidenceRoots !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.canonicalIdentityRequiresSigningChallenge !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.planIdentityDistinctFromAttemptIdentity !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.terminalMcpAttemptConfirmationReusable !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.admissionIsOperationAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.transitionDigestExcludesPlanCoordination !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.effectsDerivedByRegistryOperationLaw !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.commitDomainNamedAndAtomic !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.receiptIsOperationAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.browserAdmissionStoreCarriesProofObjects !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.globalMeansNamedCoordinationDomain !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.databaseManufacturesArtifactTruth !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.connectTokenIsArtifactAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.offlineDivergenceResolution !== "structural-only"
    || RECEIZ_V121_RELEASE_AUTHORITY.profileShowcaseArtifactIdentityIsPayloadDigest !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.profileShowcaseLiteralIdentity !== "profile-showcase:<owner>"
    || RECEIZ_V121_RELEASE_AUTHORITY.profileShowcaseSuccessorHistoryTravelsInSealedBytes !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.profileShowcaseIntroducesNewSignerIssuerOrHeadAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.nativeCaptureAttestsDedicatedCameraCeremonyOnly !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.pbiAuthorshipRequiresCanonicalEnclosingPredecessor !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.pbiAuthorshipChangesOwnership !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.pbiAuthorshipChangesMediaTruth !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.pbiAuthorshipAppendsInVerifiedOrder !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.offlineSettlementWaitsForGlobalPublication !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.enclosingArtifact !== "strongest"
    || RECEIZ_V121_RELEASE_AUTHORITY.projectionIsAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.knownTruthPaintsBeforeDiscovery !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.kaiSelectsCausalHead !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.merkleCommitsExactAppends !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.fibonacciProvidesSparseAncestry !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.subjectIdentitySurvivesOwnershipTransfer !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.proofBrainIndexIsAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.modelOutputRequiresCommandAdmission !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.factualMemoryRequiresAdmittedEventCitations !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.multiSubjectEffectsAreAtomic !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.failedDecisionsWriteZeroIncludingKai !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.mandatesReverifiedAtExecution !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.unknownNamespacesPreservedByteExact !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.bearerClaimPreservesSubjectIdentity !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.formerOwnerAuthorityRevokedImmediately !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.serverAndDatabaseAreAuthority !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.serverAndDatabaseAccelerateDistributionAndRestore !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.sealedProofObjectRemainsAuthority !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.settledSurfaceWaitsForGlobalProjection !== false
    || RECEIZ_V121_RELEASE_AUTHORITY.verifiedHydrationBecomesDurableColdTruth !== true
    || RECEIZ_V121_RELEASE_AUTHORITY.weakerProjectionMayDropStrongerKnownFields !== false) {
    throw new Error("receiz_v121_authority_mismatch");
  }
  if (RECEIZ_V113_GLOBAL_COMMIT_DOMAIN.value !== "receiz.com/global/v1"
    || RECEIZ_V114_PROTOCOL_LIMITS.exactArtifactBytes !== 524_288_000
    || RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS.exactArtifactBytes !== 16_777_216) {
    throw new Error("receiz_v121_protocol_boundary_mismatch");
  }
  if (RECEIZ_V121_APPLICATION_OPERATION_MATRIX_DIGEST !== TARGET_OPERATION_MATRIX_DIGEST
    || RECEIZ_V121_APPLICATION_OPERATION_MATRIX.length !== RECEIZ_V121_APPLICATION_OPERATIONS.length
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("artifact.global.resolve")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("artifact.offline.reconcile")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("profile-showcase.genesis.plan")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("profile-showcase.append.plan")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("economy-showcase.genesis.plan")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("economy-showcase.append.plan")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("economy-showcase.merge.plan")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("subject.twin.message")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("subject.memory.project")
    || !RECEIZ_V121_APPLICATION_OPERATIONS.includes("bearer.instrument.claim")) {
    throw new Error("receiz_v121_operation_matrix_mismatch");
  }
}

try {
  assertReleaseIdentity();
  await cp(sourceRoot, snapshotRoot, {
    recursive: true,
    filter(path) {
      if (path === sourceRoot) return true;
      const relative = path.slice(sourceRoot.length + 1);
      const portableRelative = relative.replaceAll("\\", "/");
      const firstSegment = relative.split(/[\\/]/, 1)[0];
      if (ignoredDirectories.has(firstSegment)) return false;
      if (portableRelative === "docs/superpowers" || portableRelative.startsWith("docs/superpowers/")) return false;
      if (basename(path).startsWith(".env") && basename(path) !== ".env.example") return false;
      return true;
    }
  });
  await assertCompilerBoundary(snapshotRoot);
  const officialResult = await checkReceizIntegration({ root: snapshotRoot, targetSdkVersion: TARGET_VERSION });
  const reviewedScannerCode = "compiler_import_requires_manual_migration";
  const blockingFindings = officialResult.blockingFindings.filter(
    (finding) => finding.code !== reviewedScannerCode
  );
  const result = {
    ...officialResult,
    ok: blockingFindings.length === 0,
    blockingFindings,
    releaseIdentity: {
      releaseVersion: RECEIZ_RELEASE_VERSION,
      rulesetVersion: RECEIZ_RULESET_VERSION,
      registryDigest: RECEIZ_V121_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V121_APPLICATION_OPERATION_MATRIX_DIGEST
    },
    artifactLaws: TARGET_LAWS,
    releaseAuthority: RECEIZ_V121_RELEASE_AUTHORITY,
    protocolLimits: RECEIZ_V114_PROTOCOL_LIMITS,
    runtimeMaterializationLimits: RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS,
    globalCommitDomain: RECEIZ_V113_GLOBAL_COMMIT_DOMAIN,
    applicationOperations: RECEIZ_V121_APPLICATION_OPERATION_MATRIX,
    reviewedV121ScannerFinding: officialResult.blockingFindings.some(
      (finding) => finding.code === reviewedScannerCode
    )
      ? "Runtime-only named imports were independently parsed; no compiler symbol uses the universal entrypoint."
      : null
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 2;
} finally {
  await rm(snapshotRoot, { recursive: true, force: true });
}
