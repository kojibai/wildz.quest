import { deriveKaiKlokMoment, type KaiKlokMoment } from "./kai-klok-moment";
import type { WildsWorldProjection } from "./wilds-world-state";

type WildsRuntimeMode = "receiz_live" | "kai_live" | "offline" | "local" | string;

export function resolveWildsRuntimeKaiMoment(input: {
  mode: WildsRuntimeMode;
  observedAt: string;
  cursor: WildsWorldProjection["cursor"];
}): KaiKlokMoment {
  // Restore the original live-clock contract: current Kai is always counted
  // forward from Genesis. A persisted cursor orders events; it is never now.
  const authority = input.mode === "receiz_live" || input.mode === "kai_live" ? "world" : "local";
  return deriveKaiKlokMoment({ occurredAt: input.observedAt, authority });
}
