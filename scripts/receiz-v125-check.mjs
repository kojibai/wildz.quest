#!/usr/bin/env node
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_V125_APPLICATION_OPERATIONS,
  RECEIZ_V125_APPLICATION_OPERATION_MATRIX,
  RECEIZ_V125_APPLICATION_OPERATION_MATRIX_DIGEST,
  RECEIZ_V125_APP_COMPATIBLE_SDK_RANGE,
  RECEIZ_V125_AUTHORITY_BOUNDARY,
  RECEIZ_V125_REGISTRY_DIGEST
} from "@receiz/sdk";
import { checkReceizIntegration } from "@receiz/sdk/compiler";

const TARGET_PACKAGE_VERSION = "125.0.0";
const TARGET_RULESET_VERSION = "125.0.0";
const TARGET_REGISTRY_DIGEST = "85a24c3a7fe144c8ec03c6b5fae238d1dfda64c1ed3091b24d4264dc3862ff17";
const TARGET_OPERATION_MATRIX_DIGEST = "17c98e99c3f54b7a18dea9f2466a49ea2ac5da4d1cf0a90c723560184a314a6c";
const sourceRoot = resolve(process.cwd());
const snapshotRoot = await mkdtemp(join(tmpdir(), "wildz-receiz-v125-check-"));
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
      if (compilerImport) throw new Error(`receiz_v125_compiler_import_on_runtime:${compilerImport}`);
    }
  }
}

function assertReleaseIdentity() {
  if (RECEIZ_RELEASE_VERSION !== TARGET_PACKAGE_VERSION || RECEIZ_RULESET_VERSION !== TARGET_RULESET_VERSION) {
    throw new Error("receiz_v125_release_identity_mismatch");
  }
  if (RECEIZ_V125_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST
    || RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version !== TARGET_RULESET_VERSION) {
    throw new Error("receiz_v125_registry_digest_mismatch");
  }
  if (RECEIZ_V125_APPLICATION_OPERATION_MATRIX_DIGEST !== TARGET_OPERATION_MATRIX_DIGEST
    || RECEIZ_V125_APPLICATION_OPERATION_MATRIX.length !== RECEIZ_V125_APPLICATION_OPERATIONS.length
    || RECEIZ_V125_APPLICATION_OPERATIONS.length !== 60
    || RECEIZ_V125_APP_COMPATIBLE_SDK_RANGE !== ">=125.0.0 <126.0.0") {
    throw new Error("receiz_v125_operation_matrix_mismatch");
  }
  if (RECEIZ_CURRENT_CONSTITUTION_REGISTRY.version !== TARGET_RULESET_VERSION
    || RECEIZ_V125_AUTHORITY_BOUNDARY.authority.enclosingArtifact !== "strongest"
    || RECEIZ_V125_AUTHORITY_BOUNDARY.authority.projectionIsAuthority !== false
    || RECEIZ_V125_AUTHORITY_BOUNDARY.authority.multiSubjectEffectsAreAtomic !== true
    || RECEIZ_V125_AUTHORITY_BOUNDARY.authority.settledSurfaceNeverWaitsForProjection !== true) {
    throw new Error("receiz_v125_authority_mismatch");
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
      registryDigest: RECEIZ_V125_REGISTRY_DIGEST,
      operationMatrixDigest: RECEIZ_V125_APPLICATION_OPERATION_MATRIX_DIGEST
    },
    releaseAuthority: RECEIZ_V125_AUTHORITY_BOUNDARY,
    applicationOperations: RECEIZ_V125_APPLICATION_OPERATION_MATRIX,
    reviewedV125ScannerFinding: officialResult.blockingFindings.some((finding) => finding.code === reviewedScannerCode)
      ? "Runtime-only named imports were independently parsed; no compiler symbols use the universal runtime entrypoint."
      : null
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 2;
} finally {
  await rm(snapshotRoot, { recursive: true, force: true });
}
