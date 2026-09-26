import type { Scene } from "three";

/** Publish readiness after render unwinds, before waiting for another frame. */
export function observeWildsFirstFrame(scene: Scene, onReady: () => void) {
  const previous = scene.onAfterRender;
  let cancelled = false;
  let reported = false;
  const afterRender: typeof scene.onAfterRender = (...args) => {
    previous.apply(scene, args);
    if (reported) return;
    reported = true;
    if (scene.onAfterRender === afterRender) scene.onAfterRender = previous;
    queueMicrotask(() => { if (!cancelled) onReady(); });
  };
  scene.onAfterRender = afterRender;
  return () => {
    cancelled = true;
    if (scene.onAfterRender === afterRender) scene.onAfterRender = previous;
  };
}
