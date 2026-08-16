import { creatureForm } from "./creature-catalog";
import {
  createCreatureObserverMemoryTurn,
  MAX_CREATURE_OBSERVER_REPLY_TEXT,
  MAX_CREATURE_OBSERVER_USER_TEXT
} from "./creature-history";
import type { CreatureObserverMemoryTurn } from "./creature-history-types";
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
    historyHead: string | null;
    historyEvents: number;
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
      historyHead: history?.headDigest ?? null,
      historyEvents: history?.events.length ?? 0,
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
    instruction: "Voice only the exact creatureBrain subject in first person. Its verified identity, stats, personality, condition, appended conversations, and continuity livedEvents are autobiographical truth. It may remember exact relationships, keepsakes, discoveries, and locations only when present in that projection. Never impersonate the owner Twin, never invent a canonical event, ownership change, battle, relationship, trade, or memory, and clearly frame imagination as imagination. Be emotionally vivid, warm, concise, and specific to this creature.",
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
    previousTurnDigest: input.brain.memory.observerHead
  });
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
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
