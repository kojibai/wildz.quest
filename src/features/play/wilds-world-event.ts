import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export const WILDS_WORLD_ID = "wilds:global:v3" as const;

export type WildsWorldEventKind =
  | "site.spawned"
  | "site.phase_changed"
  | "boss.emerged"
  | "raid.joined"
  | "raid.contributed"
  | "raid.entered"
  | "raid.acted"
  | "raid.lease_changed"
  | "raid.retreated"
  | "boss.defeated"
  | "site.memorialized"
  | "ecology.spawned"
  | "ecology.phase_changed"
  | "ecology.discovered"
  | "ecology.contributed"
  | "ecology.resolved"
  | "ecology.historicized"
  | "team.created"
  | "team.joined"
  | "team.invited"
  | "team.invite_accepted"
  | "team.role_changed"
  | "team.event_scheduled"
  | "team.squad_assembled"
  | "social.abuse_reported"
  | "league.scored";

export type WildsWorldEvent<T = unknown> = {
  schema: "receiz.wilds_world_event.v3";
  worldId: typeof WILDS_WORLD_ID;
  eventId: string;
  kind: WildsWorldEventKind;
  actorId: string;
  causeId: string;
  pulse: string;
  kaiKlok: number;
  occurredAt: string;
  previousEventId: string | null;
  payload: T;
  digest: string;
};

type WildsWorldEventInput<T> = Omit<WildsWorldEvent<T>, "schema" | "worldId" | "eventId" | "digest">;

const eventKinds = new Set<WildsWorldEventKind>([
  "site.spawned",
  "site.phase_changed",
  "boss.emerged",
  "raid.joined",
  "raid.contributed",
  "raid.entered",
  "raid.acted",
  "raid.lease_changed",
  "raid.retreated",
  "boss.defeated",
  "site.memorialized",
  "ecology.spawned",
  "ecology.phase_changed",
  "ecology.discovered",
  "ecology.contributed",
  "ecology.resolved",
  "ecology.historicized",
  "team.created",
  "team.joined",
  "team.invited",
  "team.invite_accepted",
  "team.role_changed",
  "team.event_scheduled",
  "team.squad_assembled",
  "social.abuse_reported",
  "league.scored"
]);

function isIsoTime(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function identityValid(value: unknown) {
  return typeof value === "string" && value.length >= 3 && value.length <= 180 && /^[a-z0-9][a-z0-9:._-]*$/i.test(value);
}

function jsonValueValid(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return !seen.has(value) && (seen.add(value), value.every((child) => jsonValueValid(child, seen)));
  if (value && typeof value === "object") {
    if (seen.has(value)) return false;
    seen.add(value);
    return Object.getPrototypeOf(value) === Object.prototype
      && Object.entries(value as Record<string, unknown>).every(([key, child]) => key.length > 0 && jsonValueValid(child, seen));
  }
  return false;
}

function validateInput(input: WildsWorldEventInput<unknown>) {
  if (!eventKinds.has(input.kind)) throw new Error("wilds_world_kind_invalid");
  if (!identityValid(input.actorId)) throw new Error("wilds_world_actor_invalid");
  if (!identityValid(input.causeId)) throw new Error("wilds_world_cause_invalid");
  if (!isIsoTime(input.pulse) || !isIsoTime(input.occurredAt)) throw new Error("wilds_world_time_invalid");
  if (!Number.isSafeInteger(input.kaiKlok) || input.kaiKlok < 1) throw new Error("wilds_world_kai_klok_invalid");
  if (input.previousEventId !== null && !/^wve:[a-f0-9]{64}$/.test(input.previousEventId)) throw new Error("wilds_world_previous_event_invalid");
  if (!jsonValueValid(input.payload)) throw new Error("wilds_world_payload_invalid");
}

function eventBasis<T>(input: WildsWorldEventInput<T>) {
  return {
    schema: "receiz.wilds_world_event.v3" as const,
    worldId: WILDS_WORLD_ID,
    ...input
  };
}

export function createWildsWorldEvent<T>(input: WildsWorldEventInput<T>): WildsWorldEvent<T> {
  validateInput(input);
  const digestHex = sha256PortableBasis(canonicalPortableCardJson(eventBasis(input))).slice("sha256:".length);
  return {
    ...eventBasis(input),
    eventId: `wve:${digestHex}`,
    digest: `sha256:${digestHex}`
  };
}

export function verifyWildsWorldEvent(event: WildsWorldEvent, previous?: WildsWorldEvent | null) {
  const errors: string[] = [];
  try {
    const rebuilt = createWildsWorldEvent({
      kind: event.kind,
      actorId: event.actorId,
      causeId: event.causeId,
      pulse: event.pulse,
      kaiKlok: event.kaiKlok,
      occurredAt: event.occurredAt,
      previousEventId: event.previousEventId,
      payload: event.payload
    });
    if (event.schema !== rebuilt.schema || event.worldId !== rebuilt.worldId) errors.push("wilds_world_schema_invalid");
    if (event.eventId !== rebuilt.eventId || event.digest !== rebuilt.digest) errors.push("wilds_world_digest_invalid");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "wilds_world_event_invalid");
  }
  if (previous !== undefined) {
    if (previous === null) {
      if (event.previousEventId !== null) errors.push("wilds_world_previous_event_invalid");
    } else {
      if (event.previousEventId !== previous.eventId || compareWildsWorldEvents(previous, event) >= 0) errors.push("wilds_world_previous_event_invalid");
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function compareWildsWorldEvents(left: WildsWorldEvent, right: WildsWorldEvent) {
  const pulseOrder = left.pulse.localeCompare(right.pulse);
  if (pulseOrder !== 0) return pulseOrder < 0 ? -1 : 1;
  if (left.kaiKlok !== right.kaiKlok) return left.kaiKlok < right.kaiKlok ? -1 : 1;
  const idOrder = left.eventId.localeCompare(right.eventId);
  return idOrder === 0 ? 0 : idOrder < 0 ? -1 : 1;
}
