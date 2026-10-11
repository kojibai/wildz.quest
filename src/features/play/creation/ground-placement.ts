import { deriveCreationGeometry, overlapsCreationSolids, type CreationSolid } from './geometry';
import type { CreationCompileContext, CreationPlan } from './compiler';
import type { CreationDefinition, CreationPose } from './types';
import { WILDS_BUILD_FLAT_APRON, projectWildsBuildFootprint, sampleWildsBuildGround, sampleWildsBuildGrading, wildsBuildPlacementGroundY } from '../wilds-build-ground';
import { isWildsNaturalSceneryId } from '../wilds-build-scenery';

export const CREATION_TERRAIN_SUPPORT_CHUNK_ID = 'wildz.creation.terrain-support.v1';
export const CREATION_TERRAIN_CLEARANCE_CHUNK_ID = 'wildz.creation.terrain-support.v2';
export function creationClearsNaturalScenery(context: Pick<CreationCompileContext, 'spaceId' | 'physical'>) {
  return context.spaceId === 'wildz.space.outer.v1'
    && context.physical.some(chunk => chunk.chunkId === CREATION_TERRAIN_CLEARANCE_CHUNK_ID);
}
export function creationUsesTerrainSupport(context: Pick<CreationCompileContext, 'spaceId' | 'physical'>) {
  return context.spaceId === 'wildz.space.outer.v1'
    && context.physical.some(chunk => chunk.chunkId === CREATION_TERRAIN_SUPPORT_CHUNK_ID || chunk.chunkId === CREATION_TERRAIN_CLEARANCE_CHUNK_ID);
}
function groundSolids(solids: readonly CreationSolid[]) {
  const bottom = Math.min(...solids.map(solid => solid.center.y - solid.halfExtents.y));
  return { bottom, solids: solids.filter(solid => solid.center.y - solid.halfExtents.y <= bottom + .025) };
}
function definitionSolids(definition: CreationDefinition, pose: CreationPose): readonly CreationSolid[] {
  const poses = new Map<string, CreationPose>(), nodes = new Map(definition.nodes.map(node => [node.id, node]));
  const nodePose = (id: string): CreationPose => {
    const existing = poses.get(id); if (existing) return existing;
    const node = nodes.get(id)!; const parent = node.parentId ? nodePose(node.parentId) : pose,
      v = node.pose.position, c = Math.cos(parent.yaw), s = Math.sin(parent.yaw);
    const result = { position: { x: parent.position.x + v.x * c + v.z * s, y: parent.position.y + v.y,
      z: parent.position.z - v.x * s + v.z * c }, yaw: parent.yaw + node.pose.yaw };
    poses.set(id, result); return result;
  };
  return definition.nodes.flatMap(node => deriveCreationGeometry(node, nodePose(node.id)).solids);
}

function contextGroundY(context: CreationCompileContext) {
  const { x, z } = context.pose.position;
  const planes = context.physical.find(chunk => chunk.chunkId === CREATION_TERRAIN_SUPPORT_CHUNK_ID || chunk.chunkId === CREATION_TERRAIN_CLEARANCE_CHUNK_ID)?.walkable ?? [];
  return wildsBuildPlacementGroundY(x, z, sampleWildsBuildGrading(planes, x, z, sampleWildsBuildGround(x, z).elevation));
}

/** New surface drafts are levelled before quotation and sealing. Historical
 * compiler inputs and the fixed pose of an existing creation stay untouched. */
export function groundCreationCompileContext(definition: CreationDefinition, context: CreationCompileContext): CreationCompileContext {
  if (!creationUsesTerrainSupport(context)) return context;
  // Portable assemblies do not buy an earth foundation. Their authored pose
  // and ordinary physical collision checks remain the placement contract.
  if (definition.nodes.some(node => node.behaviors.some(behavior => behavior.id === 'tool' || behavior.id === 'weapon')))
    return { ...context, physical: context.physical.filter(chunk => chunk.chunkId !== CREATION_TERRAIN_SUPPORT_CHUNK_ID && chunk.chunkId !== CREATION_TERRAIN_CLEARANCE_CHUNK_ID) };
  if (creationClearsNaturalScenery(context)) context = {...context, physical: context.physical.map(chunk => {
    const solids = chunk.solids.filter(solid => !isWildsNaturalSceneryId(solid.id));
    return solids.length === chunk.solids.length ? chunk : {...chunk, solids};
  })};
  if (context.evolution) return context;
  const footing = groundSolids(definitionSolids(definition, context.pose));
  if (!footing.solids.length) return context;
  const contact = sampleWildsBuildGround(context.pose.position.x, context.pose.position.z);
  const target = contextGroundY(context);
  // A deliberate height offset must still fail the contact check, rather than
  // quietly moving a suspended preview down to the ground.
  if (Math.abs(footing.bottom - contact.elevation) > .65 && Math.abs(footing.bottom - target) > .65) return context;
  return { ...context, pose: { ...context.pose, position: { ...context.pose.position,
    y: Math.round((context.pose.position.y + target - footing.bottom) * 1_000_000) / 1_000_000 } } };
}

export function assertCreationTerrainSupport(plan: CreationPlan, actualFloorY?: number, clearsScenery = false) {
  const solids = plan.chunks.flatMap(chunk => chunk.solids), footing = groundSolids(solids);
  if (!footing.solids.length) throw Error('creation_world_ground_required');
  const groundY = wildsBuildPlacementGroundY(plan.pose.position.x, plan.pose.position.z, actualFloorY);
  if (footing.bottom > groundY + .025 || footing.bottom < groundY - .2) throw Error('creation_world_ground_required');
  // The admitted floor footprint grades the earth, including capsule clearance
  // outside the doorway. Existing solids still independently fence overlaps.
  for (const solid of footing.solids) {
    // Cut/fill does not need a dense resampling of terrain beneath every floor.
    // Retain the same bounded support geometry contract for new sources.
    if (clearsScenery) {
      if (!Number.isFinite(solid.halfExtents.x) || !Number.isFinite(solid.halfExtents.z)
        || (Math.max(1,Math.ceil(solid.halfExtents.x*4))+1)*(Math.max(1,Math.ceil(solid.halfExtents.z*4))+1)>131072)
        throw Error('creation_world_ground_budget');
    } else projectWildsBuildFootprint(solid);
  }
}

/** Earth grading must not move a real obstacle or another owner's building
 * into the floor. Preserve their occupied footprints even across a deep cut. */
export function assertCreationTerrainObjectsClear(plan: CreationPlan, obstacles: readonly CreationSolid[], clearsScenery = false) {
  const footing = groundSolids(plan.chunks.flatMap(chunk => chunk.solids));
  const footprint = (solid: CreationSolid) => ({ ...solid, center: { ...solid.center, y: 0 }, halfExtents: { ...solid.halfExtents, y: 1 } });
  if (footing.solids.some(solid => obstacles.some(other => overlapsCreationSolids(footprint(clearsScenery ? { ...solid, halfExtents: { ...solid.halfExtents, x: solid.halfExtents.x + WILDS_BUILD_FLAT_APRON, z: solid.halfExtents.z + WILDS_BUILD_FLAT_APRON } } : solid), footprint(other)))))
    throw Error('creation_world_terrain_occupied');
}
