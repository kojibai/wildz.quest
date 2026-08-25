import type { WildsProjectedCapabilityControl } from "./wilds-world-capability-controls";
import {
  WILDS_WORLD_CAPABILITY_REGISTRY,
  type WildsWorldCapabilityFamily
} from "./wilds-world-capability-registry";

export type WildsCapabilityState = "ready" | "awakened" | "active" | "recovering" | "guidance";

export type WildsCapabilityCandidate = Readonly<{
  id: string;
  family: WildsWorldCapabilityFamily;
  eligible: boolean;
  urgency: number;
  distance: number;
  expectedHead?: string | null;
}>;

export type WildsCapabilityContextIntent = Readonly<{
  kind: "execute" | "toggle" | "source-preview" | "highlight-route" | "explain-recovery";
  targetId: string | null;
  expectedHead: string | null;
}>;

export type WildsCapabilityContext = Readonly<{
  family: WildsWorldCapabilityFamily;
  state: WildsCapabilityState;
  candidateIds: readonly string[];
  primaryTargetId: string | null;
  explanation: string;
  intent: WildsCapabilityContextIntent;
}>;

export type WildsCapabilityContextInput = Readonly<{
  controls: readonly WildsProjectedCapabilityControl[];
  candidates: readonly WildsCapabilityCandidate[];
  activeFamilies: readonly WildsWorldCapabilityFamily[];
}>;

const MAX_CANDIDATES_PER_FAMILY = 8;
const objectCache = new WeakMap<WildsCapabilityContextInput, ReadonlyMap<WildsWorldCapabilityFamily, WildsCapabilityContext>>();

function validCandidate(candidate: WildsCapabilityCandidate) {
  return candidate.eligible
    && candidate.id.length > 0
    && Number.isFinite(candidate.urgency)
    && Number.isFinite(candidate.distance)
    && candidate.distance >= 0;
}

function compareCandidate(left: WildsCapabilityCandidate, right: WildsCapabilityCandidate) {
  return right.urgency - left.urgency
    || left.distance - right.distance
    || left.id.localeCompare(right.id);
}

function intent(
  kind: WildsCapabilityContextIntent["kind"],
  candidate?: WildsCapabilityCandidate
): WildsCapabilityContextIntent {
  return Object.freeze({
    kind,
    targetId: candidate?.id ?? null,
    expectedHead: candidate?.expectedHead ?? null
  });
}

function projectFamilyContext(
  control: WildsProjectedCapabilityControl,
  candidates: readonly WildsCapabilityCandidate[],
  active: boolean
): WildsCapabilityContext {
  const definition = WILDS_WORLD_CAPABILITY_REGISTRY[control.family];
  const primary = candidates[0];
  let state: WildsCapabilityState;
  let explanation: string;
  let projectedIntent: WildsCapabilityContextIntent;

  if (!control.runtimeAvailable || control.capacity <= 0) {
    state = "recovering";
    explanation = `${control.label} is recovering with this companion.`;
    projectedIntent = intent("explain-recovery");
  } else if (active) {
    state = "active";
    explanation = `${control.label} is active.`;
    projectedIntent = intent(definition.actionKind === "sustained" ? "toggle" : "execute", primary);
  } else if (primary) {
    state = "awakened";
    explanation = definition.ready;
    projectedIntent = intent(definition.actionKind === "source" ? "source-preview" : definition.actionKind === "sustained" ? "toggle" : "execute", primary);
  } else if (definition.actionKind === "sustained" || definition.contextKind === "open-air") {
    state = "ready";
    explanation = definition.ready;
    projectedIntent = intent(definition.actionKind === "sustained" ? "toggle" : "execute");
  } else {
    state = "guidance";
    explanation = definition.guidance;
    projectedIntent = intent("highlight-route");
  }

  return Object.freeze({
    family: control.family,
    state,
    candidateIds: Object.freeze(candidates.map((candidate) => candidate.id)),
    primaryTargetId: primary?.id ?? null,
    explanation,
    intent: projectedIntent
  });
}

export function projectWildsCapabilityContext(
  input: WildsCapabilityContextInput
): ReadonlyMap<WildsWorldCapabilityFamily, WildsCapabilityContext> {
  const cached = objectCache.get(input);
  if (cached) return cached;
  const active = new Set(input.activeFamilies);
  const output = new Map<WildsWorldCapabilityFamily, WildsCapabilityContext>();
  for (const control of input.controls) {
    const candidates = input.candidates
      .filter((candidate) => candidate.family === control.family && validCandidate(candidate))
      .sort(compareCandidate)
      .slice(0, MAX_CANDIDATES_PER_FAMILY);
    output.set(control.family, projectFamilyContext(control, candidates, active.has(control.family)));
  }
  objectCache.set(input, output);
  return output;
}

