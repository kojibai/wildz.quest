import {
  validateCreatureAutonomyMandate,
  validateCreatureContinuityProjection
} from "./creature-history";
import type {
  CreatureAutonomyAction,
  CreatureAutonomyMandate,
  CreatureContinuityEvent,
  CreatureContinuityProjection
} from "./creature-history-types";
import {
  admitLegacyCard,
  appendLivingCardHistory,
  currentCreatureHistoryProjection
} from "./living-card-proof";
import { isLivingCardAsset, type LivingCardAsset } from "./living-card-types";
import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "./portable-card";

export const CREATURE_CONTINUITY_RULESET = "wildz.creature-continuity.v120.1" as const;
export const CREATURE_CONTINUITY_ACTIONS = ["explore", "meet", "bond", "discover", "barter-keepsake"] as const;
export const CREATURE_CONTINUITY_MAX_ACTIONS_PER_DAY = 24;
export const CREATURE_CONTINUITY_MAX_AWAY_HOURS = 72;
export const CREATURE_CONTINUITY_FIRST_EXPERIENCE_MS = 2 * 60_000;

export type CreatureContinuityDenialCode =
  | "continuity_asset_invalid"
  | "continuity_owner_mismatch"
  | "continuity_mandate_missing"
  | "continuity_mandate_inactive"
  | "continuity_no_action_due"
  | "continuity_command_rejected";

export type CreatureContinuityCommandResult = Readonly<{
  ok: boolean;
  asset: PortableCardAsset;
  appended: number;
  code?: CreatureContinuityDenialCode;
}>;

const LOCATIONS = ["wayfinder-hollow", "mosslight-grove", "echo-rill", "ember-meadow", "moonroot-crossing"] as const;
const WANDERERS = [
  ["wildz-wanderer:bramble", "Bramble"],
  ["wildz-wanderer:luma", "Luma"],
  ["wildz-wanderer:tallow", "Tallow"],
  ["wildz-wanderer:vesper", "Vesper"]
] as const;
const DISCOVERIES = ["singing-moss", "silver-seed", "sunwarm-stone", "mirror-pollen", "starlit-shell"] as const;
const KEEPSAKES = ["moss-charm", "river-glass", "ember-feather", "moon-acorn", "echo-ribbon"] as const;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function unsigned<T extends { digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _digest, ...basis } = value;
  return basis;
}

function seedInt(seed: string, offset = 0) {
  const hex = sha256PortableBasis(`${seed}:${offset}`).slice(7 + (offset % 8), 15 + (offset % 8));
  return Number.parseInt(hex, 16) >>> 0;
}

function living(asset: PortableCardAsset, at: string): LivingCardAsset {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("continuity_asset_invalid");
  return isLivingCardAsset(asset) ? asset : admitLegacyCard(asset, at);
}

export function creatureContinuityProjection(asset: PortableCardAsset): CreatureContinuityProjection | null {
  if (!isLivingCardAsset(asset)) return null;
  return currentCreatureHistoryProjection(asset).continuity ?? null;
}

function createMandate(input: Readonly<{
  asset: LivingCardAsset;
  ownerReceizId: string;
  at: string;
  status: "active" | "paused";
}>): CreatureAutonomyMandate {
  const current = currentCreatureHistoryProjection(input.asset).continuity?.mandate ?? null;
  const basis = {
    schema: "receiz.wildz.creature_autonomy_mandate.v1" as const,
    mandateId: `mandate:${input.asset.id}:${sha256PortableBasis(`${input.ownerReceizId}:${input.at}:${input.status}`).slice(7, 23)}`,
    assetId: input.asset.id,
    ownerReceizId: input.ownerReceizId,
    status: input.status,
    allowedActions: [...CREATURE_CONTINUITY_ACTIONS],
    maxActionsPerDay: CREATURE_CONTINUITY_MAX_ACTIONS_PER_DAY,
    maxAwayHours: CREATURE_CONTINUITY_MAX_AWAY_HOURS,
    issuedAt: input.status === "paused" && current ? current.issuedAt : input.at,
    changedAt: input.at,
    previousMandateDigest: current?.digest ?? null
  };
  const mandate = { ...basis, digest: digest(basis) };
  return validateCreatureAutonomyMandate(mandate, input.asset.id);
}

function appendMandate(asset: LivingCardAsset, mandate: CreatureAutonomyMandate) {
  const current = currentCreatureHistoryProjection(asset).continuity;
  const awakeningBasis = {
    schema: "receiz.wildz.creature_continuity_event.v1" as const,
    eventId: `continuity-event:${sha256PortableBasis(`${mandate.mandateId}:awakening`).slice(7, 39)}`,
    commandId: `continuity-command:${sha256PortableBasis(`${mandate.mandateId}:command`).slice(7, 39)}`,
    attemptId: `continuity-attempt:${sha256PortableBasis(`${mandate.mandateId}:attempt`).slice(7, 39)}`,
    transactionId: null,
    assetId: asset.id,
    ownerReceizId: mandate.ownerReceizId,
    mandateDigest: mandate.digest,
    previousEventDigest: current?.headDigest ?? null,
    kind: "mandate-activated" as const,
    occurredAt: mandate.changedAt,
    locationId: current?.locationId ?? "wayfinder-hollow",
    counterpartyId: null,
    counterpartyName: null,
    summary: `${asset.manifest.name} awakened to life while away under its owner's bounded roaming mandate.`,
    relationshipDelta: 0,
    keepsakeGiven: null,
    keepsakeReceived: null,
    discoveryId: null
  };
  const awakening = { ...awakeningBasis, digest: digest(awakeningBasis) };
  return appendLivingCardHistory({
    asset,
    event: {
      eventId: `continuity:${mandate.mandateId}`,
      rulesetVersion: CREATURE_CONTINUITY_RULESET,
      occurredAt: mandate.changedAt,
      source: {
        mode: "continuity",
        activityId: mandate.mandateId,
        actorId: mandate.ownerReceizId,
        authority: "local"
      },
      evidence: { sourceEventDigest: mandate.digest },
      effects: mandate.status === "active"
        ? [{ kind: "continuity-mandate", mandate }, { kind: "continuity-event", event: awakening }]
        : [{ kind: "continuity-mandate", mandate }]
    }
  });
}

export function activateCreatureContinuity(input: Readonly<{
  asset: PortableCardAsset;
  ownerReceizId: string;
  at: string;
}>): CreatureContinuityCommandResult {
  try {
    if (input.asset.manifest.ownerReceizId !== input.ownerReceizId) {
      return { ok: false, asset: input.asset, appended: 0, code: "continuity_owner_mismatch" };
    }
    const candidate = living(input.asset, input.at);
    const mandate = createMandate({ ...input, asset: candidate, status: "active" });
    const asset = appendMandate(candidate, mandate);
    return { ok: true, asset, appended: 1 };
  } catch {
    return { ok: false, asset: input.asset, appended: 0, code: "continuity_command_rejected" };
  }
}

export function pauseCreatureContinuity(input: Readonly<{
  asset: PortableCardAsset;
  ownerReceizId: string;
  at: string;
}>): CreatureContinuityCommandResult {
  try {
    if (input.asset.manifest.ownerReceizId !== input.ownerReceizId) {
      return { ok: false, asset: input.asset, appended: 0, code: "continuity_owner_mismatch" };
    }
    const candidate = living(input.asset, input.at);
    if (!currentCreatureHistoryProjection(candidate).continuity?.mandate) {
      return { ok: false, asset: input.asset, appended: 0, code: "continuity_mandate_missing" };
    }
    const mandate = createMandate({ ...input, asset: candidate, status: "paused" });
    const asset = appendMandate(candidate, mandate);
    return { ok: true, asset, appended: 1 };
  } catch {
    return { ok: false, asset: input.asset, appended: 0, code: "continuity_command_rejected" };
  }
}

function dueTimes(continuity: CreatureContinuityProjection, now: string) {
  const mandate = continuity.mandate!;
  const end = Date.parse(now);
  const interval = Math.floor(86_400_000 / mandate.maxActionsPerDay);
  const authorityStart = Date.parse(continuity.lastSettledAt ?? mandate.changedAt);
  const boundedStart = Math.max(authorityStart, end - mandate.maxAwayHours * 3_600_000);
  const times: string[] = [];
  const hasLivedExperience = continuity.events.some((event) => CREATURE_CONTINUITY_ACTIONS.includes(event.kind as CreatureAutonomyAction));
  let cursor = authorityStart + (hasLivedExperience ? interval : CREATURE_CONTINUITY_FIRST_EXPERIENCE_MS);
  if (cursor < boundedStart) cursor = boundedStart + (hasLivedExperience ? interval : 0);
  while (cursor <= end && times.length < mandate.maxActionsPerDay * Math.ceil(mandate.maxAwayHours / 24)) {
    times.push(new Date(cursor).toISOString());
    cursor += interval;
  }
  return times;
}

function eventFor(input: Readonly<{
  asset: LivingCardAsset;
  continuity: CreatureContinuityProjection;
  at: string;
  ordinal: number;
}>): CreatureContinuityEvent {
  const mandate = input.continuity.mandate!;
  const seed = `${input.asset.id}:${mandate.digest}:${input.continuity.headDigest ?? "genesis"}:${input.at}:${input.ordinal}`;
  let action = mandate.allowedActions[seedInt(seed) % mandate.allowedActions.length] as CreatureAutonomyAction;
  const hasLivedExperience = input.continuity.events.some((event) => CREATURE_CONTINUITY_ACTIONS.includes(event.kind as CreatureAutonomyAction));
  if (!hasLivedExperience && mandate.allowedActions.includes("meet")) action = "meet";
  const locationId = LOCATIONS[seedInt(seed, 1) % LOCATIONS.length];
  const wanderer = WANDERERS[seedInt(seed, 2) % WANDERERS.length];
  const discovery = DISCOVERIES[seedInt(seed, 3) % DISCOVERIES.length];
  const keepsake = KEEPSAKES[seedInt(seed, 4) % KEEPSAKES.length];
  const held = input.continuity.keepsakes[seedInt(seed, 5) % Math.max(1, input.continuity.keepsakes.length)] ?? null;
  if (action === "barter-keepsake" && !held) action = "discover";
  const social = action === "meet" || action === "bond" || action === "barter-keepsake";
  const commandId = `continuity-command:${sha256PortableBasis(seed).slice(7, 39)}`;
  const basis = {
    schema: "receiz.wildz.creature_continuity_event.v1" as const,
    eventId: `continuity-event:${sha256PortableBasis(`${commandId}:event`).slice(7, 39)}`,
    commandId,
    attemptId: `continuity-attempt:${sha256PortableBasis(`${commandId}:attempt`).slice(7, 39)}`,
    transactionId: action === "barter-keepsake" ? `continuity-transaction:${sha256PortableBasis(`${commandId}:barter`).slice(7, 39)}` : null,
    assetId: input.asset.id,
    ownerReceizId: mandate.ownerReceizId,
    mandateDigest: mandate.digest,
    previousEventDigest: input.continuity.headDigest,
    kind: action,
    occurredAt: input.at,
    locationId,
    counterpartyId: social ? wanderer[0] : null,
    counterpartyName: social ? wanderer[1] : null,
    summary: action === "explore"
      ? `${input.asset.manifest.name} followed a new trail through ${locationId.replaceAll("-", " ")} and brought home ${keepsake.replaceAll("-", " ")}.`
      : action === "discover"
        ? `${input.asset.manifest.name} discovered ${discovery.replaceAll("-", " ")} at ${locationId.replaceAll("-", " ")}.`
        : action === "meet"
          ? `${input.asset.manifest.name} met ${wanderer[1]} at ${locationId.replaceAll("-", " ")}.`
          : action === "bond"
            ? `${input.asset.manifest.name} and ${wanderer[1]} shared a quiet trail ritual at ${locationId.replaceAll("-", " ")}.`
            : `${input.asset.manifest.name} traded ${held!.replaceAll("-", " ")} with ${wanderer[1]} for ${keepsake.replaceAll("-", " ")}.`,
    relationshipDelta: action === "bond" ? 3 : social ? 1 : 0,
    keepsakeGiven: action === "barter-keepsake" ? held : null,
    keepsakeReceived: action === "explore" || action === "barter-keepsake" ? keepsake : null,
    discoveryId: action === "discover" ? discovery : null
  };
  return { ...basis, digest: digest(basis) };
}

export function settleCreatureContinuity(input: Readonly<{
  asset: PortableCardAsset;
  ownerReceizId: string;
  at: string;
}>): CreatureContinuityCommandResult {
  if (!verifyAnyWildsCard(input.asset).ok) return { ok: false, asset: input.asset, appended: 0, code: "continuity_asset_invalid" };
  if (input.asset.manifest.ownerReceizId !== input.ownerReceizId) {
    return { ok: false, asset: input.asset, appended: 0, code: "continuity_owner_mismatch" };
  }
  if (!isLivingCardAsset(input.asset)) return { ok: false, asset: input.asset, appended: 0, code: "continuity_mandate_missing" };
  const initial = currentCreatureHistoryProjection(input.asset).continuity;
  if (!initial?.mandate) return { ok: false, asset: input.asset, appended: 0, code: "continuity_mandate_missing" };
  if (initial.mandate.status !== "active" || initial.mandate.ownerReceizId !== input.ownerReceizId) {
    return { ok: false, asset: input.asset, appended: 0, code: "continuity_mandate_inactive" };
  }
  const times = dueTimes(initial, input.at);
  if (!times.length) return { ok: false, asset: input.asset, appended: 0, code: "continuity_no_action_due" };
  try {
    let candidate = input.asset;
    for (const [ordinal, at] of times.entries()) {
      const continuity = currentCreatureHistoryProjection(candidate).continuity!;
      const event = eventFor({ asset: candidate, continuity, at, ordinal });
      candidate = appendLivingCardHistory({
        asset: candidate,
        event: {
          eventId: event.eventId,
          rulesetVersion: CREATURE_CONTINUITY_RULESET,
          occurredAt: event.occurredAt,
          source: { mode: "continuity", activityId: event.commandId, actorId: mandateActor(event), authority: "local" },
          evidence: { sourceEventDigest: event.digest },
          effects: [{ kind: "continuity-event", event }]
        }
      });
    }
    validateCreatureContinuityProjection(currentCreatureHistoryProjection(candidate).continuity!, candidate.id);
    if (!verifyAnyWildsCard(candidate).ok) throw new Error("continuity_candidate_invalid");
    return { ok: true, asset: candidate, appended: times.length };
  } catch {
    return { ok: false, asset: input.asset, appended: 0, code: "continuity_command_rejected" };
  }
}

function mandateActor(event: CreatureContinuityEvent) {
  return `autonomy:${event.ownerReceizId}`;
}

export interface LivingSubjectContinuityAdapter {
  readonly version: "v120-card-history" | "v120-generic-subject";
  activate(input: Parameters<typeof activateCreatureContinuity>[0]): CreatureContinuityCommandResult;
  pause(input: Parameters<typeof pauseCreatureContinuity>[0]): CreatureContinuityCommandResult;
  settle(input: Parameters<typeof settleCreatureContinuity>[0]): CreatureContinuityCommandResult;
}

/** v120 swaps this adapter for generic subjects/UoW receipts without changing gameplay commands. */
export const livingSubjectContinuityV120: LivingSubjectContinuityAdapter = {
  version: "v120-card-history",
  activate: activateCreatureContinuity,
  pause: pauseCreatureContinuity,
  settle: settleCreatureContinuity
};

export function continuityDigestBasis<T extends { digest: string }>(value: T) {
  return digest(unsigned(value));
}
