import assert from "node:assert/strict";
import { test } from "node:test";
import { Scene } from "three";
import { observeWildsFirstFrame } from "../src/features/play/wilds-first-frame";

function completeDraw(scene: Scene) {
  scene.onAfterRender(...([] as unknown as Parameters<Scene["onAfterRender"]>));
}

test("readiness follows the completed draw once without waiting for another frame", async () => {
  const scene = new Scene();
  const events: string[] = [];
  const previous = () => { events.push("previous"); };
  scene.onAfterRender = previous;
  const stop = observeWildsFirstFrame(scene, () => { events.push("ready"); });
  await Promise.resolve();
  assert.deepEqual(events, []);
  completeDraw(scene);
  assert.deepEqual(events, ["previous"]);
  assert.equal(scene.onAfterRender, previous);
  await Promise.resolve();
  assert.deepEqual(events, ["previous", "ready"]);
  completeDraw(scene);
  await Promise.resolve();
  assert.deepEqual(events, ["previous", "ready", "previous"]);
  stop();
});

test("unmount cancels queued readiness and preserves a subsequently installed observer", async () => {
  const scene = new Scene();
  let ready = 0;
  const stop = observeWildsFirstFrame(scene, () => { ready++; });
  completeDraw(scene);
  const next = () => {};
  scene.onAfterRender = next;
  stop();
  await Promise.resolve();
  assert.equal(ready, 0);
  assert.equal(scene.onAfterRender, next);
});

test("unmount before drawing restores the previous callback without publishing readiness", async () => {
  const scene = new Scene();
  const previous = scene.onAfterRender;
  let ready = 0;
  const stop = observeWildsFirstFrame(scene, () => { ready++; });
  stop();
  assert.equal(scene.onAfterRender, previous);
  await Promise.resolve();
  assert.equal(ready, 0);
});
