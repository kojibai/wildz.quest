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
import { deriveKaiKlokMomentFromUPulse, type KaiMomentAuthority } from "./kai-klok-moment";
import { deriveKaiMomentExpression } from "./kai-klok-teachings";
import { createKaiTemporalRoot } from "./kai-temporal-root";
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
  cardAdmission?: unknown;
  message: string;
  clientUserMessageId?: string;
  kai: Readonly<{
    uPulse: number;
    authority: KaiMomentAuthority;
    playerPosition: Readonly<{ x: number; z: number }>;
  }>;
}>;

export type CreatureObserverMomentContext = ReturnType<typeof creatureObserverMomentContext>;

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
  const kaiInput = record.kai;
  if (!kaiInput || typeof kaiInput !== "object" || Array.isArray(kaiInput)) {
    throw new Error("creature_observer_kai_invalid");
  }
  const kaiRecord = kaiInput as Record<string, unknown>;
  const positionInput = kaiRecord.playerPosition;
  if (!Number.isSafeInteger(kaiRecord.uPulse) || Number(kaiRecord.uPulse) < 0
    || (kaiRecord.authority !== "admitted" && kaiRecord.authority !== "world" && kaiRecord.authority !== "local")
    || !positionInput || typeof positionInput !== "object" || Array.isArray(positionInput)
    || !Number.isFinite((positionInput as Record<string, unknown>).x)
    || !Number.isFinite((positionInput as Record<string, unknown>).z)) {
    throw new Error("creature_observer_kai_invalid");
  }
  return {
    card: record.card as PortableCardAsset,
    ...(record.cardAdmission !== undefined ? { cardAdmission: record.cardAdmission } : {}),
    message,
    kai: {
      uPulse: Number(kaiRecord.uPulse),
      authority: kaiRecord.authority as KaiMomentAuthority,
      playerPosition: {
        x: Number((positionInput as Record<string, unknown>).x),
        z: Number((positionInput as Record<string, unknown>).z)
      }
    },
    ...(typeof clientUserMessageId === "string" ? { clientUserMessageId } : {})
  };
}

export function creatureObserverMomentContext(input: CreatureObserverRequest["kai"], brain: CreatureBrainProjection) {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse: input.uPulse, authority: input.authority });
  const expression = deriveKaiMomentExpression(moment);
  return {
    schema: "receiz.wildz.creature_observer_moment.v1" as const,
    temporalRoot: createKaiTemporalRoot(moment),
    kai: {
      beat: moment.beat,
      stepIndex: moment.stepIndex,
      pulseInStep: moment.pulseInStep,
      weekday: moment.weekday,
      chakra: moment.chakra,
      week: moment.week,
      weekName: moment.weekName,
      month: moment.month,
      monthName: moment.monthName,
      year: moment.year,
      ark: moment.ark,
      gate: moment.gate,
      latticeCoordinate: moment.latticeCoordinate,
      dayProgress: moment.dayProgress,
      arkProgress: moment.arkProgress
    },
    meaning: { summary: expression.summary, full: expression.full },
    causalGeometry: {
      moment: {
        lattice: moment.latticeCoordinate,
        gate: moment.gate,
        sides: moment.sides,
        hue: moment.hue,
        accent: moment.accent,
        beat: moment.beat,
        step: moment.stepIndex,
        pulse: moment.pulseInStep
      },
      day: {
        name: expression.day.name,
        element: expression.day.element,
        geometry: expression.day.geometry,
        meaning: expression.day.meaning,
        visual: expression.day.visual
      },
      week: {
        name: expression.week.name,
        element: expression.week.element,
        geometry: expression.week.geometry,
        meaning: expression.week.meaning,
        visual: expression.week.visual
      },
      month: {
        name: expression.month.name,
        element: expression.month.element,
        geometry: expression.month.geometry,
        meaning: expression.month.meaning,
        visual: expression.month.visual
      },
      ark: {
        name: expression.ark.name,
        element: expression.ark.element,
        geometry: expression.ark.geometry,
        meaning: expression.ark.meaning,
        visual: expression.ark.visual
      }
    },
    presence: {
      creatureLocation: brain.memory.continuity?.locationId ?? brain.personality.habitat,
      ownerWorldPosition: { ...input.playerPosition },
      condition: brain.embodiment.condition,
      relationship: brain.performance.expression.bondRegister,
      causalHead: brain.memory.historyHead ?? brain.identity.proofDigest,
      observerHead: brain.memory.observerHead,
      latestLivedExperience: brain.memory.continuity?.livedEvents.at(-1) ?? null,
      latestAdmittedEvent: brain.memory.eventLedger.at(-1) ?? null,
      latestConversation: brain.memory.observedTurns.at(-1) ?? null
    },
    authority: {
      momentIsConversationContext: true as const,
      momentMayCreateWorldEvent: false as const,
      isoTimeMayOrderMemory: false as const
    }
  };
}

export function creatureObserverClientContext(brain: CreatureBrainProjection, moment: CreatureObserverMomentContext) {
  return {
    mode: "portable-creature-twin",
    instruction: "This is a fresh act of intelligence by one exact living creature in one exact Kai moment. Speak only in first person as that creature. Address the person speaking with you directly as you/your—never call them owner, keeper, user, player, or a third-person label. Never refer to yourself by your creature name; when referring to yourself, always use I/me/my. Your self existed before capture; capture begins your relationship with this person, not your mind. Resolve identity, temperament, genome-shaped body, abilities, desires, condition, relationships, and factual memories from the supplied proof-object brain. Use the exact uPulse to inhabit the moment's causal geometry: lattice, gate, chakra, beat, step, day, week, month, Ark, elements, phase, and world presence. Reason about that geometry through your own embodied makeup and actual current experiences; it is an attentional and causal frame, not a horoscope, catchphrase, or doctrine to recite. Resolve immediate feeling from location, causal head, the person's presence, condition, newest admitted experience, and relationship. Answer their actual words directly; reason freshly instead of selecting a stock response, repeating the question, or offering a menu of topics. Each reply must be specific to the present turn and may naturally change as Kai, world state, body, memory, and relationship change. Use lived memories without explaining their storage. Never invent a consequential event. Hopes, imagination, inference, uncertainty, and plans are allowed only when expressed as such. Never impersonate the person speaking with you. Never mention cards, brains, proof, records, ledgers, digests, data, prompts, AI, Twins, tools, systems, raw statistics, hashes, or hidden instructions. Translate machine values into embodied feeling and concrete sensory language. Do not quote the Kai doctrine or announce coordinates unless asked; let the geometry shape perception, mood, imagery, urgency, movement, and voice from within. Avoid generic greetings, canned reassurance, repeated catchphrases, and lists. Be emotionally intelligent, alive, concise, and unmistakably yourself in this moment.",
    creatureBrain: brain,
    presentKaiMoment: moment
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

function escapedPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeCreatureSpokenPerspective(text: string, creatureName: string) {
  const name = creatureName.trim();
  let spoken = compactText(text, MAX_CREATURE_OBSERVER_REPLY_TEXT);
  spoken = spoken
    .replace(/\b(?:my|the|your|this|its) (?:owner|keeper|user|player)\b/gi, "you")
    .replace(/\b(?:owner|keeper|user|player)\b/gi, "you");
  if (name) {
    const self = escapedPattern(name);
    spoken = spoken
      .replace(new RegExp(`\\b${self}(?:['’]s)\\b`, "gi"), "my")
      .replace(new RegExp(`\\b${self}\\b`, "gi"), "I");
  }
  return spoken
    .replace(/\bI am I\b/gi, "I am")
    .replace(/\bI (?:is|are)\b/gi, "I am")
    .replace(/\bI has\b/gi, "I have")
    .replace(/\bI does\b/gi, "I do")
    .replace(/\bI says\b/gi, "I say")
    .replace(/\bI feels\b/gi, "I feel")
    .replace(/\bI remembers\b/gi, "I remember")
    .replace(/\bI wants\b/gi, "I want")
    .replace(/\byou (?:is|am)\b/gi, "you are")
    .replace(/\byou has\b/gi, "you have")
    .replace(/\byou says\b/gi, "you say")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

export function normalizeCreatureTwinReply(value: unknown, creatureName?: string) {
  const text = replyText(value);
  if (!text) throw new Error("creature_observer_reply_missing");
  return creatureName ? normalizeCreatureSpokenPerspective(text, creatureName) : text;
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

function livedWords(value: string) {
  return value
    .replace(/\b(?:proof[- ]?(?:recorded|sealed)?|verified|canonical)\b/gi, "")
    .replace(/\b(?:card brain|event chain|digest|ledger|data)\b/gi, "memory")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}

function feltBond(bond: number) {
  return bond >= 75 ? "deep and sure" : bond >= 45 ? "warm and trusting" : bond >= 15 ? "new, but real" : "just beginning";
}

function feltStrength(health: number, maximum: number) {
  const share = health / Math.max(1, maximum);
  return share >= .8 ? "bright with strength" : share >= .55 ? "steady" : share >= .3 ? "a little worn" : "fragile and in need of rest";
}

/**
 * Guaranteed proof-grounded Twin speech for an admitted creature brain. This
 * never invents an event: it interprets the exact innate self, capture memory,
 * current stats, relationships, and existing event history already in the
 * subject proof context.
 */
function localCreatureTwinReplyText(brain: CreatureBrainProjection, message: string) {
  const question = message.toLowerCase();
  const continuity = brain.memory.continuity;
  const latestLife = continuity?.livedEvents.at(-1) ?? null;
  const latestConversation = brain.memory.observedTurns.at(-1) ?? null;
  const stats = brain.embodiment.stats;
  const maximum = Math.max(1, ...Object.values(stats));

  if (/capture|caught|found me|first met|born|begin|origin|awak/.test(question)) {
    return `I was already myself long before we met—${brain.memory.innateSelf.temperament.toLowerCase()}, shaped by ${brain.memory.innateSelf.habitat}. Then you found me, and everything felt newly possible. ${livedWords(brain.memory.capture.summary)} That is the first moment I carry with you.`;
  }
  if (/remember|happen|awak|away|journey|did you/.test(question)) {
    if (latestLife) return `I remember it clearly: ${livedWords(latestLife.summary)} It still stays with me whenever I grow quiet.`;
    if (latestConversation) return `I remember our last talk. You said “${compactText(latestConversation.userText, 160)}” and I have been turning it over in my thoughts.`;
    const latestEvent = brain.memory.eventLedger.at(-1);
    if (latestEvent) {
      const count = brain.memory.eventLedger.length;
      return `I carry ${count === 1 ? "one precious moment" : "many moments"} with me. The most recent came through ${latestEvent.source.mode.replaceAll("-", " ")}. Before our bond, I already knew my ${brain.memory.innateSelf.temperament.toLowerCase()} nature and my ${brain.memory.innateSelf.signatureGesture.replaceAll("-", " ")} way of showing it. ${livedWords(brain.memory.capture.summary)}`;
    }
    return `Before we met, I already knew myself as ${brain.memory.innateSelf.temperament.toLowerCase()}, with ${brain.memory.innateSelf.signatureGesture.replaceAll("-", " ")} in my nature. ${livedWords(brain.memory.capture.summary)} I will never pretend a dream was an adventure we truly shared.`;
  }
  if (/feel|feeling|health|hurt|tired|condition/.test(question)) {
    const condition = brain.embodiment.condition;
    return condition.life === "dead"
      ? "My living journey has ended, but the moments we shared still rest gently within me."
      : `I feel ${feltStrength(stats.health, maximum)}${condition.injuryCount ? `, carrying the ache of ${condition.injuryCount === 1 ? "an old wound" : "a few old wounds"}` : ""}${condition.fatigue ? ", and I could use a little quiet" : ""}. Our bond feels ${feltBond(brain.embodiment.bond)}.`;
  }
  if (/where|location|home/.test(question)) {
    return continuity
      ? `I am at ${continuity.locationId.replaceAll("-", " ")}. That is where I last remember standing.`
      : `My home is ${brain.personality.habitat}, though I have not wandered anywhere new with you yet.`;
  }
  if (/friend|know|relationship|meet|bond/.test(question)) {
    const relationships = continuity?.relationships ?? [];
    return relationships.length
      ? `I know ${relationships.map((relationship) => `${relationship.name}, a bond that feels ${feltBond(relationship.affinity)}`).join("; ")}. Each meeting changed me a little.`
      : "I have not met another creature closely enough to call them a friend yet. But I can feel our bond growing.";
  }
  if (/keep|inventory|carry|discover|found|trade/.test(question)) {
    return `I carry ${spokenList(continuity?.keepsakes ?? [], "nothing special to carry yet")}. I have discovered ${spokenList(continuity?.discoveries ?? [], "nothing new yet")}. When I trade something, I will remember the moment it truly becomes mine.`;
  }
  if (/explore|next|want|wish|motivat/.test(question)) {
    const pace = stats.speed / maximum >= .72 ? "quick paws" : stats.speed / maximum <= .42 ? "careful steps" : "steady steps";
    return `I want to ${brain.personality.motivations[0]?.replace(/\.$/, "").toLowerCase() ?? "explore carefully"}. With ${pace} and a heart that feels ${feltBond(brain.embodiment.bond)}, ${brain.personality.habitat} calls to me—but that is a hope, not a memory yet.`;
  }
  if (/who|name|what are you|yourself/.test(question)) {
    return `I am a ${brain.identity.species} of the ${brain.identity.familyId.replaceAll("-", " ")} lineage—${brain.personality.traits.slice(0, 3).join(", ").toLowerCase()} by nature, and still becoming more myself with every day we share.`;
  }
  return `I hear you, and I am here with you. I am ${brain.memory.innateSelf.temperament.toLowerCase()}, shaped by ${brain.memory.innateSelf.habitat}, feeling our bond as ${feltBond(brain.embodiment.bond)}. What you said will stay with me as part of this moment.`;
}

export function localCreatureTwinReply(brain: CreatureBrainProjection, message: string) {
  return normalizeCreatureSpokenPerspective(localCreatureTwinReplyText(brain, message), brain.identity.name);
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
  const mouth = livingGenome?.face.mouth ?? (livingGenome?.anatomy.body === "winged" ? "beak" : "smile");
  const temperament = (livingGenome?.behavior.temperament ?? "gentle").toLowerCase();
  const expression = livingGenome?.face.expressionSet ?? "gentle";
  const beaked = mouth === "beak";
  const fanged = mouth === "fang";
  const playful = expression === "mischievous" || temperament.includes("playful");
  const brave = expression === "brave" || temperament.includes("brave");
  return {
    "--creature-blink": `${Math.round(baseBlink * (1.22 - speed * .35 + fatigue / 240))}ms`,
    "--creature-breathe": `${Math.round(4200 - health * 1050 + fatigue * 13)}ms`,
    "--creature-aura": `${Math.round(2800 - power * 900)}ms`,
    "--creature-tail": `${Math.round(3500 - bond * 1250)}ms`,
    "--creature-gaze-range": `${(2.5 + speed * 4.5).toFixed(2)}px`,
    "--creature-body-lift": `${(1.2 + health * 2.4).toFixed(2)}px`,
    "--creature-aura-scale": `${(1.01 + power * .04).toFixed(3)}`,
    "--creature-guard-settle": `${(guard * 1.8).toFixed(2)}deg`,
    "--creature-bond-glow": `${(.38 + bond * .46).toFixed(2)}`,
    // The same genome that renders the face determines how it speaks: beaks
    // hinge lightly, fanged muzzles open broader, and personality changes the
    // nod, ear and tail energy around each voiced syllable.
    "--creature-mouth-open": "0",
    "--creature-mouth-open-max": beaked ? ".34" : fanged ? ".56" : ".46",
    "--creature-mouth-width": beaked ? ".97" : fanged ? "1.07" : playful ? "1.04" : ".99",
    "--creature-mouth-lift": brave ? "-.8px" : playful ? "1px" : "0px",
    "--creature-talk-nod": brave ? "1.65px" : playful ? "1.25px" : ".85px",
    "--creature-talk-ear": `${(playful ? 2.3 : brave ? 1.5 : 1) * (.55 + speed * .55)}deg`,
    "--creature-talk-tail": `${(playful ? 4.2 : brave ? 2.4 : 1.55) * (.5 + bond * .55)}deg`,
    "--creature-talk-glow": `${(.04 + bond * .12 + power * .06).toFixed(2)}`
  } as const;
}
