type JsonPrimitive = string | number | boolean | null;

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function normalizeNumber(value: number): string {
  if (!Number.isFinite(value)) return "null";
  return JSON.stringify(value);
}

function canonicalizeValue(value: unknown): string {
  if (isJsonPrimitive(value)) {
    if (typeof value === "number") return normalizeNumber(value);
    return JSON.stringify(value);
  }

  if (typeof value === "bigint") {
    throw new TypeError("JCS does not support bigint values.");
  }

  if (typeof value === "function" || typeof value === "symbol" || value === undefined) {
    return "null";
  }

  if (value && typeof value === "object") {
    if (typeof (value as { toJSON?: () => unknown }).toJSON === "function") {
      return canonicalizeValue((value as { toJSON: () => unknown }).toJSON());
    }

    if (Array.isArray(value)) {
      const items = value.map((item) =>
        item === undefined || typeof item === "function" || typeof item === "symbol"
          ? "null"
          : canonicalizeValue(item)
      );
      return `[${items.join(",")}]`;
    }

    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries: string[] = [];
    for (const key of keys) {
      const v = obj[key];
      if (v === undefined || typeof v === "function" || typeof v === "symbol") continue;
      entries.push(`${JSON.stringify(key)}:${canonicalizeValue(v)}`);
    }
    return `{${entries.join(",")}}`;
  }

  return "null";
}

export function jcsCanonicalize(value: unknown): string {
  return canonicalizeValue(value);
}
