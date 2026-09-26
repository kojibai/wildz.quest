"use client";

import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { observeWildsFirstFrame } from "./wilds-first-frame";

/** Reveal the existing game screen after its first complete draw. This does not
 * own, pause, or replace the renderer, and never waits on a shader promise. */
export function WildsFirstFrame({ onReady }: { onReady?: () => void }) {
  const { scene } = useThree();
  const latest = useRef(onReady);
  latest.current = onReady;
  useLayoutEffect(() => observeWildsFirstFrame(scene, () => latest.current?.()), [scene]);
  return null;
}
