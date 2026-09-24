import assert from "node:assert/strict";
import { test } from "node:test";
import { scheduleAfterPaint } from "../src/features/play/schedule-after-paint";

function clock() {
  let frame: FrameRequestCallback | undefined;
  let task: (() => void) | undefined;
  return {
    requestAnimationFrame(callback: FrameRequestCallback) { frame = callback; return 1; },
    cancelAnimationFrame() { frame = undefined; },
    setTimeout(callback: () => void) { task = callback; return 2; },
    clearTimeout() { task = undefined; },
    frame() { const next = frame; frame = undefined; next?.(0); },
    task() { const next = task; task = undefined; next?.(); }
  };
}

test("nonvisual preparation yields through the frame before running in a later task", () => {
  const runtime = clock();
  let calls = 0;
  scheduleAfterPaint(() => calls++, runtime);
  assert.equal(calls, 0);
  runtime.frame();
  assert.equal(calls, 0, "animation frame callbacks still run before paint");
  runtime.task();
  assert.equal(calls, 1);
});

test("closing or changing selection cancels preparation before and after the frame", () => {
  for (const afterFrame of [false, true]) {
    const runtime = clock();
    let calls = 0;
    const cancel = scheduleAfterPaint(() => calls++, runtime);
    if (afterFrame) runtime.frame();
    cancel();
    runtime.frame();
    runtime.task();
    assert.equal(calls, 0);
  }
});
