import type { EncounterState } from "./encounter-state";

export type WildsDiscoveryHintMedium = "ground" | "water" | "air";

export function projectWildsDiscoveryHint(encounter: EncounterState) {
  if (encounter.phase !== "hint") return null;
  const placement = encounter.placement;
  const medium: WildsDiscoveryHintMedium = placement?.layer === "air"
    ? "air"
    : placement?.layer === "surface" || placement?.layer === "water-column" || placement?.layer === "seabed"
      ? "water"
      : "ground";
  const point = medium === "air" && placement
    ? Object.freeze({ x: placement.x, z: placement.z, surfaceWorldY: placement.worldY })
    : Object.freeze({ ...encounter.searchPoint });
  return Object.freeze({
    medium,
    point,
    showHabitatCover: medium !== "air",
    activateOnSignal: medium === "air"
  });
}
