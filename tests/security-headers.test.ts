import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

const EXPECTED_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https:",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' blob:"
].join("; ");

test("Next emits the complete global security-header contract", async () => {
  const moduleUrl = pathToFileURL(resolve("next.config.mjs")).href;
  const nextConfig = (await import(moduleUrl)).default as { headers(): Promise<HeaderRule[]> };
  const rules = await nextConfig.headers();
  const globalRule = rules.find((rule) => rule.source === "/:path*");

  assert.ok(globalRule, "a catch-all response-header rule exists");
  const headers = new Map(globalRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.equal(headers.get("content-security-policy"), EXPECTED_CSP);
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("referrer-policy"), "no-referrer");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(headers.get("cross-origin-opener-policy"), "same-origin");
  assert.ok(!headers.has("strict-transport-security"), "the deployment layer owns HSTS");
  assert.ok(!headers.has("access-control-allow-origin"), "there is no blanket CORS policy");
});

test("service-worker delivery is revalidated while inheriting the global header rule", async () => {
  const moduleUrl = pathToFileURL(resolve("next.config.mjs")).href;
  const nextConfig = (await import(moduleUrl)).default as { headers(): Promise<HeaderRule[]> };
  const rules = await nextConfig.headers();
  const workerRule = rules.find((rule) => rule.source === "/sw.js");

  assert.ok(rules.some((rule) => rule.source === "/:path*"), "global headers cover /sw.js");
  assert.ok(workerRule, "the worker has a delivery-specific header rule");
  const headers = new Map(workerRule.headers.map((header) => [header.key.toLowerCase(), header.value]));
  assert.equal(headers.get("cache-control"), "no-cache, no-store, must-revalidate");
  assert.equal(headers.get("service-worker-allowed"), "/");
});
