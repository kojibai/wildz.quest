import type { WildsWeather } from "./wilds-biome";

export type WildsAudioActivity = "idle" | "travel" | "discovery" | "combat" | "recovery" | "ritual";
export type WildsAudioCombatPhase = "none" | "opening" | "pressure" | "final" | "victory" | "defeat";
export type WildsVitalityBand = "healthy" | "strained" | "critical" | "retired";

export type WildsAudioScene = {
  position: Readonly<{ x: number; z: number }>;
  biome: string;
  districtId: string | null;
  landmark: "mortal-arena" | string | null;
  arenaProximity: "inside" | "near" | "far";
  weather: WildsWeather;
  time: "day" | "night";
  activity: WildsAudioActivity;
  threat: number;
  combatPhase: WildsAudioCombatPhase;
  vitalityBand: WildsVitalityBand;
  memorial: boolean;
  victorySacrifice: boolean;
  reducedMotion: boolean;
};

export type WildsAudioSceneInput = Partial<Omit<WildsAudioScene, "position" | "landmark" | "arenaProximity">> & {
  position: Readonly<{ x: number; z: number }>;
  landmark?: WildsAudioScene["landmark"];
};

const ARENA_RADIUS = 12;
const ARENA_APPROACH_RADIUS = 24;

export function projectWildsAudioScene(input: WildsAudioSceneInput): WildsAudioScene {
  const distanceToArena = Math.hypot(input.position.x, input.position.z);
  const arenaProximity = distanceToArena <= ARENA_RADIUS ? "inside" : distanceToArena <= ARENA_APPROACH_RADIUS ? "near" : "far";
  return {
    position: input.position,
    biome: input.biome ?? "heartwood",
    districtId: input.districtId ?? null,
    landmark: input.landmark ?? (arenaProximity === "inside" ? "mortal-arena" : null),
    arenaProximity,
    weather: input.weather ?? "clear",
    time: input.time ?? "day",
    activity: input.activity ?? "idle",
    threat: Math.max(0, Math.min(1, input.threat ?? 0)),
    combatPhase: input.combatPhase ?? "none",
    vitalityBand: input.vitalityBand ?? "healthy",
    memorial: input.memorial ?? false,
    victorySacrifice: input.victorySacrifice ?? false,
    reducedMotion: input.reducedMotion ?? false
  };
}
