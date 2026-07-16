import type { LivingCardLifeSnapshot } from "../../play/living-card-types";

export function projectCreatureAppearanceHistory(life: Readonly<LivingCardLifeSnapshot>) {
  const open = life.injuries.map((id) => ({ id, kind: "injury" as const, intensity: 1 }));
  const repaired = life.repairedScars.map((id) => ({ id, kind: "repaired-scar" as const, intensity: .46 }));
  return {
    marks: [...open, ...repaired],
    posture: life.retired ? "memorial" as const : life.vitality / life.maxVitality <= .15 ? "weary" as const : "living" as const,
    historyWeight: Math.min(1, (life.victories + life.losses + life.retreats + repaired.length) / 20)
  };
}
