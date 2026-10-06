import { isAdmittedCreationProjection, type CreationPhysicalSnapshot } from './physical-store';
import type { CreationPose } from './types';
import { deriveCreationGeometry, type CreationSolid } from './geometry';
import { verifyCreationInstance } from './instance';
import { parseCreationDefinition } from './definition';
import { creationNodePoses } from './projection';
import { canAccessCreation } from './access';
import type { WildsBedSleepPose } from '../wilds-construction-function';

export type CreationBedSource = Readonly<{ schema: 'wildz.creation-bed-source.v1'; structureId: string; instanceId: string; nodeId: string; head: string; ownerReceizId: string; worldId: string; spaceId: string; position: CreationPose['position']; pose: CreationPose; geometry: CreationSolid }>;
export type CreationBedSnapshot = CreationPhysicalSnapshot | (() => CreationPhysicalSnapshot);
type Player = Readonly<{ x: number; z: number }>;
type Space = Readonly<{ spaceId: string; position: { y: number } }>;
const currentChecks = new WeakMap<CreationBedSource, (actorId: string, kaiUPulse: number) => boolean>();
const readSnapshot = (input: CreationBedSnapshot) => typeof input === 'function' ? input() : input;
function sameSolid(a: CreationSolid, b: CreationSolid): boolean {
  return a.id === b.id && Math.abs(a.yaw - b.yaw) < 1e-9 && (['x', 'y', 'z'] as const).every(axis => Math.abs(a.center[axis] - b.center[axis]) < 1e-9 && Math.abs(a.halfExtents[axis] - b.halfExtents[axis]) < 1e-9);
}
function inspect(snapshot: CreationPhysicalSnapshot, instanceId: string, nodeId: string, actorId: string, kaiUPulse: number) {
  try {
    const instance = snapshot.instances[instanceId], projection = snapshot.projections.find(p => p.instanceId === instanceId);
    if (!instance || !projection || !isAdmittedCreationProjection(projection) || !verifyCreationInstance(instance)
      || projection.head !== instance.head || projection.definitionDigest !== instance.definitionDigest || projection.worldId !== instance.worldId || projection.spaceId !== instance.spaceId
      || !canAccessCreation(instance, actorId, 'use', kaiUPulse)) return null;
    const definition = parseCreationDefinition(snapshot.definitions[instance.definitionDigest]);
    if (definition.digest !== instance.definitionDigest || definition.creatorId !== instance.creatorId) return null;
    const node = definition.nodes.find(n => n.id === nodeId), state = instance.nodeStates[nodeId];
    if (!node || state?.kind !== 'bed' || state.condition < 50 || state.capacity !== 1 || state.occupantIds.length >= state.capacity && !state.occupantIds.includes(actorId)
      || node.behaviors.length !== 1 || node.behaviors[0].id !== 'bed' || node.behaviors[0].version !== 1 || Object.keys(node.behaviors[0].parameters).length
      || node.shape.kind !== 'box' || node.shape.width < .7 || node.shape.depth < 1.9 || node.shape.height < .1 || node.shape.height > 1) return null;
    const pose = creationNodePoses(definition, instance.pose).get(nodeId);
    if (!pose || !projection.chunks.some(chunk => chunk.nodeIds.includes(nodeId))) return null;
    const geometry = deriveCreationGeometry(node, pose).solids[0];
    if (!geometry || !projection.solids.some(solid => sameSolid(solid, geometry))) return null;
    return { instance, projection, pose, geometry };
  } catch { return null; }
}
/** Only this resolver can mint a bed source. Supply the store's current getter for retained sources. */
export function resolveCreationBed(snapshot: CreationBedSnapshot, instanceId: string, nodeId: string, actorId: string, kaiUPulse: number): CreationBedSource | null {
  try {
    const current = inspect(readSnapshot(snapshot), instanceId, nodeId, actorId, kaiUPulse);
    if (!current) return null;
    const { instance, projection } = current;
    const pose = Object.freeze({ position: Object.freeze({ ...current.pose.position }), yaw: current.pose.yaw });
    const geometry = Object.freeze({ ...current.geometry, center: Object.freeze({ ...current.geometry.center }), halfExtents: Object.freeze({ ...current.geometry.halfExtents }) });
    const source: CreationBedSource = Object.freeze({ schema: 'wildz.creation-bed-source.v1', structureId: `creation-bed:${instanceId}:${nodeId}`, instanceId, nodeId, head: instance.head, ownerReceizId: instance.ownerId, worldId: instance.worldId, spaceId: instance.spaceId, position: pose.position, pose, geometry });
    currentChecks.set(source, (actor, kai) => {
      const next = inspect(readSnapshot(snapshot), instanceId, nodeId, actor, kai);
      return !!next && next.instance.head === source.head && next.projection === projection && sameSolid(next.geometry, source.geometry);
    });
    return source;
  } catch { return null; }
}
/** JSON, spread copies and historical sources cannot manufacture sleep authority. */
export function verifyCreationBedSource(value: unknown, actorId: string, kaiUPulse: number): value is CreationBedSource {
  try { return !!value && typeof value === 'object' && currentChecks.get(value as CreationBedSource)?.(actorId, kaiUPulse) === true; }
  catch { return false; }
}
export function canSleepInCreationBed(source: unknown, player: Player, space: Space, actorId: string, kaiUPulse: number): boolean {
  if (!verifyCreationBedSource(source, actorId, kaiUPulse) || ![player.x, player.z, space.position.y].every(Number.isFinite) || source.spaceId !== space.spaceId) return false;
  const { geometry } = source, dx = player.x - geometry.center.x, dz = player.z - geometry.center.z, c = Math.cos(geometry.yaw), s = Math.sin(geometry.yaw);
  // Geometry rotates local axes by -yaw; this inverse keeps reach aligned to the mattress.
  const localX = dx * c - dz * s, localZ = dx * s + dz * c;
  return Math.abs(geometry.center.y - space.position.y) < .8 && Math.abs(localX) <= geometry.halfExtents.x + .4 && Math.abs(localZ) <= geometry.halfExtents.z + .4;
}
export function selectCreationBedAtPlayer(snapshot: CreationBedSnapshot, player: Player, space: Space, actorId: string, kaiUPulse: number): CreationBedSource | null {
  try {
    const beds: CreationBedSource[] = [];
    for (const projection of readSnapshot(snapshot).projections) {
      if (!isAdmittedCreationProjection(projection) || projection.spaceId !== space.spaceId) continue;
      const instance = readSnapshot(snapshot).instances[projection.instanceId];
      if (!instance) continue;
      for (const state of Object.values(instance.nodeStates)) {
        if (state.kind !== 'bed') continue;
        const source = resolveCreationBed(snapshot, instance.instanceId, state.nodeId, actorId, kaiUPulse);
        if (source && canSleepInCreationBed(source, player, space, actorId, kaiUPulse)) beds.push(source);
      }
    }
    return beds.sort((a, b) => Math.hypot(a.geometry.center.x - player.x, a.geometry.center.z - player.z) - Math.hypot(b.geometry.center.x - player.x, b.geometry.center.z - player.z) || a.structureId.localeCompare(b.structureId))[0] || null;
  } catch { return null; }
}
/** Feet lie toward the mattress foot; the torso points toward its positive-depth pillow end. */
export function projectCreationBedSleepPose(source: unknown, player: Player, floorY: number, actorId: string, kaiUPulse: number): WildsBedSleepPose | null {
  if (!verifyCreationBedSource(source, actorId, kaiUPulse) || !canSleepInCreationBed(source, player, { spaceId: source.spaceId, position: { y: floorY } }, actorId, kaiUPulse)) return null;
  const { geometry } = source, yaw = geometry.yaw;
  return { position: [geometry.center.x - player.x - Math.sin(yaw) * .72, geometry.center.y + geometry.halfExtents.y + .22 - floorY, geometry.center.z - player.z - Math.cos(yaw) * .72], heading: yaw, pitch: Math.PI / 2 };
}
