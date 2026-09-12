"use client";

import { useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { KAI_PULSE_DURATION_MS } from "./kai-klok-moment";
import { createWildsKaiWeatherSample, writeWildsKaiWeather } from "./wilds-kai-wind";

/** Presentation only. Kai selects the field; elapsed time only bridges snapshots.
 * A stale Kai source stops extrapolating after one second. No new clock or fetch. */
export function useWildsFoliageBreeze(player: { x: number; z: number }, reducedMotion: boolean, kaiUPulse: number) {
  const breeze = useMemo(() => {
    const wind = { value: new THREE.Vector2() };
    const vector = createWildsKaiWeatherSample();
    const anchor = { pulse: 0, elapsed: 0 };
    const onBeforeCompile: THREE.MeshStandardMaterial["onBeforeCompile"] = (shader) => {
      shader.uniforms.uWildsWind = wind;
      shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        uniform vec2 uWildsWind;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float leafFlex = clamp(position.y + 0.65, 0.0, 1.0);
            transformed.xz += uWildsWind * leafFlex;
          #endif`);
    };
    return { wind, vector, anchor, onBeforeCompile };
  }, []);
  useLayoutEffect(() => {
    breeze.anchor.pulse = kaiUPulse;
    breeze.anchor.elapsed = performance.now();

  }, [breeze, kaiUPulse]);
  useFrame(() => {
    if (reducedMotion) { breeze.wind.value.set(0, 0); return; }
    const elapsed = Math.min(1_000, Math.max(0, performance.now() - breeze.anchor.elapsed));
    const visualPulse = breeze.anchor.pulse + Math.floor(elapsed / KAI_PULSE_DURATION_MS * 1_000_000);
    writeWildsKaiWeather(breeze.vector, visualPulse, player.x, player.z);
    breeze.wind.value.set(breeze.vector.windX * .003, breeze.vector.windZ * .003);
  });
  return breeze.onBeforeCompile;
}
