"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { createWildsShaderWarmup } from "./wilds-shader-warmup";

/** Prepare mounted off-camera materials too, before walking brings them into view. */
export function WildsShaderWarmup() {
  const { gl, scene, camera, invalidate } = useThree();
  const warmup = useMemo(() => createWildsShaderWarmup(
    () => gl.compileAsync(scene, camera), invalidate
  ), [gl, scene, camera, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextrestored", warmup.reset);
    return () => { warmup.reset(); canvas.removeEventListener("webglcontextrestored", warmup.reset); };
  }, [gl, warmup]);
  // Own the draw after simulation/camera/labels, with no extra RAF or per-frame traversal.
  useFrame(() => {
    if (scene.children.length) warmup.frame(() => gl.render(scene, camera));
  }, 1);
  return null;
}
