export const WILDS_WORLD_TRANSFER_PROOF_MAPS = ["constructionProjects", "constructionChunks", "constructionComponents",
  "constructionMaterialContributions", "constructionWorkContributions", "materialLots"] as const;
const retainedProofs = new WeakSet<object>();
type Rows = [string, unknown][];
type GeometryContext = { components: Rows; material: Rows; work: Rows };
const preparedGeometry = new WeakMap<object, GeometryContext>();
const sameRows = (left: Rows, right: Rows) => left.length === right.length && left.every(([key, row], index) => right[index]?.[0] === key && right[index]?.[1] === row);

/** Snapshot mutable maps without cloning private immutable proofs a second
 * time on the main thread. Unprepared caller data is still copied in full. */
export function cloneRetainedWildsWorldProofs<T extends object>(world: T): T {
  const plain = { ...world } as Record<string, unknown>;
  const tables = new Map<string, object>();
  for (const key of WILDS_WORLD_TRANSFER_PROOF_MAPS) {
    const table = Object.getOwnPropertyDescriptor(world, key)?.value;
    if (!table || typeof table !== "object" || Array.isArray(table)) continue;
    tables.set(key, table);
    delete plain[key];
  }
  const copy = structuredClone(plain);
  for (const [key, table] of tables) copy[key] = Object.fromEntries(Object.entries(table).map(([id, row]) => [id,
    row && typeof row === "object" && retainedProofs.has(row) ? row : structuredClone(row)]));
  return copy as T;
}

/** Prepare the first verified geometry in yielding slices before publishing a
 * received world. Subsequent synchronous render selectors reuse the same rows. */
export async function prepareReceivedWildsWorldProofs<T>(projection: T, options: { cancelled?(): boolean } = {}): Promise<T> {
  if (options.cancelled?.()) return projection;
  retainReceivedWildsWorldProofs(projection);
  if (!projection || typeof projection !== "object") return projection;
  const rows = Object.getOwnPropertyDescriptor(projection, "constructionComponents");
  if (!rows || !("value" in rows) || !rows.value || typeof rows.value !== "object" || !Object.keys(rows.value).length) return projection;
  const components = Object.entries(rows.value) as Rows;
  const world = projection as unknown as import("./wilds-world-state").WildsWorldProjection;
  const context = { components, material: Object.entries(world.constructionMaterialContributions ?? {}), work: Object.entries(world.constructionWorkContributions ?? {}) };
  const first = components[0]?.[1];
  const previous = first && typeof first === "object" ? preparedGeometry.get(first) : undefined;
  if (previous && sameRows(previous.components, components) && sameRows(previous.material, context.material) && sameRows(previous.work, context.work)) return projection;
  const { createWildsConstructionGeometryProjector } = await import("./wilds-construction-geometry");
  const project = createWildsConstructionGeometryProjector(Object.values(world.constructionMaterialContributions ?? {}), Object.values(world.constructionWorkContributions ?? {}));
  const yieldToRendering = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  await yieldToRendering();
  let sliceStarted = performance.now();
  for (const component of Object.values(world.constructionComponents)) {
    if (options.cancelled?.()) return projection;
    try { project(component); } catch { /* Normal admission rejects malformed evidence; preparation grants no authority. */ }
    if (performance.now() - sliceStarted >= 8) { await yieldToRendering(); sliceStarted = performance.now(); }
  }
  if (first && typeof first === "object" && [...components, ...context.material, ...context.work].every(([, row]) => row && typeof row === "object" && retainedProofs.has(row))) preparedGeometry.set(first, context);
  return projection;
}

/** Freeze private JSON/worker proof rows once after transfer. This grants no
 * authority: normal admission still validates every proof before using it.
 * Projection maps stay mutable, and caller-owned input must not enter here. */
export function retainReceivedWildsWorldProofs<T>(projection: T): T {
  if (!projection || typeof projection !== "object") return projection;
  for (const key of WILDS_WORLD_TRANSFER_PROOF_MAPS) {
    const table = Object.getOwnPropertyDescriptor(projection, key);
    if (!table || !("value" in table) || !table.value || typeof table.value !== "object") continue;
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(table.value))) {
      if ("value" in descriptor) freezePlainProof(descriptor.value);
    }
  }
  return projection;
}

function freezePlainProof(value: unknown) {
  if (value && typeof value === "object" && retainedProofs.has(value)) return;
  const objects = new Set<object>(), active = new Set<object>();
  const inspect = (item: unknown, depth: number): boolean => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return true;
    if (typeof item === "number") return Number.isFinite(item);
    if (typeof item !== "object" || depth > 64 || active.has(item)) return false;
    if (objects.has(item)) return true;
    const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
    const descriptors = Object.getOwnPropertyDescriptors(item), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== "string" || key === "toJSON")) return false;
    active.add(item);
    const valid = keys.every(key => {
      const descriptor = descriptors[key as string]!;
      return "value" in descriptor && (descriptor.enumerable || (array && key === "length")) && inspect(descriptor.value, depth + 1);
    });
    active.delete(item);
    if (!valid) return false;
    if (array) {
      const size = descriptors.length?.value;
      if (!Number.isSafeInteger(size) || size < 0 || keys.length !== size + 1) return false;
      for (let index = 0; index < size; index++) if (!descriptors[String(index)]) return false;
    }
    objects.add(item);
    return true;
  };
  // Inspect the entire row before changing any part of malformed input.
  try { if (inspect(value, 0)) for (const object of objects) { Object.freeze(object); retainedProofs.add(object); } } catch { /* Malformed data still reaches its ordinary verifier. */ }
}
