/** Exact plain-data verification memo. A head alone is never a cache key. */
export function createWildsExactProofCache(options: { maxEntries?: number; maxBytes?: number } = {}) {
  const maxEntries = options.maxEntries ?? 4096;
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024;
  type Entry = { result: boolean; bytes: number; key: string | null };
  const entries = new Map<string, Entry>();
  const immutableEntries = new WeakMap<object, WeakMap<Function, Entry>>();
  const validators = new WeakMap<Function, number>();
  let nextValidator = 0;
  let bytes = 0;

  function inspectDataKey(value: unknown): { key: string; immutable: boolean } | null {
    let length = 0;
    let immutable = true;
    const active = new Set<object>();
    const part = (text: string) => {
      length += text.length * 2;
      if (length > maxBytes) throw new Error("uncacheable");
      return text;
    };
    const visit = (item: unknown, depth: number): string => {
      if (depth > 64) throw new Error("uncacheable");
      if (item === null) return part("null");
      if (typeof item === "string" || typeof item === "boolean") return part(JSON.stringify(item));
      if (typeof item === "number" && Number.isFinite(item)) return part(Object.is(item, -0) ? "-0" : String(item));
      if (typeof item !== "object" || active.has(item)) throw new Error("uncacheable");
      const array = Array.isArray(item);
      const prototype = Object.getPrototypeOf(item);
      if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("uncacheable");
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (Object.isExtensible(item) || Reflect.ownKeys(descriptors).some(key => {
        const descriptor = descriptors[key as string]!;
        return descriptor.configurable !== false || ("value" in descriptor && descriptor.writable !== false);
      })) immutable = false;
      const keys = Reflect.ownKeys(descriptors);
      if (keys.some(key => typeof key !== "string" || key === "toJSON")) throw new Error("uncacheable");
      for (const key of keys as string[]) {
        const descriptor = descriptors[key]!;
        if (!("value" in descriptor) || (!descriptor.enumerable && !(array && key === "length"))) throw new Error("uncacheable");
      }
      active.add(item);
      let result: string;
      if (array) {
        const size = descriptors.length?.value;
        if (!Number.isSafeInteger(size) || size < 0 || keys.length !== size + 1) throw new Error("uncacheable");
        const children: string[] = [];
        for (let index = 0; index < size; index++) {
          if (!descriptors[String(index)]) throw new Error("uncacheable");
          children.push(visit(descriptors[String(index)]!.value, depth + 1));
        }
        result = part("[") + children.join(part(",")) + part("]");
      } else {
        result = part("{") + (keys as string[]).sort().map(key => part(JSON.stringify(key)) + part(":") + visit(descriptors[key]!.value, depth + 1)).join(part(",")) + part("}");
      }
      active.delete(item);
      return result;
    };
    try { return { key: visit(value, 0), immutable }; } catch { return null; }
  }
  function exactDataKey(value: unknown): string | null { return inspectDataKey(value)?.key ?? null; }

  const cache = {
    /** Returns null for accessor-bearing, non-plain, cyclic, or oversized data. */
    exactKey: exactDataKey,
    guard<T>(validator: (value: unknown) => value is T): (value: unknown) => value is T {
      return (value: unknown): value is T => cache.verify(value, validator);
    },
    verify<T>(value: T, validator: (value: T) => boolean): boolean {
      const object = value !== null && typeof value === "object" ? value : null;
      const immutableHit = object ? immutableEntries.get(object)?.get(validator) : undefined;
      if (immutableHit?.key !== null && immutableHit?.key !== undefined) {
        entries.delete(immutableHit.key); entries.set(immutableHit.key, immutableHit);
        return immutableHit.result;
      }
      const inspected = inspectDataKey(value);
      if (inspected === null) return validator(value);
      const data = inspected.key;
      let validatorId = validators.get(validator);
      if (validatorId === undefined) { validatorId = ++nextValidator; validators.set(validator, validatorId); }
      const key = `${validatorId}:${data}`;
      const found = entries.get(key);
      const result = found ? found.result : validator(value);
      const size = key.length * 2;
      let entry = found;
      if (found) { entries.delete(key); entries.set(key, found); }
      if (size <= maxBytes && maxEntries > 0) {
        if (!found) {
          while (entries.size >= maxEntries || bytes + size > maxBytes) {
            const oldest = entries.keys().next().value;
            if (oldest === undefined) break;
            const expired = entries.get(oldest)!;
            bytes -= expired.bytes; expired.key = null;
            entries.delete(oldest);
          }
          entry = { result, bytes: size, key };
          entries.set(key, entry); bytes += size;
        }
        if (object && inspected.immutable && entry) {
          let proofs = immutableEntries.get(object);
          if (!proofs) { proofs = new WeakMap(); immutableEntries.set(object, proofs); }
          proofs.set(validator, entry);
        }
      }
      return result;
    },
    stats: () => ({ entries: entries.size, bytes })
  };
  return cache;
}
