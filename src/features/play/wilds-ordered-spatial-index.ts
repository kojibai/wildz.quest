type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
const CELL = 32;

/** Broad phase only: preserves source order and duplicates for exact narrow-phase checks. */
export function createWildsOrderedSpatialIndex<T>(values: readonly T[], bounds: (value: T) => Bounds) {
  const cells = new Map<string, number[]>();
  const fallback: number[] = [];
  values.forEach((value, index) => {
    const b = bounds(value);
    if (!Object.values(b).every(value => Number.isFinite(value) && Number.isSafeInteger(Math.floor(value / CELL))) || b.maxX < b.minX || b.maxZ < b.minZ
      || (b.maxX - b.minX) / CELL > 16 || (b.maxZ - b.minZ) / CELL > 16) {
      fallback.push(index);
      return;
    }
    for (let x = Math.floor(b.minX / CELL); x <= Math.floor(b.maxX / CELL); x++) {
      for (let z = Math.floor(b.minZ / CELL); z <= Math.floor(b.maxZ / CELL); z++) {
        const key = `${x}:${z}`;
        const bucket = cells.get(key);
        if (bucket) bucket.push(index); else cells.set(key, [index]);
      }
    }
  });
  // Candidates depend on the covered cells, not the precise query coordinates.
  // Walking usually stays in the same cells for many frames. Keep only that
  // last result so narrow-phase collision still runs at the current position.
  let previous: { minX: number; maxX: number; minZ: number; maxZ: number; values: readonly T[] } | undefined;
  return (b: Bounds): readonly T[] => {
    if (!Object.values(b).every(value => Number.isFinite(value) && Number.isSafeInteger(Math.floor(value / CELL))) || b.maxX < b.minX || b.maxZ < b.minZ
      || (b.maxX - b.minX) / CELL > 16 || (b.maxZ - b.minZ) / CELL > 16) return values;
    const minX = Math.floor(b.minX / CELL), maxX = Math.floor(b.maxX / CELL);
    const minZ = Math.floor(b.minZ / CELL), maxZ = Math.floor(b.maxZ / CELL);
    if (previous && previous.minX === minX && previous.maxX === maxX
      && previous.minZ === minZ && previous.maxZ === maxZ) return previous.values;
    const indices = new Set(fallback);
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (const index of cells.get(`${x}:${z}`) ?? []) indices.add(index);
      }
    }
    const nearby = [...indices].sort((a, b) => a - b).map(index => values[index]!);
    previous = { minX, maxX, minZ, maxZ, values: nearby };
    return nearby;
  };
}
