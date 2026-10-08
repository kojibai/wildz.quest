import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsWorldWork } from "./wilds-world-work";
import { cloneRetainedWildsWorldProofs, WILDS_WORLD_TRANSFER_PROOF_MAPS } from "./wilds-received-proof-immutability";

type ProjectionWork = WildsWorldWork | { kind: "prepare-persist"; base: WildsWorldProjection; entry: unknown; anchorId?: string | null };
type TableDelta = { patch: Record<string, unknown>; removed: string[] };
type ProjectionDelta = { schema: "wildz.world-worker-delta.v1"; nested: boolean; patch: Record<string, unknown>; removed: string[]; tables: Record<string, TableDelta>; result?: Record<string, unknown> };

/** Capture mutable inputs once, keeping private, deeply frozen proof rows by
 * identity. postMessage still copies the complete request into the worker. */
export function cloneWildsWorldWorkerInput<T extends ProjectionWork>(work: T): T {
  if (!("base" in work)) return structuredClone(work);
  const { base, ...other } = work;
  return { ...structuredClone(other), base: cloneRetainedWildsWorldProofs(base) } as T;
}

/** The trusted local worker returns only changed top-level fields. Source
 * validation and durable admission run before this transport step. */
export function encodeWildsWorldWorkerResult(work: ProjectionWork, value: unknown): unknown {
  if (!("base" in work) || !value || typeof value !== "object") return value;
  const nested = work.kind === "prepare" || work.kind === "prepare-persist";
  const result = value as Record<string, unknown>;
  const projection = (nested ? result.projection : value) as Record<string, unknown> | undefined;
  if (!projection || projection.schema !== "receiz.wilds_world_projection.v3") return value;
  const base = work.base as unknown as Record<string, unknown>;
  const patch = Object.fromEntries(Object.entries(projection).filter(([key, row]) => !Object.hasOwn(base, key) || row !== base[key]));
  const tables: Record<string, TableDelta> = {};
  for (const key of WILDS_WORLD_TRANSFER_PROOF_MAPS) {
    const before = base[key], after = patch[key];
    if (!before || typeof before !== "object" || Array.isArray(before) || !after || typeof after !== "object" || Array.isArray(after)) continue;
    const table = before as Record<string, unknown>;
    tables[key] = { patch: Object.fromEntries(Object.entries(after).filter(([id, row]) => !Object.hasOwn(table, id) || row !== table[id])), removed: Object.keys(table).filter(id => !Object.hasOwn(after, id)) };
    delete patch[key];
  }
  const removed = Object.keys(base).filter(key => !Object.hasOwn(projection, key));
  const metadata = nested ? Object.fromEntries(Object.entries(result).filter(([key]) => key !== "projection")) : undefined;
  return { schema: "wildz.world-worker-delta.v1", nested, patch, removed, tables, ...(nested ? { result: metadata } : {}) } satisfies ProjectionDelta;
}

/** Reconstitute against this request's private snapshot, never the newest
 * world: overlapping and out-of-order replies cannot overwrite one another. */
export function decodeWildsWorldWorkerResult(work: ProjectionWork, value: unknown): unknown {
  if (!value || typeof value !== "object" || (value as { schema?: unknown }).schema !== "wildz.world-worker-delta.v1") return value;
  const delta = value as ProjectionDelta;
  const nested = work.kind === "prepare" || work.kind === "prepare-persist";
  if (!("base" in work) || delta.nested !== nested || !delta.patch || typeof delta.patch !== "object" || Array.isArray(delta.patch)
    || !Array.isArray(delta.removed) || delta.removed.some(key => typeof key !== "string") || !delta.tables || typeof delta.tables !== "object" || Array.isArray(delta.tables)
    || (nested && (!delta.result || typeof delta.result !== "object" || Array.isArray(delta.result)))) throw Error("wilds_world_worker_delta_invalid");
  const projection: Record<string, unknown> = Object.fromEntries(Object.entries(work.base).filter(([key]) => !delta.removed.includes(key)));
  // Defining own fields also keeps transported keys such as __proto__ inert.
  for (const [key, row] of Object.entries(delta.patch)) Object.defineProperty(projection, key, { value: row, enumerable: true, writable: true, configurable: true });
  for (const [key, table] of Object.entries(delta.tables)) {
    const before = Object.getOwnPropertyDescriptor(work.base, key)?.value;
    if (!WILDS_WORLD_TRANSFER_PROOF_MAPS.includes(key as typeof WILDS_WORLD_TRANSFER_PROOF_MAPS[number]) || !before || typeof before !== "object"
      || !table?.patch || typeof table.patch !== "object" || Array.isArray(table.patch) || !Array.isArray(table.removed) || table.removed.some(id => typeof id !== "string")) throw Error("wilds_world_worker_delta_invalid");
    projection[key] = Object.fromEntries([...Object.entries(before).filter(([id]) => !table.removed.includes(id) && !Object.hasOwn(table.patch, id)), ...Object.entries(table.patch)]);
  }
  return nested ? { ...delta.result, projection } : projection;
}
