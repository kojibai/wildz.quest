import type { WildsTerrainSurface } from "./wilds-terrain-authority";

// Presentation follows the same surface classification used by traversal.
// No new terrain samples, encounter rolls, or persistent state.
const SURFACE_TINTS: Record<WildsTerrainSurface, readonly [number, number, number]> = {
  grass: [.86, 1, .78], soil: [1, .79, .61], trail: [1, .91, .72],
  rock: [.81, .83, .86], sand: [1, .96, .78],
  "shallow-water": [.66, .76, .72], "deep-water": [.48, .6, .63]
};
export function wildsTerrainSurfaceTint(surface: WildsTerrainSurface) {
  return SURFACE_TINTS[surface];
}

/** Continuous, world-anchored form: nearby groves share character without three repeated silhouettes. */
export function wildsVegetationAspect(x: number, z: number) {
  return .9 + .14 * Math.sin(x * .017 + Math.sin(z * .023) * 2) + .06 * Math.cos(z * .041 - x * .011);
}
