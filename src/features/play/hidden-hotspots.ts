import { creatureFamilies, creatureForm } from "./creature-catalog";

export const ENCOUNTER_REGION_SIZE = 24;
const HOTSPOTS_PER_REGION = 6;
const MAX_NEARBY_HOTSPOTS = 24;

export type HotspotCover = "grass" | "flowers" | "tree" | "rock" | "cave" | "water" | "ruin" | "energy";

export type HiddenHotspot = {
  id: string;
  familyId: string;
  formId: string;
  regionX: number;
  regionZ: number;
  position: { x: number; z: number };
  cover: HotspotCover;
  hitRadius: 1.15;
  hintRadius: 4.5;
};

export type HotspotSearchResult =
  | { kind: "hit"; hotspot: HiddenHotspot; distance: number }
  | { kind: "near_miss"; hotspot: HiddenHotspot; distance: number; direction: { x: number; z: number } }
  | { kind: "empty" }
  | { kind: "captured"; hotspot: HiddenHotspot; distance: number };

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function seededUnit(x: number, z: number, salt: number) {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function coverForHabitat(habitat: string, familyIndex: number): HotspotCover {
  const value = habitat.toLowerCase();
  if (/water|tide|reef|river|marsh|lagoon|lake|rain/.test(value)) return "water";
  if (/cave|den|hollow|burrow|tunnel|underground/.test(value)) return "cave";
  if (/ruin|temple|archive|vault|station|market/.test(value)) return "ruin";
  if (/spark|storm|energy|ember|frost|crystal|solar/.test(value)) return "energy";
  if (/rock|ridge|mountain|cliff|canyon/.test(value)) return "rock";
  if (/forest|grove|wood|canopy|jungle/.test(value)) return "tree";
  if (/flower|meadow|garden|bloom/.test(value)) return "flowers";
  return (["grass", "flowers", "tree", "rock"] as const)[familyIndex % 4]!;
}

function distance(left: { x: number; z: number }, right: { x: number; z: number }) {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

export function hotspotsForRegion(regionX: number, regionZ: number): HiddenHotspot[] {
  return Array.from({ length: HOTSPOTS_PER_REGION }, (_, slot) => {
    const familyIndex = modulo((regionX + regionZ * 31) * HOTSPOTS_PER_REGION + slot, creatureFamilies.length);
    const family = creatureFamilies[familyIndex]!;
    const form = creatureForm(family.formIds[0])!;
    const inset = 2.25;
    const span = ENCOUNTER_REGION_SIZE - inset * 2;
    return {
      id: `hotspot:${regionX}:${regionZ}:${slot}:${family.id}`,
      familyId: family.id,
      formId: family.formIds[0],
      regionX,
      regionZ,
      position: {
        x: regionX * ENCOUNTER_REGION_SIZE + inset + seededUnit(regionX, regionZ, slot * 2 + 1) * span,
        z: regionZ * ENCOUNTER_REGION_SIZE + inset + seededUnit(regionZ, regionX, slot * 2 + 2) * span
      },
      cover: coverForHabitat(form.habitat, familyIndex),
      hitRadius: 1.15,
      hintRadius: 4.5
    };
  });
}

export function nearbyHiddenHotspots(player: { x: number; z: number }): HiddenHotspot[] {
  const regionX = Math.floor(player.x / ENCOUNTER_REGION_SIZE);
  const regionZ = Math.floor(player.z / ENCOUNTER_REGION_SIZE);
  const hotspots: HiddenHotspot[] = [];
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) hotspots.push(...hotspotsForRegion(regionX + dx, regionZ + dz));
  }
  return hotspots
    .sort((left, right) => distance(left.position, player) - distance(right.position, player))
    .slice(0, MAX_NEARBY_HOTSPOTS);
}

export function searchHiddenHotspots(
  hotspots: readonly HiddenHotspot[],
  point: { x: number; z: number },
  capturedHotspotIds: readonly string[]
): HotspotSearchResult {
  const closest = hotspots
    .map((hotspot) => ({ hotspot, distance: distance(hotspot.position, point) }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (!closest || closest.distance > closest.hotspot.hintRadius) return { kind: "empty" };
  if (closest.distance <= closest.hotspot.hitRadius) {
    return capturedHotspotIds.includes(closest.hotspot.id)
      ? { kind: "captured", ...closest }
      : { kind: "hit", ...closest };
  }
  const magnitude = Math.max(closest.distance, Number.EPSILON);
  return {
    kind: "near_miss",
    ...closest,
    direction: {
      x: (closest.hotspot.position.x - point.x) / magnitude,
      z: (closest.hotspot.position.z - point.z) / magnitude
    }
  };
}
