const CELL_SIZE = 64;
const RADIUS = 110;
const CELL_REACH = Math.ceil(RADIUS / CELL_SIZE);

/** A render-only index of an immutable world collection; rebuild when that collection changes. */
export function createWildsProximityIndex<T extends { position: { x: number; z: number } }>(
  values: readonly T[], id: (value: T) => string
) {
  const cells = new Map<string, T[]>();
  for (const value of values) {
    const { x, z } = value.position;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const key = `${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(value);
    else cells.set(key, [value]);
  }
  let lastCell = "";
  let candidates: T[] = [];
  let candidateBuilds = 0;
  return {
    near(position: { x: number; z: number }): T[] {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return [];
      const cx = Math.floor(position.x / CELL_SIZE), cz = Math.floor(position.z / CELL_SIZE);
      const key = `${cx},${cz}`;
      if (key !== lastCell) {
        candidates = [];
        for (let dx = -CELL_REACH; dx <= CELL_REACH; dx++) {
          for (let dz = -CELL_REACH; dz <= CELL_REACH; dz++) {
            const bucket = cells.get(`${cx + dx},${cz + dz}`);
            if (bucket) for (const value of bucket) candidates.push(value);
          }
        }
        candidates.sort((a, b) => id(a).localeCompare(id(b)));
        lastCell = key;
        candidateBuilds++;
      }
      return candidates.filter(value => Math.hypot(value.position.x - position.x, value.position.z - position.z) <= RADIUS);
    },
    stats: () => ({ candidateBuilds, candidates: candidates.length })
  };
}
