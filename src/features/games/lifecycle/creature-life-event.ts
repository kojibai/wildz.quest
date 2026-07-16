import type { LivingCardLifeSnapshot } from "../../play/living-card-types";

export type WildzCreatureLifeEvent = {
  eventId: string;
  creatureId: string;
  sourceGameId: string;
  sourceReceiptDigest: string;
  sequence: number;
  occurredAt: string;
  kind: "xp" | "bond" | "injury" | "recovery" | "evolution" | "scar" | "victory" | "loss" | "retreat" | "retirement";
  payload: Readonly<Record<string, string | number | boolean>>;
};

const DIGEST = /^sha256:[a-f0-9]{64}$/;

export function createCreatureLife(creatureId: string, maxVitality: number): LivingCardLifeSnapshot {
  if (!creatureId || !Number.isSafeInteger(maxVitality) || maxVitality < 1) throw new Error("Invalid creature life basis");
  return { creatureId, vitality: maxVitality, maxVitality, retired: false, lastSequence: 0, eventIds: [], injuries: [], repairedScars: [], victories: 0, losses: 0, retreats: 0, retirement: null };
}

function amount(event: WildzCreatureLifeEvent) {
  const value = event.payload.amount;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Creature life event amount is invalid");
  return value;
}

export function applyCreatureLifeEvent(state: Readonly<LivingCardLifeSnapshot>, event: WildzCreatureLifeEvent): LivingCardLifeSnapshot {
  if (event.creatureId !== state.creatureId) throw new Error("Creature life event identity mismatch");
  if (state.eventIds.includes(event.eventId)) return state as LivingCardLifeSnapshot;
  if (event.sequence !== state.lastSequence + 1) throw new Error("Creature life event sequence is not causal");
  if (!DIGEST.test(event.sourceReceiptDigest) || !Number.isFinite(Date.parse(event.occurredAt))) throw new Error("Creature life event receipt is invalid");
  if (state.retired) throw new Error("Canonically retired creature cannot receive life events");
  const next: LivingCardLifeSnapshot = { ...state, eventIds: [...state.eventIds, event.eventId], lastSequence: event.sequence, injuries: [...state.injuries], repairedScars: [...state.repairedScars] };
  if (event.kind === "injury") {
    next.vitality = Math.max(0, state.vitality - amount(event));
    const mark = typeof event.payload.mark === "string" ? event.payload.mark : `injury:${event.eventId}`;
    if (!next.injuries.includes(mark)) next.injuries.push(mark);
  } else if (event.kind === "recovery") {
    if (typeof event.payload.resource !== "string" || !event.payload.resource) throw new Error("Recovery resource is required");
    next.vitality = Math.min(state.maxVitality, state.vitality + amount(event));
    next.repairedScars = Array.from(new Set([...next.repairedScars, ...next.injuries]));
    next.injuries = [];
  } else if (event.kind === "victory") next.victories += 1;
  else if (event.kind === "loss") next.losses += 1;
  else if (event.kind === "retreat") next.retreats += 1;
  return next;
}
