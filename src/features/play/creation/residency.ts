import type { CreationPageRef, CreationResidencyBudget } from './chunks';
import { createCreationSpatialIndex, selectCreationNeighborhood, creationRegionIds, type CreationSpatialIndex, type CreationNeighborhoodQuery } from './index';
import type { WildsQualityProfile } from '../wilds-quality-profile';
import { freezeConstructionProof, validConstructionHead, validConstructionId } from '../wilds-construction-project';
export function validateCreationResidencyBudget(b: CreationResidencyBudget): void {
    if (!b || Object.values(b).some(n => !Number.isSafeInteger(n) || n < 0) || b.maximumPages > 128 || b.maximumVertices > 540000 || b.maximumDrawCalls > 160 || b.maximumTextureBytes > 536870912 || b.maximumUploadBytesPerPaint > 8388608)
        throw Error('creation_residency_budget_invalid');
}
export function createCreationPageIndex(input: readonly CreationPageRef[]): CreationSpatialIndex & Readonly<{
    pages: ReadonlyMap<string, CreationPageRef>;
}> {
    if (input.length > 16384)
        throw Error('creation_page_index_budget');
    const pages = new Map<string, CreationPageRef>();
    for (const raw of input) {
        const p = freezeConstructionProof(JSON.parse(JSON.stringify(raw))) as CreationPageRef;
        if (!validConstructionId(p.pageId) || !validConstructionHead(p.head) || pages.has(p.pageId) || !Array.isArray(p.nodeIds) || p.nodeIds.length > 128 || !p.nodeIds.length || p.nodeIds.some(id => !validConstructionId(id)) || new Set(p.nodeIds).size !== p.nodeIds.length || !Array.isArray(p.dependencies) || p.dependencies.length > 128 || new Set(p.dependencies).size !== p.dependencies.length || p.dependencies.includes(p.pageId) || [p.vertices, p.drawCalls, p.textureBytes, p.uploadBytes].some(n => !Number.isSafeInteger(n) || n < 0) || p.vertices > 540000 || p.drawCalls > 160 || p.textureBytes > 16777216 || p.uploadBytes > 16777216 || p.uploadBytes < p.vertices * 24)
            throw Error('creation_page_ref_invalid');
        pages.set(p.pageId, p);
    }
    // Validate dependency topology once, never during actor movement or rendering.
    const remaining = new Map<string, number>(), children = new Map<string, string[]>();
    for (const p of pages.values()) {
        remaining.set(p.pageId, p.dependencies.length);
        for (const id of p.dependencies) {
            const d = pages.get(id);
            if (!d || d.worldId !== p.worldId || d.spaceId !== p.spaceId)
                throw Error('creation_page_dependency_invalid');
            const list = children.get(id) || [];
            list.push(p.pageId);
            children.set(id, list);
        }
    }
    const ready = [...remaining].filter(([, n]) => n === 0).map(([id]) => id);
    let processed = 0;
    for (let i = 0; i < ready.length; i++) {
        processed++;
        for (const id of children.get(ready[i]) || []) {
            const n = remaining.get(id)! - 1;
            remaining.set(id, n);
            if (n === 0)
                ready.push(id);
        }
    }
    if (processed !== pages.size)
        throw Error('creation_page_dependency_cycle');
    const index = createCreationSpatialIndex([...pages.values()].map(p => ({ instanceId: p.pageId, head: p.head, definitionDigest: p.head, worldId: p.worldId, spaceId: p.spaceId, bounds: p.bounds, regionIds: creationRegionIds(p.bounds) })));
    return { ...index, pages };
}
export function selectCreationPages(index: ReturnType<typeof createCreationPageIndex>, query: CreationNeighborhoodQuery & {
    pinnedPageIds: readonly string[];
}, budget: CreationResidencyBudget): readonly CreationPageRef[] {
    validateCreationResidencyBudget(budget);
    if (!Array.isArray(query.pinnedPageIds) || query.pinnedPageIds.length > 128 || new Set(query.pinnedPageIds).size !== query.pinnedPageIds.length)
        throw Error('creation_page_pins_invalid');
    const result: CreationPageRef[] = [], selected = new Set<string>();
    let vertices = 0, calls = 0, textures = 0;
    const closure = (id: string) => {
        const ordered: CreationPageRef[] = [], visiting = new Set<string>(), stack: [
            string,
            boolean
        ][] = [[id, false]];
        while (stack.length) {
            const [key, finish] = stack.pop()!;
            if (selected.has(key))
                continue;
            const p = index.pages.get(key);
            if (!p || p.worldId !== query.worldId || p.spaceId !== query.spaceId)
                throw Error('creation_page_pin_missing');
            if (finish) {
                ordered.push(p);
                continue;
            }
            if (visiting.has(key))
                continue;
            visiting.add(key);
            if (visiting.size > 128)
                throw Error('creation_page_dependency_budget');
            stack.push([key, true]);
            for (let i = p.dependencies.length - 1; i >= 0; i--)
                stack.push([p.dependencies[i], false]);
        }
        return ordered;
    };
    const add = (id: string, required: boolean) => {
        const next = closure(id), v = next.reduce((n, p) => n + p.vertices, 0), c = next.reduce((n, p) => n + p.drawCalls, 0), t = next.reduce((n, p) => n + p.textureBytes, 0);
        const fits = result.length + next.length <= budget.maximumPages && vertices + v <= budget.maximumVertices && calls + c <= budget.maximumDrawCalls && textures + t <= budget.maximumTextureBytes && next.every(p => p.uploadBytes <= budget.maximumUploadBytesPerPaint);
        if (!fits) {
            if (required)
                throw Error('creation_occupied_residency_exceeded');
            return;
        }
        for (const p of next) {
            selected.add(p.pageId);
            result.push(p);
        }
        vertices += v;
        calls += c;
        textures += t;
    };
    query.pinnedPageIds.forEach(id => add(id, true));
    for (const entry of selectCreationNeighborhood(index, query)) {
        if (!selected.has(entry.instanceId))
            add(entry.instanceId, false);
    }
    return result;
}
/** Conservative upload ceilings; remaining draw/triangle allowance is measured by the existing renderer. Hardware qualification is separate. */
export function deriveCreationResidencyBudget(profile: WildsQualityProfile, usage: {
    drawCalls: number;
    triangles: number;
    textureBytes: number;
    maximumTextureBytes: number;
}): CreationResidencyBudget {
    if (Object.values(usage).some(n => !Number.isSafeInteger(n) || n < 0))
        throw Error('creation_scene_usage_invalid');
    const tier = profile.tier === 'low' ? 1 : profile.tier === 'medium' ? 2 : 4;
    return { maximumPages: 4 * tier, maximumVertices: Math.min(24000 * tier, Math.max(0, profile.maxTriangles - usage.triangles) * 3), maximumDrawCalls: Math.min(12 * tier, Math.max(0, profile.maxDrawCalls - usage.drawCalls)), maximumTextureBytes: Math.max(0, usage.maximumTextureBytes - usage.textureBytes), maximumUploadBytesPerPaint: 65536 * tier };
}
