export const WILDZ_FIXED_SCALE = 1_000;

export function toFixed(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Fixed-point input must be finite");
  return Math.round(value * WILDZ_FIXED_SCALE);
}

export function fromFixed(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("Fixed-point value must be a safe integer");
  return value / WILDZ_FIXED_SCALE;
}

export function mulFixed(left: number, right: number): number {
  return Math.round((left * right) / WILDZ_FIXED_SCALE);
}

export function clampFixed(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
