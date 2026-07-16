import type { AdventureCardCondition } from "../adventure/card-condition";
import { validateAdventureCondition } from "../adventure/card-condition";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";

export type ArenaLifeState = "healthy" | "strained" | "wounded" | "critical" | "mortal" | "retired";

export type ArenaLivingRevision = Readonly<{
  schema: "receiz.wilds.arena_living_revision.v1";
  assetId: string;
  revision: number;
  parentDigest: string | null;
  eventId: string;
  rulesetId: string;
  occurredAt: string;
  condition: AdventureCardCondition;
  lifeState: ArenaLifeState;
  scarIds: readonly string[];
  relationshipIds: readonly string[];
  achievementIds: readonly string[];
  evolutionIds: readonly string[];
  matchReceiptDigests: readonly string[];
  digest: string;
}>;

export type ArenaLivingRevisionInput = Readonly<{
  assetId: string;
  parent?: ArenaLivingRevision | null;
  eventId: string;
  rulesetId: string;
  occurredAt: string;
  condition: AdventureCardCondition;
  scarIds: readonly string[];
  relationshipIds: readonly string[];
  achievementIds: readonly string[];
  evolutionIds: readonly string[];
  matchReceiptDigests: readonly string[];
}>;

export type ArenaRevisionVerification = Readonly<{ ok: boolean; errors: readonly string[] }>;

const identityPattern = /^[a-z0-9:._-]{1,160}$/i;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function canonicalTime(value: string) {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function validateHistory(values: readonly string[], receipt = false) {
  if (values.length > 512 || new Set(values).size !== values.length) throw new Error("arena_revision_history_invalid");
  if (values.some((value) => receipt ? !digestPattern.test(value) : !identityPattern.test(value))) {
    throw new Error("arena_revision_history_invalid");
  }
}

function containsHistory(parent: readonly string[], child: readonly string[]) {
  return parent.every((value) => child.includes(value));
}

export function deriveArenaLifeState(condition: AdventureCardCondition): ArenaLifeState {
  validateAdventureCondition(condition);
  if (condition.life === "dead") return "retired";
  const injuryLoad = condition.injuries.reduce((total, injury) => total + injury.severity, 0);
  const trauma = condition.recovery?.trauma ?? 0;
  const pressure = Math.max(condition.fatigue, trauma, injuryLoad * 10);
  if (pressure >= 95) return "mortal";
  if (pressure >= 80) return "critical";
  if (pressure >= 55) return "wounded";
  if (pressure >= 20) return "strained";
  return "healthy";
}

function revisionDigest(revision: Omit<ArenaLivingRevision, "digest">) {
  return sha256PortableBasis(canonicalPortableCardJson(revision));
}

function validateInput(input: ArenaLivingRevisionInput) {
  if (!identityPattern.test(input.assetId) || !identityPattern.test(input.eventId) || !identityPattern.test(input.rulesetId)) {
    throw new Error("arena_revision_identity_invalid");
  }
  if (!canonicalTime(input.occurredAt)) throw new Error("arena_revision_time_invalid");
  validateAdventureCondition(input.condition);
  if (input.condition.assetId !== input.assetId) throw new Error("arena_revision_condition_asset_invalid");
  validateHistory(input.scarIds);
  validateHistory(input.relationshipIds);
  validateHistory(input.achievementIds);
  validateHistory(input.evolutionIds);
  validateHistory(input.matchReceiptDigests, true);
  if (input.condition.life === "dead" && (!input.condition.retiredAt || !input.condition.retirementCauseEventId)) {
    throw new Error("arena_revision_retirement_metadata_required");
  }
}

export function createArenaLivingRevision(input: ArenaLivingRevisionInput): ArenaLivingRevision {
  validateInput(input);
  const parent = input.parent ?? null;
  if (parent) {
    if (parent.assetId !== input.assetId) throw new Error("arena_revision_parent_asset_invalid");
    if (!verifyArenaLivingRevisionBasis(parent)) throw new Error("arena_revision_parent_invalid");
    if (Date.parse(input.occurredAt) < Date.parse(parent.occurredAt)) throw new Error("arena_revision_time_invalid");
    if (parent.lifeState === "retired" && input.condition.life !== "dead") throw new Error("arena_revision_retirement_irreversible");
    if (!containsHistory(parent.scarIds, input.scarIds)
      || !containsHistory(parent.relationshipIds, input.relationshipIds)
      || !containsHistory(parent.achievementIds, input.achievementIds)
      || !containsHistory(parent.evolutionIds, input.evolutionIds)
      || !containsHistory(parent.matchReceiptDigests, input.matchReceiptDigests)) {
      throw new Error("arena_revision_history_regression");
    }
  }
  const unsigned: Omit<ArenaLivingRevision, "digest"> = {
    schema: "receiz.wilds.arena_living_revision.v1",
    assetId: input.assetId,
    revision: (parent?.revision ?? 0) + 1,
    parentDigest: parent?.digest ?? null,
    eventId: input.eventId,
    rulesetId: input.rulesetId,
    occurredAt: input.occurredAt,
    condition: input.condition,
    lifeState: deriveArenaLifeState(input.condition),
    scarIds: [...input.scarIds],
    relationshipIds: [...input.relationshipIds],
    achievementIds: [...input.achievementIds],
    evolutionIds: [...input.evolutionIds],
    matchReceiptDigests: [...input.matchReceiptDigests],
  };
  return { ...unsigned, digest: revisionDigest(unsigned) };
}

function verifyArenaLivingRevisionBasis(revision: ArenaLivingRevision) {
  try {
    const { digest, ...unsigned } = revision;
    validateInput({
      assetId: revision.assetId,
      eventId: revision.eventId,
      rulesetId: revision.rulesetId,
      occurredAt: revision.occurredAt,
      condition: revision.condition,
      scarIds: revision.scarIds,
      relationshipIds: revision.relationshipIds,
      achievementIds: revision.achievementIds,
      evolutionIds: revision.evolutionIds,
      matchReceiptDigests: revision.matchReceiptDigests,
    });
    return revision.schema === "receiz.wilds.arena_living_revision.v1"
      && Number.isSafeInteger(revision.revision)
      && revision.revision >= 1
      && (revision.parentDigest === null || digestPattern.test(revision.parentDigest))
      && revision.lifeState === deriveArenaLifeState(revision.condition)
      && digestPattern.test(digest)
      && revisionDigest(unsigned) === digest;
  } catch {
    return false;
  }
}

export function verifyArenaLivingRevisionContent(revision: ArenaLivingRevision) {
  return verifyArenaLivingRevisionBasis(revision);
}

export function verifyArenaLivingRevision(revision: ArenaLivingRevision, parent?: ArenaLivingRevision): ArenaRevisionVerification {
  const errors: string[] = [];
  if (!verifyArenaLivingRevisionBasis(revision)) errors.push("arena_revision_digest_invalid");
  if (revision.revision === 1) {
    if (revision.parentDigest !== null || parent) errors.push("arena_revision_genesis_invalid");
  } else if (!parent) {
    errors.push("arena_revision_parent_required");
  } else {
    if (!verifyArenaLivingRevisionBasis(parent)) errors.push("arena_revision_parent_invalid");
    if (revision.assetId !== parent.assetId
      || revision.revision !== parent.revision + 1
      || revision.parentDigest !== parent.digest) errors.push("arena_revision_parent_mismatch");
    if (Date.parse(revision.occurredAt) < Date.parse(parent.occurredAt)) errors.push("arena_revision_time_invalid");
    if (parent.lifeState === "retired" && revision.lifeState !== "retired") errors.push("arena_revision_retirement_irreversible");
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
