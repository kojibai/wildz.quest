import {verifyWorldCreationActionRecord,type WildsCreationActionRecord} from './world-action';
import { emptyAdventureCondition, validateAdventureCondition, type AdventureCardCondition } from '../adventure/card-condition';
import { verifyAnyWildsCard, type PortableCardAsset } from '../portable-card';
import { constructionProofDigest, freezeConstructionProof, validConstructionHead, validConstructionId, validConstructionKai } from '../wilds-construction-project';
import { checkpointWildsWorld, wildsMaterialCustodian, type WildsWorldProjection } from '../wilds-world-state';
import { assertCreationData, parseCreationDefinition } from './definition';
import { compileCreation, type CreationCompileContext, type CreationPlan } from './compiler';
import { projectCreationWorkers, combineCreationTechniques } from './capabilities';
import { createCreationInstance, sealCreationInstance, verifyCreationInstance, type CreationInstance } from './instance';
import { initializeCreationComponents, CREATION_COMPONENT_RULE_HEAD } from './components';
import { selectCreationResources, type CreationSelectedLot } from './resources';
import { projectCreationPhysical, creationNodePoses } from './projection';
import { reviseCreationInstance, CREATION_EVOLUTION_RULE_HEAD } from './evolution';
import { overlapsCreationSolids } from './geometry';
import type { CreationSolid } from './geometry';
import { WILDS_RENDERED_PHYSICAL_OBSTACLES, projectWildsRenderedLivingObstacles, wildsTerrainObstaclesForTile } from '../wilds-terrain-obstacles';
import { WILDS_TERRAIN_TILE_SIZE } from '../wilds-terrain-authority';
import { admitWildsDiscoveryPhysicalNeighborhood } from '../wilds-discovery-sites';
import { composeWildsBurrowPhysical } from '../wilds-burrow';
import { composeWildsInteriorConstruction } from '../wilds-construction-physics';
import type { CreationDefinition } from './types';
import { verifyWildsWorldEvent, type WildsWorldEvent } from '../wilds-world-event';
import { verifyWildsMaterialLot } from '../wilds-steward-construction';
import { sameWildzPlayerCoordinate } from '../../../lib/receiz/wildz-player-coordinate';
import { CREATURE_CREATION_TECHNIQUE_RULE_V1 } from '../creature-capability-identity';
import { createWildsExactProofCache } from '../wilds-exact-proof-cache';
import { creationBuildInReach, CREATION_PHYSICAL_BUILD_REACH_RULE, type CreationBuildReachRule } from './build-reach';

export const CREATION_WORLD_RULE = Object.freeze({ id: 'creation.world.construct.v1', componentRuleHead: CREATION_COMPONENT_RULE_HEAD, techniqueRule: CREATURE_CREATION_TECHNIQUE_RULE_V1, maximumWorkers: 32, maximumMaterialLots: 256, maximumTerrainTiles: 256, work: 'source-card-techniques', custody: 'exact-finite-lot-consumption', readiness: 'local-condition-restricts-source-capability', physical: 'canonical-terrain-discovery-burrows-construction-and-admitted-creations' });
export type WildsCreationNativeKeeper = Readonly<{ schema: 'wildz.creation-native-keeper.v128'; ownerReceizId: string; assetId: string; cardProofDigest: string; artifactSha256: string; nativeHead: string }>;
export type WildsCreationWorkerSource = Readonly<{ card: PortableCardAsset; condition: AdventureCardCondition; nativeKeeper?: WildsCreationNativeKeeper }>;
export type WildsCreationConstructCommand = Readonly<{
  type: 'creation.construct'; commandId: string; instanceId: string; definition: CreationDefinition;
  context: CreationCompileContext; planDigest: string; workerSources: readonly WildsCreationWorkerSource[];
  resources: readonly CreationSelectedLot[]; actorPosition: Readonly<{ x: number; y: number; z: number }>;
  reachRule?: CreationBuildReachRule;
}>;
export type WildsCreationEvolveCommand = Omit<WildsCreationConstructCommand, 'type'> & Readonly<{ type: 'creation.evolve'; expectedHead: string }>;
export type WildsCreationBuildCommand = WildsCreationConstructCommand | WildsCreationEvolveCommand;
export type WildsCreationSourceCore = Readonly<{
  schema: 'wildz.creation-world-source.v1'; command: WildsCreationBuildCommand; commandDigest: string;
  instance: CreationInstance; ruleHead: string; kaiUPulse: number;
}>;
export type WildsCreationSourceRecord = WildsCreationSourceCore & Readonly<{ history?: readonly (WildsCreationSourceCore & Readonly<{ eventId: string }>)[]; constructionInstance?:CreationInstance; actions?:readonly Readonly<{record:WildsCreationActionRecord;priorEventId:string}>[] }>;
export const CREATION_WORLD_RULE_HEAD = constructionProofDigest(CREATION_WORLD_RULE);
export const CREATION_WORLD_EVOLUTION_RULE_HEAD = constructionProofDigest({ id: 'creation.world.evolve.v1', construct: CREATION_WORLD_RULE_HEAD, evolution: CREATION_EVOLUTION_RULE_HEAD, maximumPredecessors: 64, identity: 'owner-current-head-compare-and-swap', history: 'exact-flat-source-and-event-citations' });
export const CREATION_WORLD_PHYSICAL_BUILD_RULE_HEAD = constructionProofDigest({ ...CREATION_WORLD_RULE,
  id: 'creation.world.construct.v2', reach: CREATION_PHYSICAL_BUILD_REACH_RULE });
export const CREATION_WORLD_PHYSICAL_EVOLUTION_RULE_HEAD = constructionProofDigest({ id: 'creation.world.evolve.v2',
  construct: CREATION_WORLD_PHYSICAL_BUILD_RULE_HEAD, evolution: CREATION_EVOLUTION_RULE_HEAD,
  maximumPredecessors: 64, identity: 'owner-current-head-compare-and-swap', history: 'exact-flat-source-and-event-citations' });
function creationWorldBuildRuleHead(command: WildsCreationBuildCommand): string {
  if (command.workerSources.some(source => source.nativeKeeper)) {
    const original = creationWorldBuildRuleHead({ ...command, workerSources: command.workerSources.map(({ nativeKeeper: _keeper, ...source }) => source) });
    return constructionProofDigest({ id: 'creation.world.native-keeper.v128', original, custody: 'native-root-source-and-complete-accepted-group', binding: 'exact-actor-card-projection-artifact-and-current-native-head' });
  }
  if (command.reachRule === undefined) return command.type === 'creation.construct' ? CREATION_WORLD_RULE_HEAD : CREATION_WORLD_EVOLUTION_RULE_HEAD;
  if (command.reachRule !== CREATION_PHYSICAL_BUILD_REACH_RULE.id) throw Error('creation_world_reach_rule_invalid');
  return command.type === 'creation.construct' ? CREATION_WORLD_PHYSICAL_BUILD_RULE_HEAD : CREATION_WORLD_PHYSICAL_EVOLUTION_RULE_HEAD;
}
export type WildsCreationPersistence = Readonly<{
  creations: Record<string, WildsCreationSourceRecord>;
  creationEvents: Record<string, WildsWorldEvent>;
  constructionCommandReceipts: WildsWorldProjection['constructionCommandReceipts'];
}>;
type CreationPersistenceInput = Partial<Pick<WildsWorldProjection, 'creations' | 'creationEvents' | 'materialLots' | 'materialCustody' | 'consumedMaterialLots'>>;
export type WildsCreationShelterWorld = CreationPersistenceInput;

/** A husbandry site must be a paid, admitted, functional typed component. */
export function resolveWorldCreationLivestockShelter(world: WildsCreationShelterWorld, instanceId: string, ownerId: string): Readonly<{ shelterId: string; head: string; ownerReceizId: string; position: Readonly<{ x: number; y: number; z: number }>; spaceId: string; capacity: number }> | null {
  const candidate = world.creations?.[instanceId];
  if (!candidate) return null;
  const source = projectWildsCreationPersistence({ ...world, creations: { [instanceId]: candidate } }, ownerId).creations[instanceId];
  if (!source || source.instance.ownerId !== ownerId) return null;
  const plan = compileWorldCreationSource(source), physical = projectCreationPhysical(source.instance, source.command.definition, plan), live = new Set(physical.chunks.flatMap(chunk => chunk.nodeIds)), poses = creationNodePoses(source.command.definition, source.instance.pose);
  const usable = Object.values(source.instance.nodeStates).filter(node => live.has(node.nodeId) && node.condition >= 50).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const habitats = usable.filter(node => node.kind === 'habitat' && node.capacity > 0);
  // Only independently usable real habitats add places; crop beds and fences cannot inflate a ranch.
  const capacity = habitats.reduce((total, node) => total + (node.kind === 'habitat' ? Math.min(4, node.capacity) : 0), 0);
  const anchor = habitats[0] ?? usable.find(node => node.kind === 'garden');
  if (!anchor) return null;
  return { shelterId: instanceId, head: source.instance.head, ownerReceizId: source.instance.ownerId, position: poses.get(anchor.nodeId)!.position, spaceId: source.instance.spaceId, capacity: capacity || 4 };
}

/** Domain/source consistency only; the existing Native account save supplies the
 * enclosing artifact authority. This never upgrades an unsealed JSON fragment. */
export function projectWildsCreationPersistence(input: CreationPersistenceInput, ownerId?: string): WildsCreationPersistence {
  const creations: WildsCreationPersistence['creations'] = {}, creationEvents: WildsCreationPersistence['creationEvents'] = {}, constructionCommandReceipts: WildsCreationPersistence['constructionCommandReceipts'] = {};
  for (const [id, source] of Object.entries(input.creations ?? {})) {
    try {
      if (source.instance.instanceId !== id || ownerId && source.instance.ownerId !== ownerId && !sameWildzPlayerCoordinate(source.instance.ownerId, ownerId)) continue;
      compileWorldCreationSource(source);
      const base=source.actions?.length?{...source,instance:source.constructionInstance!,actions:undefined,constructionInstance:undefined}:source;
      const records = creationWorldSourceHistory(base), events = records.map((record, index) => index < records.length - 1 ? input.creationEvents?.[source.history![index].eventId] : input.creationEvents?.[source.actions?.[0]?.priorEventId??id]);
      if (records.some((record, index) => !creationWorldEventMatches(record, events[index]))) continue;
      if (source.instance.embeddedResources.some(ref => {
        const lot = input.materialLots?.[ref.id];
        return !lot || !verifyWildsMaterialLot(lot) || lot.head !== ref.head || lot.kind !== ref.kind || lot.quantity !== ref.quantity || (input.materialCustody?.[ref.id]?.ownerReceizId ?? lot.ownerReceizId) !== source.instance.ownerId || input.consumedMaterialLots?.[ref.id] !== id;
      })) continue;
      if(source.actions?.some((action,index)=>{const event=input.creationEvents?.[source.actions?.[index+1]?.priorEventId??id];return !event||event.kind!=='creation.acted'||event.actorId!==action.record.actorId||constructionProofDigest((event.payload as {record:WildsCreationActionRecord}).record)!==constructionProofDigest(action.record);}))continue;
      creations[id] = source; creationEvents[id] = input.creationEvents?.[id]??events.at(-1)!;
      for(const action of source.actions??[]){const event=Object.values(input.creationEvents??{}).find(event=>event.causeId===action.record.command.commandId&&event.kind==='creation.acted');if(event){creationEvents[event.eventId]=event;constructionCommandReceipts[event.causeId]={commandDigest:constructionProofDigest(action.record.command),eventPayloadDigest:constructionProofDigest(event.payload),actorId:event.actorId,kind:event.kind};}}
      for (const [index, record] of records.entries()) { const event = events[index]!; creationEvents[event.eventId] = event; constructionCommandReceipts[record.command.commandId] = { commandDigest: record.commandDigest, eventPayloadDigest: constructionProofDigest(event.payload), actorId: event.actorId, kind: event.kind }; }
    } catch { /* Unsupported/altered fragments cannot become active owned source. */ }
  }
  return { creations, creationEvents, constructionCommandReceipts };
}

export function creationWorldSourceHistory(source: WildsCreationSourceRecord): readonly WildsCreationSourceRecord[] {
  return [...(source.history ?? []).map(({ eventId: _eventId, ...core }, index) => ({ ...core, ...(index ? { history: source.history!.slice(0, index) } : {}) })), source];
}
export function creationWorldEventMatches(source: WildsCreationSourceRecord, event: WildsWorldEvent | undefined): boolean {
  if(source.actions?.length){const action=source.actions.at(-1)!.record;return Boolean(event&&verifyWildsWorldEvent(event).ok&&event.kind==='creation.acted'&&event.actorId===action.actorId&&event.causeId===action.command.commandId&&constructionProofDigest((event.payload as {records?:Record<string,unknown>}).records?.[source.instance.instanceId])===constructionProofDigest(source));}
  if (!event || !verifyWildsWorldEvent(event).ok || event.kind !== (source.command.type === 'creation.construct' ? 'creation.constructed' : 'creation.evolved') || event.actorId !== source.instance.ownerId || event.causeId !== source.command.commandId || event.uPulse !== source.kaiUPulse) return false;
  const payload = event.payload as { record?: unknown; commandDigest?: unknown; constitutionalCommand?: { digest?: unknown; type?: unknown } };
  return constructionProofDigest(payload.record) === constructionProofDigest(source) && payload.commandDigest === source.commandDigest && payload.constitutionalCommand?.digest === source.commandDigest && payload.constitutionalCommand.type === source.command.type;
}

/** Exact ancestry, never a claimed revision count or an arbitrary same-ID replacement. */
export function isWorldCreationSuccessor(before: WildsCreationSourceRecord, after: WildsCreationSourceRecord): boolean {
  if(after.actions?.length){try{compileWorldCreationSource(after);const index=before.actions?.length??0;return after.actions.length>index&&constructionProofDigest(after.actions.slice(0,index))===constructionProofDigest(before.actions??[])&&after.actions[index].record.predecessors[before.instance.instanceId]?.head===before.instance.head;}catch{return false;}}
  try { compileWorldCreationSource(before); compileWorldCreationSource(after); return creationWorldSourceHistory(after).some(prior => constructionProofDigest(prior) === constructionProofDigest(before)); } catch { return false; }
}
export function mergeWorldCreationSourceRows(left: CreationPersistenceInput, right: CreationPersistenceInput): Pick<WildsCreationPersistence, 'creations' | 'creationEvents'> {
  const creations = { ...left.creations }, creationEvents = { ...right.creationEvents, ...left.creationEvents };
  for (const [id, candidate] of Object.entries(right.creations ?? {})) {
    try {
      compileWorldCreationSource(candidate);
      if (!creationWorldEventMatches(candidate, right.creationEvents?.[id])) continue;
      if (!creations[id] || isWorldCreationSuccessor(creations[id], candidate)) { creations[id] = candidate; creationEvents[id] = right.creationEvents![id]; }
    } catch { /* A fork cannot supersede an installed source. */ }
  }
  return { creations, creationEvents };
}

/** A binding to the existing admitted world source, never an identity or proof authenticator. */
export function creationWorldSourceHead(world: WildsWorldProjection): string { return checkpointWildsWorld(world).projectionDigest; }

export function creationWorldAvailability(world: WildsWorldProjection, actorId: string) {
  return {
    actorId,
    heads: Object.fromEntries(Object.values(world.materialLots).map(lot => [lot.lotId, lot.head])),
    custody: Object.fromEntries(Object.values(world.materialLots).map(lot => [lot.lotId, wildsMaterialCustodian(world, lot)])),
    spent: new Set(Object.keys(world.consumedMaterialLots)), reserved: new Set(Object.keys(world.reservedMaterialLots)), stored: new Set(Object.keys(world.storedMaterialLots))
  };
}

/** Current device conditions can suppress canonical card techniques; they cannot grant techniques. */
export function creationWorldWorkers(sources: readonly WildsCreationWorkerSource[], actorId: string) {
  if (!sources.length || sources.length > CREATION_WORLD_RULE.maximumWorkers || new Set(sources.map(s => s.card.id)).size !== sources.length) throw Error('creation_world_workers_invalid');
  for (const source of sources) {
    const keeper = source.nativeKeeper;
    if (keeper && (Object.keys(keeper).sort().join(',') !== 'artifactSha256,assetId,cardProofDigest,nativeHead,ownerReceizId,schema'
      || keeper.schema !== 'wildz.creation-native-keeper.v128' || keeper.ownerReceizId !== actorId || keeper.assetId !== source.card.id
      || keeper.cardProofDigest !== source.card.proof.digest || !/^[a-f0-9]{64}$/.test(keeper.artifactSha256) || !/^[a-f0-9]{64}$/.test(keeper.nativeHead))) throw Error('creation_world_worker_keeper_invalid');
    // This retained binding is replay input. The native source host independently
    // verifies its complete root receipt, exact bytes/current owner and head;
    // legacy publication rejects keeper-bearing commands.
    if (!verifyAnyWildsCard(source.card).ok || (source.card.manifest.ownerReceizId !== actorId && !sameWildzPlayerCoordinate(source.card.manifest.ownerReceizId, actorId) && !keeper) || source.condition.assetId !== source.card.id) throw Error('creation_world_worker_source_invalid');
    validateAdventureCondition(source.condition);
  }
  const cards = sources.map(source => source.card);
  const canonical = projectCreationWorkers(cards, Object.fromEntries(cards.map(card => [card.id, emptyAdventureCondition(card.id)])));
  const constrained = projectCreationWorkers(cards, Object.fromEntries(sources.map(source => [source.card.id, source.condition])));
  const workers = constrained.map(worker => ({ ...worker, techniques: worker.techniques.filter(t => canonical.find(c => c.assetId === worker.assetId)!.techniques.includes(t)) }));
  if (workers.some(worker => !worker.ready || !worker.techniques.length)) throw Error('creation_world_worker_not_ready');
  return workers;
}

/** Canonical physical constraints are derived on the source boundary. Carried
 * client chunks cannot erase trees, structures, cave walls, or admitted objects. */
function canonicalCreationWorldSolids(world: WildsWorldProjection, plan: CreationPlan): readonly CreationSolid[] {
  const tiles = new Set<string>(), regions = new Set<string>();
  for (const chunk of plan.chunks) {
    const b = chunk.bounds;
    const tileX0 = Math.floor(b.min.x / WILDS_TERRAIN_TILE_SIZE), tileX1 = Math.floor(b.max.x / WILDS_TERRAIN_TILE_SIZE), tileZ0 = Math.floor(b.min.z / WILDS_TERRAIN_TILE_SIZE), tileZ1 = Math.floor(b.max.z / WILDS_TERRAIN_TILE_SIZE);
    if ((tileX1 - tileX0 + 1) * (tileZ1 - tileZ0 + 1) > CREATION_WORLD_RULE.maximumTerrainTiles) throw Error('creation_world_physical_budget');
    for (let x = tileX0; x <= tileX1; x++) for (let z = tileZ0; z <= tileZ1; z++) tiles.add(`${x}:${z}`);
    if (tiles.size > CREATION_WORLD_RULE.maximumTerrainTiles) throw Error('creation_world_physical_budget');
    for (let x = Math.floor(b.min.x / 128); x <= Math.floor(b.max.x / 128); x++) for (let z = Math.floor(b.min.z / 128); z <= Math.floor(b.max.z / 128); z++) regions.add(`${x}:${z}`);
  }
  const solids: CreationSolid[] = [];
  if (plan.spaceId === 'wildz.space.outer.v1') {
    const obstacles = [...WILDS_RENDERED_PHYSICAL_OBSTACLES, ...projectWildsRenderedLivingObstacles(world), ...[...tiles].flatMap(key => { const [x, z] = key.split(':').map(Number); return wildsTerrainObstaclesForTile(x, z); })];
    for (const obstacle of obstacles) solids.push({ id: obstacle.id, yaw: 0, center: obstacle.shape.kind === 'box' ? obstacle.position : { ...obstacle.position, y: obstacle.position.y + obstacle.shape.height / 2 }, halfExtents: obstacle.shape.kind === 'box' ? { x: obstacle.shape.halfX, y: obstacle.shape.halfY, z: obstacle.shape.halfZ } : { x: obstacle.shape.radius, y: obstacle.shape.height / 2, z: obstacle.shape.radius } });
  }
  let knownSpace = plan.spaceId === 'wildz.space.outer.v1';
  for (const key of regions) {
    const [x, z] = key.split(':').map(Number);
    const physical = composeWildsInteriorConstruction(composeWildsBurrowPhysical(admitWildsDiscoveryPhysicalNeighborhood(x, z), world.burrows), world);
    knownSpace ||= physical.surfaces.some(surface => surface.spaceId === plan.spaceId);
    for (const solid of [...physical.solids, ...physical.ceilings]) if (solid.spaceId === plan.spaceId) solids.push({ id: solid.id, yaw: 0, center: solid.center, halfExtents: solid.halfExtents });
  }
  if (!knownSpace) throw Error('creation_world_space_unadmitted');
  return solids;
}

/** Exact footprint check shared by the preview and source boundary. Never writes or spends materials. */
function assertCanonicalWorldCreationPlacement(world: WildsWorldProjection, plan: CreationPlan) {
  const canonicalSolids = canonicalCreationWorldSolids(world, plan);
  if (plan.chunks.some(chunk => chunk.solids.some(solid => canonicalSolids.some(other => overlapsCreationSolids(solid, other))))) throw Error('creation_world_canonical_overlap');
}
function assertAdmittedWorldCreationPlacement(world: WildsWorldProjection, plan: CreationPlan) {
  for (const source of Object.values(world.creations ?? {})) {
    if (source.instance.instanceId === plan.evolution?.instanceId) continue;
    if (source.instance.worldId !== plan.worldId || source.instance.spaceId !== plan.spaceId) continue;
    const prior = compileWorldCreationSource(source), physical = projectCreationPhysical(source.instance, source.command.definition, prior);
    if (plan.chunks.some(chunk => chunk.solids.some(solid => physical.solids.some(other => overlapsCreationSolids(solid, other))))) throw Error('creation_world_admitted_overlap');
  }
}
export function assertWorldCreationPlacement(world: WildsWorldProjection, plan: CreationPlan) {
  assertCanonicalWorldCreationPlacement(world, plan);
  assertAdmittedWorldCreationPlacement(world, plan);
}

/** Pure source law used identically by local admission and replay. No writes, verifier injection, or remote rail. */
export function resolveWorldCreationBuild(world: WildsWorldProjection, command: WildsCreationBuildCommand, actorId: string, kaiUPulse: number): { record: WildsCreationSourceRecord; plan: CreationPlan } {
  assertCreationData(command);
  const ruleHead = creationWorldBuildRuleHead(command);
  const prior = world.creations?.[command.instanceId];
  if (!validConstructionId(command.commandId) || !validConstructionId(command.instanceId) || !validConstructionId(actorId) || !validConstructionKai(kaiUPulse) || !validConstructionHead(command.planDigest) || !['creation.construct', 'creation.evolve'].includes(command.type) || (command.type === 'creation.construct' ? !!prior : !prior)) throw Error('creation_world_command_invalid');
  const definition = parseCreationDefinition(command.definition), context = command.context;
  if (definition.creatorId !== actorId || context.worldId !== world.worldId || context.sourceHead !== creationWorldSourceHead(world)) throw Error('creation_world_source_stale');
  if (command.type === 'creation.construct' && context.evolution) throw Error('creation_world_source_stale');
  if (command.type === 'creation.evolve') {
    const verified = projectWildsCreationPersistence({ ...world, creations: { [command.instanceId]: prior! } }).creations[command.instanceId];
    if (!verified || verified.instance.ownerId !== actorId || verified.instance.head !== command.expectedHead || !context.evolution || context.evolution.instanceId !== command.instanceId || context.evolution.head !== command.expectedHead || context.evolution.definition.digest !== verified.command.definition.digest || context.worldId !== verified.instance.worldId || context.spaceId !== verified.instance.spaceId || constructionProofDigest(context.pose) !== constructionProofDigest(verified.instance.pose) || (verified.history?.length ?? 0) >= 64) throw Error('creation_world_evolution_source_stale');
  }
  if (!command.actorPosition || ![command.actorPosition.x, command.actorPosition.y, command.actorPosition.z].every(Number.isFinite)
    || command.reachRule === undefined && !creationBuildInReach({ pose: context.pose, chunks: [] }, command.actorPosition)) throw Error('creation_world_build_out_of_reach');
  const workers = creationWorldWorkers(command.workerSources, actorId);
  if (constructionProofDigest([...context.techniques].sort()) !== constructionProofDigest(combineCreationTechniques(workers))) throw Error('creation_world_technique_source_mismatch');
  const fresh = compileCreation(definition, context);
  if (fresh.status !== 'ready' || fresh.plan.digest !== command.planDigest || fresh.plan.requiredWork < 1) throw Error('creation_world_plan_stale');
  if (command.reachRule && !creationBuildInReach(fresh.plan, command.actorPosition, command.reachRule)) throw Error('creation_world_build_out_of_reach');
  assertCanonicalWorldCreationPlacement(world, fresh.plan);
  if (command.type === 'creation.evolve') {
    const previousPhysical = projectCreationPhysical(prior!.instance, prior!.command.definition, compileWorldCreationSource(prior!));
    if (!creationWorldReplacementSafe(previousPhysical.solids, fresh.plan.chunks.flatMap(chunk => chunk.solids), command.actorPosition)) throw Error('creation_world_occupied_replacement_required');
  }
  const selected = selectCreationResources(Object.values(world.materialLots), context.budget, fresh.plan.requiredResources, creationWorldAvailability(world, actorId));
  if (Object.keys(selected.deficits).length || selected.lots.length > CREATION_WORLD_RULE.maximumMaterialLots || constructionProofDigest(selected.lots) !== constructionProofDigest(command.resources)) throw Error('creation_world_materials_unavailable');
  assertAdmittedWorldCreationPlacement(world, fresh.plan);
  const instance = command.type === 'creation.evolve' ? reviseCreationInstance(prior!.instance, prior!.command.definition, definition, selected.lots, kaiUPulse) : constructInstance(command, kaiUPulse);
  const history = command.type === 'creation.evolve' ? [...(prior!.history ?? []), { ...sourceCore(prior!), eventId: world.creationEvents![command.instanceId].eventId }] : undefined;
  const record: WildsCreationSourceRecord = { schema: 'wildz.creation-world-source.v1', command: JSON.parse(JSON.stringify(command)) as WildsCreationBuildCommand, commandDigest: constructionProofDigest(command), instance, ruleHead, kaiUPulse, ...(history ? { history } : {}) };
  return { record: freezeConstructionProof(record), plan: fresh.plan };
}
export function creationWorldReplacementSafe(before: readonly CreationSolid[], after: readonly CreationSolid[], position: Readonly<{ x: number; y: number; z: number }>): boolean {
  const body: CreationSolid = { id: 'current-player-body', yaw: 0, center: { ...position, y: position.y + .9 }, halfExtents: { x: .35, y: .9, z: .35 } };
  return after.every(solid => !overlapsCreationSolids(solid, body) || before.some(old => constructionProofDigest(old) === constructionProofDigest(solid)));
}
export const resolveWorldCreationConstruct = (world: WildsWorldProjection, command: WildsCreationConstructCommand, actorId: string, kaiUPulse: number) => resolveWorldCreationBuild(world, command, actorId, kaiUPulse);
function sourceCore({ history: _history, ...core }: WildsCreationSourceRecord): WildsCreationSourceCore { return core; }
function constructInstance(command: WildsCreationConstructCommand, kaiUPulse: number): CreationInstance {
  const planned = createCreationInstance({ instanceId: command.instanceId, definition: command.definition, ownerId: command.definition.creatorId, worldId: command.context.worldId, spaceId: command.context.spaceId, pose: command.context.pose, kaiUPulse });
  const { head: _head, ...basis } = planned;
  return sealCreationInstance({ ...basis, stage: 'functional', nodeStates: initializeCreationComponents(command.definition, kaiUPulse), embeddedResources: command.resources });
}

/** Reuse only complete unchanged plain-data sources. Cached geometry is private
 * and every caller receives its own plan, including its mutable mesh buffers. */
export function createWorldCreationSourceCompiler(options: { maxEntries?: number; maxBytes?: number } = {}) {
  const maxEntries = options.maxEntries ?? 64, maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
  const exact = createWildsExactProofCache({ maxEntries: 0, maxBytes });
  const entries = new Map<string, { plan: CreationPlan; bytes: number }>();
  let bytes = 0, compilations = 0, reused = 0;
  return {
    stats: () => ({ entries: entries.size, bytes, compilations, reused }),
    compile(source: WildsCreationSourceRecord): CreationPlan {
      const key = exact.exactKey(source), cached = key === null ? undefined : entries.get(key);
      if (cached && key !== null) {
        entries.delete(key); entries.set(key, cached); reused++;
        return structuredClone(cached.plan);
      }
      const plan = compileWorldCreationSourceUncached(source);
      compilations++;
      if (key !== null && maxEntries > 0) {
        const size = key.length * 2 + JSON.stringify(plan, (_key, value) => ArrayBuffer.isView(value) ? null : value).length * 2
          + plan.chunks.reduce((sum, chunk) => sum + chunk.positions.byteLength + chunk.normals.byteLength, 0);
        if (size <= maxBytes) {
          while (entries.size >= maxEntries || bytes + size > maxBytes) {
            const oldest = entries.keys().next().value;
            if (oldest === undefined) break;
            bytes -= entries.get(oldest)!.bytes; entries.delete(oldest);
          }
          entries.set(key, { plan: structuredClone(plan), bytes: size }); bytes += size;
        }
      }
      return plan;
    }
  };
}

const worldCreationSourceCompiler = createWorldCreationSourceCompiler();

/** Reconstruct exact geometry from the durable deterministic source; mesh buffers are never saved as authority. */
export function compileWorldCreationSource(source: WildsCreationSourceRecord): CreationPlan {
  return worldCreationSourceCompiler.compile(source);
}

function compileWorldCreationSourceUncached(source: WildsCreationSourceRecord): CreationPlan {
  if(source.actions?.length){
    if(source.actions.length>64||!source.constructionInstance)throw Error('creation_action_history_invalid');
    const {actions,constructionInstance,...fields}=source,base={...fields,instance:constructionInstance};
    const plan=compileWorldCreationSourceUncached(base);let current=constructionInstance;
    for(const action of actions){if(action.record.predecessors[current.instanceId]?.head!==current.head)throw Error('creation_action_ancestry_invalid');current=verifyWorldCreationActionRecord(action.record)[current.instanceId];if(!current)throw Error('creation_action_source_missing');}
    if(current.head!==source.instance.head)throw Error('creation_action_current_head_invalid');return plan;
  }
  assertCreationData(source);
  if ((source.history?.length ?? 0) > 64) throw Error('creation_world_history_budget');
  let prior: WildsCreationSourceRecord | null = null, lastPlan: CreationPlan | null = null;
  const commandIds = new Set<string>();
  for (const record of creationWorldSourceHistory(source)) {
    if(record.actions?.length){lastPlan=compileWorldCreationSourceUncached(record);prior=record;continue;}
    if (record.schema !== 'wildz.creation-world-source.v1' || record.ruleHead !== creationWorldBuildRuleHead(record.command) || record.commandDigest !== constructionProofDigest(record.command) || !verifyCreationInstance(record.instance) || record.instance.instanceId !== source.instance.instanceId || record.instance.instanceId !== record.command.instanceId || record.instance.definitionDigest !== record.command.definition.digest || record.instance.stage !== 'functional' || record.instance.ownerId !== record.command.definition.creatorId || record.instance.kaiUPulse !== record.kaiUPulse || commandIds.has(record.command.commandId)) throw Error('creation_world_record_invalid');
    commandIds.add(record.command.commandId);
    lastPlan = compileWorldCreationCore(record, prior);
    prior = record;
  }
  return lastPlan!;
}
function compileWorldCreationCore(source: WildsCreationSourceRecord, prior: WildsCreationSourceRecord | null): CreationPlan {
  if (source.command.type === 'creation.construct' ? !!prior || !!source.command.context.evolution || !!source.history?.length : !prior || !source.command.context.evolution || source.command.expectedHead !== prior.instance.head || source.command.context.evolution.head !== prior.instance.head || source.command.context.evolution.instanceId !== prior.instance.instanceId || source.command.context.evolution.definition.digest !== prior.command.definition.digest) throw Error('creation_world_record_ancestry_invalid');
  const compiled = compileCreation(source.command.definition, source.command.context);
  if (compiled.status !== 'ready' || compiled.plan.requiredWork < 1 || compiled.plan.digest !== source.command.planDigest || constructionProofDigest(compiled.plan.pose) !== constructionProofDigest(source.instance.pose) || compiled.plan.worldId !== source.instance.worldId || compiled.plan.spaceId !== source.instance.spaceId) throw Error('creation_world_record_plan_invalid');
  if (source.command.reachRule && !creationBuildInReach(compiled.plan, source.command.actorPosition, source.command.reachRule)) throw Error('creation_world_build_out_of_reach');
  const workers = creationWorldWorkers(source.command.workerSources, source.instance.ownerId);
  if (constructionProofDigest([...source.command.context.techniques].sort()) !== constructionProofDigest(combineCreationTechniques(workers))) throw Error('creation_world_record_crew_invalid');
  const paid = source.command.resources.reduce<Record<string, number>>((totals, resource) => ({ ...totals, [resource.kind]: (totals[resource.kind] ?? 0) + resource.quantity }), {});
  if (source.command.resources.length > CREATION_WORLD_RULE.maximumMaterialLots || new Set(source.command.resources.map(resource => resource.id)).size !== source.command.resources.length || source.command.resources.some(resource => resource.quantity !== 1 || !validConstructionHead(resource.head)) || constructionProofDigest(paid) !== constructionProofDigest(compiled.plan.requiredResources)) throw Error('creation_world_record_materials_invalid');
  const expected = source.command.type === 'creation.construct' ? constructInstance(source.command, source.kaiUPulse) : reviseCreationInstance(prior!.instance, prior!.command.definition, source.command.definition, source.command.resources, source.kaiUPulse);
  if (expected.head !== source.instance.head) throw Error('creation_world_record_successor_invalid');
  return compiled.plan;
}
