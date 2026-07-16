import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

test("package metadata points at the Wildz repository", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    repository: { url: string };
    bugs: { url: string };
    keywords: string[];
  };

  assert.equal(packageJson.repository.url, "git+https://github.com/kojibai/wildz.quest.git");
  assert.equal(packageJson.bugs.url, "https://github.com/kojibai/wildz.quest/issues");
  assert.ok(packageJson.keywords.includes("pwa"));
  assert.ok(packageJson.keywords.includes("wildz"));
  assert.ok(!packageJson.keywords.includes("commerce-saas-template"));
});

test("all declared mobile PWA icons have their advertised dimensions", () => {
  const icons = [
    ["public/icons/icon-180.png", 180],
    ["public/icons/icon-192.png", 192],
    ["public/icons/icon-512.png", 512],
    ["public/icons/icon-maskable-192.png", 192],
    ["public/icons/icon-maskable-512.png", 512]
  ] as const;

  for (const [path, expectedSize] of icons) {
    const png = readFileSync(path);
    assert.equal(png.toString("ascii", 1, 4), "PNG", `${path} is a PNG`);
    assert.equal(png.readUInt32BE(16), expectedSize, `${path} width`);
    assert.equal(png.readUInt32BE(20), expectedSize, `${path} height`);
  }
});

test("mobile metadata uses the iOS icon and keeps pinch zoom available", () => {
  const source = readFileSync("app/layout.tsx", "utf8");

  assert.match(source, /apple:\s*"\/icons\/icon-180\.png"/);
  assert.doesNotMatch(source, /maximumScale/);
  assert.match(source, /userScalable:\s*true/);
});

test("Vercel output tracing excludes transient runtime-guard and local-only files", async () => {
  const moduleUrl = `${pathToFileURL(resolve("next.config.mjs")).href}?trace-test=${Date.now()}`;
  const nextConfig = (await import(moduleUrl)).default as {
    outputFileTracingExcludes?: Record<string, string[]>;
  };
  const excludes = nextConfig.outputFileTracingExcludes?.["/*"] ?? [];

  assert.ok(excludes.includes("tmp/**/*"), "the deleted runtime marker must never enter a server trace");
  assert.ok(excludes.includes(".git/**/*"), "git internals are not runtime dependencies");
  assert.ok(excludes.includes(".test-build/**/*"), "compiled test output is not a runtime dependency");
  assert.ok(excludes.includes("tests/**/*"), "test sources are not runtime dependencies");
});
