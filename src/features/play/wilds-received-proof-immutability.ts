const proofMaps = ["constructionProjects", "constructionChunks", "constructionComponents",
  "constructionMaterialContributions", "constructionWorkContributions", "materialLots"] as const;

/** Prepare the first verified geometry in yielding slices before publishing a
 * received world. Subsequent synchronous render selectors reuse the same rows. */
export async function prepareReceivedWildsWorldProofs<T>(projection: T, options: { cancelled?(): boolean } = {}): Promise<T> {
  if (options.cancelled?.()) return projection;
  retainReceivedWildsWorldProofs(projection);
  if (!projection || typeof projection !== "object") return projection;
  const rows = Object.getOwnPropertyDescriptor(projection, "constructionComponents");
  if (!rows || !("value" in rows) || !rows.value || typeof rows.value !== "object" || !Object.keys(rows.value).length) return projection;
  const { createWildsConstructionGeometryProjector } = await import("./wilds-construction-geometry");
  const world = projection as unknown as import("./wilds-world-state").WildsWorldProjection;
  const project = createWildsConstructionGeometryProjector(Object.values(world.constructionMaterialContributions ?? {}), Object.values(world.constructionWorkContributions ?? {}));
  const yieldToRendering = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  await yieldToRendering();
  let sliceStarted = performance.now();
  for (const component of Object.values(world.constructionComponents)) {
    if (options.cancelled?.()) return projection;
    try { project(component); } catch { /* Normal admission rejects malformed evidence; preparation grants no authority. */ }
    if (performance.now() - sliceStarted >= 8) { await yieldToRendering(); sliceStarted = performance.now(); }
  }
  return projection;
}

/** Freeze private JSON/worker proof rows once after transfer. This grants no
 * authority: normal admission still validates every proof before using it.
 * Projection maps stay mutable, and caller-owned input must not enter here. */
export function retainReceivedWildsWorldProofs<T>(projection: T): T {
  if (!projection || typeof projection !== "object") return projection;
  for (const key of proofMaps) {
    const table = Object.getOwnPropertyDescriptor(projection, key);
    if (!table || !("value" in table) || !table.value || typeof table.value !== "object") continue;
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(table.value))) {
      if ("value" in descriptor) freezePlainProof(descriptor.value);
    }
  }
  return projection;
}

function freezePlainProof(value: unknown) {
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
  try { if (inspect(value, 0)) for (const object of objects) Object.freeze(object); } catch { /* Malformed data still reaches its ordinary verifier. */ }
}
