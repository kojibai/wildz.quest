function boundedPower(value: number) {
  if (!Number.isFinite(value)) throw new Error("wilds_capability_power_invalid");
  return Math.max(0, Math.min(100, value));
}

export type WildsBreakTarget = Readonly<{
  id: string;
  integrity: number;
  admittedImpact: number;
  breakable: boolean;
  protected: boolean;
  privateOwnerId: string | null;
}>;

export function applyWildsBreakCapability(target: WildsBreakTarget) {
  if (!target.breakable || target.protected || target.privateOwnerId) throw new Error("wilds_break_protected_source");
  if (!Number.isFinite(target.integrity) || !Number.isFinite(target.admittedImpact) || target.integrity < 0 || target.admittedImpact <= 0) {
    throw new Error("wilds_break_target_invalid");
  }
  return Object.freeze({ ...target, integrity: Math.max(0, target.integrity - target.admittedImpact) });
}

export type WildsHazardFamily = "heat" | "cold" | "pressure" | "storm" | "impact";

export function beginWildsResistanceEnvelope(input: Readonly<{
  hazard: WildsHazardFamily;
  creatureResistance: WildsHazardFamily;
  power: number;
}>) {
  const matching = input.hazard === input.creatureResistance;
  return Object.freeze({
    active: matching,
    hazard: input.hazard,
    protection: matching ? boundedPower(input.power) / 100 : 0
  });
}

export function beginWildsAnchorHold(input: Readonly<{
  force: Readonly<{ x: number; z: number }>;
  power: number;
}>) {
  if (!Number.isFinite(input.force.x) || !Number.isFinite(input.force.z)) throw new Error("wilds_anchor_force_invalid");
  const scale = boundedPower(input.power) / 100;
  return Object.freeze({
    active: true as const,
    counterForce: Object.freeze({ x: -input.force.x * scale, z: -input.force.z * scale })
  });
}

export type WildsRescueTarget = Readonly<{
  id: string;
  endangered: boolean;
  position: Readonly<{ x: number; z: number }>;
  safeAnchor: Readonly<{ x: number; z: number }>;
  recoveryMargin: number;
  injuryCount: number;
}>;

export function applyWildsRescueCapability(target: WildsRescueTarget, power: number) {
  if (!target.endangered) throw new Error("wilds_rescue_target_safe");
  return Object.freeze({
    ...target,
    endangered: false,
    position: Object.freeze({ ...target.safeAnchor }),
    recoveryMargin: Math.min(100, target.recoveryMargin + Math.floor(boundedPower(power) / 10))
  });
}

