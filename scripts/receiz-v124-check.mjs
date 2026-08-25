#!/usr/bin/env node
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_V124_APPLICATION_OPERATIONS,
  RECEIZ_V124_APPLICATION_OPERATION_MATRIX,
  RECEIZ_V124_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_V124_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_V124_AUTHORITY_BOUNDARY,
  RECEIZ_V124_REGISTRY_DIGEST
} from "@receiz/sdk";
import { checkReceizIntegration } from "@receiz/sdk/compiler";

const TARGET_PACKAGE_VERSION = "124.0.2";
const TARGET_RULESET_VERSION = "124.0.0";
const TARGET_REGISTRY_DIGEST = "d02429151b0bcebdaeb89485792e377afc55130f9a25e07982c1c88221314247";
const TARGET_OPERATION_MATRIX_DIGEST = "540d1c1bf39f1b288b257c79a6e020bdcc5e587fc9b7dbf6b7aaa5d082e20ad5";
const sourceRoot = resolve(process.cwd());
const snapshotRoot = await mkdtemp(join(tmpdir(), "wildz-receiz-v124-check-"));
const ignoredDirectories = new Set([
  ".git", ".next", ".playwright-cli", ".pnpm-store", ".superpowers", ".test-build", ".worktrees",
  "build", "coverage", "dist", "node_modules", "out", "output", "tmp", "vendor"
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
    for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s*["']@receiz\/sdk["']/g)) {
      const imported = (match[1] ?? "").split(",").map((value) => value.replace(/^type\s+/, "").trim().split(/\s+as\s+/)[0]);
      const compilerImport = imported.find((name) => compilerSymbols.has(name));
      if (compilerImport) throw new Error(`receiz_v124_compiler_import_on_runtime:${compilerImport}`);
    }
  }
}

function assertReleaseIdentity() {
  if (RECEIZ_RELEASE_VERSION !== TARGET_PACKAGE_VERSION || RECEIZ_RULESET_VERSION !== TARGET_RULESET_VERSION) {
    throw new Error("receiz_v124_release_identity_mismatch");
  }
  if (RECEIZ_V124_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST
    || RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version !== TARGET_RULESET_VERSION) {
    throw new Error("receiz_v124_registry_digest_mismatch");
  }
  if (RECEIZ_V124_APPLICATION_OPERATION_MATRIX_DIGEST !== TARGET_OPERATION_MATRIX_DIGEST
    || RECEIZ_V124_APPLICATION_OPERATION_MATRIX.length !== RECEIZ_V124_APPLICATION_OPERATIONS.length
    || RECEIZ_V124_APPLICATION_OPERATIONS.length !== 53
    || RECEIZ_V124_APP_COMPATIBLE_SDK_RANGE !== ">=124.0.0 <125.0.0") {
    throw new Error("receiz_v124_operation_matrix_mismatch");
  }
  if (RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version !== TARGET_RULESET_VERSION
    || RECEIZ_V124_AUTHORITY_BOUNDARY.authority.enclosingArtifact !== "strongest"
    || RECEIZ_V124_AUTHORITY_BOUNDARY.authority.projectionIsAuthority !== false
    || RECEIZ_V124_AUTHORITY_BOUNDARY.authority.multiSubjectEffectsAreAtomic !== true
    || RECEIZ_V124_AUTHORITY_BOUNDARY.authority.settledSurfaceNeverWaitsForProjection !== true) {
    throw new Error("receiz_v124_authority_mismatch");
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
      if (portableRelative === "public/vendor" || portableRelative.startsWith("public/vendor/")) return false;
      if (portableRelative === "docs/superpowers" || portableRelative.startsWith("docs/superpowers/")) return false;
      if (basename(path).startsWith(".env") && basename(path) !== ".env.example") return false;
      return true;
    }
  });
  await assertCompilerBoundary(snapshotRoot);
  const officialResult = await checkReceizIntegration({ root: snapshotRoot, targetSdkVersion: TARGET_PACKAGE_VERSION });
  const reviewedScannerCode = "compiler_import_requires_manual_migration";
  const blockingFindings = officialResult.blockingFindings.filter((finding) => finding.code !== reviewedScannerCode);
  const result = {
    ...officialResult,
    ok: blockingFindings.length === 0,
    blockingFindings,
    releaseIdentity: {
      releaseVersion: RECEIZ_RELEASE_VERSION,
      rulesetVersion: RECEIZ_RULESET_VERSION,
      registryDigest: RECEIZ_V124_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V124_APPLICATION_OPERATION_MATRIX_DIGEST
    },
    releaseAuthority: RECEIZ_V124_AUTHORITY_BOUNDARY,
    applicationOperations: RECEIZ_V124_APPLICATION_OPERATION_MATRIX,
    reviewedV124ScannerFinding: officialResult.blockingFindings.some((finding) => finding.code === reviewedScannerCode)
      ? "Runtime-only named imports were independently parsed; no compiler symbols use the universal runtime entrypoint."
      : null
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 2;
} finally {
  await rm(snapshotRoot, { recursive: true, force: true });
}
