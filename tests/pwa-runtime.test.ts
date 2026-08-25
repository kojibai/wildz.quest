import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("first service-worker takeover does not reload an already rendered game", async () => {
  const events = await import("../src/features/pwa/pwa-events");
  const controllerChangeAction = (
    events as typeof events & {
      pwaControllerChangeAction?: (updateRequested: boolean) => "ignore" | "reload";
    }
  ).pwaControllerChangeAction;

  assert.equal(typeof controllerChangeAction, "function");
  assert.equal(controllerChangeAction?.(false), "ignore");
  assert.equal(controllerChangeAction?.(true), "reload");
});

test("PWA controller registers a release-distinct worker after paint", () => {
  const source = readFileSync("src/features/pwa/PwaController.tsx", "utf8");
  const env = readFileSync(".env.example", "utf8");

  assert.match(source, /serviceWorker\.register/);
  assert.match(source, /requestIdleCallback|setTimeout/);
  assert.match(source, /\/sw\.js\?release=/);
  assert.match(source, /NEXT_PUBLIC_WILDZ_SW_RELEASE/);
  assert.match(source, /v8\.0\.0-r1/);
  assert.match(env, /^NEXT_PUBLIC_WILDZ_SW_RELEASE=v8\.0\.0-r1$/m);
});

test("local neural voice preparation is complete-once and single-flight across rapid refreshes", () => {
  const worker = readFileSync("public/sw.js", "utf8");

  assert.match(worker, /LOCAL_VOICE_READY_URL/);
  assert.match(worker, /localVoicePreparationPromise/);
  assert.match(worker, /if \(await cache\.match\(LOCAL_VOICE_READY_URL\)\) return/);
  assert.match(worker, /if \(localVoicePreparationPromise\) return localVoicePreparationPromise/);
  assert.ok(worker.indexOf("cache.put(LOCAL_VOICE_READY_URL") > worker.indexOf("for (const pathname of LOCAL_VOICE_URLS)"));
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

test("update activation preserves state and reloads into one coherent Next release", () => {
  const source = readFileSync("src/features/pwa/PwaController.tsx", "utf8");

  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Update applied/);
  assert.doesNotMatch(source, /Retry update/);
  assert.match(source, /activateWaitingUpdate/);
  assert.match(source, /location\.reload/);
});
