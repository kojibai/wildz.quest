import { wildsProductionPlacementGradesGround } from './wilds-world-construction';
import { constructionGeometryForCollections } from './wilds-construction-neighborhood';
import { verifyWildsConstructionComponent, projectWildsConstructionProgress } from './wilds-construction-component';
import { verifyWildsConstructionProject } from './wilds-construction-project';
import { wildsMaterialCustodian } from './wilds-world-state';
import type { WildsWorldProjection } from './wilds-world-state';
import type { WildsHarvestedSourceStateV1 } from './wilds-steward-construction';
import type { WildsNourishmentSourceState, WildsFoodKind } from './wilds-nourishment';
import { wildsBuildSceneryClearedAt, type WildsBuildSceneryFootprint } from './wilds-build-scenery';
import { projectWildsCreationPersistence, compileWorldCreationSource, CREATION_WORLD_RULE } from './creation/world-source';
import { projectCreationPhysical } from './creation/projection';
import { creationClearsNaturalScenery } from './creation/ground-placement';
import { projectWildsConstructionTerrain, sampleWildsConstructionTerrainAt } from './wilds-construction-terrain';
import { constructionProofDigest, freezeConstructionProof, validConstructionKai } from './wilds-construction-project';
import { projectWildsResourceSourceForObstacle, projectWildsResourceAvailability } from './wilds-resource-authority';
import { initialWildsHarvestedSourceState, verifyWildsHarvestedSourceState, verifyWildsMaterialLot } from './wilds-steward-construction';
import { wildsNourishmentPlantsForTile, wildsNourishmentPlantById, wildsNourishmentSourceAt } from './wilds-nourishment';
import { wildsTerrainObstaclesForTile, WILDS_RENDERED_PHYSICAL_OBSTACLES, projectWildsRenderedLivingObstacles } from './wilds-terrain-obstacles';
import { WILDS_TERRAIN_TILE_SIZE } from './wilds-terrain-authority';
import { WILDS_BUILD_FLAT_APRON, sampleWildsBuildGround } from './wilds-build-ground';
import type { CreationSolid } from './creation/geometry';
import type { WildsConstructionTerrainPad } from './wilds-construction-terrain';
type Point = Readonly<{ x: number; y: number; z: number }>;
/** Historical command data, exact-compared to native global replay on first admission. */
export type WildsClearanceHistoricalContext = Readonly<{solids:readonly CreationSolid[];terrain:readonly WildsConstructionTerrainPad[];piles:readonly Point[]}>;
/** Exact replay checkpoints; validity of this data does not establish native custody. */
export type WildsBuildingClearanceSourceCheckpoints = Readonly<{
  materials: Readonly<Record<string, WildsHarvestedSourceStateV1 | null>>;
  food: Readonly<Record<string, WildsNourishmentSourceState | null>>;
  retiredSourceIds: readonly string[];
}>;
export type WildsClearanceSource = Readonly<{
  sourceId: string; sourceHead: string; kind: 'timber' | 'stone' | 'food';
  foodKind?: WildsFoodKind; cropDay?: number; remaining: number; position: Point;
}>;
export type WildsBuildingClearanceV1 = Readonly<{
  schema: 'wildz.building-clearance.v1'; clearanceId: string; ruleHead: string;
  buildingId: string; buildingHead: string; buildingOwnerId: string; constructionRuleHead: string; commandId: string;
  buildingKaiUPulse: number; paidFootprintHead: string; kaiUPulse: number; footprints: readonly WildsBuildSceneryFootprint[]; sources: readonly WildsClearanceSource[];
}>;
export type WildsClearancePile = WildsClearanceSource & Readonly<{ pileId: string; clearanceId: string }>;
export type WildsBuildingClearanceInputs = Readonly<{
  world: WildsWorldProjection; buildingId: string; buildingHead: string;
  sourceCheckpoints: WildsBuildingClearanceSourceCheckpoints; kaiUPulse: number;
  historicalContext?: WildsClearanceHistoricalContext;
}>;

/** Candidate law, selected only by the new explicit construction marker. The
 * released resource source remains the enclosing authority and admits no yield
 * merely because this deterministic container is structurally valid. */
export const WILDS_BUILDING_CLEARANCE_RULE = Object.freeze({
  id: 'wildz.building-clearance.v1', terrain: 'complete-oriented-paid-footings-and-flat-apron',
  sources: 'bounded-canonical-terrain-and-current-crop-exact-checkpoints',
  portions: 'remaining-capacity-at-exact-kai-no-missed-crops',
  retirement: 'first-clearance-per-original-source-permanent',
  history: 'independent-of-evolution-move-demolition-and-transfer',
  placement: 'stable-source-order-outside-walls-doorways-and-established-structures',
  authority: 'candidate-only-requires-current-native-source-replay'
});
export const WILDS_BUILDING_CLEARANCE_RULE_HEAD = constructionProofDigest(WILDS_BUILDING_CLEARANCE_RULE);
const q = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function canonicalSourceId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (wildsNourishmentPlantById(id)) return true;
  const match = /^wildz\.resource\.v1:terrain:(-?\d+):(-?\d+):(tree|rock):(\d+)$/.exec(id);
  if (!match) return false;
  const obstacle = wildsTerrainObstaclesForTile(Number(match[1]), Number(match[2])).find(item => item.id === `wildz.terrain.v1:${match[1]}:${match[2]}:${match[3]}:${match[4]}`);
  return !!obstacle && projectWildsResourceSourceForObstacle(obstacle).sourceId === id;
}
function assertCheckpoints(value: WildsBuildingClearanceSourceCheckpoints) {
  if (!plain(value) || Object.keys(value).sort().join(',') !== 'food,materials,retiredSourceIds'
    || !plain(value.materials) || !plain(value.food) || !Array.isArray(value.retiredSourceIds)
    || value.retiredSourceIds.some(id => !canonicalSourceId(id)) || new Set(value.retiredSourceIds).size !== value.retiredSourceIds.length)
    throw Error('wilds_clearance_checkpoints_invalid');
}
function footprintBounds(pad: WildsBuildSceneryFootprint, extra: number) {
  const c = Math.abs(Math.cos(pad.yaw)), s = Math.abs(Math.sin(pad.yaw));
  const hx = c * (pad.halfExtents.x + extra) + s * (pad.halfExtents.z + extra),
    hz = s * (pad.halfExtents.x + extra) + c * (pad.halfExtents.z + extra);
  return { minX: pad.center.x - hx, maxX: pad.center.x + hx, minZ: pad.center.z - hz, maxZ: pad.center.z + hz };
}
function tilesForFootprints(footprints: readonly WildsBuildSceneryFootprint[]) {
  const tiles = new Set<string>();
  // Tree canopies can intersect a footprint from an adjacent tile. The canonical
  // generator's maximum canopy is below 8m; keep enumeration bounded by the law.
  for (const pad of footprints) {
    const b = footprintBounds(pad, WILDS_BUILD_FLAT_APRON + 8);
    const x0 = Math.floor(b.minX / WILDS_TERRAIN_TILE_SIZE), x1 = Math.floor(b.maxX / WILDS_TERRAIN_TILE_SIZE),
      z0 = Math.floor(b.minZ / WILDS_TERRAIN_TILE_SIZE), z1 = Math.floor(b.maxZ / WILDS_TERRAIN_TILE_SIZE);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > CREATION_WORLD_RULE.maximumTerrainTiles) throw Error('wilds_clearance_footprint_budget');
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) tiles.add(`${x}:${z}`);
    if (tiles.size > CREATION_WORLD_RULE.maximumTerrainTiles) throw Error('wilds_clearance_footprint_budget');
  }
  return [...tiles].sort().map(key => key.split(':').map(Number));
}
function historyIds(world: WildsWorldProjection) {
  return Object.values(world.buildingClearances ?? {}).flatMap(value => {
    if (!isWildsBuildingClearanceCandidate(value)) throw Error('wilds_clearance_history_invalid');
    return value.sources.map(source => source.sourceId);
  });
}
/** Hash/container consistency only, never native admission or shared authority. */
export function isWildsBuildingClearanceCandidate(value: unknown): value is WildsBuildingClearanceV1 {
  try {
    const candidate = value as WildsBuildingClearanceV1;
    if (!candidate || candidate.schema !== 'wildz.building-clearance.v1' || candidate.ruleHead !== WILDS_BUILDING_CLEARANCE_RULE_HEAD
      || !validConstructionKai(candidate.kaiUPulse) || !Array.isArray(candidate.footprints) || !candidate.footprints.length
      || !Array.isArray(candidate.sources) || new Set(candidate.sources.map(source => source.sourceId)).size !== candidate.sources.length
      || candidate.sources.some(source => !canonicalSourceId(source.sourceId) || !Number.isSafeInteger(source.remaining) || source.remaining < 0
        || ![source.position.x, source.position.y, source.position.z].every(Number.isFinite))) return false;
    const { clearanceId, ...basis } = candidate;
    return clearanceId === `wildz:clearance:${constructionProofDigest(basis).slice(7)}`;
  } catch { return false; }
}

/** Zero-write derivation from an admitted paid source and explicit exact replay
 * checkpoints. This function cannot authenticate an imported world/checkpoint,
 * reserve a portion, retire a crop, or credit an inventory. Task 3 must compare
 * these inputs with independently opened current native source replay. */
export function deriveWildsBuildingClearance(input: WildsBuildingClearanceInputs): WildsBuildingClearanceV1 {
  if (!validConstructionKai(input.kaiUPulse)) throw Error('wilds_clearance_kai_invalid');
  assertCheckpoints(input.sourceCheckpoints);
  const source = projectWildsCreationPersistence(input.world).creations[input.buildingId];
  const component = input.world.constructionComponents[input.buildingId];
  let building: { head: string; ownerId: string; kaiUPulse: number; commandId: string; ruleHead: string; paidFootprintHead: string; solids: ReturnType<typeof projectCreationPhysical>['solids'] };
  if (source) {
    if (source.instance.head !== input.buildingHead || source.kaiUPulse > input.kaiUPulse
      || !creationClearsNaturalScenery(source.command.context)
      || Object.values(source.instance.nodeStates).some(node => node.kind === 'equipment')) throw Error('wilds_clearance_building_unadmitted');
    building = { head: source.instance.head, ownerId: source.instance.ownerId, kaiUPulse: source.kaiUPulse,
      commandId: source.command.commandId, ruleHead: source.ruleHead, paidFootprintHead: source.instance.head,
      solids: projectCreationPhysical(source.instance, source.command.definition, compileWorldCreationSource(source)).solids };
  } else if (component && verifyWildsConstructionComponent(component)) {
    const project = input.world.constructionProjects[component.projectId];
    if (component.head !== input.buildingHead || component.kaiUPulse > input.kaiUPulse
      || !project || !verifyWildsConstructionProject(project) || project.ownerReceizId !== component.ownerReceizId
      || (component.evidence.spaceId ?? 'wildz.space.outer.v1') !== 'wildz.space.outer.v1'
      || component.evidence.physical.groundSupport !== 'wildz.build-ground.v2'
      || !['foundation', 'floor', 'path', 'garden', 'workshop'].includes(component.kind)) throw Error('wilds_clearance_building_unadmitted');
    if (!wildsProductionPlacementGradesGround(component.evidence, component.kind)) throw Error('wilds_clearance_building_unsupported');
    const materials = Object.values(input.world.constructionMaterialContributions), work = Object.values(input.world.constructionWorkContributions);
    const progress = projectWildsConstructionProgress(component, materials, work);
    if (progress.stage === 'planned' || progress.allocationConflicts.length || progress.invalidWorkContributionIds.length) throw Error('wilds_clearance_building_unpaid');
    const embedded = materials.filter(item => progress.embeddedLotIds.includes(item.lotId));
    if (!embedded.length || embedded.some(item => {
      const lot = input.world.materialLots[item.lotId];
      return !lot || !verifyWildsMaterialLot(lot) || lot.head !== item.lotHead || input.world.consumedMaterialLots[item.lotId] !== component.componentId
        || wildsMaterialCustodian(input.world, lot) !== item.custodianReceizId || item.kaiUPulse > input.kaiUPulse;
    }) || work.some(item => progress.appliedWorkContributionIds.includes(item.contributionId) && item.kaiUPulse > input.kaiUPulse)) throw Error('wilds_clearance_building_unpaid');
    const physical = constructionGeometryForCollections(input.world.constructionMaterialContributions, input.world.constructionWorkContributions)(component);
    building = { head: component.head, ownerId: component.ownerReceizId, kaiUPulse: component.originKaiUPulse ?? component.kaiUPulse,
      commandId: component.adjustmentCommandId ?? component.commandId,
      ruleHead: constructionProofDigest({ id: 'construction.component.clearance.v1', landscape: 'wildz.build-ground.v2', clearance: WILDS_BUILDING_CLEARANCE_RULE_HEAD }),
      paidFootprintHead: constructionProofDigest({ componentHead: component.head, solids: physical.solids, work: progress.appliedWork,
        lots: embedded.map(item => [item.lotId, item.lotHead]).sort(([a], [b]) => a.localeCompare(b)) }),
      solids: physical.solids.map(solid => ({ ...solid, yaw: 0 })) };
  } else throw Error('wilds_clearance_building_unadmitted');
  const previous = Object.values(input.world.buildingClearances ?? {}).find(item => item.buildingId === input.buildingId
    && item.buildingHead === building.head && item.paidFootprintHead === building.paidFootprintHead);
  if (previous) {
    if (!isWildsBuildingClearanceCandidate(previous)) throw Error('wilds_clearance_history_invalid');
    return freezeConstructionProof(JSON.parse(JSON.stringify(previous)) as WildsBuildingClearanceV1);
  }
  const bottom = Math.min(...building.solids.map(solid => solid.center.y - solid.halfExtents.y));
  const footprints = building.solids.filter(solid => solid.center.y - solid.halfExtents.y <= bottom + .025)
    .map(solid => ({ center: { ...solid.center, y: q(bottom) }, halfExtents: { x: solid.halfExtents.x, z: solid.halfExtents.z }, yaw: solid.yaw }))
    .sort((a, b) => constructionProofDigest(a).localeCompare(constructionProofDigest(b)));
  if (!footprints.length) throw Error('wilds_clearance_footprint_invalid');
  const retired = new Set([...input.sourceCheckpoints.retiredSourceIds, ...historyIds(input.world)]);
  const candidates = new Map<string, Omit<WildsClearanceSource, 'position'> & { origin: Point }>();
  for (const [x, z] of tilesForFootprints(footprints)) {
    const clearedTrees = new Set<string>();
    for (const obstacle of wildsTerrainObstaclesForTile(x, z)) {
      const radius = Math.max(obstacle.radius, obstacle.kind === 'tree' ? obstacle.visualScale * 1.4 : obstacle.radius);
      if (!wildsBuildSceneryClearedAt(footprints, obstacle.position.x, obstacle.position.z, radius)) continue;
      if (obstacle.kind === 'tree') clearedTrees.add(obstacle.id);
      const original = projectWildsResourceSourceForObstacle(obstacle);
      if (retired.has(original.sourceId)) continue;
      if (!own(input.sourceCheckpoints.materials, original.sourceId)) throw Error(`wilds_clearance_checkpoint_missing:${original.sourceId}`);
      const supplied = input.sourceCheckpoints.materials[original.sourceId], current = supplied === null ? initialWildsHarvestedSourceState(original) : supplied;
      if (!current || !verifyWildsHarvestedSourceState(current) || current.sourceId !== original.sourceId
        || Object.keys(current).sort().join(',') !== 'harvestedCapacity,head,lastHarvestKaiPulse,parentHead,revision,schema,sourceId'
        || current.harvestedCapacity > original.capacity || (current.revision === 0 && constructionProofDigest(current) !== constructionProofDigest(initialWildsHarvestedSourceState(original))))
        throw Error('wilds_clearance_material_checkpoint_invalid');
      const remaining = projectWildsResourceAvailability(original, { admittedHarvestedCapacity: current.harvestedCapacity,
        lastHarvestKaiPulse: current.lastHarvestKaiPulse, currentKaiPulse: String(input.kaiUPulse) }).availableCapacity;
      candidates.set(original.sourceId, { sourceId: original.sourceId, sourceHead: current.head, kind: original.kind as 'timber' | 'stone', remaining, origin: original.position });
    }
    for (const plant of wildsNourishmentPlantsForTile(x, z)) {
      if (!(plant.terrainTreeId && clearedTrees.has(plant.terrainTreeId)) && !wildsBuildSceneryClearedAt(footprints, plant.position.x, plant.position.z, .35)) continue;
      if (retired.has(plant.sourceId)) continue;
      if (!own(input.sourceCheckpoints.food, plant.sourceId)) throw Error(`wilds_clearance_checkpoint_missing:${plant.sourceId}`);
      const checkpoint = input.sourceCheckpoints.food[plant.sourceId];
      if (checkpoint !== null && !plain(checkpoint)) throw Error('wilds_clearance_food_checkpoint_invalid');
      const crop = wildsNourishmentSourceAt(plant, checkpoint === null ? undefined : checkpoint, input.kaiUPulse);
      if (!crop.valid) throw Error('wilds_clearance_food_checkpoint_invalid');
      candidates.set(plant.sourceId, { sourceId: plant.sourceId, sourceHead: crop.head, kind: 'food', foodKind: plant.foodKind,
        cropDay: crop.cropDay, remaining: crop.remaining, origin: plant.position });
    }
  }
  const terrain = [...projectWildsConstructionTerrain(input.world),...(input.historicalContext?.terrain??[])];
  const established = [...Object.values(projectWildsCreationPersistence(input.world).creations).filter(item => item.instance.instanceId !== input.buildingId)
    .flatMap(item => projectCreationPhysical(item.instance, item.command.definition, compileWorldCreationSource(item)).solids),...(input.historicalContext?.solids??[])];
  const obstacles = [...WILDS_RENDERED_PHYSICAL_OBSTACLES, ...projectWildsRenderedLivingObstacles(input.world)];
  const survivingScenery = new Map<string, ReturnType<typeof wildsTerrainObstaclesForTile>>();
  const clearFootprints = [...footprints, ...terrain.filter(pad => pad.clearsScenery)];
  const blockedByScenery = (point: Point) => {
    // Side positions can extend beyond the cleared tiles. Query canonical
    // surviving collision bodies there, not just rendered fixed landmarks.
    const minX = Math.floor((point.x - 8.8) / WILDS_TERRAIN_TILE_SIZE), maxX = Math.floor((point.x + 8.8) / WILDS_TERRAIN_TILE_SIZE),
      minZ = Math.floor((point.z - 8.8) / WILDS_TERRAIN_TILE_SIZE), maxZ = Math.floor((point.z + 8.8) / WILDS_TERRAIN_TILE_SIZE);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const key = `${x}:${z}`;
      let obstacles = survivingScenery.get(key);
      if (!obstacles) {
        obstacles = wildsTerrainObstaclesForTile(x, z).filter(obstacle => !retired.has(projectWildsResourceSourceForObstacle(obstacle).sourceId)
          && !wildsBuildSceneryClearedAt(clearFootprints, obstacle.position.x, obstacle.position.z,
            Math.max(obstacle.radius, obstacle.kind === 'tree' ? obstacle.visualScale * 1.4 : obstacle.radius)));
        survivingScenery.set(key, obstacles);
      }
      if (obstacles.some(obstacle => Math.hypot(point.x - obstacle.position.x, point.z - obstacle.position.z) < obstacle.radius + .8)) return true;
    }
    return false;
  };
  const placed: Point[] = [...Object.values(input.world.buildingClearances ?? {}).flatMap(clearance => clearance.sources.filter(item => item.remaining > 0).map(item => item.position)),...(input.historicalContext?.piles??[])];
  const sources = [...candidates.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)).map(({ origin, ...resource }) => {
    let position: Point | undefined;
    // Source-nearest side first, then alternate sides, tangential slots, and a
    // bounded natural-ground laydown when a neighboring property occupies it.
    const positions: Array<{ point: Point; ring: number; distance: number; order: number }> = [];
    for (const [index, pad] of footprints.entries()) for (let ring = 0; ring < 8; ring++) for (let side = 0; side < 4; side++) {
      const edge = side % 2 ? pad.halfExtents.z : pad.halfExtents.x;
      const along = side % 2 ? pad.halfExtents.x : pad.halfExtents.z;
      const slots = Math.max(1, Math.floor(along / .9));
      for (let slot = -slots; slot <= slots; slot++) {
        const tangent = slot * Math.min(.9, along / slots);
        if (side === 3 && Math.abs(tangent) < 1.5) continue; // unobstructed doorway approach
        const normal = (side < 2 ? 1 : -1) * (edge + .75 + ring);
        const dx = side % 2 ? tangent : normal, dz = side % 2 ? normal : tangent;
        const c = Math.cos(pad.yaw), s = Math.sin(pad.yaw), x = q(pad.center.x + dx * c + dz * s), z = q(pad.center.z - dx * s + dz * c);
        const ground = sampleWildsBuildGround(x, z), y = sampleWildsConstructionTerrainAt(terrain, x, z, ground.elevation);
        positions.push({ point: { x, y, z }, ring, distance: Math.hypot(x - origin.x, z - origin.z), order: index * 100000 + side * 1000 + slot + slots });
      }
    }
    positions.sort((a, b) => a.ring - b.ring || a.distance - b.distance || a.order - b.order);
    for (const candidate of positions) {
      const point = candidate.point;
      if (footprints.some(pad => { const dx = point.x - pad.center.x, dz = point.z - pad.center.z, c = Math.cos(pad.yaw), s = Math.sin(pad.yaw); return Math.abs(dx * c - dz * s) <= pad.halfExtents.x + .4 && Math.abs(dx * s + dz * c) <= pad.halfExtents.z + .4; })) continue;
      if (established.some(solid => {
        const dx = point.x - solid.center.x, dz = point.z - solid.center.z, c = Math.cos(solid.yaw), s = Math.sin(solid.yaw);
        return Math.abs(dx * c - dz * s) <= solid.halfExtents.x + 1 && Math.abs(dx * s + dz * c) <= solid.halfExtents.z + 1;
      })) continue;
      if (terrain.some(pad => !pad.historicalScenery && pad.ownerId && !pad.id.startsWith(`${input.buildingId}:`) && wildsBuildSceneryClearedAt([pad], point.x, point.z, .4))) continue;
      if (obstacles.some(obstacle => Math.hypot(point.x - obstacle.position.x, point.z - obstacle.position.z) < obstacle.radius + .8)) continue;
      if (blockedByScenery(point)) continue;
      if (placed.some(other => Math.hypot(point.x - other.x, point.z - other.z) < 1.2)) continue;
      if (candidate.ring && (sampleWildsBuildGround(point.x, point.z).slope > .55 || point.y < -.9)) continue;
      position = point; break;
    }
    if (!position) throw Error('wilds_clearance_laydown_unavailable');
    if (resource.remaining > 0) placed.push(position);
    return { ...resource, position };
  });
  const basis = { schema: 'wildz.building-clearance.v1' as const, ruleHead: WILDS_BUILDING_CLEARANCE_RULE_HEAD,
    buildingId: input.buildingId, buildingHead: building.head, buildingOwnerId: building.ownerId, constructionRuleHead: building.ruleHead,
    commandId: building.commandId, buildingKaiUPulse: building.kaiUPulse, paidFootprintHead: building.paidFootprintHead, kaiUPulse: input.kaiUPulse, footprints, sources };
  return freezeConstructionProof({ ...basis, clearanceId: `wildz:clearance:${constructionProofDigest(basis).slice(7)}` });
}
export function verifyWildsBuildingClearance(value: unknown, exactInputs: WildsBuildingClearanceInputs): boolean {
  try { return constructionProofDigest(value) === constructionProofDigest(deriveWildsBuildingClearance(exactInputs)); } catch { return false; }
}
/** Disposable finite display projection, never an inventory grant. */
export function projectWildsBuildingClearancePiles(clearances: readonly WildsBuildingClearanceV1[], depletion: Readonly<Record<string, number>>): readonly WildsClearancePile[] {
  const seen = new Map<string, string>(), piles: WildsClearancePile[] = [];
  for (const clearance of clearances) {
    if (!isWildsBuildingClearanceCandidate(clearance)) throw Error('wilds_clearance_candidate_invalid');
    const digest = constructionProofDigest(clearance), existing = seen.get(clearance.clearanceId);
    if (existing) { if (existing !== digest) throw Error('wilds_clearance_candidate_conflict'); continue; }
    seen.set(clearance.clearanceId, digest);
    for (const source of clearance.sources) {
      const pileId = `wildz:clearance-pile:${constructionProofDigest({ clearanceId: clearance.clearanceId, sourceId: source.sourceId }).slice(7)}`;
      const taken = depletion[pileId] ?? 0;
      if (!Number.isSafeInteger(taken) || taken < 0 || taken > source.remaining) throw Error('wilds_clearance_depletion_invalid');
      if (taken < source.remaining) piles.push({ ...source, remaining: source.remaining - taken, pileId, clearanceId: clearance.clearanceId });
    }
  }
  return freezeConstructionProof(piles);
}

export type WildsBuildingClearanceEventPayload = Readonly<{
  ruleHead: string; buildingId: string; buildingHead: string;
  sourceCheckpoints: WildsBuildingClearanceSourceCheckpoints; clearance: WildsBuildingClearanceV1;
  historicalContext?: WildsClearanceHistoricalContext;
}>;
/** Distinct causal append for a previously captured building; its original
 * creation command/source bytes stay intact. This payload is candidate data. */
export function deriveWildsBuildingClearanceEventPayload(input: WildsBuildingClearanceInputs): WildsBuildingClearanceEventPayload {
  const clearance = deriveWildsBuildingClearance(input);
  return freezeConstructionProof(JSON.parse(JSON.stringify({ ruleHead: WILDS_BUILDING_CLEARANCE_RULE_HEAD,
    buildingId: input.buildingId, buildingHead: input.buildingHead, sourceCheckpoints: input.sourceCheckpoints, clearance,
    ...(input.historicalContext?{historicalContext:input.historicalContext}:{}) })) as WildsBuildingClearanceEventPayload);
}

export type WildsClearanceHistory=Pick<WildsWorldProjection,'buildingClearances'|'clearanceTaken'>;
/** Saved display continuity only. A restored row cannot authorize collection. */
export function projectWildsClearanceHistory(value:WildsClearanceHistory):WildsClearanceHistory {
 if(!value.buildingClearances)return {};
 const buildingClearances=Object.fromEntries(Object.entries(value.buildingClearances).filter(([id,row])=>id===row.clearanceId&&isWildsBuildingClearanceCandidate(row)));
 const capacities=new Map(projectWildsBuildingClearancePiles(Object.values(buildingClearances),{}).map(pile=>[pile.pileId,pile.remaining]));
 const clearanceTaken=Object.fromEntries(Object.entries(value.clearanceTaken??{}).filter(([id,taken])=>Number.isSafeInteger(taken)&&taken>=0&&taken<=(capacities.get(id)??-1)));
 return freezeConstructionProof({buildingClearances,clearanceTaken});
}
/** Reservations and finite depletion are monotonic. Current-source admission
 * still reopens native evidence; this only preserves previously painted facts. */
export function preserveWildsClearanceHistory<T extends WildsClearanceHistory>(current:WildsClearanceHistory,candidate:T):T{
 if(!current.buildingClearances)return candidate;
 if(current.buildingClearances===candidate.buildingClearances&&current.clearanceTaken===candidate.clearanceTaken)return candidate;
 const buildingClearances={...current.buildingClearances,...candidate.buildingClearances},clearanceTaken={...candidate.clearanceTaken};
 for(const [id,taken] of Object.entries(current.clearanceTaken??{}))clearanceTaken[id]=Math.max(taken,clearanceTaken[id]??0);
 const sameRows=(a:object|undefined,b:object)=>Object.keys(a??{}).length===Object.keys(b).length&&Object.entries(b).every(([id,row])=>(a as Record<string,unknown>|undefined)?.[id]===row);
 if(sameRows(candidate.buildingClearances,buildingClearances)&&sameRows(candidate.clearanceTaken,clearanceTaken))return candidate;
 const history=freezeConstructionProof({buildingClearances,clearanceTaken});return {...candidate,...history};
}
