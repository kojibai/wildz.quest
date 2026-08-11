import { applyAdventureConditionDelta, validateAdventureCondition } from "./adventure/card-condition";
import { applyGrowthEvent } from "./growth-engine";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse } from "./kai-klok-moment";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import {
  CREATURE_HISTORY_NAMESPACE,
  type CreateCreatureHistoryAdmissionInput,
  type CreateCreatureHistoryInput,
  type CreatureHistoryAdmissionEnvelope,
  type CreatureHistoryAdmissionNode,
  type CreatureHistoryAdmittedAuthority,
  type CreatureHistoryAuthorityVerifier,
  type CreatureHistoryChain,
  type CreatureHistoryEffect,
  type CreatureHistoryEvent,
  type CreatureHistoryEventDraft,
  type CreatureHistoryKaiCoordinate,
  type CreatureHistoryProjection,
  type CreatureHistoryRecord
} from "./creature-history-types";

const DIGEST = /^sha256:[a-f0-9]{64}$/;
const IDENTITY = /^[a-z0-9:._-]{1,180}$/i;
const MAX_EVENTS = 16_384;
const MAX_EFFECTS = 32;
const MAX_REFERENCES = 512;
const ADMITTED_AUTHORITIES = new Set<CreatureHistoryAdmittedAuthority>(["admitted", "verified-receipt", "canonical"]);

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function canonicalTime(value: string) {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function kaiForDraft(draft: Pick<CreatureHistoryEventDraft, "occurredAt" | "kai">): CreatureHistoryKaiCoordinate {
  if (draft.kai) return { ...draft.kai };
  const moment = deriveKaiKlokMoment({ occurredAt: draft.occurredAt, authority: "local" });
  return {
    uPulse: moment.uPulse,
    pulse: moment.pulse,
    beat: moment.beat,
    stepIndex: moment.stepIndex,
    weekday: moment.weekday,
    chakra: moment.chakra,
    coordinate: moment.coordinate
  };
}

function validateKai(kai: CreatureHistoryKaiCoordinate) {
  if (!Number.isSafeInteger(kai.uPulse)
    || !Number.isSafeInteger(kai.pulse)
    || !Number.isSafeInteger(kai.beat)
    || !Number.isSafeInteger(kai.stepIndex)
    || kai.beat < 0
    || kai.stepIndex < 0
    || !kai.weekday.trim()
    || !kai.chakra.trim()
    || !kai.coordinate.trim()) throw new Error("creature_history_kai_invalid");
  const canonical = deriveKaiKlokMomentFromUPulse({ uPulse: kai.uPulse, authority: "admitted" });
  if (kai.pulse !== canonical.pulse
    || kai.beat !== canonical.beat
    || kai.stepIndex !== canonical.stepIndex
    || kai.weekday !== canonical.weekday
    || kai.chakra !== canonical.chakra
    || kai.coordinate !== canonical.coordinate) throw new Error("creature_history_kai_invalid");
}

function validateTextList(values: readonly string[], error: string, digestOnly = false) {
  if (values.length > MAX_REFERENCES || new Set(values).size !== values.length) throw new Error(error);
  if (values.some((value) => digestOnly ? !DIGEST.test(value) : !IDENTITY.test(value))) throw new Error(error);
}

function validateRecord(record: CreatureHistoryRecord) {
  for (const value of Object.values(record)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new Error("creature_history_record_invalid");
  }
}

function validateGrowth(projection: CreatureHistoryProjection) {
  const growth = projection.growth;
  if (!Number.isSafeInteger(growth.bond) || growth.bond < 0 || growth.bond > 1_000_000) throw new Error("creature_history_growth_invalid");
  for (const value of Object.values(growth.paths)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new Error("creature_history_growth_invalid");
  }
  validateTextList(growth.eventIds, "creature_history_growth_invalid");
  validateTextList(growth.achievementIds, "creature_history_growth_invalid");
  validateTextList(growth.consumedAchievementIds, "creature_history_growth_invalid");
  validateTextList(growth.completedQuestIds, "creature_history_growth_invalid");
  if (growth.recoveryUntil !== null && !canonicalTime(growth.recoveryUntil)) throw new Error("creature_history_growth_invalid");
}

export function validateCreatureHistoryProjection(projection: CreatureHistoryProjection) {
  if (projection.schema !== "receiz.wildz.creature_history_projection.v1"
    || !IDENTITY.test(projection.assetId)
    || !IDENTITY.test(projection.formId)
    || !DIGEST.test(projection.livingRevisionDigest)
    || !Number.isSafeInteger(projection.level)
    || projection.level < 1
    || projection.level > 10
    || !Number.isSafeInteger(projection.xp)
    || projection.xp < 0
    || projection.xp > 99
    || !Number.isSafeInteger(projection.bond)
    || projection.bond < 0
    || projection.bond > 1_000_000
    || !Number.isSafeInteger(projection.stage)
    || projection.stage < 1
    || projection.stage > 3
    || !Number.isSafeInteger(projection.ascensionRank)
    || projection.ascensionRank < 0
    || projection.ascensionRank > 1_000_000) throw new Error("creature_history_projection_invalid");
  validateGrowth(projection);
  validateAdventureCondition(projection.condition);
  if (projection.condition.assetId !== projection.assetId
    || projection.bond !== projection.growth.bond
    || canonicalPortableCardJson(projection.mastery) !== canonicalPortableCardJson(projection.condition.mastery)) {
    throw new Error("creature_history_projection_invalid");
  }
  validateRecord(projection.record);
  validateTextList(projection.achievements, "creature_history_projection_invalid");
  validateTextList(projection.relationships, "creature_history_projection_invalid");
  validateTextList(projection.scars, "creature_history_projection_invalid");
  validateTextList(projection.upgrades, "creature_history_projection_invalid");
  return projection;
}

function projectionDigest(projection: CreatureHistoryProjection) {
  validateCreatureHistoryProjection(projection);
  return digest(projection);
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function applyProgress(projection: CreatureHistoryProjection, effect: Extract<CreatureHistoryEffect, { kind: "progress" }>) {
  if (!Number.isSafeInteger(effect.xpDelta) || effect.xpDelta < 0 || effect.xpDelta > 1_000_000 || effect.growthEvents.length > 64) {
    throw new Error("creature_history_progress_invalid");
  }
  const totalXp = projection.xp + effect.xpDelta;
  const levels = Math.min(10 - projection.level, Math.floor(totalXp / 100));
  let growth = projection.growth;
  for (const event of effect.growthEvents) growth = applyGrowthEvent(growth, event);
  return {
    ...projection,
    level: projection.level + levels,
    xp: projection.level + levels >= 10 ? Math.min(99, totalXp % 100) : totalXp % 100,
    bond: growth.bond,
    growth,
    achievements: unique([...projection.achievements, ...growth.achievementIds])
  } satisfies CreatureHistoryProjection;
}

function applyRecord(projection: CreatureHistoryProjection, effect: Extract<CreatureHistoryEffect, { kind: "record" }>) {
  const record = { ...projection.record };
  for (const [key, amount] of Object.entries(effect.counters) as Array<[keyof CreatureHistoryRecord, number]>) {
    if (!(key in record) || !Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000) throw new Error("creature_history_record_invalid");
    record[key] = Math.min(1_000_000, record[key] + amount);
  }
  return {
    ...projection,
    record,
    achievements: unique([...projection.achievements, ...effect.achievementIds]),
    relationships: unique([...projection.relationships, ...effect.relationshipIds]),
    scars: unique([...projection.scars, ...effect.scarIds]),
    upgrades: unique([...projection.upgrades, ...effect.upgradeIds])
  } satisfies CreatureHistoryProjection;
}

function historyContains(parent: readonly string[], child: readonly string[]) {
  return parent.every((value) => child.includes(value));
}

function assertCheckpointDoesNotRegress(prior: CreatureHistoryProjection, next: CreatureHistoryProjection) {
  if (prior.condition.life === "dead" && next.condition.life !== "dead") throw new Error("creature_history_mortality_irreversible");
  if ((next.level - 1) * 100 + next.xp < (prior.level - 1) * 100 + prior.xp
    || next.bond < prior.bond
    || !historyContains(prior.achievements, next.achievements)
    || !historyContains(prior.relationships, next.relationships)
    || !historyContains(prior.scars, next.scars)
    || !historyContains(prior.upgrades, next.upgrades)) throw new Error("creature_history_projection_regression");
}

function applyEffects(prior: CreatureHistoryProjection | null, effects: readonly CreatureHistoryEffect[]) {
  if (!effects.length || effects.length > MAX_EFFECTS) throw new Error("creature_history_effects_invalid");
  let projection = prior;
  for (const effect of effects) {
    if (effect.kind === "legacy-checkpoint") {
      validateCreatureHistoryProjection(effect.projection);
      if (projection) assertCheckpointDoesNotRegress(projection, effect.projection);
      projection = structuredClone(effect.projection);
      continue;
    }
    if (!projection) throw new Error("creature_history_genesis_checkpoint_required");
    if (effect.kind === "progress") projection = applyProgress(projection, effect);
    if (effect.kind === "condition") {
      const condition = applyAdventureConditionDelta(projection.condition, effect.delta);
      projection = { ...projection, condition, mastery: { ...condition.mastery }, upgrades: unique([...projection.upgrades, ...condition.upgradeIds]) };
    }
    if (effect.kind === "record") projection = applyRecord(projection, effect);
    if (effect.kind === "transformation") {
      if (effect.fromRevisionDigest !== projection.livingRevisionDigest
        || !DIGEST.test(effect.toRevisionDigest)
        || !IDENTITY.test(effect.formId)
        || !Number.isSafeInteger(effect.stage)
        || effect.stage < projection.stage
        || effect.stage > 3
        || !Number.isSafeInteger(effect.ascensionRank)
        || effect.ascensionRank < projection.ascensionRank) throw new Error("creature_history_transformation_invalid");
      projection = {
        ...projection,
        formId: effect.formId,
        stage: effect.stage,
        ascensionRank: effect.ascensionRank,
        livingRevisionDigest: effect.toRevisionDigest
      };
    }
  }
  if (!projection) throw new Error("creature_history_genesis_checkpoint_required");
  return validateCreatureHistoryProjection(projection);
}

function isAdmittedAuthority(authority: CreatureHistoryEventDraft["source"]["authority"]): authority is CreatureHistoryAdmittedAuthority {
  return ADMITTED_AUTHORITIES.has(authority as CreatureHistoryAdmittedAuthority);
}

function admissionUnsigned(envelope: CreatureHistoryAdmissionEnvelope) {
  const { digest: _digest, ...unsigned } = envelope;
  return unsigned;
}

function validateAdmissionShape(envelope: CreatureHistoryAdmissionEnvelope) {
  const node = envelope.node;
  if (envelope.schema !== "receiz.wildz.creature_history_admission.v1"
    || node.schema !== "receiz.wildz.creature_history_admission_node.v1"
    || !ADMITTED_AUTHORITIES.has(node.authority)
    || !IDENTITY.test(node.issuerId)
    || !IDENTITY.test(node.assetId)
    || !IDENTITY.test(node.eventId)
    || !IDENTITY.test(node.rulesetVersion)
    || !DIGEST.test(node.verificationDigest)
    || !DIGEST.test(node.rootProofDigest)
    || !DIGEST.test(node.rootDigest)
    || !DIGEST.test(node.parentDigest)
    || !DIGEST.test(node.sourceDigest)
    || !DIGEST.test(node.evidenceDigest)
    || !DIGEST.test(node.effectsDigest)
    || !DIGEST.test(node.resultingProjectionDigest)
    || !DIGEST.test(node.receiptDigest)
    || !DIGEST.test(node.replayDigest)
    || !DIGEST.test(envelope.digest)
    || !canonicalTime(node.occurredAt)) throw new Error("creature_history_authority_admission_invalid");
  validateKai(node.kai);
  if (digest(admissionUnsigned(envelope)) !== envelope.digest) throw new Error("creature_history_authority_admission_invalid");
}

function validateDraft(draft: CreatureHistoryEventDraft, requireAdmission = true) {
  if (!IDENTITY.test(draft.eventId)
    || !IDENTITY.test(draft.rulesetVersion)
    || !canonicalTime(draft.occurredAt)
    || !IDENTITY.test(draft.source.activityId)
    || !IDENTITY.test(draft.source.actorId)
    || !["local", "admitted", "verified-receipt", "canonical", "legacy-migration"].includes(draft.source.authority)) {
    throw new Error("creature_history_event_invalid");
  }
  validateKai(kaiForDraft(draft));
  for (const value of [draft.evidence.receiptDigest, draft.evidence.replayDigest, draft.evidence.sourceEventDigest]) {
    if (value !== undefined && !DIGEST.test(value)) throw new Error("creature_history_evidence_invalid");
  }
  if (isAdmittedAuthority(draft.source.authority)) {
    if (!draft.kai || !draft.evidence.receiptDigest || !draft.evidence.replayDigest) {
      throw new Error("creature_history_authority_evidence_required");
    }
    if (requireAdmission && !draft.evidence.admission) throw new Error("creature_history_authority_admission_required");
    if (draft.evidence.admission) validateAdmissionShape(draft.evidence.admission);
  } else if (draft.evidence.admission) {
    throw new Error("creature_history_authority_admission_invalid");
  }
  validateTextList(draft.evidence.sourceEventIds ?? [], "creature_history_evidence_invalid");
  if (draft.effects.length > MAX_EFFECTS) throw new Error("creature_history_effects_invalid");
}

function expectedAdmissionNode(input: {
  chain: Pick<CreatureHistoryChain, "assetId" | "rootProofDigest" | "rootDigest">;
  parentDigest: string;
  draft: CreatureHistoryEventDraft;
  issuerId: string;
  verificationDigest: string;
  resultingProjectionDigest: string;
}): CreatureHistoryAdmissionNode {
  const receiptDigest = input.draft.evidence.receiptDigest;
  const replayDigest = input.draft.evidence.replayDigest;
  if (!isAdmittedAuthority(input.draft.source.authority)
    || !input.draft.kai
    || !receiptDigest
    || !replayDigest) throw new Error("creature_history_authority_evidence_required");
  return {
    schema: "receiz.wildz.creature_history_admission_node.v1",
    authority: input.draft.source.authority,
    issuerId: input.issuerId,
    verificationDigest: input.verificationDigest,
    assetId: input.chain.assetId,
    rootProofDigest: input.chain.rootProofDigest,
    rootDigest: input.chain.rootDigest,
    parentDigest: input.parentDigest,
    eventId: input.draft.eventId,
    rulesetVersion: input.draft.rulesetVersion,
    occurredAt: input.draft.occurredAt,
    kai: structuredClone(input.draft.kai),
    sourceDigest: digest(input.draft.source),
    evidenceDigest: digest({
      receiptDigest: input.draft.evidence.receiptDigest,
      replayDigest: input.draft.evidence.replayDigest,
      sourceEventDigest: input.draft.evidence.sourceEventDigest,
      sourceEventIds: input.draft.evidence.sourceEventIds
    }),
    effectsDigest: digest(input.draft.effects),
    resultingProjectionDigest: input.resultingProjectionDigest,
    receiptDigest,
    replayDigest
  };
}

function admissionMatches(input: {
  chain: Pick<CreatureHistoryChain, "assetId" | "rootProofDigest" | "rootDigest">;
  parentDigest: string;
  draft: CreatureHistoryEventDraft;
  resultingProjectionDigest: string;
}) {
  const admission = input.draft.evidence.admission;
  if (!admission) return false;
  try {
    validateAdmissionShape(admission);
    const expected = expectedAdmissionNode({
      ...input,
      issuerId: admission.node.issuerId,
      verificationDigest: admission.node.verificationDigest
    });
    return canonicalPortableCardJson(admission.node) === canonicalPortableCardJson(expected);
  } catch {
    return false;
  }
}

export function createCreatureHistoryAdmission(input: CreateCreatureHistoryAdmissionInput): CreatureHistoryAdmissionEnvelope {
  if (!verifyCreatureHistory(input.chain).ok) throw new Error("creature_history_previous_invalid");
  validateDraft(input.event, false);
  if (!IDENTITY.test(input.issuerId) || !DIGEST.test(input.verificationDigest)) {
    throw new Error("creature_history_authority_admission_invalid");
  }
  const projection = applyEffects(input.chain.projection, input.event.effects);
  const node = expectedAdmissionNode({
    chain: input.chain,
    parentDigest: input.chain.headDigest,
    draft: input.event,
    issuerId: input.issuerId,
    verificationDigest: input.verificationDigest,
    resultingProjectionDigest: projectionDigest(projection)
  });
  const unsigned = { schema: "receiz.wildz.creature_history_admission.v1" as const, node };
  return { ...unsigned, digest: digest(unsigned) };
}

export function verifyCreatureHistoryAdmission(chain: CreatureHistoryChain, event: CreatureHistoryEventDraft) {
  if (!verifyCreatureHistory(chain).ok) return false;
  try {
    validateDraft(event);
    const projection = applyEffects(chain.projection, event.effects);
    return admissionMatches({
      chain,
      parentDigest: chain.headDigest,
      draft: event,
      resultingProjectionDigest: projectionDigest(projection)
    });
  } catch {
    return false;
  }
}

function rootDigest(input: Pick<CreatureHistoryChain, "assetId" | "rootProofDigest">) {
  return digest({ namespace: CREATURE_HISTORY_NAMESPACE, assetId: input.assetId, rootProofDigest: input.rootProofDigest });
}

function eventUnsigned(input: Omit<CreatureHistoryEvent, "digest">) {
  return input;
}

function draftBasis(draft: CreatureHistoryEventDraft) {
  return canonicalPortableCardJson({ ...draft, kai: kaiForDraft(draft) });
}

function eventDraftBasis(event: CreatureHistoryEvent) {
  return canonicalPortableCardJson({
    eventId: event.eventId,
    rulesetVersion: event.rulesetVersion,
    occurredAt: event.occurredAt,
    kai: event.kai,
    source: event.source,
    evidence: event.evidence,
    effects: event.effects
  });
}

export function appendCreatureHistoryEvent(chain: CreatureHistoryChain, draft: CreatureHistoryEventDraft): CreatureHistoryChain {
  const verified = verifyCreatureHistory(chain);
  if (!verified.ok) throw new Error("creature_history_previous_invalid");
  validateDraft(draft);
  const duplicate = chain.events.find((event) => event.eventId === draft.eventId);
  if (duplicate) {
    if (eventDraftBasis(duplicate) === draftBasis(draft)) return chain;
    throw new Error("creature_history_event_conflict");
  }
  if (chain.events.length >= MAX_EVENTS) throw new Error("creature_history_capacity_exceeded");
  const kai = kaiForDraft(draft);
  const prior = chain.events.at(-1)!;
  if (kai.uPulse < prior.kai.uPulse) throw new Error("creature_history_kai_regression");
  const projection = applyEffects(chain.projection, draft.effects);
  if (projection.assetId !== chain.assetId) throw new Error("creature_history_asset_invalid");
  const resultingProjectionDigest = projectionDigest(projection);
  if (isAdmittedAuthority(draft.source.authority) && !admissionMatches({
    chain,
    parentDigest: chain.headDigest,
    draft,
    resultingProjectionDigest
  })) throw new Error("creature_history_authority_admission_invalid");
  const unsigned: Omit<CreatureHistoryEvent, "digest"> = {
    schema: "receiz.wildz.creature_history_event.v1",
    namespace: CREATURE_HISTORY_NAMESPACE,
    rulesetVersion: draft.rulesetVersion,
    sequence: chain.events.length + 1,
    eventId: draft.eventId,
    assetId: chain.assetId,
    rootProofDigest: chain.rootProofDigest,
    parentDigest: chain.headDigest,
    occurredAt: draft.occurredAt,
    kai,
    source: structuredClone(draft.source),
    evidence: structuredClone(draft.evidence),
    effects: structuredClone(draft.effects),
    resultingProjectionDigest
  };
  const event = { ...unsigned, digest: digest(eventUnsigned(unsigned)) };
  return {
    ...chain,
    events: [...chain.events, event],
    headDigest: event.digest,
    projection: structuredClone(projection),
    projectionDigest: resultingProjectionDigest
  };
}

export function createCreatureHistory(input: CreateCreatureHistoryInput): CreatureHistoryChain {
  if (!IDENTITY.test(input.assetId) || !DIGEST.test(input.rootProofDigest)) throw new Error("creature_history_root_invalid");
  validateCreatureHistoryProjection(input.projection);
  if (input.projection.assetId !== input.assetId) throw new Error("creature_history_asset_invalid");
  const root = rootDigest(input);
  const completeness = input.completeness ?? "complete";
  const draft: CreatureHistoryEventDraft = {
    eventId: `${completeness === "complete" ? "birth" : "migration"}:${input.assetId}`,
    rulesetVersion: input.rulesetVersion,
    occurredAt: input.occurredAt,
    ...(input.kai ? { kai: input.kai } : {}),
    source: {
      mode: completeness === "complete" ? "birth" : "migration",
      activityId: `${completeness === "complete" ? "birth" : "migration"}:${input.assetId}`,
      actorId: input.actorId,
      authority: completeness === "complete" ? "local" : "legacy-migration"
    },
    evidence: {},
    effects: [{ kind: "legacy-checkpoint", projection: structuredClone(input.projection) }]
  };
  validateDraft(draft);
  const kai = kaiForDraft(draft);
  const resultDigest = projectionDigest(input.projection);
  const unsigned: Omit<CreatureHistoryEvent, "digest"> = {
    schema: "receiz.wildz.creature_history_event.v1",
    namespace: CREATURE_HISTORY_NAMESPACE,
    rulesetVersion: draft.rulesetVersion,
    sequence: 1,
    eventId: draft.eventId,
    assetId: input.assetId,
    rootProofDigest: input.rootProofDigest,
    parentDigest: root,
    occurredAt: draft.occurredAt,
    kai,
    source: draft.source,
    evidence: draft.evidence,
    effects: draft.effects,
    resultingProjectionDigest: resultDigest
  };
  const event = { ...unsigned, digest: digest(unsigned) };
  return {
    schema: "receiz.wildz.creature_history.v1",
    namespace: CREATURE_HISTORY_NAMESPACE,
    assetId: input.assetId,
    rootProofDigest: input.rootProofDigest,
    rootDigest: root,
    completeness,
    events: [event],
    headDigest: event.digest,
    projection: structuredClone(input.projection),
    projectionDigest: resultDigest
  };
}

export function verifyCreatureHistory(chain: CreatureHistoryChain): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  try {
    if (chain.schema !== "receiz.wildz.creature_history.v1"
      || chain.namespace !== CREATURE_HISTORY_NAMESPACE
      || !IDENTITY.test(chain.assetId)
      || !DIGEST.test(chain.rootProofDigest)
      || chain.rootDigest !== rootDigest(chain)
      || (chain.completeness !== "complete" && chain.completeness !== "legacy-checkpoint")
      || !chain.events.length
      || chain.events.length > MAX_EVENTS) throw new Error("creature_history_root_invalid");
    let projection: CreatureHistoryProjection | null = null;
    let parentDigest = chain.rootDigest;
    let priorUPulse: number | null = null;
    const eventIds = new Set<string>();
    chain.events.forEach((event, index) => {
      validateDraft({
        eventId: event.eventId,
        rulesetVersion: event.rulesetVersion,
        occurredAt: event.occurredAt,
        kai: event.kai,
        source: event.source,
        evidence: event.evidence,
        effects: event.effects
      });
      if (event.schema !== "receiz.wildz.creature_history_event.v1"
        || event.namespace !== CREATURE_HISTORY_NAMESPACE
        || event.sequence !== index + 1
        || event.assetId !== chain.assetId
        || event.rootProofDigest !== chain.rootProofDigest
        || event.parentDigest !== parentDigest
        || eventIds.has(event.eventId)
        || (priorUPulse !== null && event.kai.uPulse < priorUPulse)) throw new Error("creature_history_chain_invalid");
      projection = applyEffects(projection, event.effects);
      const expectedProjectionDigest = projectionDigest(projection);
      if (isAdmittedAuthority(event.source.authority) && !admissionMatches({
        chain,
        parentDigest,
        draft: event,
        resultingProjectionDigest: expectedProjectionDigest
      })) throw new Error("creature_history_authority_admission_invalid");
      const { digest: storedDigest, ...unsigned } = event;
      if (event.resultingProjectionDigest !== expectedProjectionDigest || storedDigest !== digest(unsigned)) {
        throw new Error("creature_history_digest_invalid");
      }
      eventIds.add(event.eventId);
      parentDigest = event.digest;
      priorUPulse = event.kai.uPulse;
    });
    if (!projection
      || chain.headDigest !== parentDigest
      || chain.projectionDigest !== projectionDigest(projection)
      || canonicalPortableCardJson(chain.projection) !== canonicalPortableCardJson(projection)) {
      throw new Error("creature_history_projection_invalid");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "creature_history_invalid");
  }
  return { ok: errors.length === 0, errors };
}

export function isCreatureHistoryDescendant(ancestor: CreatureHistoryChain, descendant: CreatureHistoryChain) {
  if (!verifyCreatureHistory(ancestor).ok || !verifyCreatureHistory(descendant).ok
    || ancestor.assetId !== descendant.assetId
    || ancestor.rootProofDigest !== descendant.rootProofDigest
    || descendant.events.length <= ancestor.events.length) return false;
  return ancestor.events.every((event, index) => descendant.events[index]?.digest === event.digest);
}

function latestAdmittedEvent(chain: CreatureHistoryChain) {
  for (let index = chain.events.length - 1; index >= 0; index -= 1) {
    const event = chain.events[index]!;
    if (isAdmittedAuthority(event.source.authority)) return event;
  }
  return null;
}

function trustedAdmittedEvent(chain: CreatureHistoryChain, verifier?: CreatureHistoryAuthorityVerifier) {
  const event = latestAdmittedEvent(chain);
  if (!event) return { event: null, trusted: false } as const;
  const envelope = event.evidence.admission;
  if (!envelope || !verifier) return { event, trusted: false } as const;
  try {
    return { event, trusted: verifier.verifyAdmission({ envelope, event, chain }) === true } as const;
  } catch {
    return { event, trusted: false } as const;
  }
}

function descendantSuffixIsTrusted(
  ancestor: CreatureHistoryChain,
  descendant: CreatureHistoryChain,
  verifier?: CreatureHistoryAuthorityVerifier
) {
  for (let index = ancestor.events.length; index < descendant.events.length; index += 1) {
    const event = descendant.events[index]!;
    if (!isAdmittedAuthority(event.source.authority)) continue;
    const envelope = event.evidence.admission;
    if (!envelope || !verifier) return false;
    try {
      if (verifier.verifyAdmission({ envelope, event, chain: descendant }) !== true) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function compareCreatureHistoryHeads(
  left: CreatureHistoryChain,
  right: CreatureHistoryChain,
  verifier?: CreatureHistoryAuthorityVerifier
): "left" | "right" | "equal" {
  if (!verifyCreatureHistory(left).ok || !verifyCreatureHistory(right).ok) throw new Error("creature_history_invalid");
  if (left.assetId !== right.assetId || left.rootProofDigest !== right.rootProofDigest || left.rootDigest !== right.rootDigest) {
    throw new Error("creature_history_root_conflict");
  }
  if (left.headDigest === right.headDigest) return "equal";
  if (isCreatureHistoryDescendant(left, right)) {
    if (!descendantSuffixIsTrusted(left, right, verifier)) throw new Error("creature_history_authority_untrusted");
    return "right";
  }
  if (isCreatureHistoryDescendant(right, left)) {
    if (!descendantSuffixIsTrusted(right, left, verifier)) throw new Error("creature_history_authority_untrusted");
    return "left";
  }
  const leftAdmission = trustedAdmittedEvent(left, verifier);
  const rightAdmission = trustedAdmittedEvent(right, verifier);
  if ((leftAdmission.event && !leftAdmission.trusted) || (rightAdmission.event && !rightAdmission.trusted)) {
    throw new Error("creature_history_authority_untrusted");
  }
  const leftAuthority = leftAdmission.event;
  const rightAuthority = rightAdmission.event;
  if (leftAuthority && !rightAuthority) return "left";
  if (rightAuthority && !leftAuthority) return "right";
  if (!leftAuthority || !rightAuthority) throw new Error("creature_history_unadmitted_branch_conflict");
  const leftUPulse = leftAuthority.kai.uPulse;
  const rightUPulse = rightAuthority.kai.uPulse;
  if (leftUPulse > rightUPulse) return "left";
  if (rightUPulse > leftUPulse) return "right";
  throw new Error("creature_history_authority_slot_conflict");
}
