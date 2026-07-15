import type { WildsWorldEvent } from "./wilds-world-event";
import type { WildsWorldCheckpoint } from "./wilds-world-state";

export type WildsWorldRecord = { checkpoint: WildsWorldCheckpoint; eventTail: WildsWorldEvent[] };

export function findWildsWorldRecord(value: unknown): WildsWorldRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const checkpoint = record.checkpoint as WildsWorldCheckpoint | undefined;
  if (checkpoint?.schema === "receiz.wilds_world_checkpoint.v3" && Array.isArray(record.eventTail)) {
    return { checkpoint, eventTail: record.eventTail as WildsWorldEvent[] };
  }
  for (const key of ["state", "data", "record", "appState", "result"]) {
    const found = findWildsWorldRecord(record[key]);
    if (found) return found;
  }
  return null;
}
