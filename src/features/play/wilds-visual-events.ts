export type WildsVisualEventKind =
  | "search"
  | "rustle"
  | "emerge"
  | "impact"
  | "capture"
  | "seal"
  | "reveal"
  | "evolve"
  | "lineage"
  | "player-arrival";

export type WildsVisualEvent = {
  id: string;
  kind: WildsVisualEventKind;
  createdAt: number;
  durationMs: number;
  intensity: number;
};

const MAX_ACTIVE_EVENTS = 24;

export function activeWildsVisualEvents(events: WildsVisualEvent[], now: number) {
  return events.filter((event) => now - event.createdAt < event.durationMs);
}

export function appendWildsVisualEvent(
  events: WildsVisualEvent[],
  event: WildsVisualEvent,
  now: number
) {
  if (events.some((candidate) => candidate.id === event.id)) {
    return activeWildsVisualEvents(events, now);
  }
  return [...activeWildsVisualEvents(events, now), event].slice(-MAX_ACTIVE_EVENTS);
}
