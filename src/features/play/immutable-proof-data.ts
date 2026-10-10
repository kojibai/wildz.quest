// Immutability is an eligibility check, never verification or admission.
// Weak membership only avoids walking descendants already proved immutable.
const immutablePlainObjects = new WeakSet<object>();

export function isDeeplyFrozenPlainProofData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return ["string", "number", "boolean"].includes(typeof value);
  if (immutablePlainObjects.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor) || !isDeeplyFrozenPlainProofData(descriptor.value, seen)) return false;
  }
  seen.delete(value);
  immutablePlainObjects.add(value);
  return true;
}

/** Freeze data descriptors without reading getters. Accessors/non-plain data
 * remain ineligible for result reuse even when their containing object freezes. */
export function freezeProofData(value: unknown, seen = new WeakSet<object>()) {
  if (!value || typeof value !== "object" || seen.has(value) || immutablePlainObjects.has(value)) return;
  seen.add(value);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if ("value" in descriptor) freezeProofData(descriptor.value, seen);
  }
  Object.freeze(value);
}
