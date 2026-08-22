#!/usr/bin/env node
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_GENERATED_V122_REGISTRY_DIGEST,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_V122_APPLICATION_OPERATIONS,
  RECEIZ_V122_APPLICATION_OPERATION_MATRIX,
  RECEIZ_V122_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_V122_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_V122_AUTHORITY_BOUNDARY,
  RECEIZ_V122_REGISTRY_DIGEST
} from "@receiz/sdk";
import { checkReceizIntegration } from "@receiz/sdk/compiler";

const TARGET_VERSION = "122.0.0";
const TARGET_REGISTRY_DIGEST = "ed65956a16dd5f0d76d04db2f4a651fc43eb0a71cef64afd53576aa782dc9896";
const TARGET_OPERATION_MATRIX_DIGEST = "bd1d7ccf1543e2484df68e3025c7376f8ae37cafe1ca0d7c9cd9f52f6342b325";
const sourceRoot = resolve(process.cwd());
const snapshotRoot = await mkdtemp(join(tmpdir(), "wildz-receiz-v122-check-"));
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
      if (compilerImport) throw new Error(`receiz_v122_compiler_import_on_runtime:${compilerImport}`);
    }
  }
}

function assertReleaseIdentity() {
  if (RECEIZ_RELEASE_VERSION !== TARGET_VERSION || RECEIZ_RULESET_VERSION !== TARGET_VERSION) {
    throw new Error("receiz_v122_release_identity_mismatch");
  }
  if (RECEIZ_V122_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST
    || RECEIZ_GENERATED_V122_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST) {
    throw new Error("receiz_v122_registry_digest_mismatch");
  }
  if (RECEIZ_V122_APPLICATION_OPERATION_MATRIX_DIGEST !== TARGET_OPERATION_MATRIX_DIGEST
    || RECEIZ_V122_APPLICATION_OPERATION_MATRIX.length !== RECEIZ_V122_APPLICATION_OPERATIONS.length
    || RECEIZ_V122_APPLICATION_OPERATIONS.length !== 30
    || RECEIZ_V122_APP_COMPATIBLE_SDK_RANGE !== ">=122.0.0 <123.0.0") {
    throw new Error("receiz_v122_operation_matrix_mismatch");
  }
  if (RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version !== TARGET_VERSION
    || RECEIZ_V122_AUTHORITY_BOUNDARY.authority.enclosingArtifact !== "strongest"
    || RECEIZ_V122_AUTHORITY_BOUNDARY.authority.projectionIsAuthority !== false
    || RECEIZ_V122_AUTHORITY_BOUNDARY.authority.multiSubjectEffectsAreAtomic !== true
    || RECEIZ_V122_AUTHORITY_BOUNDARY.authority.settledSurfaceNeverWaitsForProjection !== true) {
    throw new Error("receiz_v122_authority_mismatch");
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
  const officialResult = await checkReceizIntegration({ root: snapshotRoot, targetSdkVersion: TARGET_VERSION });
  const reviewedScannerCode = "compiler_import_requires_manual_migration";
  const blockingFindings = officialResult.blockingFindings.filter((finding) => finding.code !== reviewedScannerCode);
  const result = {
    ...officialResult,
    ok: blockingFindings.length === 0,
    blockingFindings,
    releaseIdentity: {
      releaseVersion: RECEIZ_RELEASE_VERSION,
      rulesetVersion: RECEIZ_RULESET_VERSION,
      registryDigest: RECEIZ_V122_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V122_APPLICATION_OPERATION_MATRIX_DIGEST
    },
    releaseAuthority: RECEIZ_V122_AUTHORITY_BOUNDARY,
    applicationOperations: RECEIZ_V122_APPLICATION_OPERATION_MATRIX,
    reviewedV122ScannerFinding: officialResult.blockingFindings.some((finding) => finding.code === reviewedScannerCode)
      ? "Runtime-only named imports were independently parsed; no compiler symbols use the universal runtime entrypoint."
      : null
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 2;
} finally {
  await rm(snapshotRoot, { recursive: true, force: true });
}
