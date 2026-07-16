import type { LivingCardLifeSnapshot } from "../../play/living-card-types";

export function projectCreatureCondition(life: Readonly<LivingCardLifeSnapshot>) {
  const ratio = life.maxVitality <= 0 ? 0 : life.vitality / life.maxVitality;
  return {
    playable: !life.retired,
    vitalityBand: life.retired ? "retired" as const : ratio <= .15 ? "grave" as const : ratio <= .35 ? "strained" as const : "healthy" as const,
    mobilityPermille: life.retired ? 0 : ratio <= .15 ? 720 : ratio <= .35 ? 860 : 1000,
    unresolvedInjuries: life.injuries
  };
}
