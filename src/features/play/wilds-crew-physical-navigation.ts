import { WILDS_PLAYER_BODY_RADIUS } from "./wilds-player-body";
import { validateAdventureCondition, type AdventureCardCondition } from "./adventure/card-condition";
import { wildsTerrainElevation } from "./wilds-terrain-authority";
import { writeWildsSiteRuntimeMovement, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import type { WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import type { WildsCrewSegmentSampler } from "./wilds-crew-navigation";

/** Conservative walk-only adapter. Shapes are canonical projections supplied by the
 * scene, never visual meshes. This intentionally refuses water, steep drops and stairs
 * that need unsupported stepping. It grants no flight, swimming or climbing capability.
 * Rebuild on physical projection/space changes; the prepared neighborhood is bounded.
 */
export function createWildsCrewPhysicalSampler(input: {
  runtime: WildsSiteRuntimeProjection; spaceId: string;
  obstacles: readonly WildsTerrainObstacle[];
  originX: number; originZ: number;
}): WildsCrewSegmentSampler {
  const reach = 32, radius = WILDS_PLAYER_BODY_RADIUS, height = 1.55;
  const near = (x: number, z: number, extent: number) => Math.abs(x - input.originX) <= reach + extent && Math.abs(z - input.originZ) <= reach + extent;
  const solids = input.runtime.physical.solids.filter(s => s.spaceId === input.spaceId && s.kind !== "mountain-envelope" && near(s.center.x, s.center.z, Math.max(s.halfExtents.x, s.halfExtents.z)));
  const obstacles = input.spaceId === "wildz.space.outer.v1"
    ? input.obstacles.filter(o => o.material !== "soft" && near(o.position.x, o.position.z, o.radius)) : [];
  const overBudget = solids.length + obstacles.length > 4096;
  type Block = { x: number; z: number; lo: number; hi: number; hx: number; hz: number; cylinder: boolean };
  const bins = new Map<number, Map<number, Block[] | null>>();
  const add = (block: Block) => {
    const padding = radius + .12;
    const minX = Math.floor(Math.max(input.originX - reach, block.x - block.hx - padding) / 4);
    const maxX = Math.floor(Math.min(input.originX + reach, block.x + block.hx + padding) / 4);
    const minZ = Math.floor(Math.max(input.originZ - reach, block.z - block.hz - padding) / 4);
    const maxZ = Math.floor(Math.min(input.originZ + reach, block.z + block.hz + padding) / 4);
    for (let x = minX; x <= maxX; x++) {
      let column = bins.get(x); if (!column) { column = new Map(); bins.set(x, column); }
      for (let z = minZ; z <= maxZ; z++) {
        const bucket = column.get(z);
        if (bucket === null) continue;
        if (!bucket) column.set(z, [block]);
        else if (bucket.length >= 128) column.set(z, null);
        else bucket.push(block);
      }
    }
  };
  if (!overBudget) {
    for (const solid of solids) add({ x: solid.center.x, z: solid.center.z, lo: solid.center.y - solid.halfExtents.y, hi: solid.center.y + solid.halfExtents.y, hx: solid.halfExtents.x, hz: solid.halfExtents.z, cylinder: false });
    for (const obstacle of obstacles) {
      const shape = obstacle.shape;
      add({ x: obstacle.position.x, z: obstacle.position.z,
        lo: shape.kind === "box" ? obstacle.position.y - shape.halfY : obstacle.position.y,
        hi: shape.kind === "box" ? obstacle.position.y + shape.halfY : obstacle.position.y + shape.height,
        hx: shape.kind === "box" ? shape.halfX : shape.radius,
        hz: shape.kind === "box" ? shape.halfZ : shape.radius, cylinder: shape.kind === "cylinder" });
    }
  }
  const site = { x: 0, z: 0, floorY: 0, ceilingY: Infinity, surfaceId: null as string | null, flooded: false, blocked: false, blockedByClimb: false };
  // Swept expanded box test; conservative capsule bounds cannot miss a thin wall.
  function box(sx: number, sz: number, tx: number, tz: number, x: number, z: number, hx: number, hz: number) {
    const dx = tx - sx, dz = tz - sz;
    let low = 0, high = 1;
    if (Math.abs(dx) < 1e-12) { if (Math.abs(sx - x) > hx + radius) return false; }
    else { const a = (x - hx - radius - sx) / dx, b = (x + hx + radius - sx) / dx; low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b)); }
    if (Math.abs(dz) < 1e-12) { if (Math.abs(sz - z) > hz + radius) return false; }
    else { const a = (z - hz - radius - sz) / dz, b = (z + hz + radius - sz) / dz; low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b)); }
    return low <= high;
  }
  return (from, to, mode, out) => {
    out.allowed = false; out.y = NaN;
    const distance = Math.hypot(to.x - from.x, to.z - from.z);
    if (mode !== "walk" || overBudget || distance > 3 || !near(from.x, from.z, -1) || !near(to.x, to.z, -1)) return;
    const count = Math.max(1, Math.ceil(distance / .12));
    let x = from.x, z = from.z, y = from.y;
    for (let i = 1; i <= count; i++) {
      const tx = from.x + (to.x - from.x) * i / count, tz = from.z + (to.z - from.z) * i / count;
      const fallback = input.spaceId === "wildz.space.outer.v1" ? wildsTerrainElevation(tx, tz) : y;
      writeWildsSiteRuntimeMovement(site, input.runtime, input.spaceId, x, y, z, tx, tz, radius, fallback, false);
      if (site.blocked || Math.abs(site.x - tx) > 1e-5 || Math.abs(site.z - tz) > 1e-5 || !Number.isFinite(site.floorY) || site.flooded || site.ceilingY - site.floorY < height) return;
      if (input.spaceId === "wildz.space.outer.v1" && site.floorY < -1.1) return;
      // Refuse unsupported vertical discontinuities rather than snapping to a deck.
      if (Math.abs(site.floorY - y) > .03 + distance / count * .7) return;
      const bottom = Math.min(y, site.floorY), top = Math.max(y, site.floorY) + height;
      const bucket = bins.get(Math.floor((x + tx) / 8))?.get(Math.floor((z + tz) / 8));
      if (bucket === null) return; // Saturated cell fails closed; no unbounded frame scan.
      if (bucket) for (const block of bucket) {
        if (block.hi <= bottom + .02 || block.lo >= top) continue;
        if (!block.cylinder) {
          if (box(x, z, tx, tz, block.x, block.z, block.hx, block.hz)) return;
        } else {
          const dx = tx - x, dz = tz - z, denominator = dx * dx + dz * dz;
          const t = denominator ? Math.max(0, Math.min(1, ((block.x - x) * dx + (block.z - z) * dz) / denominator)) : 0;
          if (Math.hypot(x + dx * t - block.x, z + dz * t - block.z) <= block.hx + radius) return;
        }
      }
      x = tx; z = tz; y = site.floorY;
    }
    out.allowed = true; out.y = y;
  };
}

/** Conservative readiness gate from the existing admitted condition projection. */
export function canWildsCrewTravel(condition: AdventureCardCondition | undefined): boolean {
  if (!condition) return false;
  try { validateAdventureCondition(condition); } catch { return false; }
  return condition.life === "alive" && !condition.retiredAt && condition.fatigue < 85
    && (!condition.recovery || condition.recovery.state === "stable")
    && !condition.injuries.some(injury => injury.kind === "limb" && injury.severity >= 2);
}
