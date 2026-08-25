import type { WildsMaterialLotV1 } from "./wilds-steward-construction";
import { selectWildsTrailBridgeRotation } from "./wilds-steward-construction";
import { sampleWildsTerrain } from "./wilds-terrain-authority";
import type { WildsWorkCapabilityMeter } from "./wilds-work-capability";

export type WildsStewardBlueprintId = "trail-shelter" | "trail-bridge" | "steward-workbench" | "trail-cache";

export type WildsStewardBlueprintDefinition = Readonly<{
  id: WildsStewardBlueprintId;
  label: string;
  purpose: string;
  placement: string;
  materials: Readonly<{ timber: number; stone: number }>;
}>;

export type WildsStewardPlacement = Readonly<{
  blueprintId: WildsStewardBlueprintId;
  point: Readonly<{ x: number; z: number }>;
  rotationQuarterTurns: 0 | 1;
  valid: boolean;
  reason: string | null;
}>;

export const WILDS_STEWARD_BLUEPRINTS: readonly WildsStewardBlueprintDefinition[] = Object.freeze([
  Object.freeze({
    id: "trail-shelter" as const,
    label: "Trail Shelter",
    purpose: "A persistent public place to recover beside bonded creatures.",
    placement: "Reachable dry ground",
    materials: Object.freeze({ timber: 2, stone: 1 })
  }),
  Object.freeze({
    id: "trail-bridge" as const,
    label: "Trail Bridge",
    purpose: "A persistent public crossing between two safe banks.",
    placement: "Water between level banks",
    materials: Object.freeze({ timber: 4, stone: 2 })
  }),
  Object.freeze({
    id: "steward-workbench" as const,
    label: "Steward Workbench",
    purpose: "A persistent station where exact material lots become proof-bound field tools.",
    placement: "Reachable dry ground",
    materials: Object.freeze({ timber: 3, stone: 2 })
  }),
  Object.freeze({
    id: "trail-cache" as const,
    label: "Trail Cache",
    purpose: "Persistent exact-lot storage that keeps gathered materials safe without changing their proof.",
    placement: "Reachable dry ground",
    materials: Object.freeze({ timber: 2, stone: 2 })
  })
]);

function finitePoint(point: Readonly<{ x: number; z: number }>) {
  return Number.isFinite(point.x) && Number.isFinite(point.z)
    && Math.abs(point.x) <= 500_000_000 && Math.abs(point.z) <= 500_000_000;
}

export function projectWildsStewardCraft(input: Readonly<{
  activeCreatureName: string;
  materialLots: readonly Pick<WildsMaterialLotV1, "kind" | "lotId">[];
  pending: boolean;
  selectedBlueprintId: WildsStewardBlueprintId | null;
  workMeters: readonly WildsWorkCapabilityMeter[];
}>) {
  const timber = input.materialLots.filter((lot) => lot.kind === "timber").length;
  const stone = input.materialLots.filter((lot) => lot.kind === "stone").length;
  const capacity = input.workMeters.length ? Math.min(...input.workMeters.map((meter) => meter.value)) : 0;
  const recovering = input.workMeters.length === 0 || input.workMeters.every((meter) => meter.state === "recovering");
  const partner = Object.freeze({
    name: input.activeCreatureName || "No active companion",
    capacity,
    ready: !recovering,
    families: Object.freeze(input.workMeters.map((meter) => meter.label))
  });
  const blueprints = Object.freeze(WILDS_STEWARD_BLUEPRINTS.map((definition) => {
    const missing = Object.freeze({
      timber: Math.max(0, definition.materials.timber - timber),
      stone: Math.max(0, definition.materials.stone - stone)
    });
    const progressiveSite = definition.id === "trail-shelter" || definition.id === "trail-bridge";
    const state = input.pending ? "pending" as const
      : progressiveSite ? "ready" as const
        : !partner.ready ? "partner" as const
          : missing.timber > 0 || missing.stone > 0 ? "materials" as const
            : "ready" as const;
    return Object.freeze({
      ...definition,
      missing,
      selected: input.selectedBlueprintId === definition.id,
      state
    });
  }));
  return Object.freeze({ materials: Object.freeze({ timber, stone }), partner, blueprints });
}

export function projectWildsStewardPlacement(input: Readonly<{
  actorPosition: Readonly<{ x: number; z: number }>;
  blueprintId: WildsStewardBlueprintId;
  point: Readonly<{ x: number; z: number }>;
}>): WildsStewardPlacement {
  if (!finitePoint(input.actorPosition) || !finitePoint(input.point)) throw new Error("wilds_steward_placement_position_invalid");
  const point = Object.freeze({ x: input.point.x, z: input.point.z });
  if (Math.hypot(point.x - input.actorPosition.x, point.z - input.actorPosition.z) > 7) {
    return Object.freeze({ blueprintId: input.blueprintId, point, rotationQuarterTurns: 0, valid: false, reason: "Move within reach before placing." });
  }
  if (input.blueprintId === "trail-bridge") {
    const rotationQuarterTurns = selectWildsTrailBridgeRotation(point);
    return rotationQuarterTurns === null
      ? Object.freeze({ blueprintId: input.blueprintId, point, rotationQuarterTurns: 0, valid: false, reason: "Choose water held between two nearby level banks." })
      : Object.freeze({ blueprintId: input.blueprintId, point, rotationQuarterTurns, valid: true, reason: null });
  }
  const terrain = sampleWildsTerrain(point.x, point.z);
  const water = terrain.surface === "shallow-water" || terrain.surface === "deep-water";
  return water
    ? Object.freeze({ blueprintId: input.blueprintId, point, rotationQuarterTurns: 0, valid: false, reason: "Choose living ground above the waterline." })
    : Object.freeze({ blueprintId: input.blueprintId, point, rotationQuarterTurns: 0, valid: true, reason: null });
}
