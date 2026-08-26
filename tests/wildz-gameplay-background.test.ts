import assert from "node:assert/strict";
import test from "node:test";
import { createWildzGameplayBackgroundRunner } from "../src/lib/performance/wildz-gameplay-background";

test("gameplay background work uses browser background priority when available", async () => {
  const priorities: string[] = [];
  const runner = createWildzGameplayBackgroundRunner({
    postTask: async <Value>(task: () => Value | Promise<Value>, options: { priority: "background" }) => {
      priorities.push(options.priority);
      return task();
    }
  });

  const result = await runner.run(() => 42);

  assert.equal(result, 42);
  assert.deepEqual(priorities, ["background"]);
});

test("gameplay background work uses an idle deadline without blocking the triggering frame", async () => {
  const events: string[] = [];
  let idleCallback: (() => void) | null = null;
  const runner = createWildzGameplayBackgroundRunner({
    requestIdleCallback(callback, options) {
      events.push(`scheduled:${options.timeout}`);
      idleCallback = callback;
      return 7;
    },
    cancelIdleCallback() {}
  });

  const result = runner.run(() => {
    events.push("worked");
    return "saved";
  }, { timeoutMs: 900 });

  assert.deepEqual(events, ["scheduled:900"]);
  assert.ok(idleCallback);
  (idleCallback as () => void)();
  assert.equal(await result, "saved");
  assert.deepEqual(events, ["scheduled:900", "worked"]);
});

test("gameplay background work preserves task failures", async () => {
  const runner = createWildzGameplayBackgroundRunner({
    postTask: async <Value>(task: () => Value | Promise<Value>) => task()
  });

  await assert.rejects(runner.run(() => {
    throw new Error("checkpoint_failed");
  }), /checkpoint_failed/);
});

test("Safari fallback yields through a paint boundary before background work", async () => {
  const events: string[] = [];
  let animationFrame: (() => void) | null = null;
  let timer: (() => void) | null = null;
  const runner = createWildzGameplayBackgroundRunner({
    requestAnimationFrame(callback) {
      events.push("frame-scheduled");
      animationFrame = callback;
      return 1;
    },
    setTimer(callback) {
      events.push("timer-scheduled");
      timer = callback;
      return 2;
    }
  });

  const result = runner.run(() => {
    events.push("worked");
    return 9;
  });
  assert.deepEqual(events, ["frame-scheduled"]);
  (animationFrame as unknown as () => void)();
  assert.deepEqual(events, ["frame-scheduled", "timer-scheduled"]);
  (timer as unknown as () => void)();
  assert.equal(await result, 9);
});
