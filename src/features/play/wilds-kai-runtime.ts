import {
  deriveKaiKlokMoment,
  deriveKaiKlokMomentFromUPulse,
  KAI_PULSE_DURATION_MS,
  type KaiKlokMoment
} from "./kai-klok-moment";
import type { WildsWorldProjection } from "./wilds-world-state";

type WildsRuntimeMode = "receiz_live" | "kai_live" | "offline" | "local" | string;

function safeUPulse(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("wilds_kai_runtime_upulse_invalid");
  return value;
}

export function observeWildsKaiUPulse(epochMs = Date.now()) {
  if (!Number.isFinite(epochMs)) throw new Error("wilds_kai_runtime_observation_invalid");
  return deriveKaiKlokMoment({
    occurredAt: new Date(Math.trunc(epochMs)).toISOString(),
    authority: "local"
  }).uPulse;
}

export function createWildsKaiRuntimeClock(input: {
  baselineUPulse: number;
  baselineElapsedMs?: number;
  floorUPulse?: number;
}) {
  const baselineUPulse = safeUPulse(input.baselineUPulse);
  const baselineElapsedMs = input.baselineElapsedMs ?? 0;
  if (!Number.isFinite(baselineElapsedMs)) throw new Error("wilds_kai_runtime_elapsed_invalid");
  let floorUPulse = Math.max(baselineUPulse, safeUPulse(input.floorUPulse ?? baselineUPulse));

  return {
    read(elapsedMs: number, observedUPulse?: number) {
      if (!Number.isFinite(elapsedMs)) throw new Error("wilds_kai_runtime_elapsed_invalid");
      const elapsed = Math.max(0, elapsedMs - baselineElapsedMs);
      const projected = safeUPulse(baselineUPulse + Math.floor(elapsed / KAI_PULSE_DURATION_MS * 1_000_000));
      const observed = observedUPulse === undefined ? 0 : safeUPulse(observedUPulse);
      floorUPulse = Math.max(floorUPulse, projected, observed);
      return floorUPulse;
    }
  };
}

export function resolveWildsRuntimeKaiMoment(input: {
  mode: WildsRuntimeMode;
  uPulse: number;
  cursor: WildsWorldProjection["cursor"];
}): KaiKlokMoment {
  const authority = input.mode === "receiz_live" || input.mode === "kai_live" ? "world" : "local";
  return deriveKaiKlokMomentFromUPulse({ uPulse: safeUPulse(input.uPulse), authority });
}
