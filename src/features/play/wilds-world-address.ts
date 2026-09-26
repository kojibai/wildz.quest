/** A persistent v11 position. Local offsets are integer millionths of a world unit. */
export type WildsWorldAddress = {
  worldVersion: 11;
  regionX: string;
  regionZ: string;
  localX: number;
  localZ: number;
};

export const WILDS_REGION_MICRO_UNITS = 24_000_000;
const REGION_MICRO = BigInt(WILDS_REGION_MICRO_UNITS);
const MAX_REGION_DIGITS = 4096;
const CANONICAL_INTEGER = /^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/;

function parseRegion(value: unknown): string {
  if (typeof value !== "string" || value.length > MAX_REGION_DIGITS || !CANONICAL_INTEGER.test(value)) {
    throw new RangeError("Invalid Wilds world address region");
  }
  return value;
}

function parseLocal(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= WILDS_REGION_MICRO_UNITS) {
    throw new RangeError("Invalid Wilds world address local offset");
  }
  return value;
}

export function parseWildsWorldAddress(value: unknown): WildsWorldAddress {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Invalid Wilds world address");
  }
  const address = value as Record<string, unknown>;
  if (address.worldVersion !== 11) {
    throw new RangeError("Invalid Wilds world address version");
  }
  return {
    worldVersion: 11,
    regionX: parseRegion(address.regionX),
    regionZ: parseRegion(address.regionZ),
    localX: parseLocal(address.localX),
    localZ: parseLocal(address.localZ)
  };
}

/** Euclidean quotient and remainder keep local offsets nonnegative across zero. */
function normalizeAxis(region: string, local: number, deltaMicro: bigint): [string, number] {
  const total = BigInt(local) + deltaMicro;
  let quotient = total / REGION_MICRO;
  let remainder = total % REGION_MICRO;
  if (remainder < 0n) {
    quotient -= 1n;
    remainder += REGION_MICRO;
  }
  const nextRegion = (BigInt(region) + quotient).toString();
  parseRegion(nextRegion);
  return [nextRegion, Number(remainder)];
}

export function offsetWildsWorldAddress(
  value: WildsWorldAddress,
  dxMicro: bigint,
  dzMicro: bigint
): WildsWorldAddress {
  const address = parseWildsWorldAddress(value);
  if (typeof dxMicro !== "bigint" || typeof dzMicro !== "bigint") {
    throw new TypeError("Wilds world address offsets must be bigint micro-units");
  }
  const [regionX, localX] = normalizeAxis(address.regionX, address.localX, dxMicro);
  const [regionZ, localZ] = normalizeAxis(address.regionZ, address.localZ, dzMicro);
  return { worldVersion: 11, regionX, regionZ, localX, localZ };
}

/** Distance is measured from the starting region for deterministic rarity bands. */
export function wildsAddressDistanceSquared(value: WildsWorldAddress): bigint {
  const address = parseWildsWorldAddress(value);
  const x = BigInt(address.regionX);
  const z = BigInt(address.regionZ);
  return x * x + z * z;
}

function v10CoordinateToMicro(value: number): bigint {
  const micro = value * 1_000_000;
  if (!Number.isFinite(value) || !Number.isSafeInteger(micro)) {
    throw new RangeError("V10 position must be finite and exactly representable in micro-units");
  }
  return BigInt(micro);
}

/** Existing v10 coordinates retain their original world-unit meaning. */
export function v10PositionToWildsAddress(x: number, z: number): WildsWorldAddress {
  return offsetWildsWorldAddress(
    { worldVersion: 11, regionX: "0", regionZ: "0", localX: 0, localZ: 0 },
    v10CoordinateToMicro(x),
    v10CoordinateToMicro(z)
  );
}
