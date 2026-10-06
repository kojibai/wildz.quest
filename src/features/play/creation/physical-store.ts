import { verifyCreationAdmission, type CreationOperation, type CreationAdmissionOutcome } from './operation';
import { prepareCreationNavigation, type CreationNavigation } from './navigation';
import type { CreationPhysicalProjection } from './projection';
import { verifyCreationPlan, type CreationPlan } from './compiler';
import type { CreationDefinition } from './types';
import type { CreationInstance } from './instance';
import { verifyCurrentCreationSource, type CreationCurrentSource } from './current-source';
const admittedProjections = new WeakSet<CreationPhysicalProjection>();
export const isAdmittedCreationProjection = (projection: CreationPhysicalProjection) => admittedProjections.has(projection);
export type CreationPhysicalSnapshot = Readonly<{
    revision: number;
    projections: readonly CreationPhysicalProjection[];
    navigation: CreationNavigation;
    instances: Readonly<Record<string, CreationInstance>>;
    definitions: Readonly<Record<string, CreationDefinition>>;
}>;
type Project = (instance: CreationInstance, definition: CreationDefinition, plan: CreationPlan) => Promise<CreationPhysicalProjection>;
function binds(projection: CreationPhysicalProjection, instance: CreationInstance) {
    return projection.instanceId === instance.instanceId && projection.head === instance.head && projection.definitionDigest === instance.definitionDigest && projection.worldId === instance.worldId && projection.spaceId === instance.spaceId;
}
function sameLiveChunks(before: CreationPhysicalProjection, after: CreationPhysicalProjection) {
    return before.chunks.length === after.chunks.length && before.chunks.every((chunk, index) => chunk.nodeIds.length === after.chunks[index].nodeIds.length && chunk.nodeIds.every((id, i) => id === after.chunks[index].nodeIds[i]));
}
/** Private admission boundary. Physical edits also require a qualified local occupant/GPU replacement fence. */
export function createCreationPhysicalStore(input: Readonly<{
    project: Project;
    canReplace?: (before: CreationPhysicalProjection, after: CreationPhysicalProjection, source: CreationCurrentSource) => Promise<boolean>;
}>) {
    let snapshot: CreationPhysicalSnapshot = Object.freeze({ revision: 0, projections: Object.freeze([]), navigation: prepareCreationNavigation([]), instances: Object.freeze({}), definitions: Object.freeze({}) }), closed = false;
    const subscribers = new Set<() => void>(), pending = new Map<string, Promise<boolean>>(), planDigests = new Map<string, string>();
    function publish(instance: CreationInstance, definition: CreationDefinition, projection: CreationPhysicalProjection, planDigest: string, compatible = false) {
        const projections = [...snapshot.projections.filter(p => p.instanceId !== instance.instanceId), projection];
        const navigation = compatible ? snapshot.navigation : prepareCreationNavigation(projections);
        admittedProjections.add(projection);
        snapshot = Object.freeze({ revision: snapshot.revision + 1, projections: Object.freeze(projections), navigation, instances: Object.freeze({ ...snapshot.instances, [instance.instanceId]: instance }), definitions: Object.freeze({ ...snapshot.definitions, [definition.digest]: definition }) });
        planDigests.set(instance.instanceId, planDigest);
        for (const callback of subscribers) {
            try {
                callback();
            }
            catch { /* A view listener cannot roll back an adopted source. */ }
        }
    }
    function hold(id: string, task: Promise<boolean>) {
        pending.set(id, task);
        return task.finally(() => { if (pending.get(id) === task)
            pending.delete(id); });
    }
    const store = {
        snapshot: () => snapshot,
        subscribe(callback: () => void) { subscribers.add(callback); return () => { subscribers.delete(callback); }; },
        async adoptCurrent(source: CreationCurrentSource, plan: CreationPlan, fence: () => boolean = () => true): Promise<boolean> {
            try {
                if (closed || !fence() || source.planDigest !== plan.digest || source.instance.definitionDigest !== plan.definitionDigest || !verifyCreationPlan(plan) || !await verifyCurrentCreationSource(source))
                    return false;
                if (closed || !fence())
                    return false;
                const id = source.instance.instanceId, existing = pending.get(id);
                if (existing) {
                    await existing;
                    return store.adoptCurrent(source, plan, fence);
                }
                const prior = snapshot.instances[id];
                if (prior?.head === source.instance.head)
                    return true;
                if (prior && source.instance.revision <= prior.revision)
                    return false;
                // Copy transferable buffers before awaiting an injected worker boundary.
                const exactPlan = structuredClone(plan), oldProjection = snapshot.projections.find(p => p.instanceId === id);
                const task = (async () => {
                    try {
                        let projection = await input.project(source.instance, source.definition, exactPlan);
                        if (closed || !fence() || snapshot.instances[id] !== prior || !verifyCreationPlan(exactPlan) || !binds(projection, source.instance))
                            return false;
                        const compatible = !!oldProjection && planDigests.get(id) === source.planDigest && sameLiveChunks(oldProjection, projection);
                        if (oldProjection && !compatible && (!input.canReplace || !await input.canReplace(oldProjection, projection, source)))
                            return false;
                        if (closed || !fence() || snapshot.instances[id] !== prior || !await verifyCurrentCreationSource(source) || snapshot.instances[id] !== prior || closed || !fence())
                            return false;
                        if (compatible && oldProjection)
                            projection = { ...projection, chunks: oldProjection.chunks, solids: oldProjection.solids, walkable: oldProjection.walkable, interiors: oldProjection.interiors, connections: oldProjection.connections, nodePoses: oldProjection.nodePoses };
                        publish(source.instance, source.definition, projection, source.planDigest, compatible);
                        return true;
                    }
                    catch {
                        return false;
                    }
                })();
                return hold(id, task);
            }
            catch {
                return false;
            }
        },
        async adopt(operation: CreationOperation, outcome: CreationAdmissionOutcome, plan: CreationPlan, fence: () => boolean = () => true): Promise<boolean> {
            const verified = verifyCreationAdmission(operation, outcome);
            if (closed || !fence() || verified.status !== 'admitted' || plan.digest !== operation.planDigest || plan.definitionDigest !== operation.definitionDigest)
                return false;
            const prior = snapshot.instances[operation.instanceId];
            if (prior)
                return prior.head === verified.instance.head;
            const existing = pending.get(operation.instanceId);
            if (existing) {
                await existing;
                return snapshot.instances[operation.instanceId]?.head === verified.instance.head;
            }
            const task = (async () => {
                try {
                    const projection = await input.project(verified.instance, operation.definition, plan);
                    if (closed || !fence() || verifyCreationAdmission(operation, outcome).status !== 'admitted' || !binds(projection, verified.instance))
                        return false;
                    publish(verified.instance, operation.definition, projection, plan.digest);
                    return true;
                }
                catch {
                    return false;
                }
            })();
            return hold(operation.instanceId, task);
        },
        close() { closed = true; subscribers.clear(); }
    };
    return store;
}
