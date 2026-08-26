import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import { deriveKaiKlokMoment } from "./kai-klok-moment";

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
  | "grove.discovered"
  | "grove.operation_admitted"
  | "resource.custody_transferred"
  | "resource.material_custody_transferred"
  | "resource.material_harvested"
  | "structure.built"
  | "construction.site_placed"
  | "construction.site_contributed"
  | "construction.site_worked"
  | "tool.crafted"
  | "tool.equipped"
  | "storage.material_moved"
  | "team.created"
  | "team.joined"
  | "team.invited"
  | "team.invite_accepted"
  | "team.role_changed"
  | "team.event_scheduled"
  | "team.squad_assembled"
  | "social.abuse_reported"
  | "league.scored"
  | "story.chapter_opened"
  | "story.objective_contributed"
  | "story.chapter_settled"
  | "story.achievement_granted"
  | "story.trainer_encountered"
  | "story.trainer_battle_settled"
  | "story.tournament_opened"
  | "story.tournament_entered"
  | "story.tournament_round_settled"
  | "story.tournament_settled";

type WildsWorldEventFields<T> = {
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

export type LegacyWildsWorldEventV3<T = unknown> = WildsWorldEventFields<T> & {
  schema: "receiz.wilds_world_event.v3";
};

export type WildsWorldEvent<T = unknown> = WildsWorldEventFields<T> & {
  schema: "receiz.wilds_world_event.v4";
  /** Primary deterministic temporal coordinate admitted at the mutation boundary. */
  uPulse: number;
  /** Causal append sequence inside one uPulse. */
  sequence: number;
};

export type CompatibleWildsWorldEvent<T = unknown> = WildsWorldEvent<T> | LegacyWildsWorldEventV3<T>;

type WildsWorldEventInput<T> = Omit<WildsWorldEvent<T>, "schema" | "worldId" | "eventId" | "digest" | "sequence" | "uPulse"> & {
  /** Exact admitted root. Omit only at an ISO interoperability boundary. */
  uPulse?: number;
};

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
  "grove.discovered",
  "grove.operation_admitted",
  "resource.custody_transferred",
  "resource.material_custody_transferred",
  "resource.material_harvested",
  "structure.built",
  "construction.site_placed",
  "construction.site_contributed",
  "construction.site_worked",
  "tool.crafted",
  "tool.equipped",
  "storage.material_moved",
  "team.created",
  "team.joined",
  "team.invited",
  "team.invite_accepted",
  "team.role_changed",
  "team.event_scheduled",
  "team.squad_assembled",
  "social.abuse_reported",
  "league.scored",
  "story.chapter_opened",
  "story.objective_contributed",
  "story.chapter_settled",
  "story.achievement_granted",
  "story.trainer_encountered",
  "story.trainer_battle_settled",
  "story.tournament_opened",
  "story.tournament_entered",
  "story.tournament_round_settled",
  "story.tournament_settled"
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
  if (input.uPulse !== undefined && (!Number.isSafeInteger(input.uPulse) || input.uPulse < 0)) throw new Error("wilds_world_upulse_invalid");
  if (input.previousEventId !== null && !/^wve:[a-f0-9]{64}$/.test(input.previousEventId)) throw new Error("wilds_world_previous_event_invalid");
  if (!jsonValueValid(input.payload)) throw new Error("wilds_world_payload_invalid");
}

function eventBasis<T>(input: WildsWorldEventInput<T>) {
  const { uPulse: admittedUPulse, ...fields } = input;
  const uPulse = admittedUPulse ?? deriveKaiKlokMoment({ occurredAt: input.pulse, authority: "world" }).uPulse;
  return {
    schema: "receiz.wilds_world_event.v4" as const,
    worldId: WILDS_WORLD_ID,
    uPulse,
    sequence: input.kaiKlok,
    ...fields
  };
}

function legacyEventBasis<T>(input: WildsWorldEventInput<T>) {
  const { uPulse: _uPulse, ...fields } = input;
  return { schema: "receiz.wilds_world_event.v3" as const, worldId: WILDS_WORLD_ID, ...fields };
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

export function verifyWildsWorldEvent(event: CompatibleWildsWorldEvent, previous?: CompatibleWildsWorldEvent | null) {
  const errors: string[] = [];
  try {
    const input = {
      kind: event.kind,
      actorId: event.actorId,
      causeId: event.causeId,
      pulse: event.pulse,
      kaiKlok: event.kaiKlok,
      occurredAt: event.occurredAt,
      previousEventId: event.previousEventId,
      payload: event.payload
    };
    if (event.schema === "receiz.wilds_world_event.v3") {
      validateInput(input);
      const digestHex = sha256PortableBasis(canonicalPortableCardJson(legacyEventBasis(input))).slice("sha256:".length);
      if (event.schema !== "receiz.wilds_world_event.v3" || event.worldId !== WILDS_WORLD_ID) errors.push("wilds_world_schema_invalid");
      if (event.eventId !== `wve:${digestHex}` || event.digest !== `sha256:${digestHex}`) errors.push("wilds_world_digest_invalid");
    } else if (event.schema === "receiz.wilds_world_event.v4") {
      const rebuilt = createWildsWorldEvent({ ...input, uPulse: event.uPulse });
      if (event.schema !== rebuilt.schema || event.worldId !== rebuilt.worldId) errors.push("wilds_world_schema_invalid");
      if (event.uPulse !== rebuilt.uPulse
        || event.sequence !== event.kaiKlok
        || event.sequence !== rebuilt.sequence
        || event.eventId !== rebuilt.eventId
        || event.digest !== rebuilt.digest) errors.push("wilds_world_digest_invalid");
    } else {
      errors.push("wilds_world_schema_invalid");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "wilds_world_event_invalid");
  }
  if (previous !== undefined) {
    if (previous === null) {
      if (event.previousEventId !== null) errors.push("wilds_world_previous_event_invalid");
    } else {
      if (event.previousEventId !== previous.eventId
        || compareWildsWorldEvents(previous, event) >= 0) errors.push("wilds_world_previous_event_invalid");
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function wildsWorldEventUPulse(event: Pick<CompatibleWildsWorldEvent, "pulse"> & Partial<Pick<WildsWorldEvent, "uPulse">>) {
  return "uPulse" in event && event.uPulse !== undefined
    ? event.uPulse
    : deriveKaiKlokMoment({ occurredAt: event.pulse, authority: "world" }).uPulse;
}

export function wildsWorldEventSequence(event: Pick<CompatibleWildsWorldEvent, "kaiKlok"> & Partial<Pick<WildsWorldEvent, "sequence">>) {
  return "sequence" in event && event.sequence !== undefined ? event.sequence : event.kaiKlok;
}

export function compareWildsWorldEvents(left: CompatibleWildsWorldEvent, right: CompatibleWildsWorldEvent) {
  const leftUPulse = wildsWorldEventUPulse(left);
  const rightUPulse = wildsWorldEventUPulse(right);
  if (leftUPulse !== rightUPulse) return leftUPulse < rightUPulse ? -1 : 1;
  const leftSequence = wildsWorldEventSequence(left);
  const rightSequence = wildsWorldEventSequence(right);
  if (leftSequence !== rightSequence) return leftSequence < rightSequence ? -1 : 1;
  return 0;
}
