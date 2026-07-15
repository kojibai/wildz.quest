import { projectWorldProgression } from "./world-progression";

export type WildsWeather = "clear" | "sun-shower" | "pollen-drift";

export type WildsLandmark = {
  kind: "hearttree-sanctum" | "root-arch" | "spring" | "none";
  rotation: number;
  scale: number;
};

export type WildsBiomeTile = {
  seed: number;
  ground: { base: string; moss: string; soil: string };
  trail: { base: string; edge: string };
  canopy: { deep: string; mid: string; highlight: string };
  weather: WildsWeather;
  landmark: WildsLandmark;
  ecology: {
    treeCount: number;
    bushCount: number;
    rockCount: number;
    flowerCount: number;
  };
  luminosity: number;
  chapterId: string;
};

function hashTile(x: number, z: number, salt = 0) {
  let value = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(z ^ salt, 0xc2b2ae35);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  return value >>> 0;
}

function unit(seed: number, salt: number) {
  return hashTile(seed, salt, 0x27d4eb2d) / 0xffffffff;
}

function count(seed: number, salt: number, min: number, max: number) {
  return min + Math.floor(unit(seed, salt) * (max - min + 1));
}

export function projectWildsBiome(tileX: number, tileZ: number, missionProgress: number, worldMastery = 0): WildsBiomeTile {
  const seed = hashTile(tileX, tileZ);
  const world = projectWorldProgression(worldMastery);
  const mastery = Math.max(0, Math.min(1, missionProgress / 100));
  const weatherRoll = unit(seed, 19);
  const landmarkRoll = unit(seed, 37);
  const landmark: WildsLandmark = tileX === 0 && tileZ === 0
    ? { kind: "hearttree-sanctum", rotation: 0.18, scale: 1.08 }
    : landmarkRoll > 0.91
      ? { kind: "root-arch", rotation: unit(seed, 41) * Math.PI, scale: 0.88 + unit(seed, 43) * 0.28 }
      : landmarkRoll < 0.075
        ? { kind: "spring", rotation: unit(seed, 47) * Math.PI, scale: 0.86 + unit(seed, 53) * 0.24 }
        : { kind: "none", rotation: 0, scale: 1 };

  return {
    seed,
    ground: { base: world.chapter.palette.ground, moss: world.chapter.palette.accent, soil: world.chapter.palette.canopy },
    trail: { base: "#cbb778", edge: "#9b8b56" },
    canopy: { deep: world.chapter.palette.canopy, mid: world.chapter.palette.ground, highlight: world.chapter.palette.accent },
    weather: weatherRoll > 0.78 ? "sun-shower" : weatherRoll < 0.22 ? "pollen-drift" : "clear",
    landmark,
    ecology: {
      treeCount: count(seed, 61, 2, 5),
      bushCount: count(seed, 67, 4, 8),
      rockCount: count(seed, 71, 1, 4),
      flowerCount: count(seed, 73, 2, 5) + Math.floor(mastery * 4)
    },
    luminosity: 0.74 + mastery * 0.18 + unit(seed, 79) * 0.06,
    chapterId: world.chapter.id
  };
}
