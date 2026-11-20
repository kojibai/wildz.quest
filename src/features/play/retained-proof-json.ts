const immutableProofValues = new WeakSet<object>();

/** Take immutable custody before retaining an exact canonical representation. */
export function freezeProofValue<T>(value: T): T {
  if (value && typeof value === "object" && !immutableProofValues.has(value)) {
    for (const child of Object.values(value)) freezeProofValue(child);
    Object.freeze(value);
    immutableProofValues.add(value);
  }
  return value;
}

/** Same sorted-JSON encoding as canonicalPortableCardJson. Only immutable
 * objects retain bytes; mutable caller values never acquire retained authority. */
export function createRetainedProofJson() {
  const representations = new WeakMap<object, string>();
  const encode = (value: unknown): string | undefined => {
    if (!value || typeof value !== "object") return JSON.stringify(value);
    const held = immutableProofValues.has(value) ? representations.get(value) : undefined;
    if (held !== undefined) return held;
    let text: string;
    if (Array.isArray(value)) text = `[${Array.from(value, child => encode(child) ?? "null").join(",")}]`;
    else {
      const record = value as Record<string, unknown>;
      // JSON's integer-key ordering applies after locale-sorted insertion.
      const ordered = Object.keys(Object.fromEntries(Object.keys(record).sort((a, b) => a.localeCompare(b)).map(key => [key, true])));
      text = `{${ordered.flatMap(key => {
        const encoded = encode(record[key]);
        return encoded === undefined ? [] : [`${JSON.stringify(key)}:${encoded}`];
      }).join(",")}}`;
    }
    return text;
  };
  return (value: unknown): string => {
    const text = encode(value);
    if (text === undefined) throw new Error("wildz_proof_json_missing");
    if (value && typeof value === "object" && immutableProofValues.has(value)) representations.set(value, text);
    return text;
  };
}

/** Bound transient UTF-8 allocations while preserving complete canonical bytes. */
export function encodeProofJson(text: string): Uint8Array {
  const encoder = new TextEncoder();
  let byteLength = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    byteLength += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  const output = new Uint8Array(byteLength);
  let written = 0;
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + 64 * 1024, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    written += encoder.encodeInto(text.slice(offset, end), output.subarray(written)).written;
    offset = end;
  }
  return output;
}
