import type { CreationChunk } from './compiler';
/** Worker-only buffer packing. Repeated nodes share one draw group per material. */
export function mergeCreationMaterialBuffers(positions: readonly number[], normals: readonly number[], groups: CreationChunk['materials']) {
    if (positions.length !== normals.length || positions.length % 9)
        throw Error('creation_geometry_buffer_invalid');
    const byMaterial = new Map<string, typeof groups[number][]>();
    let count = 0;
    for (const g of groups) {
        if (!Number.isSafeInteger(g.start) || !Number.isSafeInteger(g.count) || g.start !== count || g.count < 0 || g.count % 3 || g.start + g.count > positions.length / 3)
            throw Error('creation_material_range_invalid');
        count += g.count;
        const list = byMaterial.get(g.material) || [];
        list.push(g);
        byMaterial.set(g.material, list);
    }
    if (count !== positions.length / 3)
        throw Error('creation_material_range_incomplete');
    const nextPositions = new Float32Array(positions.length), nextNormals = new Float32Array(normals.length), materials: CreationChunk['materials'][number][] = [];
    let offset = 0;
    for (const [material, list] of [...byMaterial].sort(([a], [b]) => a.localeCompare(b))) {
        const start = offset / 3;
        for (const g of list) {
            const from = g.start * 3, to = (g.start + g.count) * 3;
            nextPositions.set(positions.slice(from, to), offset);
            nextNormals.set(normals.slice(from, to), offset);
            offset += g.count * 3;
        }
        materials.push({ material, start, count: offset / 3 - start });
    }
    return { positions: nextPositions, normals: nextNormals, materials };
}
