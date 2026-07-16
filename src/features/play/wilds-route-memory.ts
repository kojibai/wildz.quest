import { sha256PortableBasis } from "./portable-card";

export type WildsRouteDirection = "north" | "east" | "south" | "west";
export type WildsRouteMemory = {
  id: string;
  sequence: WildsRouteDirection[];
  step: number;
  mistakes: number;
  phase: "briefing" | "active" | "complete";
  eventIds: string[];
};

const DIRECTIONS: readonly WildsRouteDirection[] = ["north", "east", "south", "west"];

function digest(seed: string) {
  return sha256PortableBasis(seed).slice(7);
}

function routeEventId(state: WildsRouteMemory, intent: string) {
  return `route-event:${digest(`${state.id}:${state.step}:${state.mistakes}:${state.eventIds.length}:${intent}`).slice(0, 20)}`;
}

export function createWildsRouteMemory(seed: string): WildsRouteMemory {
  const routeDigest = digest(`wayfinder-route:${seed}`);
  const sequence = Array.from({ length: 3 }, (_, index) => DIRECTIONS[Number.parseInt(routeDigest.slice(index * 2, index * 2 + 2), 16) % DIRECTIONS.length]!);
  return { id: `route:${routeDigest.slice(0, 20)}`, sequence, step: 0, mistakes: 0, phase: "briefing", eventIds: [] };
}

export function applyWildsRouteIntent(state: WildsRouteMemory, intent: "begin" | WildsRouteDirection): WildsRouteMemory {
  if (state.phase === "complete") return state;
  if (state.phase === "briefing") {
    if (intent !== "begin") return state;
    return { ...state, phase: "active", eventIds: [...state.eventIds, routeEventId(state, intent)] };
  }
  if (intent === "begin" || state.mistakes >= 3) return state;
  const eventIds = [...state.eventIds, routeEventId(state, intent)];
  if (intent !== state.sequence[state.step]) return { ...state, step: 0, mistakes: Math.min(3, state.mistakes + 1), eventIds };
  const step = state.step + 1;
  return { ...state, step, phase: step === state.sequence.length ? "complete" : "active", eventIds };
}
