import type { CreationPhysicalSnapshot } from './physical-store';
import type { CreationPhysicalProjection } from './projection';
import type { CreationResidencyBudget, CreationPageRef } from './chunks';
import type { CreationNeighborhoodQuery } from './index';
import { createCreationPageIndex, selectCreationPages } from './residency';
import { prepareCreationNavigation } from './navigation';
import { createCreationUploadScheduler } from './upload-scheduler';
import { isAdmittedCreationProjection } from './physical-store';
export type CreationSceneSnapshot = Readonly<{
    revision: number;
    projections: readonly CreationPhysicalProjection[];
    renderProjections: readonly CreationPhysicalProjection[];
    navigation: ReturnType<typeof prepareCreationNavigation>;
    queued: number;
    uploadBytes: number;
    blocked: string | null;
}>;
/** Residency is a projection of source admission. Selection and collider preparation occur outside frame callbacks. */
export function createCreationSceneRuntime(input: {
    defer: (work: () => void) => void;
}) {
    let snapshot: CreationSceneSnapshot = { revision: 0, projections: [], renderProjections: [], navigation: prepareCreationNavigation([]), queued: 0, uploadBytes: 0, blocked: null };
    let pages = createCreationPageIndex([]), source: Pick<CreationPhysicalSnapshot, 'projections' | 'definitions'> | null = null;
    let scheduler: ReturnType<typeof createCreationUploadScheduler> | null = null;
    let visibleIds = new Set<string>(), physicalIdsCache = new Set<string>();
    const equalIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every(id => b.has(id));
    const pageSources = new Map<string, {
        projection: CreationPhysicalProjection;
        chunk: CreationPhysicalProjection['chunks'][number];
    }>(), listeners = new Set<() => void>(), rendered = new Set<string>();
    let requestedBudget: CreationResidencyBudget | null = null;
    let wanted = new Set<string>(), deferred = false, closed = false, generation = 0;
    const collect = (ids: ReadonlySet<string>) => { const groups = new Map<CreationPhysicalProjection, CreationPhysicalProjection['chunks'][number][]>(); for (const id of ids) {
        const p = pageSources.get(id);
        if (!p)
            continue;
        const chunks = groups.get(p.projection) || [];
        chunks.push(p.chunk);
        groups.set(p.projection, chunks);
    } return [...groups].map(([p, chunks]) => ({ ...p, chunks, solids: chunks.flatMap(c => c.solids), walkable: chunks.flatMap(c => c.walkable), interiors: chunks.flatMap(c => c.interiors), connections: chunks.flatMap(c => c.connections) })); };
    const publish = () => { if (deferred || closed)
        return; deferred = true; const epoch = generation; input.defer(() => { if (closed || epoch !== generation)
        return; deferred = false; const uploaded = scheduler?.paintSnapshot().active || [], ids = new Set(uploaded.map(r => r.chunk.id)), physicalIds = new Set([...ids].filter(id => rendered.has(id))); const changedPhysical = !equalIds(physicalIds, physicalIdsCache), changedVisible = !equalIds(ids, visibleIds), projections = changedPhysical ? collect(physicalIds) : snapshot.projections; physicalIdsCache = physicalIds; visibleIds = ids; snapshot = { ...snapshot, revision: snapshot.revision + 1, projections, renderProjections: changedVisible ? collect(ids) : snapshot.renderProjections, navigation: changedPhysical ? prepareCreationNavigation(projections) : snapshot.navigation, queued: scheduler?.paintSnapshot().queued || 0 }; listeners.forEach(fn => fn()); }); };
    return { snapshot: () => snapshot, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
        refresh(next: Pick<CreationPhysicalSnapshot, 'projections' | 'definitions'>, budget: CreationResidencyBudget) {
            if (closed)
                return;
            if (next.projections.some(p => !isAdmittedCreationProjection(p)))
                throw Error('creation_scene_source_unadmitted');
            requestedBudget = budget;
            if (source === next && scheduler)
                return;
            const priorChunks = new Map([...pageSources].map(([id, p]) => [id, p.chunk]));
            generation++;
            deferred = false;
            source = next;
            pageSources.clear();
            const refs: CreationPageRef[] = [];
            for (const projection of next.projections) {
                const definition = next.definitions[projection.definitionDigest];
                if (!definition)
                    throw Error('creation_scene_definition_missing');
                const ownerPages = new Map(projection.chunks.flatMap(c => c.nodeIds.map(id => [id, c.id] as const))), nodes = new Map(definition.nodes.map(n => [n.id, n]));
                for (const chunk of projection.chunks) {
                    pageSources.set(chunk.id, { projection, chunk });
                    const dependencies = [...new Set(chunk.nodeIds.flatMap(id => { const n = nodes.get(id); if (!n)
                            throw Error('creation_scene_node_missing'); return [...n.supports, ...(n.parentId ? [n.parentId] : [])].map(id => ownerPages.get(id)).filter((id): id is string => !!id && id !== chunk.id); }))];
                    refs.push({ pageId: chunk.id, head: projection.head, worldId: projection.worldId, spaceId: projection.spaceId, bounds: chunk.bounds, nodeIds: chunk.nodeIds, dependencies, vertices: chunk.positions.length / 3, drawCalls: chunk.materials.length, textureBytes: 0, uploadBytes: chunk.positions.byteLength + chunk.normals.byteLength });
                }
            }
            pages = createCreationPageIndex(refs);
            if (scheduler) {
                scheduler.retain(chunk => pageSources.get(chunk.id)?.chunk === chunk);
                wanted = new Set([...wanted].filter(id => priorChunks.get(id) === pageSources.get(id)?.chunk));
            }
            else
                scheduler = createCreationUploadScheduler({ budget, upload: chunk => ({ chunk, renderReady: true, physicsReady: true, textureBytes: 0 }), dispose: chunk => { rendered.delete(chunk.chunk.id); } });
            snapshot = { ...snapshot, blocked: null, uploadBytes: 0 };
            publish();
        },
        select(query: CreationNeighborhoodQuery) {
            if (!scheduler || closed)
                return false;
            const pinned = [...rendered].filter(id => { const p = pages.pages.get(id); return p && p.worldId === query.worldId && p.spaceId === query.spaceId && query.position.x >= p.bounds.min.x - .5 && query.position.x <= p.bounds.max.x + .5 && query.position.z >= p.bounds.min.z - .5 && query.position.z <= p.bounds.max.z + .5 && query.position.y >= p.bounds.min.y - .3 && query.position.y <= p.bounds.max.y + .3; });
            let selected: readonly CreationPageRef[];
            try {
                selected = selectCreationPages(pages, { ...query, pinnedPageIds: pinned }, requestedBudget || scheduler.budget);
            }
            catch (error) {
                snapshot = { ...snapshot, blocked: error instanceof Error ? error.message : 'creation_scene_residency_unavailable' };
                publish();
                return false;
            }
            const next = new Set(selected.map(p => p.pageId));
            for (const id of wanted)
                if (!next.has(id))
                    scheduler.cancel(id);
            scheduler.reconfigure(requestedBudget || scheduler.budget);
            for (const p of selected)
                if (!wanted.has(p.pageId)) {
                    const source = pageSources.get(p.pageId)!;
                    scheduler.enqueue(p.pageId, [source.chunk]);
                }
            wanted = next;
            snapshot = { ...snapshot, blocked: null };
            publish();
            return true;
        },
        paint() { if (!scheduler || closed)
            return; const before = scheduler.paintSnapshot(), result = scheduler.paint(); if (result.uploadedBytes || result.queued !== before.queued) {
            snapshot = { ...snapshot, uploadBytes: result.uploadedBytes };
            publish();
        } },
        rendered(pageId: string) { if (!closed && wanted.has(pageId) && !rendered.has(pageId) && scheduler?.paintSnapshot().active.some(p => p.chunk.id === pageId)) {
            rendered.add(pageId);
            publish();
        } },
        close() { closed = true; generation++; scheduler?.close(); listeners.clear(); pageSources.clear(); rendered.clear(); }
    };
}
