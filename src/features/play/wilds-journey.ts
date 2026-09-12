/** Personal recollections only: this journal never grants resources, ownership, or growth. */
export const WILDS_JOURNEY_LIMIT = 80;
export type WildsJourneyKind = "met" | "harvest" | "built" | "discovered" | "home";
export type WildsJourneyInput = {
  kind: WildsJourneyKind;
  subjectId: string;
  companionId?: string;
  companionName?: string;
  label: string;
  position: { x: number; z: number };
};
export type WildsJourneyMemory = WildsJourneyInput & { id: string; timestamp: number };
const kinds = new Set<WildsJourneyKind>(["met", "harvest", "built", "discovered", "home"]);
const shortString = (value: unknown, limit: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : undefined;

export function wildsJourneyStorageKey(ownerId: string): string {
  return `wildz:journey:v1:${encodeURIComponent(ownerId)}`;
}

export function sanitizeWildsJourneyInput(value: unknown): WildsJourneyInput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (!kinds.has(row.kind as WildsJourneyKind)) return null;
  const subjectId = shortString(row.subjectId, 256);
  const label = shortString(row.label, 240);
  const companionId = shortString(row.companionId, 256);
  const companionName = companionId ? shortString(row.companionName, 80) : undefined;
  const position = row.position as { x?: unknown; z?: unknown } | undefined;
  if (!subjectId || !label || !position || typeof position.x !== "number" || typeof position.z !== "number"
    || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return null;
  if (row.kind === "met" && !companionId) return null;
  return { kind: row.kind as WildsJourneyKind, subjectId, label,
    ...(companionId ? { companionId } : {}), ...(companionName ? { companionName } : {}),
    position: { x: position.x, z: position.z } };
}

export function wildsJourneyMemoryId(input: WildsJourneyInput): string {
  // A first meeting remains the same memory even if the creature moves or is renamed.
  return JSON.stringify(input.kind === "met"
    ? [input.kind, input.companionId]
    : [input.kind, input.subjectId, input.companionId ?? ""]);
}

export function sanitizeWildsJourney(value: unknown): WildsJourneyMemory[] {
  if (!Array.isArray(value)) return [];
  const memories = new Map<string, WildsJourneyMemory>();
  // Bound work as well as output when storage is malformed or from an unknown version.
  for (const row of value.slice(-WILDS_JOURNEY_LIMIT * 4)) {
    const input = sanitizeWildsJourneyInput(row);
    if (!input || typeof row.timestamp !== "number" || !Number.isFinite(row.timestamp) || row.timestamp < 0) continue;
    const id = wildsJourneyMemoryId(input);
    const previous = memories.get(id);
    if (!previous || row.timestamp < previous.timestamp) memories.set(id, { ...input, id, timestamp: row.timestamp });
  }
  return [...memories.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-WILDS_JOURNEY_LIMIT);
}

export function rememberWildsJourney(
  memories: readonly WildsJourneyMemory[], input: WildsJourneyInput, timestamp = Date.now()
): readonly WildsJourneyMemory[] {
  const clean = sanitizeWildsJourneyInput(input);
  if (!clean || !Number.isFinite(timestamp) || timestamp < 0) return memories;
  const id = wildsJourneyMemoryId(clean);
  if (memories.some((memory) => memory.id === id)) return memories;
  return [...memories.slice(-(WILDS_JOURNEY_LIMIT - 1)), { ...clean, id, timestamp }];
}

export function parseWildsJourney(serialized: string | null): WildsJourneyMemory[] {
  if (!serialized || serialized.length > 300_000) return [];
  try { return sanitizeWildsJourney(JSON.parse(serialized)); } catch { return []; }
}
