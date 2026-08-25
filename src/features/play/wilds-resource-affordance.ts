import type { WildsResourceKind } from "./wilds-resource-authority";

export type WildsResourceAffordanceState = "approach" | "ready" | "companion" | "rest" | "working" | "recovering";

export type WildsResourceAffordance = Readonly<{
  state: WildsResourceAffordanceState;
  label: string;
  guidance: string;
  enabled: boolean;
}>;

const ACTION_DISTANCE = 5.5;

export function projectWildsResourceAffordance(input: Readonly<{
  kind: Extract<WildsResourceKind, "timber" | "stone">;
  distance: number;
  availableCapacity: number;
  pending: boolean;
  companionQualified: boolean;
  companionReady?: boolean;
}>): WildsResourceAffordance {
  if (!Number.isFinite(input.distance) || input.distance < 0 || !Number.isSafeInteger(input.availableCapacity) || input.availableCapacity < 0) {
    throw new Error("wilds_resource_affordance_input_invalid");
  }
  const noun = input.kind === "timber" ? "Living timber" : "Foundation stone";
  if (input.availableCapacity === 0) return Object.freeze({ state: "recovering", label: input.kind === "timber" ? "Timber recovering" : "Stone resting", guidance: "This living source is replenishing", enabled: false });
  if (input.distance > ACTION_DISTANCE) return Object.freeze({ state: "approach", label: noun, guidance: "Move closer to harvest", enabled: false });
  if (input.pending) return Object.freeze({ state: "working", label: "Harvesting…", guidance: "Work is being admitted", enabled: false });
  if (input.companionReady === false) return Object.freeze({ state: "rest", label: `Observe ${input.kind === "timber" ? "timber" : "stone"}`, guidance: "Read the source now; gather after your companion rests", enabled: true });
  if (!input.companionQualified) return Object.freeze({ state: "companion", label: `Observe ${input.kind === "timber" ? "timber" : "stone"}`, guidance: input.kind === "timber" ? "Reveals why a Woodland companion is needed" : "Reveals why a Quarry companion is needed", enabled: true });
  return Object.freeze({ state: "ready", label: input.kind === "timber" ? "Harvest timber" : "Gather stone", guidance: "Work together", enabled: true });
}
