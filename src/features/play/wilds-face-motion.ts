export type WildsBlinkProfile = Readonly<{
  cadenceMs: number;
  phaseMs: number;
  closeMs: number;
  holdMs: number;
  openMs: number;
}>;

/** Cosmetic identity sampling happens at construction, never in the frame loop. */
export function wildsFaceUnit(identity: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619);
  return (hash >>> 0) / 0xffffffff;
}

export function projectWildsBlinkProfile(identity: string, cadenceMs = 2800 + wildsFaceUnit(identity, 71) * 3000): WildsBlinkProfile {
  const cadence = Number.isFinite(cadenceMs) && cadenceMs > 300 ? cadenceMs : 4100;
  return Object.freeze({
    cadenceMs: cadence,
    phaseMs: wildsFaceUnit(identity, 73) * cadence,
    closeMs: 42 + wildsFaceUnit(identity, 79) * 26,
    holdMs: 8 + wildsFaceUnit(identity, 83) * 18,
    openMs: 78 + wildsFaceUnit(identity, 89) * 52
  });
}

function ease(value: number) { return value * value * (3 - 2 * value); }

/** One scalar per face; no allocations, timers, state updates, hashes or I/O. */
export function sampleWildsBlink(profile: WildsBlinkProfile, timeMs: number, sleeping = false, motionScale = 1) {
  if (sleeping) return 1;
  if (motionScale <= 0 || !Number.isFinite(timeMs)) return 0;
  const phase = ((timeMs + profile.phaseMs) % profile.cadenceMs + profile.cadenceMs) % profile.cadenceMs;
  if (phase < profile.closeMs) return ease(phase / profile.closeMs);
  if (phase < profile.closeMs + profile.holdMs) return 1;
  if (phase < profile.closeMs + profile.holdMs + profile.openMs) return 1 - ease((phase - profile.closeMs - profile.holdMs) / profile.openMs);
  return 0;
}
