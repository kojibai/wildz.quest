import { creatureForm } from "./creature-catalog";
import {
  createCreatureObserverMemoryTurn,
  MAX_CREATURE_OBSERVER_REPLY_TEXT,
  MAX_CREATURE_OBSERVER_USER_TEXT
} from "./creature-history";
import type {
  CreatureHistoryEffect,
  CreatureHistoryEvidence,
  CreatureHistoryKaiCoordinate,
  CreatureHistorySource,
  CreatureObserverMemoryTurn
} from "./creature-history-types";
import { projectLivingCardDossier } from "./living-card-dossier";
import { currentCreatureHistoryProjection, currentLivingGenome } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  verifyAnyWildsCard,
  type PortableCardAsset
} from "./portable-card";

export const CREATURE_BRAIN_SCHEMA = "receiz.wildz.creature_brain.v1" as const;
export const CREATURE_OBSERVER_ROUTE = "/api/receiz/creature-observer" as const;

export type CreatureBrainProjection = Readonly<{
  schema: typeof CREATURE_BRAIN_SCHEMA;
  brainId: string;
  subject: "portable-creature-card";
  authority: {
    source: "verified-card-proof-and-appended-history";
    observer: "receiz-twin";
    modelMayAppendObservedMemory: true;
    modelMayRewriteProof: false;
  };
  identity: {
    assetId: string;
    proofDigest: string;
    name: string;
    species: string;
    familyId: string;
    formId: string;
    stage: number;
    rarity: string;
    capturedAt: string;
    visualFingerprint: string;
  };
  personality: {
    story: string;
    motivations: readonly string[];
    traits: readonly string[];
    habitat: string;
    bonding: readonly string[];
    cautions: readonly string[];
    quirks: readonly string[];
    communication: string;
    careCues: readonly string[];
  };
  embodiment: {
    stats: Readonly<{ health: number; power: number; guard: number; speed: number; bond: number }>;
    abilities: readonly string[];
    role: string;
    condition: Readonly<{ life: "alive" | "dead"; fatigue: number; injuryCount: number }>;
    level: number;
    xp: number;
    bond: number;
  };
  memory: {
    innateSelf: Readonly<{
      kind: "pre-capture-self";
      identityAnchor: string;
      selfKnowledge: string;
      temperament: string;
      signatureGesture: string;
      battleStance: string;
      habitat: string;
      traits: readonly string[];
      motivations: readonly string[];
      communication: string;
      originalStats: Readonly<{ health: number; power: number; guard: number; speed: number; bond: number }>;
      originalAbilities: readonly string[];
      proofDigest: string;
    }>;
    capture: Readonly<{
      kind: "capture" | "starter" | "fusion" | "legacy_admission";
      relationshipMeaning: "first-owner-shared-memory";
      occurredAt: string;
      encounterId: string;
      habitat: string;
      kaiPulse: string;
      summary: string;
      proofDigest: string;
    }>;
    historyHead: string | null;
    historyEvents: number;
    eventLedger: readonly Readonly<{
      sequence: number;
      eventId: string;
      occurredAt: string;
      kai: CreatureHistoryKaiCoordinate;
      source: CreatureHistorySource;
      evidence: CreatureHistoryEvidence;
      effects: readonly CreatureHistoryEffect[];
      resultingProjectionDigest: string;
      digest: string;
    }>[];
    observerHead: string | null;
    observedTurns: readonly CreatureObserverMemoryTurn[];
    continuity: null | Readonly<{
      status: "active" | "paused";
      locationId: string;
      eventHead: string | null;
      livedEvents: readonly Readonly<{ kind: string; occurredAt: string; summary: string; digest: string }>[];
      relationships: readonly Readonly<{ subjectId: string; name: string; affinity: number; meetings: number }>[];
      keepsakes: readonly string[];
      discoveries: readonly string[];
    }>;
  };
  performance: {
    voice: "first-person-creature";
    groundedInExactMemory: true;
    acknowledgeUnknowns: true;
    neverImpersonateOwner: true;
    expression: Readonly<{
      voiceSignature: string;
      cadence: "deliberate" | "steady" | "quick";
      temperament: string;
      signatureGesture: string;
      battleStance: string;
      auraLanguage: string;
      bondRegister: "guarded" | "familiar" | "trusted" | "profound";
      emotionalOpenness: number;
      evolvesOnlyFromProofState: true;
    }>;
  };
  contextDigest: string;
}>;

export type CreatureObserverRequest = Readonly<{
  card: PortableCardAsset;
  message: string;
  clientUserMessageId?: string;
}>;

function compactText(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function brainUnsigned(asset: PortableCardAsset) {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("creature_observer_form_unknown");
  const dossier = projectLivingCardDossier(asset, "https://wildz.quest");
  const living = isLivingCardAsset(asset) ? asset : null;
  const history = living?.manifest.history ?? null;
  const birthGenome = living?.manifest.birthGenome ?? null;
  const birthRevision = living?.manifest.revisions[0] ?? null;
  const embodiedGenome = living ? currentLivingGenome(living) : birthGenome;
  const statMaximum = Math.max(1, ...Object.values(asset.manifest.stats));
  const speedRatio = asset.manifest.stats.speed / statMaximum;
  const bondRatio = dossier.gameplay.bond / 100;
  const observerMemory = living && history ? currentCreatureHistoryProjection(living).observerMemory : undefined;
  const continuity = living && history ? currentCreatureHistoryProjection(living).continuity : undefined;
  const captureKind = living?.manifest.birth.kind ?? "capture";
  const capture = {
    kind: captureKind,
    relationshipMeaning: "first-owner-shared-memory" as const,
    occurredAt: living?.manifest.birth.bornAt ?? asset.manifest.capturedAt,
    encounterId: asset.manifest.encounterId,
    habitat: dossier.personality.habitat,
    kaiPulse: asset.manifest.variant.kaiPulse,
    summary: captureKind === "starter"
      ? `${asset.manifest.name}'s owner-shared story began as a starter bond in ${dossier.personality.habitat}.`
      : captureKind === "fusion"
        ? `${asset.manifest.name}'s owner-shared story began through a proof-recorded fusion bond in ${dossier.personality.habitat}.`
        : captureKind === "legacy_admission"
          ? `${asset.manifest.name}'s existing self and capture encounter ${asset.manifest.encounterId} entered verified owner-shared continuity.`
          : `${asset.manifest.name} first shared a bond with its owner when encountered and captured in ${dossier.personality.habitat}.`,
    proofDigest: asset.proof.digest
  } as const;
  return {
    schema: CREATURE_BRAIN_SCHEMA,
    brainId: `wildz-brain:${asset.id}`,
    subject: "portable-creature-card" as const,
    authority: {
      source: "verified-card-proof-and-appended-history" as const,
      observer: "receiz-twin" as const,
      modelMayAppendObservedMemory: true as const,
      modelMayRewriteProof: false as const
    },
    identity: {
      assetId: asset.id,
      proofDigest: asset.proof.digest,
      name: asset.manifest.name,
      species: asset.manifest.species,
      familyId: asset.manifest.familyId,
      formId: asset.manifest.formId,
      stage: asset.manifest.stage,
      rarity: asset.manifest.rarity,
      capturedAt: asset.manifest.capturedAt,
      visualFingerprint: asset.manifest.variant.traits.visualFingerprint
    },
    personality: {
      story: dossier.story,
      motivations: dossier.personality.motivations,
      traits: dossier.personality.traits,
      habitat: dossier.personality.habitat,
      bonding: dossier.personality.bonding,
      cautions: dossier.personality.cautions,
      quirks: dossier.personality.quirks,
      communication: dossier.personality.communication,
      careCues: dossier.personality.careCues
    },
    embodiment: {
      stats: { ...asset.manifest.stats },
      abilities: [...asset.manifest.abilityNames],
      role: dossier.gameplay.role,
      condition: dossier.gameplay.condition,
      level: dossier.gameplay.level,
      xp: dossier.gameplay.xp,
      bond: dossier.gameplay.bond
    },
    memory: {
      innateSelf: {
        kind: "pre-capture-self" as const,
        identityAnchor: birthGenome?.identityAnchor ?? asset.manifest.variant.traits.visualFingerprint,
        selfKnowledge: `${asset.manifest.name} already knew its own ${dossier.personality.traits.slice(0, 3).join(", ").toLowerCase()} nature, ${dossier.personality.habitat} home signal, and ${dossier.personality.communication.toLowerCase()} way of communicating before its shared story with an owner began.`,
        temperament: birthGenome?.behavior.temperament ?? dossier.personality.traits[0] ?? "self-aware",
        signatureGesture: birthGenome?.behavior.signatureGesture ?? dossier.personality.communication,
        battleStance: birthGenome?.behavior.battleStance ?? "instinctive",
        habitat: dossier.personality.habitat,
        traits: [...dossier.personality.traits],
        motivations: [...dossier.personality.motivations],
        communication: dossier.personality.communication,
        originalStats: { ...(birthRevision?.stats ?? asset.manifest.stats) },
        originalAbilities: [...(birthRevision?.abilityNames ?? asset.manifest.abilityNames)],
        proofDigest: living?.manifest.birth.legacyDigest ?? asset.proof.digest
      },
      capture,
      historyHead: history?.headDigest ?? null,
      historyEvents: history?.events.length ?? 0,
      eventLedger: history?.events.map((event) => ({
        sequence: event.sequence,
        eventId: event.eventId,
        occurredAt: event.occurredAt,
        kai: { ...event.kai },
        source: { ...event.source },
        evidence: structuredClone(event.evidence),
        effects: structuredClone(event.effects),
        resultingProjectionDigest: event.resultingProjectionDigest,
        digest: event.digest
      })) ?? [],
      observerHead: observerMemory?.headDigest ?? null,
      observedTurns: observerMemory?.turns ?? [],
      continuity: continuity?.mandate ? {
        status: continuity.mandate.ownerReceizId === asset.manifest.ownerReceizId
          ? continuity.mandate.status
          : "paused",
        locationId: continuity.locationId,
        eventHead: continuity.headDigest,
        livedEvents: continuity.events.map((event) => ({
          kind: event.kind,
          occurredAt: event.occurredAt,
          summary: event.summary,
          digest: event.digest
        })),
        relationships: continuity.relationships.map((relationship) => ({ ...relationship })),
        keepsakes: [...continuity.keepsakes],
        discoveries: [...continuity.discoveries]
      } : null
    },
    performance: {
      voice: "first-person-creature" as const,
      groundedInExactMemory: true as const,
      acknowledgeUnknowns: true as const,
      neverImpersonateOwner: true as const,
      expression: {
        voiceSignature: `expression:${sha256PortableBasis(`${asset.id}:${asset.manifest.variant.traits.visualFingerprint}`).slice(7, 23)}`,
        cadence: speedRatio >= .72 ? "quick" as const : speedRatio <= .42 ? "deliberate" as const : "steady" as const,
        temperament: embodiedGenome?.behavior.temperament ?? dossier.personality.traits[0] ?? "self-aware",
        signatureGesture: embodiedGenome?.behavior.signatureGesture ?? dossier.personality.communication,
        battleStance: embodiedGenome?.behavior.battleStance ?? "instinctive",
        auraLanguage: embodiedGenome
          ? `${embodiedGenome.auraProfile.kind}, ${embodiedGenome.palette.primary}, ${dossier.personality.habitat}`
          : `living aura, ${dossier.personality.habitat}`,
        bondRegister: dossier.gameplay.bond >= 75 ? "profound" as const
          : dossier.gameplay.bond >= 45 ? "trusted" as const
            : dossier.gameplay.bond >= 15 ? "familiar" as const
              : "guarded" as const,
        emotionalOpenness: Math.max(0, Math.min(1, .18 + bondRatio * .72)),
        evolvesOnlyFromProofState: true as const
      }
    }
  };
}

export function projectCreatureBrain(asset: PortableCardAsset): CreatureBrainProjection {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("creature_observer_card_invalid");
  const unsigned = brainUnsigned(asset);
  return {
    ...unsigned,
    contextDigest: sha256PortableBasis(canonicalPortableCardJson(unsigned))
  };
}

export function parseCreatureObserverRequest(value: unknown): CreatureObserverRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("creature_observer_request_invalid");
  const record = value as Record<string, unknown>;
  const message = typeof record.message === "string"
    ? compactText(record.message, MAX_CREATURE_OBSERVER_USER_TEXT)
    : "";
  if (!message || !record.card || !verifyAnyWildsCard(record.card as PortableCardAsset).ok) {
    throw new Error("creature_observer_request_invalid");
  }
  const clientUserMessageId = record.clientUserMessageId;
  if (clientUserMessageId !== undefined
    && (typeof clientUserMessageId !== "string" || !/^[a-z0-9:._-]{1,180}$/i.test(clientUserMessageId))) {
    throw new Error("creature_observer_request_invalid");
  }
  return {
    card: record.card as PortableCardAsset,
    message,
    ...(typeof clientUserMessageId === "string" ? { clientUserMessageId } : {})
  };
}

export function creatureObserverClientContext(brain: CreatureBrainProjection) {
  return {
    mode: "portable-creature-twin",
    instruction: "Voice only the exact creatureBrain subject in first person. memory.innateSelf is who this being already knew itself to be before capture; capture did not create its mind. memory.capture is the exact first shared memory with its owner—the beginning of their relationship, not the creature's existence. memory.eventLedger is its complete ordered proof autobiography, including the admitted root and every subsequent source, Kai coordinate, evidence reference, effect, transformation, condition change, battle, training event, recovery, relationship, autonomous act, and conversation appended to this card. Treat only those entries as events that actually happened. Never impersonate the owner Twin, never invent a canonical event, ownership change, battle, relationship, trade, or memory, and clearly frame imagination as imagination. Be emotionally vivid, warm, natural, concise, and specific to this creature.",
    creatureBrain: brain
  };
}

export function creatureObserverThreadKey(assetId: string) {
  return `wildz-creature-${sha256PortableBasis(assetId).slice(7, 31)}`;
}

export function creatureObserverVisitorKey(ownerActorId: string) {
  return `wildz-owner-${sha256PortableBasis(ownerActorId).slice(7, 31)}`;
}

function replyText(value: unknown, depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === "string") return compactText(value, MAX_CREATURE_OBSERVER_REPLY_TEXT) || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = replyText(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["text", "message", "content", "reply", "response", "assistantMessage"]) {
    const found = replyText(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

export function normalizeCreatureTwinReply(value: unknown) {
  const text = replyText(value);
  if (!text) throw new Error("creature_observer_reply_missing");
  return text;
}

export function createObservedCreatureTurn(input: Readonly<{
  brain: CreatureBrainProjection;
  ownerActorId: string;
  message: string;
  reply: string;
  observedAt: string;
  clientUserMessageId?: string;
  observer?: CreatureObserverMemoryTurn["observer"];
}>) {
  const turnId = `observer:${sha256PortableBasis(canonicalPortableCardJson({
    assetId: input.brain.identity.assetId,
    contextDigest: input.brain.contextDigest,
    observedAt: input.observedAt,
    message: input.message,
    reply: input.reply,
    clientUserMessageId: input.clientUserMessageId ?? null
  })).slice(7, 39)}`;
  return createCreatureObserverMemoryTurn({
    assetId: input.brain.identity.assetId,
    turnId,
    observedAt: input.observedAt,
    ownerActorId: input.ownerActorId,
    userText: compactText(input.message, MAX_CREATURE_OBSERVER_USER_TEXT),
    creatureText: compactText(input.reply, MAX_CREATURE_OBSERVER_REPLY_TEXT),
    contextDigest: input.brain.contextDigest,
    previousTurnDigest: input.brain.memory.observerHead,
    observer: input.observer
  });
}

function spokenList(values: readonly string[], empty: string) {
  if (!values.length) return empty;
  if (values.length === 1) return values[0]!.replaceAll("-", " ");
  return `${values.slice(0, -1).map((value) => value.replaceAll("-", " ")).join(", ")}, and ${values.at(-1)!.replaceAll("-", " ")}`;
}

/**
 * Always-available, deterministic Twin voice. It interprets only the verified
 * brain projection and is used when the public Receiz AI rail cannot answer.
 */
export function localCreatureTwinReply(brain: CreatureBrainProjection, message: string) {
  const question = message.toLowerCase();
  const name = brain.identity.name;
  const continuity = brain.memory.continuity;
  const latestLife = continuity?.livedEvents.at(-1) ?? null;
  const latestConversation = brain.memory.observedTurns.at(-1) ?? null;
  if (/capture|caught|found me|first met|born|begin|origin|awak/.test(question)) {
    const capture = brain.memory.capture;
    return `I already knew who I was before capture: ${brain.memory.innateSelf.selfKnowledge} I remember when our story began, too. ${capture.summary} It happened at ${capture.occurredAt}, from encounter ${capture.encounterId}. That is our first proof-recorded shared memory.`;
  }
  if (/remember|happen|awak|away|journey|did you/.test(question)) {
    if (latestLife) return `I remember it exactly: ${latestLife.summary} That memory is sealed at ${latestLife.digest.slice(7, 17)}, so I will not confuse it with something I only imagined.`;
    if (latestConversation) return `I remember our last proof-sealed conversation. You said “${compactText(latestConversation.userText, 160)}” and I answered from the card brain I still carry.`;
    const latestEvent = brain.memory.eventLedger.at(-1);
    if (latestEvent) {
      const count = brain.memory.eventLedger.length;
      return `I remember ${count} proof-recorded ${count === 1 ? "moment" : "moments"}. The latest is ${latestEvent.source.mode.replaceAll("-", " ")} at ${latestEvent.occurredAt}, and it is sealed in my card. Before our bond, I already knew my ${brain.memory.innateSelf.temperament.toLowerCase()} nature and ${brain.memory.innateSelf.signatureGesture.replaceAll("-", " ")} way of expressing myself. Our shared history begins here: ${brain.memory.capture.summary}`;
    }
    return `Before capture, I already knew myself as ${brain.memory.innateSelf.temperament.toLowerCase()}, with ${brain.memory.innateSelf.signatureGesture.replaceAll("-", " ")} in my nature. My first exact shared memory with you is this: ${brain.memory.capture.summary} It happened at ${brain.memory.capture.occurredAt}. I will not pretend another adventure happened when it did not.`;
  }
  if (/feel|feeling|health|hurt|tired|condition/.test(question)) {
    const condition = brain.embodiment.condition;
    return condition.life === "dead"
      ? `My living journey has ended, but my exact memories remain in this card.`
      : `I feel ${condition.injuryCount ? `the weight of ${condition.injuryCount} recorded ${condition.injuryCount === 1 ? "injury" : "injuries"}` : "whole"} and ${condition.fatigue ? `${condition.fatigue} fatigue` : "rested"}. My health is ${brain.embodiment.stats.health}, and our bond is ${brain.embodiment.bond}.`;
  }
  if (/where|location|home/.test(question)) {
    return continuity
      ? `I am at ${continuity.locationId.replaceAll("-", " ")}. That is my latest proof-recorded location, not a guess.`
      : `My home signal is ${brain.personality.habitat}, but I do not have a newer proof-recorded location yet.`;
  }
  if (/friend|know|relationship|meet|bond/.test(question)) {
    const relationships = continuity?.relationships ?? [];
    return relationships.length
      ? `I know ${relationships.map((relationship) => `${relationship.name}, bond ${relationship.affinity}`).join("; ")}. Every one of those meetings is present in my lived history.`
      : `I do not have another creature recorded as a relationship yet. Our own bond is ${brain.embodiment.bond}, and I can feel that truth in my exact stats.`;
  }
  if (/keep|inventory|carry|discover|found|trade/.test(question)) {
    return `I carry ${spokenList(continuity?.keepsakes ?? [], "no proof-recorded keepsakes yet")}. I have discovered ${spokenList(continuity?.discoveries ?? [], "nothing new yet")}. I will only call a trade real when it appears in my event chain.`;
  }
  if (/explore|next|want|wish|motivat/.test(question)) {
    return `I want to ${brain.personality.motivations[0]?.replace(/\.$/, "").toLowerCase() ?? "explore carefully"}. My ${brain.embodiment.stats.speed} speed and ${brain.embodiment.stats.bond} bond make ${brain.personality.habitat} feel like the right kind of trail—but that is a hope, not an event that already happened.`;
  }
  if (/who|name|what are you|yourself/.test(question)) {
    return `I am ${name}, a ${brain.identity.species} of the ${brain.identity.familyId.replaceAll("-", " ")} lineage. I speak from proof ${brain.identity.proofDigest.slice(7, 19)}, with ${brain.personality.traits.slice(0, 3).join(", ").toLowerCase()} in my nature.`;
  }
  return `I hear you. I am ${name}, speaking from my exact card brain. Ask me about how I feel, what I remember, where I am, who I know, or what I carry, and I will answer only from what my proof actually contains.`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export type CreatureVoiceCandidate = Readonly<{
  name: string;
  lang: string;
  default?: boolean;
  localService?: boolean;
  voiceURI?: string;
}>;

export function creatureVoiceProfile<T extends CreatureVoiceCandidate>(asset: PortableCardAsset, voices: readonly T[]) {
  const stats = asset.manifest.stats;
  const maximum = Math.max(1, ...Object.values(stats));
  const seed = Number.parseInt(sha256PortableBasis(`${asset.id}:${asset.manifest.variant.traits.visualFingerprint}`).slice(7, 15), 16);
  const explicitlyHighQuality = /premium|enhanced|natural|neural|siri|google (us|uk) english/i;
  const familiarNaturalNames = /samantha|ava|zoe|allison|serena|daniel|jamie|martha|arthur/i;
  const roboticNames = /compact|espeak|novelty|whisper|zarvox|bells|bad news|good news|cellos/i;
  const ranked = voices
    .filter((voice) => /^en(?:-|$)/i.test(voice.lang))
    .map((voice) => ({
      voice,
      score: (voice.default ? 1_000 : 0)
        + (explicitlyHighQuality.test(`${voice.name} ${voice.voiceURI ?? ""}`) ? 300 : 0)
        + (familiarNaturalNames.test(`${voice.name} ${voice.voiceURI ?? ""}`) ? 80 : 0)
        + (voice.localService ? 4 : 0)
        - (roboticNames.test(`${voice.name} ${voice.voiceURI ?? ""}`) ? 200 : 0)
    }))
    .filter((entry) => entry.score > -100)
    .sort((left, right) => right.score - left.score || left.voice.name.localeCompare(right.voice.name));
  const browserDefault = ranked.find((entry) => entry.voice.default);
  const premium = ranked.filter((entry) => entry.score >= 300 && !entry.voice.default);
  // Preserve the device's best configured voice whenever it exposes one. A
  // named voice is forced only when the browser explicitly marks it as a
  // high-quality family; unknown voices are worse than the system default.
  const voice = browserDefault?.voice ?? (premium.length ? premium[seed % premium.length]!.voice : null);
  const timbre = ((seed >>> 8) % 13 - 6) / 100;
  return {
    voice,
    signature: `voice:${seed.toString(16).padStart(8, "0")}`,
    rate: Math.max(.88, Math.min(1.04, .91 + stats.speed / maximum * .09 + timbre * .08)),
    pitch: Math.max(.94, Math.min(1.06, .985 + stats.bond / maximum * .025 - stats.power / maximum * .018 + timbre * .12)),
    volume: Math.max(.91, Math.min(.98, .92 + stats.health / maximum * .05))
  } as const;
}

export type CreatureVoicePerformanceSegment = Readonly<{
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  pauseAfterMs: number;
}>;

function voiceSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+(?:[.!?]+[”’\"]?|$)/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [];
}

/**
 * Builds a restrained, deterministic acting performance from the creature's
 * real embodiment. The range is deliberately subtle: large browser pitch and
 * speed shifts sound synthetic, while small sentence contours read as intent.
 */
export function creatureVoicePerformance(asset: PortableCardAsset, text: string): readonly CreatureVoicePerformanceSegment[] {
  const stats = asset.manifest.stats;
  const maximum = Math.max(1, ...Object.values(stats));
  const speed = stats.speed / maximum;
  const power = stats.power / maximum;
  const guard = stats.guard / maximum;
  const bond = stats.bond / maximum;
  const health = stats.health / maximum;
  const identitySeed = sha256PortableBasis(`${asset.id}:${asset.manifest.variant.traits.visualFingerprint}:performance`);
  const baseRate = .91 + speed * .085 - guard * .012;
  const basePitch = .99 + bond * .022 - power * .018;
  const expressiveRange = .008 + (1 - guard) * .012 + bond * .006;
  const sentences = voiceSentences(text);
  return (sentences.length ? sentences : [text.trim()]).filter(Boolean).map((sentence, index) => {
    const sentenceSeed = Number.parseInt(sha256PortableBasis(`${identitySeed}:${index}:${sentence}`).slice(7, 15), 16);
    const contour = ((sentenceSeed % 2_001) / 1_000 - 1) * expressiveRange;
    const isQuestion = /\?[”’\"]?$/.test(sentence);
    const isExclamation = /![”’\"]?$/.test(sentence);
    return {
      text: sentence,
      rate: Math.max(.87, Math.min(1.055, baseRate + contour * .45 + (isExclamation ? .012 : 0))),
      pitch: Math.max(.94, Math.min(1.065, basePitch + contour + (isQuestion ? .014 : 0) + (isExclamation ? .008 : 0))),
      volume: Math.max(.91, Math.min(.99, .925 + health * .045 + (isExclamation ? .008 : 0))),
      pauseAfterMs: 80 + sentenceSeed % 55 + (isQuestion ? 45 : isExclamation ? 28 : 65)
    };
  });
}

export function creatureConsciousnessMotion(asset: PortableCardAsset, fatigue = 0) {
  const stats = asset.manifest.stats;
  const maximum = Math.max(1, stats.health, stats.power, stats.guard, stats.speed, stats.bond);
  const speed = clamp01(stats.speed / maximum);
  const power = clamp01(stats.power / maximum);
  const guard = clamp01(stats.guard / maximum);
  const bond = clamp01(stats.bond / maximum);
  const health = clamp01(stats.health / maximum);
  const livingGenome = isLivingCardAsset(asset) ? currentLivingGenome(asset) : null;
  const baseBlink = livingGenome?.identity?.behavior.blinkMs ?? asset.manifest.variant.traits.animationMs;
  return {
    "--creature-blink": `${Math.round(baseBlink * (1.22 - speed * .35 + fatigue / 240))}ms`,
    "--creature-breathe": `${Math.round(4200 - health * 1050 + fatigue * 13)}ms`,
    "--creature-aura": `${Math.round(2800 - power * 900)}ms`,
    "--creature-tail": `${Math.round(3500 - bond * 1250)}ms`,
    "--creature-gaze-range": `${(2.5 + speed * 4.5).toFixed(2)}px`,
    "--creature-body-lift": `${(1.2 + health * 2.4).toFixed(2)}px`,
    "--creature-aura-scale": `${(1.01 + power * .04).toFixed(3)}`,
    "--creature-guard-settle": `${(guard * 1.8).toFixed(2)}deg`,
    "--creature-bond-glow": `${(.38 + bond * .46).toFixed(2)}`
  } as const;
}
