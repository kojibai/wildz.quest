export type MortalityWarning = "safe" | "strained" | "grave" | "final";

export function projectMortalityWarning(fighter: { vitality: number; maxVitality: number }, nextKnownDamage = 0): MortalityWarning {
  if (fighter.vitality <= nextKnownDamage) return "final";
  const ratio = fighter.maxVitality <= 0 ? 0 : fighter.vitality / fighter.maxVitality;
  return ratio <= .15 ? "grave" : ratio <= .35 ? "strained" : "safe";
}

export function completeMortalResult(input: {
  matchId: string;
  creatureId: string;
  vitality: number;
  outcome: "victory" | "defeat" | "draw" | "fled";
  mortal: boolean;
}) {
  const retired = input.mortal && input.vitality <= 0;
  return {
    ...input,
    events: retired ? [{
      kind: "retirement" as const,
      creatureId: input.creatureId,
      matchId: input.matchId,
      honor: input.outcome === "victory" ? "victorious-sacrifice" as const : "fallen" as const
    }] : []
  };
}
