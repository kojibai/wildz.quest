export const WILDS_EXPEDITION_SPARK_REWARD = 1;

export function isWildsTrailResourceBalance(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Preserve valid saved units. Missing legacy fields use their existing
 * starting balance; malformed present fields never grant replacement units. */
export function restoreWildsTrailResourceBalance(value: unknown, fallback = 0): number {
  return value === undefined ? fallback : isWildsTrailResourceBalance(value) ? value : 0;
}

export function addWildsTrailResourceUnits(balance: number, amount: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, restoreWildsTrailResourceBalance(balance) + amount);
}
