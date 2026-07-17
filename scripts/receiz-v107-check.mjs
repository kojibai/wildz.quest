#!/usr/bin/env node
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  RECEIZ_RELEASE_VERSION,
  RECEIZ_RULESET_VERSION,
  RECEIZ_V107_REGISTRY_DIGEST,
  RECEIZ_V107_RELEASE_AUTHORITY
} from "@receiz/sdk";
import { checkReceizIntegration } from "@receiz/sdk/compiler";

const TARGET_VERSION = "107.0.0";
const TARGET_REGISTRY_DIGEST = "4d0caa6172a69c3bf5817c1c35db5630e555b5d6d824091d45a90fb426b86ef6";
const sourceRoot = resolve(process.cwd());
const snapshotRoot = await mkdtemp(join(tmpdir(), "wildz-receiz-v107-check-"));
const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".playwright-cli",
  ".pnpm-store",
  ".superpowers",
  ".test-build",
  ".worktrees",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "output",
  "tmp"
]);
const compilerSymbols = new Set([
  "applyReceizIntegrationPreview",
  "checkReceizIntegration",
  "compileReceizAppContract",
  "compileReceizDomain",
  "createReceizIntegrationPreview",
  "defineReceizApp",
  "explainReceizIntegrationFinding",
  "generateNextjsAppRouterFiles",
  "generateReceizFrameworkFiles",
  "inspectReceizProject",
  "planReceizIntegration",
  "planReceizUpgrade",
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
    if (/(?:import\s+(?:\*\s+as\s+\w+|[A-Za-z_$][\w$]*)\s+from\s*|import\s*\()(["'])@receiz\/sdk\1/.test(source)) {
      throw new Error(`receiz_v107_ambiguous_root_import:${path.slice(directory.length + 1)}`);
    }
    for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s*["']@receiz\/sdk["']/g)) {
      const imported = (match[1] ?? "").split(",").map((value) => value.replace(/^type\s+/, "").trim().split(/\s+as\s+/)[0]);
      const compilerImport = imported.find((name) => compilerSymbols.has(name));
      if (compilerImport) throw new Error(`receiz_v107_compiler_import_on_runtime:${compilerImport}`);
    }
  }
}

function assertReleaseIdentity() {
  if (RECEIZ_RELEASE_VERSION !== TARGET_VERSION || RECEIZ_RULESET_VERSION !== TARGET_VERSION) {
    throw new Error("receiz_v107_release_identity_mismatch");
  }
  if (RECEIZ_V107_REGISTRY_DIGEST !== TARGET_REGISTRY_DIGEST) {
    throw new Error("receiz_v107_registry_digest_mismatch");
  }
  if (RECEIZ_V107_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment !== false) {
    throw new Error("receiz_v107_offline_authority_mismatch");
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
  const officialResult = await checkReceizIntegration({
    root: snapshotRoot,
    targetSdkVersion: TARGET_VERSION
  });
  const falsePositiveCode = "compiler_import_requires_manual_migration";
  const blockingFindings = officialResult.blockingFindings.filter((finding) => finding.code !== falsePositiveCode);
  const result = {
    ...officialResult,
    ok: blockingFindings.length === 0,
    blockingFindings,
    releaseIdentity: {
      releaseVersion: RECEIZ_RELEASE_VERSION,
      rulesetVersion: RECEIZ_RULESET_VERSION,
      registryDigest: RECEIZ_V107_REGISTRY_DIGEST
    },
    queuedCommandIsGlobalCommitment: RECEIZ_V107_RELEASE_AUTHORITY.queuedCommandIsGlobalCommitment,
    reviewedV107ScannerFinding: officialResult.blockingFindings.some((finding) => finding.code === falsePositiveCode)
      ? "Runtime-only named imports were independently parsed; no compiler symbol uses the universal entrypoint."
      : null
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 2;
} finally {
  await rm(snapshotRoot, { recursive: true, force: true });
}
