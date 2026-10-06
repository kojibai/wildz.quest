import type { CreationBounds } from './geometry';
import type { CreationPoint } from './types';
import { validConstructionHead, validConstructionId, freezeConstructionProof, constructionProofDigest } from '../wilds-construction-project';
export type CreationIndexEntry = Readonly<{
    instanceId: string;
    head: string;
    worldId: string;
    spaceId: string;
    regionIds: readonly string[];
    bounds: CreationBounds;
    definitionDigest: string;
}>;
export type CreationNeighborhoodQuery = Readonly<{
    worldId: string;
    spaceId: string;
    position: CreationPoint;
    radius: number;
    limit: number;
}>;
export type CreationSpatialIndex = Readonly<{
    revision: number;
    entries: ReadonlyMap<string, CreationIndexEntry>;
    regions: ReadonlyMap<string, readonly string[]>;
}>;
const SIZE = 32, MAX_REGIONS = 4096;
export function creationRegionIds(bounds: CreationBounds): readonly string[] {
    if (!bounds || !bounds.min || !bounds.max || ![bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9) || bounds.min.x > bounds.max.x || bounds.min.y > bounds.max.y || bounds.min.z > bounds.max.z)
        throw Error('creation_index_bounds_invalid');
    const x0 = Math.floor(bounds.min.x / SIZE), x1 = Math.floor(bounds.max.x / SIZE), z0 = Math.floor(bounds.min.z / SIZE), z1 = Math.floor(bounds.max.z / SIZE);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > MAX_REGIONS)
        throw Error('creation_index_region_budget');
    const ids: string[] = [];
    for (let x = x0; x <= x1; x++)
        for (let z = z0; z <= z1; z++)
            ids.push(`${x}:${z}`);
    return ids;
}
export function createCreationSpatialIndex(input: readonly CreationIndexEntry[]): CreationSpatialIndex {
    if (input.length > 16384)
        throw Error('creation_index_instance_budget');
    const entries = new Map<string, CreationIndexEntry>(), regions = new Map<string, string[]>();
    for (const original of input) {
        const entry = freezeConstructionProof(JSON.parse(JSON.stringify(original))) as CreationIndexEntry;
        if (![entry.instanceId, entry.worldId, entry.spaceId].every(validConstructionId) || !validConstructionHead(entry.head) || !validConstructionHead(entry.definitionDigest))
            throw Error('creation_index_source_invalid');
        const cells = creationRegionIds(entry.bounds);
        if (!Array.isArray(entry.regionIds) || constructionProofDigest([...entry.regionIds].sort()) !== constructionProofDigest([...cells].sort()))
            throw Error('creation_index_regions_invalid');
        const before = entries.get(entry.instanceId);
        if (before) {
            if (constructionProofDigest(before) !== constructionProofDigest(entry))
                throw Error('creation_index_head_conflict');
            continue;
        }
        entries.set(entry.instanceId, entry);
        for (const region of cells) {
            const key = JSON.stringify([entry.worldId, entry.spaceId, region]), ids = regions.get(key) || [];
            ids.push(entry.instanceId);
            regions.set(key, ids);
        }
    }
    return { revision: 1, entries, regions };
}
export function selectCreationNeighborhood(index: CreationSpatialIndex, query: CreationNeighborhoodQuery): readonly CreationIndexEntry[] {
    if (![query.worldId, query.spaceId].every(validConstructionId) || !query.position || ![query.position.x, query.position.y, query.position.z, query.radius].every(Number.isFinite) || query.radius < 0 || query.radius > 256 || !Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 128)
        throw Error('creation_index_query_invalid');
    const p = query.position, r = query.radius, cells = creationRegionIds({ min: { x: p.x - r, y: p.y - r, z: p.z - r }, max: { x: p.x + r, y: p.y + r, z: p.z + r } }), found = new Set<string>(), near: { entry: CreationIndexEntry; distanceSquared: number }[] = [];
    for (const cell of cells)
        for (const id of index.regions.get(JSON.stringify([query.worldId, query.spaceId, cell])) || []) {
            if (found.has(id))
                continue;
            found.add(id);
            const entry = index.entries.get(id);
            if (!entry || entry.worldId !== query.worldId || entry.spaceId !== query.spaceId)
                continue;
            const b = entry.bounds, dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x), dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y), dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            if (distanceSquared <= r * r)
                near.push({ entry, distanceSquared });
        }
    return near.sort((a, b) => a.distanceSquared - b.distanceSquared || a.entry.instanceId.localeCompare(b.entry.instanceId)).slice(0, query.limit).map(({ entry }) => entry);
}
