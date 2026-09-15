"use client";

import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

/** Reveal the existing game screen after its first complete draw. This does not
 * own, pause, or replace the renderer, and never waits on a shader promise. */
export function WildsFirstFrame({ onReady }: { onReady?: () => void }) {
  const { scene } = useThree();
  const latest = useRef(onReady);
  latest.current = onReady;
  useLayoutEffect(() => {
    const previous = scene.onAfterRender;
    let frame = 0;
    let reported = false;
    const afterRender: typeof scene.onAfterRender = (...args) => {
      previous.apply(scene, args);
      if (reported) return;
      reported = true;
      if (scene.onAfterRender === afterRender) scene.onAfterRender = previous;
      frame = window.requestAnimationFrame(() => latest.current?.());
    };
    scene.onAfterRender = afterRender;
    return () => {
      window.cancelAnimationFrame(frame);
      if (scene.onAfterRender === afterRender) scene.onAfterRender = previous;
    };
  }, [scene]);
  return null;
}
