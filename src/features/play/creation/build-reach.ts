import type { CreationPlan } from './compiler';
import type { CreationPoint } from './types';

export const CREATION_PHYSICAL_BUILD_REACH_RULE = Object.freeze({
  id: 'wildz.creation-reach.physical.v2' as const,
  metres: 12,
  dimensions: 'xyz',
  target: 'legacy-origin-or-compiled-oriented-solid',
});
export type CreationBuildReachRule = typeof CREATION_PHYSICAL_BUILD_REACH_RULE.id;

/** The compiler's physical solids define the work site. Empty space between
 * parts and the enclosing render-page bounds do not extend the player's reach. */
export function creationBuildInReach(plan: Pick<CreationPlan, 'pose' | 'chunks'>, position: CreationPoint,
  rule?: CreationBuildReachRule): boolean {
  if (!position || ![position.x, position.y, position.z].every(Number.isFinite)
    || rule !== undefined && rule !== CREATION_PHYSICAL_BUILD_REACH_RULE.id) return false;
  const origin = plan.pose.position;
  if (Math.hypot(position.x - origin.x, position.y - origin.y, position.z - origin.z) <= 12) return true;
  if (rule === undefined) return false;
  for (const chunk of plan.chunks) for (const solid of chunk.solids) {
    if (![solid.center.x, solid.center.y, solid.center.z, solid.yaw,
      solid.halfExtents.x, solid.halfExtents.y, solid.halfExtents.z].every(Number.isFinite)
      || Object.values(solid.halfExtents).some(value => value < 0)) continue;
    const x = position.x - solid.center.x, z = position.z - solid.center.z,
      c = Math.cos(solid.yaw), s = Math.sin(solid.yaw);
    const dx = Math.max(0, Math.abs(x * c - z * s) - solid.halfExtents.x),
      dy = Math.max(0, Math.abs(position.y - solid.center.y) - solid.halfExtents.y),
      dz = Math.max(0, Math.abs(x * s + z * c) - solid.halfExtents.z);
    if (Math.hypot(dx, dy, dz) <= 12) return true;
  }
  return false;
}
