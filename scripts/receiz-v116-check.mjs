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
  RECEIZ_V116_REGISTRY_DIGEST,
  RECEIZ_V116_RELEASE_AUTHORITY,
  RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS
} from "@receiz/sdk";
import {
  checkReceizIntegration,
  RECEIZ_V116_APPLICATION_OPERATIONS,
  RECEIZ_V116_APPLICATION_OPERATION_MATRIX,
  RECEIZ_V116_APPLICATION_OPERATION_MATRIX_DIGEST
} from "@receiz/sdk/compiler";

const TARGET_VERSION = "116.0.0";
const TARGET_REGISTRY_DIGEST = "9bf61fcf4541edf565bb2ded252e35a976a3ca7c9176dea0f1ffac74ce192a80";
const TARGET_OPERATION_MATRIX_DIGEST = "ec5829eeec039c1f4885d056b8cd6cf6506d08547cee58daa229ecbd44155420";
const TARGET_LAWS = Array.from({ length: 30 }, (_, index) => `ARTIFACT-${String(index + 1).padStart(3, "0")}`);
const sourceRoot = resolve(process.cwd());
const snapshotRoot = await mkdtemp(join(tmpdir(), "wildz-receiz-v116-check-"));
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
      throw new Error(`receiz_v116_historical_sdk_import:${path.slice(directory.length + 1)}`);
    }
    if (/(?:import\s+(?:\*\s+as\s+\w+|[A-Za-z_$][\w$]*)\s+from\s*|import\s*\()(["'])@receiz\/sdk\1/.test(source)) {
      throw new Error(`receiz_v116_ambiguous_root_import:${path.slice(directory.length + 1)}`);
    }
    for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s*["']@receiz\/sdk["']/g)) {
      const imported = (match[1] ?? "").split(",").map((value) => value.replace(/^type\s+/, "").trim().split(/\s+as\s+/)[0]);
      const compilerImport = imported.find((name) => compilerSymbols.has(name));
      if (compilerImport) throw new Error(`receiz_v116_compiler_import_on_runtime:${compilerImport}`);
    }
  }
}

function assertReleaseIdentity() {
  if (RECEIZ_RELEASE_VERSION !== TARGET_VERSION || RECEIZ_RULESET_VERSION !== TARGET_VERSION) {
    throw new Error("receiz_v116_release_identity_mismatch");
  }
  if (RECEIZ_V116_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST) throw new Error("receiz_v116_registry_digest_mismatch");
  const artifactLaws = RECEIZ_CURRENT_CONSTITUTION_REGISTRY.laws
    .map((law) => law.id)
    .filter((id) => /^ARTIFACT-\d{3}$/.test(id));
  if (JSON.stringify(artifactLaws) !== JSON.stringify(TARGET_LAWS)) {
    throw new Error("receiz_v116_artifact_laws_mismatch");
  }
  if (!RECEIZ_V116_RELEASE_AUTHORITY.proofObjectFirst
    || !RECEIZ_V116_RELEASE_AUTHORITY.receizComReferenceBeforeDeveloperRails
    || RECEIZ_V116_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.registryPayloadIsProofAuthority !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.localArtifactVerificationRequiresNetwork !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.historicalDeveloperSdkInstallable !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.unifiedArtifactAdmission !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.recoveryPlanIsProofAuthority !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.proofExplanationIsProofAuthority !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.recoveryCommitRequiresVerifiedCapability !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.recoveryCommitIsAtomic !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.admissionDerivedFromCanonicalExactBytes !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.recoveryHistoryRequiresIndependentEvidenceRoots !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.canonicalIdentityRequiresSigningChallenge !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.planIdentityDistinctFromAttemptIdentity !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.terminalMcpAttemptConfirmationReusable !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.admissionIsOperationAuthority !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.transitionDigestExcludesPlanCoordination !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.effectsDerivedByRegistryOperationLaw !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.commitDomainNamedAndAtomic !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.receiptIsOperationAuthority !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.browserAdmissionStoreCarriesProofObjects !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.globalMeansNamedCoordinationDomain !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.databaseManufacturesArtifactTruth !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.connectTokenIsArtifactAuthority !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.offlineDivergenceResolution !== "structural-only"
    || RECEIZ_V116_RELEASE_AUTHORITY.profileShowcaseArtifactIdentityIsPayloadDigest !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.profileShowcaseLiteralIdentity !== "profile-showcase:<owner>"
    || RECEIZ_V116_RELEASE_AUTHORITY.profileShowcaseSuccessorHistoryTravelsInSealedBytes !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.profileShowcaseIntroducesNewSignerIssuerOrHeadAuthority !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.nativeCaptureAttestsDedicatedCameraCeremonyOnly !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.pbiAuthorshipRequiresCanonicalEnclosingPredecessor !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.pbiAuthorshipChangesOwnership !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.pbiAuthorshipChangesMediaTruth !== false
    || RECEIZ_V116_RELEASE_AUTHORITY.pbiAuthorshipAppendsInVerifiedOrder !== true
    || RECEIZ_V116_RELEASE_AUTHORITY.offlineSettlementWaitsForGlobalPublication !== false) {
    throw new Error("receiz_v116_authority_mismatch");
  }
  if (RECEIZ_V113_GLOBAL_COMMIT_DOMAIN.value !== "receiz.com/global/v1"
    || RECEIZ_V114_PROTOCOL_LIMITS.exactArtifactBytes !== 524_288_000
    || RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS.exactArtifactBytes !== 16_777_216) {
    throw new Error("receiz_v116_protocol_boundary_mismatch");
  }
  if (RECEIZ_V116_APPLICATION_OPERATION_MATRIX_DIGEST !== TARGET_OPERATION_MATRIX_DIGEST
    || RECEIZ_V116_APPLICATION_OPERATION_MATRIX.length !== RECEIZ_V116_APPLICATION_OPERATIONS.length
    || !RECEIZ_V116_APPLICATION_OPERATIONS.includes("artifact.global.resolve")
    || !RECEIZ_V116_APPLICATION_OPERATIONS.includes("artifact.offline.reconcile")
    || !RECEIZ_V116_APPLICATION_OPERATIONS.includes("profile-showcase.genesis.plan")
    || !RECEIZ_V116_APPLICATION_OPERATIONS.includes("profile-showcase.append.plan")
    || !RECEIZ_V116_APPLICATION_OPERATIONS.includes("economy-showcase.genesis.plan")
    || !RECEIZ_V116_APPLICATION_OPERATIONS.includes("economy-showcase.append.plan")
    || !RECEIZ_V116_APPLICATION_OPERATIONS.includes("economy-showcase.merge.plan")) {
    throw new Error("receiz_v116_operation_matrix_mismatch");
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
      registryDigest: RECEIZ_V116_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V116_APPLICATION_OPERATION_MATRIX_DIGEST
    },
    artifactLaws: TARGET_LAWS,
    releaseAuthority: RECEIZ_V116_RELEASE_AUTHORITY,
    protocolLimits: RECEIZ_V114_PROTOCOL_LIMITS,
    runtimeMaterializationLimits: RECEIZ_V114_RUNTIME_MATERIALIZATION_LIMITS,
    globalCommitDomain: RECEIZ_V113_GLOBAL_COMMIT_DOMAIN,
    applicationOperations: RECEIZ_V116_APPLICATION_OPERATION_MATRIX,
    reviewedV116ScannerFinding: officialResult.blockingFindings.some(
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
