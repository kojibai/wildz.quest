import { wildsSiteRuntimeGroundY, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";

export type WildsInteractionSurfacePoint = Readonly<{
  x: number;
  z: number;
  surfaceWorldY: number;
}>;

function quantize(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function projectWildsInteractionSurfacePoint(
  runtime: WildsSiteRuntimeProjection,
  spaceId: string,
  point: Readonly<{ x: number; z: number }>,
  fallbackWorldY: number
): WildsInteractionSurfacePoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z) || !Number.isFinite(fallbackWorldY)) {
    throw new Error("wilds_interaction_surface_input_invalid");
  }
  return Object.freeze({
    x: quantize(point.x),
    z: quantize(point.z),
    surfaceWorldY: quantize(wildsSiteRuntimeGroundY(runtime, spaceId, point.x, point.z, fallbackWorldY))
  });
}

