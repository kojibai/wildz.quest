"use client";

import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { prepareWildsFirstDraw } from "./wilds-shader-prewarm";
import { scheduleAfterPaint } from "./schedule-after-paint";

export function WildsFirstDrawPreparation({ onPrepared }: { onPrepared: (prepared: boolean) => void }) {
  const { gl, scene, camera } = useThree();
  useLayoutEffect(() => prepareWildsFirstDraw(gl, scene, camera, scheduleAfterPaint,
    () => onPrepared(true)), [gl, scene, camera, onPrepared]);
  return null;
}
