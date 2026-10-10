import { constructionProofDigest } from '../wilds-construction-project';
import type { PortableCardAsset } from '../portable-card';
import type { PlayState } from '../game-state';
import { checkpointWildsWorld, replayWildsWorld, type WildsWorldProjection } from '../wilds-world-state';
import type { WildsWorldEvent } from '../wilds-world-event';
import type { CreationController } from './controller';
import { createCreationPhysicalStore } from './physical-store';
import { createCreationCurrentSourcePort, type CreationCurrentSource } from './current-source';
import { compileCreation, verifyCreationPlan, type CreationCompileContext, type CreationPlan } from './compiler';
import { combineCreationTechniques, projectCreationWorkers } from './capabilities';
import { selectCreationResources } from './resources';
import { assertWorldCreationPlacement, creationWorldAvailability, creationWorldSourceHead, creationWorldWorkers, compileWorldCreationSource, projectWildsCreationPersistence, creationWorldSourceHistory, creationWorldReplacementSafe, type WildsCreationBuildCommand, type WildsCreationSourceRecord } from './world-source';
import { creationPlacementMessage } from './placement-message';
import type { CreationCommitResult, CreationDefinition, CreationInstanceRef } from './types';
import { creationBuildInReach, CREATION_PHYSICAL_BUILD_REACH_RULE } from './build-reach';

export type WorldCreationControllerInput = Readonly<{
  environment: () => Readonly<{ ownerId: string; worldId: string; spaceId: string }>;
  world: () => WildsWorldProjection | null;
  crew: () => Readonly<{ cards: readonly PortableCardAsset[]; conditions: PlayState['adventureConditions'] }>;
  position: () => Readonly<{ x: number; y: number; z: number }>;
  compileContext: (plan: CreationPlan) => CreationCompileContext | null;
  admit: (command: WildsCreationBuildCommand, beforeAdmit: () => Promise<void>) => Promise<Readonly<{ projection: WildsWorldProjection; events: readonly WildsWorldEvent[] }>>;
  project: Parameters<typeof createCreationPhysicalStore>[0]['project'];
}>;

/** Concrete adapter to the same admitted local world/outbox used by manual materials.
 * The world callback must be the installed edge queue's currentSource; arbitrary
 * JSON, a transport response, and a digest alone do not install source authority. */
export function createWorldCreationController(input: WorldCreationControllerInput): CreationController & Readonly<{ validatePlacement(plan: CreationPlan): string | null; restore(): Promise<number>; resolve(instanceId: string): Promise<CreationCurrentSource | null> }> {
  const physical = createCreationPhysicalStore({ project: input.project, async canReplace(before, after, current) {
    const source = sourceRecord(current.instance.instanceId);
    return !!source && source.instance.head === current.instance.head && (creationWorldSourceHistory(source).some(prior => prior.instance.head === before.head)||Boolean(source.actions?.some(action=>action.record.predecessors[source.instance.instanceId]?.head===before.head))) && creationWorldReplacementSafe(before.solids, after.solids, input.position());
  } });
  let closed = false;
  const replayCache = new WeakMap<WildsWorldProjection, WildsWorldProjection>();
  const sourceCache = new WeakMap<WildsWorldProjection, Map<string, WildsCreationSourceRecord | null>>();
  const same = (a: unknown, b: unknown) => constructionProofDigest(a) === constructionProofDigest(b);
  const withoutSelectedPhysical = (context: CreationCompileContext): CreationCompileContext => context.evolution ? { ...context, physical: context.physical.filter(chunk => chunk.instanceId !== context.evolution!.instanceId || chunk.head !== context.evolution!.head) } : context;
  const scopeMatches = (scope: ReturnType<WorldCreationControllerInput['environment']>) => !closed && same(scope, input.environment());
  function sourceRecord(instanceId: string): WildsCreationSourceRecord | null {
    const world = input.world(), scope = input.environment();
    if (closed || !world || scope.worldId !== world.worldId) return null;
    let replayed = replayCache.get(world);
    if (!replayed) { replayed = replayWildsWorld([], checkpointWildsWorld(world)); replayCache.set(world, replayed); }
    let records = sourceCache.get(world);
    if (!records) { records = new Map(); sourceCache.set(world, records); }
    if (!records.has(instanceId)) { const raw = replayed.creations?.[instanceId]; records.set(instanceId, raw ? projectWildsCreationPersistence({ ...replayed, creations: { [instanceId]: raw } }).creations[instanceId] ?? null : null); }
    const source = records.get(instanceId);
    if (!source || source.instance.worldId !== scope.worldId || source.instance.spaceId !== scope.spaceId) return null;
    const visit = source.instance.access.visit;
    if (source.instance.ownerId !== scope.ownerId && visit.mode !== 'public' && !(visit.mode === 'invited' && visit.subjects.includes(scope.ownerId))) return null;
    const receipt = replayed.constructionCommandReceipts[source.command.commandId];
    if (!receipt || receipt.actorId !== source.instance.ownerId || receipt.kind !== (source.command.type === 'creation.construct' ? 'creation.constructed' : 'creation.evolved') || receipt.commandDigest !== source.commandDigest || source.instance.embeddedResources.some(resource => replayed.consumedMaterialLots[resource.id] !== instanceId)) return null;
    compileWorldCreationSource(source);
    return source;
  }
  const sources = createCreationCurrentSourcePort({
    async read(query) {
      const source = sourceRecord(query.instanceId);
      return source ? { status: 'available', instance: source.instance, definition: source.command.definition, planDigest: source.command.planDigest, source } : { status: 'unavailable', reason: 'creation_world_current_source_unavailable' };
    },
    async authenticateCurrent(current) {
      const source = sourceRecord(current.instance.instanceId);
      return !!source && same(source, current.source) && source.instance.head === current.instance.head && source.command.definition.digest === current.definition.digest && source.command.planDigest === current.planDigest;
    }
  });
  async function resolve(instanceId: string): Promise<CreationCurrentSource | null> {
    const scope = input.environment();
    const source = await sources.read({ instanceId, worldId: scope.worldId, spaceId: scope.spaceId });
    return source.status === 'available' && scopeMatches(scope) ? source : null;
  }
  async function hydrate(instanceId: string, plan: CreationPlan): Promise<boolean> {
    const scope = input.environment(), source = await resolve(instanceId);
    return !!source && scopeMatches(scope) && physical.adoptCurrent(source, plan, () => scopeMatches(scope));
  }
  async function adopt(instanceId: string, expectedOperationId?: string, expectedPlanDigest?: string): Promise<CreationCommitResult> {
    const source = sourceRecord(instanceId);
    if (!source || expectedOperationId && source.command.commandId !== expectedOperationId || expectedPlanDigest && source.command.planDigest !== expectedPlanDigest) return { status: 'unknown', operationId: expectedOperationId ?? instanceId };
    if (!await hydrate(instanceId, compileWorldCreationSource(source))) return { status: 'unknown', operationId: source.command.commandId };
    return { status: 'admitted', instance: source.instance };
  }
  return {
    scope: input.environment, snapshot: physical.snapshot, subscribe: physical.subscribe, hydrate, resolve,
    validatePlacement(plan: CreationPlan): string | null {
      const scope = input.environment(), world = input.world();
      if (closed || !world || world.worldId !== plan.worldId || scope.worldId !== plan.worldId || scope.spaceId !== plan.spaceId
        || plan.sourceHead !== creationWorldSourceHead(world) || !verifyCreationPlan(plan)) return 'The world changed. Prepare this placement again before building.';
      try { assertWorldCreationPlacement(world, plan); return null; }
      catch (error) { return creationPlacementMessage(error instanceof Error ? error.message : 'This placement could not be checked. Try moving it.'); }
    },
    async restore() {
      const scope = input.environment(), ids = Object.keys(input.world()?.creations ?? {});
      let restored = 0;
      for (const id of ids) {
        if (!scopeMatches(scope)) break;
        const currentHead = input.world()?.creations?.[id]?.instance.head;
        if (currentHead && physical.snapshot().instances[id]?.head === currentHead) { restored++; continue; }
        try { if ((await adopt(id)).status === 'admitted') restored++; } catch { /* An invalid or foreign source is never rendered. */ }
      }
      return restored;
    },
    async commit(definition: CreationDefinition, plan: CreationPlan, workerIds: readonly string[], selected?: CreationInstanceRef | null): Promise<CreationCommitResult> {
      const reject = (reason: string): CreationCommitResult => ({ status: 'rejected', reason, writes: 0 });
      const scope = input.environment(), world = input.world();
      if (closed || !world || scope.ownerId !== definition.creatorId || scope.worldId !== plan.worldId || scope.spaceId !== plan.spaceId || !!plan.evolution !== !!selected || selected && (!same(plan.evolution, selected) || world.creations?.[selected.instanceId]?.instance.ownerId !== scope.ownerId || world.creations[selected.instanceId].instance.head !== selected.head) || !verifyCreationPlan(plan) || !workerIds.length || workerIds.length > 32 || new Set(workerIds).size !== workerIds.length) return reject('Creation ownership, location or selected crew changed.');
      let command: WildsCreationBuildCommand;
      try {
        const crew = input.crew(), candidates = projectCreationWorkers(crew.cards, crew.conditions);
        const workerSources = workerIds.map(id => {
          const worker = candidates.find(candidate => candidate.assetId === id || candidate.subjectId === id), card = crew.cards.find(candidate => candidate.id === worker?.assetId);
          if (!card || !crew.conditions[card.id]) throw Error('creation_world_worker_missing');
          const source = { card, condition: crew.conditions[card.id] };
          return source;
        });
        const workers = creationWorldWorkers(workerSources, scope.ownerId), rawContext = input.compileContext(plan);
        if (!rawContext) throw Error('creation_world_context_unavailable');
        const context: CreationCompileContext = { ...withoutSelectedPhysical(rawContext), pose: plan.pose, techniques: combineCreationTechniques(workers) };
        if (context.sourceHead !== creationWorldSourceHead(world)) throw Error('creation_world_source_stale');
        const compiled = compileCreation(definition, context);
        if (compiled.status !== 'ready' || compiled.plan.digest !== plan.digest) throw Error('creation_world_plan_stale');
        const resources = selectCreationResources(Object.values(world.materialLots), context.budget, plan.requiredResources, creationWorldAvailability(world, scope.ownerId));
        if (Object.keys(resources.deficits).length) throw Error('creation_world_materials_unavailable');
        const operationId = `creation:${selected ? 'evolve' : 'construct'}:${crypto.randomUUID()}`;
        const actorPosition = input.position(), reachRule = CREATION_PHYSICAL_BUILD_REACH_RULE.id;
        if (!creationBuildInReach(compiled.plan, actorPosition, reachRule)) throw Error('Move within 12 metres of your creation preview to build.');
        const fields = { commandId: operationId, definition, context, planDigest: plan.digest, workerSources, resources: resources.lots, actorPosition, reachRule };
        command = structuredClone(selected ? { ...fields, type: 'creation.evolve' as const, instanceId: selected.instanceId, expectedHead: selected.head } : { ...fields, type: 'creation.construct' as const, instanceId: `creation:instance:${crypto.randomUUID()}` });
      } catch (error) { return reject(error instanceof Error ? error.message : 'The build sources could not be prepared.'); }
      const unknown = (): CreationCommitResult => ({ status: 'unknown', operationId: command.commandId });
      let authorizedForPersistence = false;
      try {
        await input.admit(command, async () => {
          if (!scopeMatches(scope)) throw Error('creation_world_scope_changed');
          const current = input.world(), crew = input.crew(), context = input.compileContext(plan);
          if (!current || creationWorldSourceHead(current) !== command.context.sourceHead || !context || !same({ ...withoutSelectedPhysical(context), pose: plan.pose, techniques: command.context.techniques }, command.context)) throw Error('creation_world_final_source_changed');
          for (const expected of command.workerSources) {
            const card = crew.cards.find(candidate => candidate.id === expected.card.id);
            if (!card || !same(card, expected.card) || !same(crew.conditions[card.id], expected.condition)) throw Error('creation_world_final_worker_changed');
          }
          creationWorldWorkers(command.workerSources, scope.ownerId);
          if (!creationBuildInReach(plan, input.position(), command.reachRule)) throw Error('Move within 12 metres of your creation preview to build.');
          authorizedForPersistence = true;
        });
        if (!scopeMatches(scope)) return unknown();
        return await adopt(command.instanceId, command.commandId, command.planDigest);
      } catch (error) {
        if (!scopeMatches(scope)) return unknown();
        if (!authorizedForPersistence) return reject(error instanceof Error ? error.message : 'The build sources changed before saving.');
        try { return await adopt(command.instanceId, command.commandId, command.planDigest); } catch { return unknown(); }
      }
    },
    async recover(operationId: string, plan: CreationPlan): Promise<CreationCommitResult> {
      const source = Object.values(input.world()?.creations ?? {}).find(candidate => candidate.command.commandId === operationId);
      if (!source || source.command.planDigest !== plan.digest) return { status: 'unknown', operationId };
      return adopt(source.instance.instanceId);
    },
    close() { closed = true; physical.close(); }
  };
}
