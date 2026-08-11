import {
  deriveKaiKlokMoment,
  deriveKaiKlokMomentFromUPulse,
  type KaiKlokMoment
} from "./kai-klok-moment";
import { wildsWorldCursorUPulse, type WildsWorldProjection } from "./wilds-world-state";

type WildsRuntimeMode = "receiz_live" | "kai_live" | "offline" | "local" | string;

export function resolveWildsRuntimeKaiMoment(input: {
  mode: WildsRuntimeMode;
  observedAt: string;
  cursor: WildsWorldProjection["cursor"];
}): KaiKlokMoment {
  if ((input.mode === "receiz_live" || input.mode === "kai_live") && input.cursor) {
    return deriveKaiKlokMomentFromUPulse({
      uPulse: wildsWorldCursorUPulse(input.cursor),
      authority: "world"
    });
  }
  return deriveKaiKlokMoment({ occurredAt: input.observedAt, authority: "local" });
}
