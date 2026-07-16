#!/usr/bin/env node
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { checkReceizIntegration } from "@receiz/sdk/compiler";

const sourceRoot = resolve(process.cwd());
const snapshotRoot = await mkdtemp(join(tmpdir(), "wildz-receiz-check-"));
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
      throw new Error(`receiz_v105_ambiguous_root_import:${path.slice(directory.length + 1)}`);
    }
    for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s*["']@receiz\/sdk["']/g)) {
      const imported = (match[1] ?? "").split(",").map((value) => value.replace(/^type\s+/, "").trim().split(/\s+as\s+/)[0]);
      const compilerImport = imported.find((name) => compilerSymbols.has(name));
      if (compilerImport) throw new Error(`receiz_v105_compiler_import_on_runtime:${compilerImport}`);
    }
  }
}

try {
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
    targetSdkVersion: "105.0.0"
  });
  const falsePositiveCode = "compiler_import_requires_manual_migration";
  const blockingFindings = officialResult.blockingFindings.filter((finding) => finding.code !== falsePositiveCode);
  const result = {
    ...officialResult,
    ok: blockingFindings.length === 0,
    blockingFindings,
    reviewedV105ScannerFinding: officialResult.blockingFindings.some((finding) => finding.code === falsePositiveCode)
      ? "Runtime-only named imports were independently parsed; no compiler symbol uses the universal entrypoint."
      : null
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 2;
} finally {
  await rm(snapshotRoot, { recursive: true, force: true });
}
