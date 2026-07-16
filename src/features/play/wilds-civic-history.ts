import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type WildsCivicEventKind = "settlement.discovered" | "resident.met" | "service.completed" | "puzzle.completed";

export type WildsCivicEvent = {
  schema: "receiz.wilds_civic_event.v1";
  eventId: string;
  settlementId: "wayfinder-hollow";
  actorId: string;
  kind: WildsCivicEventKind;
  sourceId: string;
  occurredAt: string;
  cardProofDigest: string | null;
  reputation: number;
};

export type WildsCivicProjection = {
  events: WildsCivicEvent[];
  reputation: number;
  rank: "visitor" | "neighbor" | "wayfinder" | "keeper";
  completedSourceIds: string[];
};

const KINDS = new Set<WildsCivicEventKind>(["settlement.discovered", "resident.met", "service.completed", "puzzle.completed"]);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{1,95}$/;
const PROOF_DIGEST = /^sha256:[a-f0-9]{64}$/;

export function normalizeWildsCivicActorId(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9:._-]+/g, "-").replace(/^[^a-zA-Z0-9]+/, "").slice(0, 96);
  return normalized.length >= 2 ? normalized : "wilds.player";
}

function eventBasis(input: Omit<WildsCivicEvent, "eventId">) {
  return `civic:${sha256PortableBasis(canonicalPortableCardJson(input)).slice(7, 31)}`;
}

export function createWildsCivicEvent(input: Omit<WildsCivicEvent, "schema" | "eventId">): WildsCivicEvent {
  const event: Omit<WildsCivicEvent, "eventId"> = { schema: "receiz.wilds_civic_event.v1", ...input };
  return { ...event, eventId: eventBasis(event) };
}

export function verifyWildsCivicEvent(event: WildsCivicEvent): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!event || typeof event !== "object") return { ok: false, errors: ["civic_event_invalid"] };
  if (event.schema !== "receiz.wilds_civic_event.v1") errors.push("civic_schema_invalid");
  if (event.settlementId !== "wayfinder-hollow") errors.push("civic_settlement_invalid");
  if (!SAFE_ID.test(event.actorId)) errors.push("civic_actor_invalid");
  if (!KINDS.has(event.kind)) errors.push("civic_kind_invalid");
  if (!SAFE_ID.test(event.sourceId)) errors.push("civic_source_invalid");
  if (!Number.isFinite(Date.parse(event.occurredAt)) || new Date(event.occurredAt).toISOString() !== event.occurredAt) errors.push("civic_time_invalid");
  if (event.cardProofDigest !== null && !PROOF_DIGEST.test(event.cardProofDigest)) errors.push("civic_card_proof_invalid");
  if (!Number.isInteger(event.reputation) || event.reputation < 0 || event.reputation > 5) errors.push("civic_reputation_invalid");
  const { eventId: _eventId, ...basis } = event;
  if (event.eventId !== eventBasis(basis)) errors.push("civic_event_id_invalid");
  return { ok: errors.length === 0, errors };
}

function civicRank(reputation: number): WildsCivicProjection["rank"] {
  if (reputation >= 30) return "keeper";
  if (reputation >= 15) return "wayfinder";
  if (reputation >= 5) return "neighbor";
  return "visitor";
}

export function projectWildsCivicHistory(events: readonly WildsCivicEvent[]): WildsCivicProjection {
  const admitted = new Map<string, WildsCivicEvent>();
  for (const event of events) {
    if (!verifyWildsCivicEvent(event).ok || admitted.has(event.eventId)) continue;
    admitted.set(event.eventId, event);
  }
  const ordered = [...admitted.values()].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId));
  const sourceScores = new Map<string, number>();
  const completedSourceIds: string[] = [];
  for (const event of ordered) {
    if (!sourceScores.has(event.sourceId)) completedSourceIds.push(event.sourceId);
    sourceScores.set(event.sourceId, Math.min(5, (sourceScores.get(event.sourceId) ?? 0) + event.reputation));
  }
  const reputation = Math.min(100, [...sourceScores.values()].reduce((sum, score) => sum + score, 0));
  return { events: ordered, reputation, rank: civicRank(reputation), completedSourceIds };
}
