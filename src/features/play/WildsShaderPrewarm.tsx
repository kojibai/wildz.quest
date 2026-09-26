"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { WebGLRenderTarget } from "three";
import { prewarmWildsSceneShaders, wildsSceneShaderSignature } from "./wilds-shader-prewarm";

/** Optional shader preparation never participates in the first-frame gate. */
export function WildsShaderPrewarm() {
  const { gl, scene, camera } = useThree();
  const drawn = useRef(false);
  useFrame(() => { drawn.current = true; });
  useLayoutEffect(() => {
    if (!gl.extensions.has("KHR_parallel_shader_compile")) return;
    const controller = new AbortController();
    const target = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
    // Submit all existing material programs together once the scene is committed.
    // The normal first draw still decides readiness. No draw, uniform reflection,
    // completion polling or shader promise is introduced here.
    try { prewarmWildsSceneShaders(gl, scene, camera, target, controller.signal); }
    catch { /* A driver without working preparation still renders normally. */ }
    let signature: string | null = null;
    let idle: number | null = null;
    let timer: number | null = null;
    const schedule = () => {
      if (controller.signal.aborted) return;
      timer = window.setTimeout(check, 2_000);
    };
    const check = () => {
      if (controller.signal.aborted) return;
      if (!drawn.current || document.visibilityState === "hidden") { schedule(); return; }
      const run = () => {
        idle = null;
        if (controller.signal.aborted) return;
        const next = `${camera.layers.mask}|${wildsSceneShaderSignature(scene)}`;
        if (next === signature) { schedule(); return; }
        signature = next;
        try { prewarmWildsSceneShaders(gl, scene, camera, target, controller.signal); }
        catch { /* Rendering remains authoritative if optional preparation fails. */ }
        schedule();
      };
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(run, { timeout: 1_000 });
      else timer = window.setTimeout(run, 0);
    };
    // The next animation callback follows this scene's initial draw; scheduling
    // work as a task keeps compilation out of the frame/readiness callback.
    const first = window.requestAnimationFrame(() => { timer = window.setTimeout(check, 0); });
    return () => {
      controller.abort();
      window.cancelAnimationFrame(first);
      if (timer !== null) window.clearTimeout(timer);
      if (idle !== null) window.cancelIdleCallback(idle);
      target.dispose();
    };
  }, [camera, gl, scene]);
  return null;
}
