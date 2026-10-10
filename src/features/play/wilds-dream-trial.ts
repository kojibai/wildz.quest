import { deriveKaiKlokMomentFromUPulse } from "./kai-klok-moment";
import { deriveKaiMomentExpression } from "./kai-klok-teachings";
import { sha256PortableBasis } from "./portable-card";

export const WILDS_DREAM_RUNES = ["Root", "Flow", "Flame", "Light"] as const;
export const WILDS_DREAM_PREVIEW_UPULSES = 500_000;
export const WILDS_DREAM_ECHO_UPULSES = 14_000_000;
export type WildsDreamTap = Readonly<{ rune: number; uPulse: number }>;
export type WildsDreamTrial = Readonly<{
  schema: "wildz.dream-trial.v1";
  id: string;
  assetId: string;
  enteredUPulse: number;
  rounds: readonly (readonly number[])[];
}>;

export function createWildsDreamTrial(assetId: string, enteredUPulse: number): WildsDreamTrial {
  if (!assetId || !Number.isSafeInteger(enteredUPulse) || enteredUPulse < 0) throw Error("wilds_dream_coordinate_invalid");
  const moment = deriveKaiKlokMomentFromUPulse({uPulse: enteredUPulse, authority: "local"});
  const seed = sha256PortableBasis(`wildz:dream:v1:${assetId}:${moment.latticeCoordinate}:${enteredUPulse}`).replace(/^sha256:/, "");
  const rounds = [2, 3, 4].map((length, round) => Array.from({length}, (_, index) => parseInt(seed[(round * 9 + index) % seed.length], 16) % 4));
  return {schema: "wildz.dream-trial.v1", id: `dream:${assetId}:${enteredUPulse}`, assetId, enteredUPulse, rounds};
}

export function wildsDreamStory(trial: WildsDreamTrial) {
  const moment = deriveKaiKlokMomentFromUPulse({uPulse: trial.enteredUPulse, authority: "local"});
  const expression = deriveKaiMomentExpression(moment);
  return { moment, expression, title: `${expression.ark.name} · The Echo Race`,
    opening: `${expression.day.name} opens a path through ${expression.month.name}. ${expression.ark.meaning}`,
    objective: `Recover three scattered patterns before your dream echo reaches the gate. ${expression.day.meaning}` };
}

/** Solo practice replay. A UI win flag never awards growth or competitive standing. */
export function verifyWildsDreamTrial(trial: WildsDreamTrial, taps: readonly WildsDreamTap[], completedUPulse: number): boolean {
  try {
    if (JSON.stringify(trial) !== JSON.stringify(createWildsDreamTrial(trial.assetId, trial.enteredUPulse))) return false;
    if (!Number.isSafeInteger(completedUPulse) || completedUPulse < trial.enteredUPulse || completedUPulse > trial.enteredUPulse + WILDS_DREAM_ECHO_UPULSES) return false;
    if (taps.length !== 9) return false;
    let previous = trial.enteredUPulse, index = 0;
    for (const round of trial.rounds) {
      const ready = previous + WILDS_DREAM_PREVIEW_UPULSES;
      for (let step = 0; step < round.length; step++) {
        const tap = taps[index++];
        if (tap.rune !== round[step] || !Number.isSafeInteger(tap.uPulse) || tap.uPulse <= previous || tap.uPulse > completedUPulse || (step === 0 && tap.uPulse < ready)) return false;
        previous = tap.uPulse;
      }
    }
    return true;
  } catch { return false; }
}
