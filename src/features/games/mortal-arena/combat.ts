import type { ArenaAffinity, MortalArenaFighter } from "./types";

export type ArenaHit = { damage: number; breakDamage: number; launch: number; affinity: ArenaAffinity };
const ADVANTAGE: Readonly<Record<ArenaAffinity, ArenaAffinity>> = { Grove: "Tide", Tide: "Ember", Ember: "Grove", Spark: "Stone", Stone: "Prism", Prism: "Spark" };

export function projectMatchupModifiers(attacker: ArenaAffinity, defender: ArenaAffinity) {
  return { damagePermille: ADVANTAGE[attacker] === defender ? 1350 : ADVANTAGE[defender] === attacker ? 650 : 1000 };
}

export function resolveArenaHit(defender: Readonly<MortalArenaFighter>, hit: ArenaHit, tick: number) {
  const perfectGuard = defender.guarding && defender.guardStartedTick !== null && tick - defender.guardStartedTick <= 4;
  const guarding = defender.guarding;
  const affinity = projectMatchupModifiers(hit.affinity, defender.affinity).damagePermille;
  const baseDamage = Math.max(1, Math.round(hit.damage * affinity / 1_000));
  const damage = Math.max(1, Math.round(baseDamage * (perfectGuard ? .12 : guarding ? .42 : 1)));
  const nextBreak = perfectGuard
    ? Math.min(defender.maxBreak, defender.break + Math.round(hit.breakDamage * .45))
    : Math.max(0, defender.break - Math.round(hit.breakDamage * (guarding ? .7 : 1)));
  const launch = perfectGuard ? 0 : Math.round(hit.launch * (nextBreak === 0 ? 1.7 : 1));
  return {
    fighter: {
      ...defender,
      vitality: Math.max(0, defender.vitality - damage),
      break: nextBreak,
      velocity: { ...defender.velocity, x: defender.velocity.x + launch * -defender.facing },
      recoveryTicks: Math.max(defender.recoveryTicks, nextBreak === 0 ? 22 : 8)
    },
    damage,
    perfectGuard
  };
}

export function arenaHitFor(attacker: Readonly<MortalArenaFighter>, kind: "light" | "heavy"): ArenaHit {
  return kind === "light"
    ? { damage: Math.max(36, Math.round(attacker.power * .55)), breakDamage: 54, launch: 70, affinity: attacker.affinity }
    : { damage: Math.max(72, attacker.power), breakDamage: 120, launch: 150, affinity: attacker.affinity };
}
