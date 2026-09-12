import type { WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import type { WildsKaiWeatherSample } from "./wilds-kai-wind";
export type WildsWeatherExposure = { rain: number; wind: number; sheltered: boolean };

/** Uses the built collision solids, so a planned frame is not an invisible roof.
 * No history writes: structures physically deflect today's rain and wind. */
export function writeWildsWeatherExposure(target: WildsWeatherExposure, weather: WildsKaiWeatherSample,
  point: { x: number; y: number; z: number }, solids: readonly WildsTerrainObstacle[]) {
  target.rain = weather.precipitation;
  target.wind = 1;
  target.sheltered = false;
  const speed = weather.windSpeed;
  const dx = speed > .001 ? weather.windX / speed : 0, dz = speed > .001 ? weather.windZ / speed : 0;
  for (const solid of solids) {
    if (solid.kind !== "structure" || solid.shape?.kind !== "box") continue;
    const shape = solid.shape, sx = solid.position.x - point.x, sz = solid.position.z - point.z;
    const bottom = solid.position.y - shape.halfY, top = solid.position.y + shape.halfY;
    if (bottom >= point.y + 1.2 && bottom <= point.y + 8
      && Math.abs(sx) < shape.halfX && Math.abs(sz) < shape.halfZ) {
      target.rain = 0; target.sheltered = true; target.wind = Math.min(target.wind, .65);
    }
    const upwind = -(sx * dx + sz * dz);
    const cross = Math.abs(sx * dz - sz * dx);
    const width = Math.abs(dz) * shape.halfX + Math.abs(dx) * shape.halfZ;
    if (upwind > 0 && upwind < 6 && cross < width && top > point.y + .8 && bottom < point.y + 1.5) {
      target.wind = Math.min(target.wind, .2 + upwind / 6 * .3);
    }
  }
  return target;
}
