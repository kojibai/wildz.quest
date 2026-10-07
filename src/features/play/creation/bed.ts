import { isAdmittedCreationProjection, type CreationPhysicalSnapshot } from './physical-store';
import type { CreationPose } from './types';
import { deriveCreationGeometry, type CreationSolid } from './geometry';
import { verifyCreationInstance } from './instance';
import { parseCreationDefinition } from './definition';
import { creationNodePoses } from './projection';
import { canAccessCreation } from './access';
import type { WildsBedSleepPose } from '../wilds-construction-function';
import { validConstructionId, validConstructionKai } from '../wilds-construction-project';
import {creationPositionIsClear,type CreationNavigation} from './navigation';

export type CreationBedSource = Readonly<{ schema: 'wildz.creation-bed-source.v1'; structureId: string; instanceId: string; nodeId: string; head: string; ownerReceizId: string; worldId: string; spaceId: string; position: CreationPose['position']; pose: CreationPose; geometry: CreationSolid }>;
export type CreationBedSnapshot = CreationPhysicalSnapshot | (() => CreationPhysicalSnapshot);
type Player = Readonly<{ x: number; z: number }>;
type Space = Readonly<{ spaceId: string; position: { y: number } }>;
const currentChecks = new WeakMap<CreationBedSource, (actorId: string, kaiUPulse: number) => boolean>();
const resolvedBeds = new WeakMap<object, Map<string, CreationBedSource>>();
const readSnapshot = (input: CreationBedSnapshot) => typeof input === 'function' ? input() : input;
function immutableData(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => 'value' in descriptor && immutableData(descriptor.value));
}
function withinBedFootprint(geometry: CreationSolid, player: Player, space: Space): boolean {
  const dx = player.x - geometry.center.x, dz = player.z - geometry.center.z, c = Math.cos(geometry.yaw), s = Math.sin(geometry.yaw);
  return Math.abs(geometry.center.y - space.position.y) < .8 && Math.abs(dx * c - dz * s) <= geometry.halfExtents.x + .4 && Math.abs(dx * s + dz * c) <= geometry.halfExtents.z + .4;
}
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
    const key = JSON.stringify([instanceId, nodeId, actorId]), cache = resolvedBeds.get(snapshot);
    const prior = cache?.get(key);
    if (prior && verifyCreationBedSource(prior, actorId, kaiUPulse)) return prior;
    cache?.delete(key);
    const current = inspect(readSnapshot(snapshot), instanceId, nodeId, actorId, kaiUPulse);
    if (!current) return null;
    const { instance, projection } = current;
    const pose = Object.freeze({ position: Object.freeze({ ...current.pose.position }), yaw: current.pose.yaw });
    const geometry = Object.freeze({ ...current.geometry, center: Object.freeze({ ...current.geometry.center }), halfExtents: Object.freeze({ ...current.geometry.halfExtents }) });
    const source: CreationBedSource = Object.freeze({ schema: 'wildz.creation-bed-source.v1', structureId: `creation-bed:${instanceId}:${nodeId}`, instanceId, nodeId, head: instance.head, ownerReceizId: instance.ownerId, worldId: instance.worldId, spaceId: instance.spaceId, position: pose.position, pose, geometry });
    const definition = readSnapshot(snapshot).definitions[instance.definitionDigest];
    // An identity memo is safe only for recursively immutable source data.
    // Mutable inputs keep the full verification path; a replacement head/source
    // invalidates this lease immediately, including custody and occupancy edits.
    const reusable = immutableData(instance) && immutableData(definition);
    currentChecks.set(source, (actor, kai) => {
      if (reusable) {
        const next = readSnapshot(snapshot);
        if (!validConstructionId(actor) || !validConstructionKai(kai) || kai < instance.kaiUPulse
          || next.instances[instanceId] !== instance || next.definitions[instance.definitionDigest] !== definition
          || !next.projections.includes(projection) || !isAdmittedCreationProjection(projection)
          || projection.head !== instance.head || projection.definitionDigest !== instance.definitionDigest
          || projection.worldId !== instance.worldId || projection.spaceId !== instance.spaceId
          || !projection.chunks.some(chunk => chunk.nodeIds.includes(nodeId))
          || !projection.solids.some(solid => sameSolid(solid, source.geometry))) return false;
        const state = instance.nodeStates[nodeId];
        return state.kind === 'bed' && (state.occupantIds.length < state.capacity || state.occupantIds.includes(actor))
          && (actor === actorId || canAccessCreation(instance, actor, 'use', kai));
      }
      const next = inspect(readSnapshot(snapshot), instanceId, nodeId, actor, kai);
      return !!next && next.instance.head === source.head && next.projection === projection && sameSolid(next.geometry, source.geometry);
    });
    if (reusable) {
      const sources = cache || new Map<string, CreationBedSource>();
      sources.set(key, source);
      resolvedBeds.set(snapshot, sources);
    }
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
  return withinBedFootprint(source.geometry, player, space);
}
export function selectCreationBedAtPlayer(snapshot: CreationBedSnapshot, player: Player, space: Space, actorId: string, kaiUPulse: number): CreationBedSource | null {
  try {
    if (![player.x, player.z, space.position.y].every(Number.isFinite)) return null;
    const current = readSnapshot(snapshot);
    const beds: CreationBedSource[] = [];
    for (const projection of current.projections) {
      if (!isAdmittedCreationProjection(projection) || projection.spaceId !== space.spaceId) continue;
      const instance = current.instances[projection.instanceId];
      if (!instance) continue;
      for (const state of Object.values(instance.nodeStates)) {
        if (state.kind !== 'bed') continue;
        // Admitted chunk bounds are a broad phase only. Beds in reach still
        // undergo every current-source, access and mattress-footprint check.
        if (!projection.chunks.some(chunk => chunk.nodeIds.includes(state.nodeId)
          && player.x >= chunk.bounds.min.x - Math.SQRT2 * .4 && player.x <= chunk.bounds.max.x + Math.SQRT2 * .4
          && player.z >= chunk.bounds.min.z - Math.SQRT2 * .4 && player.z <= chunk.bounds.max.z + Math.SQRT2 * .4
          && space.position.y > chunk.bounds.min.y - .8 && space.position.y < chunk.bounds.max.y + .8)) continue;
        // A room and its bed can share one page. Test the actual admitted
        // mattress before hashing the entire definition just to offer Sleep.
        const mattress = projection.solids.find(solid => solid.id === `${state.nodeId}:body`);
        if (!mattress || !withinBedFootprint(mattress, player, space)) continue;
        const source = resolveCreationBed(snapshot, instance.instanceId, state.nodeId, actorId, kaiUPulse);
        if (source && canSleepInCreationBed(source, player, space, actorId, kaiUPulse)) beds.push(source);
      }
    }
    return beds.sort((a, b) => Math.hypot(a.geometry.center.x - player.x, a.geometry.center.z - player.z) - Math.hypot(b.geometry.center.x - player.x, b.geometry.center.z - player.z) || a.structureId.localeCompare(b.structureId))[0] || null;
  } catch { return null; }
}
export function restoredCreationBedFloor(snapshot: CreationBedSnapshot, marker: { instanceId?: string; nodeId?: string; componentHead: string; spaceId: string }, player: Player, spaceId: string, actorId: string, kaiUPulse: number): number | null {
  if (!marker.instanceId || !marker.nodeId || marker.spaceId !== spaceId) return null;
  const bed = resolveCreationBed(snapshot, marker.instanceId, marker.nodeId, actorId, kaiUPulse);
  if (!bed || bed.head !== marker.componentHead || bed.spaceId !== spaceId) return null;
  const projection = readSnapshot(snapshot).projections.find(p => p.instanceId === bed.instanceId && p.head === bed.head);
  if (!projection || !isAdmittedCreationProjection(projection)) return null;
  let floor: number | null = null;
  for (const surface of projection.walkable) {
    // Restore the supporting floor, never the mattress top or a different storey.
    if (surface.center.y > bed.geometry.center.y - bed.geometry.halfExtents.y + .02
      || surface.center.y < bed.geometry.center.y - .8) continue;
    const dx = player.x - surface.center.x, dz = player.z - surface.center.z;
    const c = Math.cos(surface.yaw), s = Math.sin(surface.yaw);
    if (Math.abs(dx*c-dz*s) > surface.halfExtents.x || Math.abs(dx*s+dz*c) > surface.halfExtents.z
      || !canSleepInCreationBed(bed, player, {spaceId, position:{y:surface.center.y}}, actorId, kaiUPulse)) continue;
    floor = Math.max(floor ?? -Infinity, surface.center.y);
  }
  return floor;
}
export function creationBedWakeFloor(source:unknown,player:Player,floorY:number,actorId:string,kaiUPulse:number,navigation:CreationNavigation):number|null{
  if(!verifyCreationBedSource(source,actorId,kaiUPulse)||!canSleepInCreationBed(source,player,{spaceId:source.spaceId,position:{y:floorY}},actorId,kaiUPulse))return null;
  if(creationPositionIsClear(navigation,source.spaceId,{...player,y:floorY}))return floorY;
  // Sleep lies on the mattress visually while logical feet remain at the room
  // floor. Stand on its admitted top before walking, with full head clearance.
  const y=source.geometry.center.y+source.geometry.halfExtents.y;
  return creationPositionIsClear(navigation,source.spaceId,{...player,y})?y:null;
}
/** Feet lie toward the mattress foot; the torso points toward its positive-depth pillow end. */
export function projectCreationBedSleepPose(source: unknown, player: Player, floorY: number, actorId: string, kaiUPulse: number): WildsBedSleepPose | null {
  if (!verifyCreationBedSource(source, actorId, kaiUPulse) || !canSleepInCreationBed(source, player, { spaceId: source.spaceId, position: { y: floorY } }, actorId, kaiUPulse)) return null;
  const { geometry } = source, yaw = geometry.yaw;
  return { position: [geometry.center.x - player.x - Math.sin(yaw) * .72, geometry.center.y + geometry.halfExtents.y + .22 - floorY, geometry.center.z - player.z - Math.cos(yaw) * .72], heading: yaw, pitch: Math.PI / 2 };
}
