import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("PWA controller registers a release-distinct worker after paint", () => {
  const source = readFileSync("src/features/pwa/PwaController.tsx", "utf8");
  const env = readFileSync(".env.example", "utf8");

  assert.match(source, /serviceWorker\.register/);
  assert.match(source, /requestIdleCallback|setTimeout/);
  assert.match(source, /\/sw\.js\?release=/);
  assert.match(source, /NEXT_PUBLIC_WILDZ_SW_RELEASE/);
  assert.match(source, /v3\.0\.0-r118\.0/);
  assert.match(env, /^NEXT_PUBLIC_WILDZ_SW_RELEASE=v3\.0\.0-r118\.0$/m);
});

test("installability is retained and shown only as explicit user consent", () => {
  const source = readFileSync("src/features/pwa/PwaController.tsx", "utf8");

  assert.match(source, /beforeinstallprompt/);
  assert.match(source, /preventDefault\(\)/);
  assert.match(source, /Install Wildz/);
  assert.match(source, /\.prompt\(\)/);
  assert.match(source, /userChoice/);
});

test("applying an update preserves state for a frame and uses the shared message", () => {
  const source = readFileSync("src/features/pwa/PwaController.tsx", "utf8");

  assert.match(source, /Apply update/);
  assert.match(source, /wildz:preserve-state/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /WILDZ_APPLY_UPDATE_MESSAGE/);
});

test("update activation reports success without forcing a reload and can recover on timeout", () => {
  const source = readFileSync("src/features/pwa/PwaController.tsx", "utf8");

  assert.match(source, /addEventListener\("controllerchange"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Update applied/);
  assert.match(source, /Retry update/);
  assert.match(source, /clearTimeout/);
  assert.match(source, /updateRequestedRef/);
  assert.doesNotMatch(source, /location\.reload/);
});
