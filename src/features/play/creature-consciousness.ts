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
    capture: Readonly<{
      kind: "capture" | "starter" | "fusion" | "legacy_admission";
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
  const observerMemory = living && history ? currentCreatureHistoryProjection(living).observerMemory : undefined;
  const continuity = living && history ? currentCreatureHistoryProjection(living).continuity : undefined;
  const captureKind = living?.manifest.birth.kind ?? "capture";
  const capture = {
    kind: captureKind,
    occurredAt: living?.manifest.birth.bornAt ?? asset.manifest.capturedAt,
    encounterId: asset.manifest.encounterId,
    habitat: dossier.personality.habitat,
    kaiPulse: asset.manifest.variant.kaiPulse,
    summary: captureKind === "starter"
      ? `${asset.manifest.name} awakened as a starter companion in ${dossier.personality.habitat}.`
      : captureKind === "fusion"
        ? `${asset.manifest.name} was born through a proof-recorded fusion in ${dossier.personality.habitat}.`
        : captureKind === "legacy_admission"
          ? `${asset.manifest.name}'s earlier life was admitted at a verified legacy checkpoint.`
          : `${asset.manifest.name} was encountered and captured in ${dossier.personality.habitat}.`,
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
      neverImpersonateOwner: true as const
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
    instruction: "Voice only the exact creatureBrain subject in first person. memory.capture is its exact origin memory and memory.eventLedger is its complete ordered autobiography: every source, Kai coordinate, evidence reference, effect, transformation, condition change, battle, training event, recovery, relationship, autonomous act, and conversation appended to this card. Treat only those entries as events that actually happened. Never impersonate the owner Twin, never invent a canonical event, ownership change, battle, relationship, trade, or memory, and clearly frame imagination as imagination. Be emotionally vivid, warm, natural, concise, and specific to this creature.",
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
    return `I remember my beginning: ${capture.summary} It happened at ${capture.occurredAt}, from encounter ${capture.encounterId}. That is my proof-recorded origin, not a story I invented later.`;
  }
  if (/remember|happen|awak|away|journey|did you/.test(question)) {
    if (latestLife) return `I remember it exactly: ${latestLife.summary} That memory is sealed at ${latestLife.digest.slice(7, 17)}, so I will not confuse it with something I only imagined.`;
    if (latestConversation) return `I remember our last proof-sealed conversation. You said “${compactText(latestConversation.userText, 160)}” and I answered from the card brain I still carry.`;
    const latestEvent = brain.memory.eventLedger.at(-1);
    if (latestEvent) return `I remember ${brain.memory.eventLedger.length} proof-recorded events. The latest is ${latestEvent.source.mode.replaceAll("-", " ")} at ${latestEvent.occurredAt}, sealed as ${latestEvent.digest.slice(7, 17)}. My first memory is still ${brain.memory.capture.summary}`;
    return `My first exact memory is this: ${brain.memory.capture.summary} It happened at ${brain.memory.capture.occurredAt}. I will not pretend another adventure happened when it did not.`;
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
  localService?: boolean;
  voiceURI?: string;
}>;

export function creatureVoiceProfile<T extends CreatureVoiceCandidate>(asset: PortableCardAsset, voices: readonly T[]) {
  const stats = asset.manifest.stats;
  const maximum = Math.max(1, ...Object.values(stats));
  const seed = Number.parseInt(sha256PortableBasis(`${asset.id}:${asset.manifest.variant.traits.visualFingerprint}`).slice(7, 15), 16);
  const naturalNames = /samantha|ava|zoe|allison|serena|daniel|jamie|martha|arthur|siri|premium|enhanced|natural|neural/i;
  const roboticNames = /compact|espeak|novelty|whisper|zarvox|bells|bad news|good news|cellos/i;
  const ranked = voices
    .filter((voice) => /^en(?:-|$)/i.test(voice.lang))
    .map((voice) => ({
      voice,
      score: (naturalNames.test(`${voice.name} ${voice.voiceURI ?? ""}`) ? 100 : 0)
        + (voice.localService ? 8 : 0)
        - (roboticNames.test(`${voice.name} ${voice.voiceURI ?? ""}`) ? 200 : 0)
    }))
    .filter((entry) => entry.score > -100)
    .sort((left, right) => right.score - left.score || left.voice.name.localeCompare(right.voice.name));
  const preferred = ranked.filter((entry) => entry.score >= 100);
  const pool = preferred.length ? preferred : ranked;
  const voice = pool.length ? pool[seed % pool.length]!.voice : null;
  const timbre = ((seed >>> 8) % 17 - 8) / 100;
  return {
    voice,
    rate: Math.max(.78, Math.min(1.12, .87 + stats.speed / maximum * .17 + timbre * .25)),
    pitch: Math.max(.72, Math.min(1.28, .88 + stats.bond / maximum * .22 + timbre)),
    volume: .94
  } as const;
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
