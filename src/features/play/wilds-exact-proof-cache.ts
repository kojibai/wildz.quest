/** Exact plain-data verification memo. A head alone is never a cache key. */
export function createWildsExactProofCache(options: { maxEntries?: number; maxBytes?: number } = {}) {
  const maxEntries = options.maxEntries ?? 4096;
  const maxBytes = options.maxBytes ?? 4 * 1024 * 1024;
  const entries = new Map<string, { result: boolean; bytes: number }>();
  const validators = new WeakMap<Function, number>();
  let nextValidator = 0;
  let bytes = 0;

  function exactDataKey(value: unknown): string | null {
    let length = 0;
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
    try { return visit(value, 0); } catch { return null; }
  }

  const cache = {
    /** Returns null for accessor-bearing, non-plain, cyclic, or oversized data. */
    exactKey: exactDataKey,
    guard<T>(validator: (value: unknown) => value is T): (value: unknown) => value is T {
      return (value: unknown): value is T => cache.verify(value, validator);
    },
    verify<T>(value: T, validator: (value: T) => boolean): boolean {
      const data = exactDataKey(value);
      if (data === null) return validator(value);
      let validatorId = validators.get(validator);
      if (validatorId === undefined) { validatorId = ++nextValidator; validators.set(validator, validatorId); }
      const key = `${validatorId}:${data}`;
      const found = entries.get(key);
      if (found) { entries.delete(key); entries.set(key, found); return found.result; }
      const result = validator(value);
      const size = key.length * 2;
      if (size <= maxBytes && maxEntries > 0) {
        while (entries.size >= maxEntries || bytes + size > maxBytes) {
          const oldest = entries.keys().next().value;
          if (oldest === undefined) break;
          bytes -= entries.get(oldest)!.bytes;
          entries.delete(oldest);
        }
        entries.set(key, { result, bytes: size });
        bytes += size;
      }
      return result;
    },
    stats: () => ({ entries: entries.size, bytes })
  };
  return cache;
}
