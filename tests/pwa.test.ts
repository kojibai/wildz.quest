import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("PWA manifest is standalone, portrait-first, and fully Wildz branded", () => {
  const source = readFileSync("app/manifest.ts", "utf8");

  assert.match(source, /name:\s*WILDZ_PRODUCT\.name/);
  assert.match(source, /display:\s*"standalone"/);
  assert.match(source, /orientation:\s*"portrait-primary"/);
  assert.match(source, /start_url:\s*"\/"/);
  assert.match(source, /purpose:\s*"maskable"/);
});

test("service worker classifies identity and mutation APIs as network-only", () => {
  const source = readFileSync("public/sw.js", "utf8");

  assert.match(source, /NETWORK_ONLY_PREFIXES/);
  assert.match(source, /"\/api\/auth"/);
  assert.match(source, /"\/api\/market"/);
  assert.match(source, /request\.method !== "GET"/);
  assert.match(source, /authorization/i);
});

test("offline guidance is honest about cached reads and connected actions", () => {
  const source = readFileSync("app/offline/page.tsx", "utf8");

  assert.match(source, /previously visited public profiles/i);
  assert.match(source, /cached card details/i);
  assert.match(source, /require a connection/i);
  assert.match(source, /sign-in/i);
  assert.match(source, /market/i);
  assert.doesNotMatch(source, /live game works offline/i);
});
