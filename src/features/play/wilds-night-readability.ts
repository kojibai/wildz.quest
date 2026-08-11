export type WildsAuthoredDarkness = Readonly<{
  amount: number;
  source: "none" | "cave" | "storm";
}>;

type DarknessEncounter = Readonly<{
  phase: string;
  cover?: string;
}>;

type DarknessEcologySite = Readonly<{
  familyId: string;
  phase: string;
  position: Readonly<{ x: number; z: number }>;
  radius: number;
}>;

const CAVE_INTERIOR_PHASES = new Set([
  "battle_intro",
  "player_turn",
  "capture_ready",
  "emerging",
  "capsule",
  "sealed",
  "revealed"
]);

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function projectWildsAuthoredDarkness(input: Readonly<{
  encounter: DarknessEncounter;
  player: Readonly<{ x: number; z: number }>;
  ecologySites: readonly DarknessEcologySite[];
}>): WildsAuthoredDarkness {
  const caveAmount = input.encounter.cover === "cave" && CAVE_INTERIOR_PHASES.has(input.encounter.phase) ? 0.82 : 0;
  const stormAmount = input.ecologySites.reduce((maximum, site) => {
    if (site.familyId !== "stormfront" || site.phase === "expired" || site.phase === "historical") return maximum;
    const radius = Math.max(0, site.radius);
    const distance = Math.hypot(site.position.x - input.player.x, site.position.z - input.player.z);
    const falloff = 1 - Math.max(0, distance - radius) / 10;
    return Math.max(maximum, 0.68 * clamp01(falloff));
  }, 0);

  if (caveAmount >= stormAmount && caveAmount > 0) return { amount: caveAmount, source: "cave" };
  if (stormAmount > 0) return { amount: stormAmount, source: "storm" };
  return { amount: 0, source: "none" };
}

export type WildsReadabilityProfile = Readonly<{
  darkness: number;
  actorEmissive: number;
  pathEmissive: number;
  threatEmissive: number;
  motionScale: 0 | 1;
}>;

export function projectWildsReadabilityProfile(input: Readonly<{
  authoredDarkness: number;
  characterFill: number;
  nightAmount: number;
  reducedMotion: boolean;
  rim: number;
}>): WildsReadabilityProfile {
  const darkness = clamp01(Math.max(input.nightAmount, input.authoredDarkness));
  const actorEmissive = clamp01(darkness * 0.12 + input.characterFill * 0.025 + input.rim * 0.015);
  return {
    darkness,
    actorEmissive,
    pathEmissive: darkness * 0.11,
    threatEmissive: darkness * 0.32 + actorEmissive,
    motionScale: input.reducedMotion ? 0 : 1
  };
}
