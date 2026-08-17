import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "./portable-card";
import {
  appendLivingCardHistory,
  currentCreatureHistoryProjection
} from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type {
  CreatureCareAction,
  CreatureContinuityEvent,
  CreatureContinuityProjection
} from "./creature-history-types";

export type { CreatureCareAction } from "./creature-history-types";

export const CREATURE_CARE_RULESET = "wildz.creature-care.v7.0.0" as const;
export const CREATURE_CARE_COSTS: Readonly<Record<CreatureCareAction, number>> = {
  feed: 3,
  comfort: 0,
  treat: 8
};

export type CreatureCareState = Readonly<{
  active: boolean;
  hunger: number;
  attention: number;
  wellness: number;
  status: "resting" | "healthy" | "needs-care" | "urgent" | "sick" | "dead";
  lastCareAt: string | null;
  nextNeedAt: string | null;
}>;

export type CreatureCareResult = Readonly<{
  ok: boolean;
  asset: PortableCardAsset;
  cost: number;
  code?: "care_asset_invalid" | "care_owner_mismatch" | "care_mandate_inactive" | "care_creature_dead" | "care_command_rejected" | "care_no_settlement_due";
}>;

const CARE_ACTIONS = new Set<CreatureCareAction>(["feed", "comfort", "treat"]);
const HOUR_MS = 3_600_000;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function decay(input: { hunger: number; attention: number; wellness: number }, hours: number) {
  let state = { ...input };
  for (let index = 0; index < Math.min(168, Math.max(0, hours)); index += 1) {
    state.hunger = Math.max(0, state.hunger - 2);
    state.attention = Math.max(0, state.attention - 1);
    const danger = state.hunger === 0 ? 2 : state.hunger < 25 || state.attention < 15 ? 1 : 0;
    state.wellness = Math.max(0, Math.min(100, state.wellness - danger));
  }
  return state;
}

function applyCare(state: { hunger: number; attention: number; wellness: number }, action: CreatureCareAction) {
  if (action === "feed") return { ...state, hunger: Math.min(100, state.hunger + 48), wellness: Math.min(100, state.wellness + 4) };
  if (action === "comfort") return { ...state, attention: Math.min(100, state.attention + 42), wellness: Math.min(100, state.wellness + 3) };
  return {
    hunger: Math.min(100, state.hunger + 12),
    attention: Math.min(100, state.attention + 12),
    wellness: Math.min(100, state.wellness + 38)
  };
}

function statusFor(state: { hunger: number; attention: number; wellness: number }): CreatureCareState["status"] {
  if (state.wellness === 0) return "dead";
  if (state.wellness < 35) return "sick";
  if (state.hunger < 20 || state.attention < 15) return "urgent";
  if (state.hunger < 45 || state.attention < 35) return "needs-care";
  return "healthy";
}

export function projectCreatureCare(asset: PortableCardAsset, at: string): CreatureCareState {
  if (!isLivingCardAsset(asset) || !Number.isFinite(Date.parse(at))) {
    return { active: false, hunger: 100, attention: 100, wellness: 100, status: "resting", lastCareAt: null, nextNeedAt: null };
  }
  const projection = currentCreatureHistoryProjection(asset);
  const continuity = projection.continuity;
  const mandate = continuity?.mandate;
  if (!continuity || !mandate || mandate.status !== "active" || projection.condition.life === "dead") {
    return {
      active: false,
      hunger: projection.condition.life === "dead" ? 0 : 100,
      attention: projection.condition.life === "dead" ? 0 : 100,
      wellness: projection.condition.life === "dead" ? 0 : 100,
      status: projection.condition.life === "dead" ? "dead" : "resting",
      lastCareAt: null,
      nextNeedAt: null
    };
  }

  const sessionStart = Date.parse(mandate.changedAt);
  const end = Math.max(sessionStart, Date.parse(at));
  let cursor = sessionStart;
  let meters = { hunger: 100, attention: 100, wellness: 100 };
  let lastCareAt: string | null = null;
  for (const event of continuity.events) {
    if (!CARE_ACTIONS.has(event.kind as CreatureCareAction)) continue;
    const eventAt = Date.parse(event.occurredAt);
    if (eventAt < sessionStart || eventAt > end) continue;
    meters = decay(meters, Math.floor((eventAt - cursor) / HOUR_MS));
    meters = applyCare(meters, event.kind as CreatureCareAction);
    cursor = eventAt;
    lastCareAt = event.occurredAt;
  }
  meters = decay(meters, Math.floor((end - cursor) / HOUR_MS));
  return {
    active: true,
    ...meters,
    status: statusFor(meters),
    lastCareAt,
    nextNeedAt: new Date(cursor + HOUR_MS).toISOString()
  };
}

function careEvent(input: Readonly<{
  asset: PortableCardAsset;
  continuity: CreatureContinuityProjection;
  ownerReceizId: string;
  kind: CreatureCareAction | "neglect";
  at: string;
}>): CreatureContinuityEvent {
  const mandate = input.continuity.mandate!;
  const commandId = `care-command:${sha256PortableBasis(`${input.asset.id}:${input.kind}:${input.at}:${input.continuity.headDigest ?? "genesis"}`).slice(7, 39)}`;
  const basis = {
    schema: "receiz.wildz.creature_continuity_event.v1" as const,
    eventId: `care-event:${sha256PortableBasis(`${commandId}:event`).slice(7, 39)}`,
    commandId,
    attemptId: `care-attempt:${sha256PortableBasis(`${commandId}:attempt`).slice(7, 39)}`,
    transactionId: null,
    assetId: input.asset.id,
    ownerReceizId: input.ownerReceizId,
    mandateDigest: mandate.digest,
    previousEventDigest: input.continuity.headDigest,
    kind: input.kind,
    occurredAt: input.at,
    locationId: input.continuity.locationId,
    counterpartyId: null,
    counterpartyName: null,
    summary: input.kind === "feed"
      ? `${input.asset.manifest.name} ate trail beans earned through play and felt nourished.`
      : input.kind === "comfort"
        ? `${input.asset.manifest.name} received focused attention and felt its bond deepen.`
        : input.kind === "treat"
          ? `${input.asset.manifest.name} received restorative care using earned trail supplies.`
          : `${input.asset.manifest.name}'s wellness reached zero after its active care mandate went unanswered.`,
    relationshipDelta: input.kind === "comfort" ? 2 : 0,
    keepsakeGiven: null,
    keepsakeReceived: null,
    discoveryId: null
  };
  return { ...basis, digest: digest(basis) };
}

export function careForCreature(input: Readonly<{
  asset: PortableCardAsset;
  ownerReceizId: string;
  action: CreatureCareAction;
  at: string;
}>): CreatureCareResult {
  if (!verifyAnyWildsCard(input.asset).ok || !isLivingCardAsset(input.asset)) return { ok: false, asset: input.asset, cost: 0, code: "care_asset_invalid" };
  if (input.asset.manifest.ownerReceizId !== input.ownerReceizId) return { ok: false, asset: input.asset, cost: 0, code: "care_owner_mismatch" };
  const projection = currentCreatureHistoryProjection(input.asset);
  const continuity = projection.continuity;
  if (!continuity?.mandate || continuity.mandate.status !== "active" || continuity.mandate.ownerReceizId !== input.ownerReceizId) {
    return { ok: false, asset: input.asset, cost: 0, code: "care_mandate_inactive" };
  }
  if (projection.condition.life === "dead" || projectCreatureCare(input.asset, input.at).status === "dead") {
    return { ok: false, asset: input.asset, cost: 0, code: "care_creature_dead" };
  }
  try {
    const event = careEvent({ ...input, continuity, kind: input.action });
    const asset = appendLivingCardHistory({
      asset: input.asset,
      event: {
        eventId: event.eventId,
        rulesetVersion: CREATURE_CARE_RULESET,
        occurredAt: input.at,
        source: { mode: "continuity", activityId: event.commandId, actorId: input.ownerReceizId, authority: "local" },
        evidence: { sourceEventDigest: event.digest },
        effects: [{ kind: "continuity-event", event }]
      }
    });
    return { ok: true, asset, cost: CREATURE_CARE_COSTS[input.action] };
  } catch {
    return { ok: false, asset: input.asset, cost: 0, code: "care_command_rejected" };
  }
}

export function settleCreatureCare(input: Readonly<{
  asset: PortableCardAsset;
  ownerReceizId: string;
  at: string;
}>): CreatureCareResult {
  if (!verifyAnyWildsCard(input.asset).ok || !isLivingCardAsset(input.asset)) return { ok: false, asset: input.asset, cost: 0, code: "care_asset_invalid" };
  if (input.asset.manifest.ownerReceizId !== input.ownerReceizId) return { ok: false, asset: input.asset, cost: 0, code: "care_owner_mismatch" };
  const projection = currentCreatureHistoryProjection(input.asset);
  if (projection.condition.life === "dead" || projectCreatureCare(input.asset, input.at).status !== "dead") {
    return { ok: false, asset: input.asset, cost: 0, code: "care_no_settlement_due" };
  }
  const continuity = projection.continuity;
  if (!continuity?.mandate || continuity.mandate.status !== "active") return { ok: false, asset: input.asset, cost: 0, code: "care_mandate_inactive" };
  try {
    const event = careEvent({ ...input, continuity, kind: "neglect" });
    const asset = appendLivingCardHistory({
      asset: input.asset,
      event: {
        eventId: event.eventId,
        rulesetVersion: CREATURE_CARE_RULESET,
        occurredAt: input.at,
        source: { mode: "continuity", activityId: event.commandId, actorId: input.ownerReceizId, authority: "local" },
        evidence: { sourceEventDigest: event.digest },
        effects: [
          { kind: "continuity-event", event },
          {
            kind: "condition",
            delta: {
              assetId: input.asset.id,
              lifeBefore: "alive",
              lifeAfter: "dead",
              fatigueDelta: 25,
              injuriesAdded: [],
              xp: {},
              mastery: {},
              upgradeIdsAdded: [],
              receiptDigestsAdded: []
            }
          }
        ]
      }
    });
    return { ok: true, asset, cost: 0 };
  } catch {
    return { ok: false, asset: input.asset, cost: 0, code: "care_command_rejected" };
  }
}
