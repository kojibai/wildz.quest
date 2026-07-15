export type WorldMasteryVerb = "travel" | "battle" | "capture" | "training" | "mission" | "lineage" | "ascension";

export type WildsWorldChapter = {
  id: "verdant-crown" | "ember-reach" | "tidal-lanterns" | "skyglass-expanse" | "umbral-bloom";
  name: string;
  element: "Grove" | "Ember" | "Tide" | "Spark" | "Prism";
  objective: string;
  palette: { ground: string; fog: string; canopy: string; accent: string };
  eventNames: readonly [string, string, string];
};

export const WILDS_WORLD_CHAPTERS: readonly WildsWorldChapter[] = [
  { id: "verdant-crown", name: "Verdant Crown", element: "Grove", objective: "Restore the Hearttree trails", palette: { ground: "#4f9254", fog: "#91dca7", canopy: "#246b46", accent: "#d9ff9f" }, eventNames: ["Hearttree Bloom", "Rootway Rescue", "Crownkeeper Titan"] },
  { id: "ember-reach", name: "Ember Reach", element: "Ember", objective: "Temper the singing calderas", palette: { ground: "#9a5942", fog: "#e5a477", canopy: "#6f3d3a", accent: "#ffcf72" }, eventNames: ["Cinderfall Caravan", "Lanternforge Rush", "Ashmane Titan"] },
  { id: "tidal-lanterns", name: "Tidal Lanterns", element: "Tide", objective: "Relight the drifting reefways", palette: { ground: "#398a8a", fog: "#80d5d2", canopy: "#276a78", accent: "#b9f5ff" }, eventNames: ["Moonreef Chorus", "Lantern Current", "Abyssal Titan"] },
  { id: "skyglass-expanse", name: "Skyglass Expanse", element: "Spark", objective: "Reconnect the storm mirrors", palette: { ground: "#657bc1", fog: "#b8c9ff", canopy: "#495a9a", accent: "#fff0a8" }, eventNames: ["Cloudrail Relay", "Mirrorstorm", "Thunderwing Titan"] },
  { id: "umbral-bloom", name: "Umbral Bloom", element: "Prism", objective: "Wake the nocturne gardens", palette: { ground: "#655483", fog: "#b59ad7", canopy: "#443861", accent: "#ffd0f1" }, eventNames: ["Dreamspore Dance", "Prismroot Vigil", "Eclipse Titan"] }
] as const;

const masteryAwards: Readonly<Record<WorldMasteryVerb, number>> = {
  travel: 1,
  battle: 8,
  capture: 18,
  training: 3,
  mission: 25,
  lineage: 45,
  ascension: 60
};

export function worldMasteryAward(verb: WorldMasteryVerb) {
  return masteryAwards[verb];
}

export function projectWorldProgression(rawMastery: number) {
  const mastery = Math.max(0, Math.floor(Number.isFinite(rawMastery) ? rawMastery : 0));
  const chapterSpan = 100;
  const fullCycleSpan = chapterSpan * WILDS_WORLD_CHAPTERS.length;
  const cycle = Math.floor(mastery / fullCycleSpan) + 1;
  const chapterIndex = Math.floor((mastery % fullCycleSpan) / chapterSpan);
  const chapter = WILDS_WORLD_CHAPTERS[chapterIndex]!;
  const chapterMastery = mastery % chapterSpan;
  const eventIndex = (cycle + chapterIndex * 2) % chapter.eventNames.length;
  const target = 3 + cycle * 2 + chapterIndex;
  return {
    mastery,
    cycle,
    chapterIndex,
    chapter,
    chapterMastery,
    nextChapterAt: mastery + (chapterSpan - chapterMastery),
    worldEvent: {
      id: `${chapter.id}:cycle-${cycle}:event-${eventIndex}`,
      chapterId: chapter.id,
      name: chapter.eventNames[eventIndex]!,
      objective: eventIndex === 2 ? `Win ${target} Titan rounds` : eventIndex === 1 ? `Complete ${target} mastery actions` : `Discover ${target} habitat signals`,
      target,
      titan: eventIndex === 2
    }
  } as const;
}
