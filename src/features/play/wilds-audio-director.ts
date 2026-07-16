import type { WildsAudioScene } from "./wilds-audio-scene";

export type WildsAudioProgram = {
  id: string;
  priority: number;
  layers: readonly string[];
  crossfadeSeconds: number;
};

export type WildsAudioMemory = {
  activeProgramId: string | null;
  enteredAt: number;
  recent: readonly string[];
};

const EXPLORATION = "exploration-theme";
const FOREST = "forest-ambience";
const ARENA = "mortal-arena-boss";

function program(id: string, priority: number, layers: readonly string[], crossfadeSeconds = 2.4): WildsAudioProgram {
  return { id, priority, layers, crossfadeSeconds };
}

function programForId(id: string): WildsAudioProgram {
  if (id === "canonical-retirement") return program(id, 100, [FOREST], 3.6);
  if (id === "victory-sacrifice") return program(id, 95, [ARENA, "receiz-kai-turah-signature"], 3.2);
  if (id === "mortal-arena-final") return program(id, 90, [ARENA, "arena-final-pulse"], 1.1);
  if (id === "mortal-arena-combat") return program(id, 80, [ARENA, "arena-combat-pulse"], 1.35);
  if (id === "mortal-arena-idle") return program(id, 70, [ARENA, FOREST, "arena-dormant-pulse"], 1.8);
  if (id === "mortal-arena-approach") return program(id, 60, [EXPLORATION, FOREST, "arena-distant-pulse"]);
  if (id.startsWith("district-")) return program(id, 50, [EXPLORATION, FOREST, `motif-${id}`]);
  return program(id, 40, [EXPLORATION, FOREST]);
}

function candidatesFor(scene: WildsAudioScene): WildsAudioProgram[] {
  const candidates: WildsAudioProgram[] = [];
  if (scene.vitalityBand === "retired") candidates.push(programForId("canonical-retirement"));
  else if (scene.memorial && scene.victorySacrifice) candidates.push(programForId("victory-sacrifice"));
  if (scene.activity === "combat" && scene.landmark === "mortal-arena") {
    candidates.push(programForId(scene.combatPhase === "final" || scene.vitalityBand === "critical" ? "mortal-arena-final" : "mortal-arena-combat"));
  }
  if (scene.landmark === "mortal-arena" && scene.activity !== "combat") candidates.push(programForId("mortal-arena-idle"));
  if (scene.arenaProximity === "near") candidates.push(programForId("mortal-arena-approach"));
  if (scene.districtId) candidates.push(programForId(`district-${scene.districtId}`));
  const biome = programForId(`biome-${scene.biome}`);
  const weatherLayer = scene.weather === "pollen-drift" ? "weather-pollen" : scene.weather === "sun-shower" ? "weather-rain" : null;
  candidates.push(weatherLayer ? { ...biome, layers: [...biome.layers, weatherLayer] } : biome);
  return candidates.sort((left, right) => right.priority - left.priority);
}

export function selectWildsAudioProgram(scene: WildsAudioScene, memory: WildsAudioMemory, now = Date.now()): WildsAudioProgram {
  const candidates = candidatesFor(scene);
  const preferred = candidates.find((candidate) => !memory.recent.slice(-2).includes(candidate.id)) ?? candidates[0];
  if (memory.activeProgramId && now - memory.enteredAt < 4_000) {
    const active = programForId(memory.activeProgramId);
    if (preferred.priority <= active.priority) return active;
  }
  return preferred;
}
