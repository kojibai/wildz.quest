import {
  RECEIZ_LIVING_SUBJECT_REDUCER_DIGEST,
  RECEIZ_V120_REGISTRY_DIGEST,
  createReceizLivingSubjectRuntime,
  createReceizSubjectPrimaryProofObjectV1,
  encodeReceizSubjectNamespaceBytes,
  type ReceizLivingSubjectModel,
  type ReceizSubjectProofContextV1,
  type ReceizSubjectTwinResultV1
} from "@receiz/sdk";
import type { CreatureBrainProjection } from "./creature-consciousness";
import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  type PortableCardAsset
} from "./portable-card";

const encoder = new TextEncoder();

export const WILDZ_V120_SUBJECT_TYPE = "wildz.creature" as const;

type CreatureSubjectSpeech = Readonly<{
  speech: string;
  provider: string;
  model: string;
  version: string;
  performance?: Readonly<Record<string, unknown>>;
}>;

export type CreatureSubjectV120Observation = Readonly<{
  brain: CreatureBrainProjection;
  artifactDigest: string;
  subjectHead: string;
  brainHead: string;
  objectMerkleRoot: string;
  objectCount: string;
  registryDigest: string;
  reducerDigest: string;
  twin: ReceizSubjectTwinResultV1;
}>;

function exactBytes(value: unknown) {
  return encoder.encode(canonicalPortableCardJson(value));
}

function proofObject(input: Readonly<{
  asset: PortableCardAsset;
  suffix: string;
  kai: string;
  eventIds?: readonly string[];
  value: unknown;
  text: string;
  kind?: "claim" | "long-form" | "conversation" | "event" | "relationship" | "inventory" | "other";
}>) {
  return createReceizSubjectPrimaryProofObjectV1({
    subjectId: input.asset.id,
    proofObjectId: `wildz-proof:${sha256PortableBasis(`${input.asset.id}:${input.suffix}`).slice(7, 39)}`,
    kai: input.kai,
    eventIds: input.eventIds ?? [],
    exactBytes: exactBytes(input.value),
    text: [{ kind: input.kind ?? "event", text: input.text }]
  });
}

function primaryObjects(asset: PortableCardAsset, brain: CreatureBrainProjection) {
  const objects = [
    proofObject({
      asset,
      suffix: "innate-self",
      kai: asset.manifest.variant.kaiPulse,
      value: brain.memory.innateSelf,
      text: brain.memory.innateSelf.selfKnowledge,
      kind: "long-form"
    }),
    proofObject({
      asset,
      suffix: "capture",
      kai: asset.manifest.variant.kaiPulse,
      value: brain.memory.capture,
      text: brain.memory.capture.summary,
      kind: "event"
    })
  ];
  for (const event of brain.memory.eventLedger) {
    objects.push(proofObject({
      asset,
      suffix: `history:${event.eventId}`,
      kai: String(event.kai.uPulse),
      eventIds: [event.eventId],
      value: event,
      text: `A lived ${event.source.mode} moment changed this creature's continuing state.`,
      kind: event.source.mode === "conversation" ? "conversation" : "event"
    }));
  }
  for (const turn of brain.memory.observedTurns) {
    objects.push(proofObject({
      asset,
      suffix: `conversation:${turn.turnId}`,
      kai: asset.manifest.variant.kaiPulse,
      eventIds: [turn.turnId],
      value: turn,
      text: `Owner: ${turn.userText}\n${brain.identity.name}: ${turn.creatureText}`,
      kind: "conversation"
    }));
  }
  for (const event of brain.memory.continuity?.livedEvents ?? []) {
    objects.push(proofObject({
      asset,
      suffix: `continuity:${event.digest}`,
      kai: asset.manifest.variant.kaiPulse,
      eventIds: [event.digest],
      value: event,
      text: event.summary,
      kind: "event"
    }));
  }
  return objects;
}

function namespaces(brain: CreatureBrainProjection) {
  return {
    identity: encodeReceizSubjectNamespaceBytes(brain.identity),
    canonicalState: encodeReceizSubjectNamespaceBytes(brain.embodiment),
    selfModel: encodeReceizSubjectNamespaceBytes({
      innateSelf: brain.memory.innateSelf,
      personality: brain.personality,
      performance: brain.performance
    }),
    memory: encodeReceizSubjectNamespaceBytes(brain.memory),
    relationships: encodeReceizSubjectNamespaceBytes(brain.memory.continuity?.relationships ?? []),
    inventory: encodeReceizSubjectNamespaceBytes({ keepsakes: brain.memory.continuity?.keepsakes ?? [] }),
    abilities: encodeReceizSubjectNamespaceBytes(brain.embodiment.abilities),
    condition: encodeReceizSubjectNamespaceBytes(brain.embodiment.condition),
    worldPosition: encodeReceizSubjectNamespaceBytes({ locationId: brain.memory.continuity?.locationId ?? null }),
    mandates: encodeReceizSubjectNamespaceBytes(brain.memory.continuity?.status ?? null),
    eventHistory: encodeReceizSubjectNamespaceBytes(brain.memory.eventLedger),
    projections: encodeReceizSubjectNamespaceBytes({ contextDigest: brain.contextDigest }),
    applicationNamespaces: encodeReceizSubjectNamespaceBytes({
      "wildz.quest/creature-brain": brain,
      "wildz.quest/card-proof-digest": brain.identity.proofDigest
    })
  };
}

export async function observeCreatureThroughReceizV120(input: Readonly<{
  asset: PortableCardAsset;
  brain: CreatureBrainProjection;
  ownerReceizId: string;
  message: string;
  clientMessageId: string;
  speak: (context: Readonly<{
    brain: CreatureBrainProjection;
    proofContext: ReceizSubjectProofContextV1;
  }>) => Promise<CreatureSubjectSpeech>;
}>) : Promise<CreatureSubjectV120Observation> {
  const brain = input.brain;
  if (brain.identity.assetId !== input.asset.id || brain.identity.proofDigest !== input.asset.proof.digest) {
    throw new Error("creature_observer_brain_mismatch");
  }
  const model: ReceizLivingSubjectModel = async ({ proofContext }) => {
    const response = await input.speak({ brain, proofContext });
    return {
      provider: response.provider,
      model: response.model,
      version: response.version,
      speech: response.speech,
      proposedIntents: [],
      performance: response.performance ?? {
        voiceSignature: brain.performance.expression.voiceSignature,
        temperament: brain.performance.expression.temperament,
        gesture: brain.performance.expression.signatureGesture,
        authoritative: false
      }
    };
  };
  const runtime = createReceizLivingSubjectRuntime({
    registryDigest: RECEIZ_V120_REGISTRY_DIGEST,
    reducerDigest: RECEIZ_LIVING_SUBJECT_REDUCER_DIGEST,
    initialKai: input.asset.manifest.variant.kaiPulse,
    model
  });
  const artifact = runtime.admitSubject({
    subjectId: input.asset.id,
    proofObjectId: input.asset.id,
    subjectType: WILDZ_V120_SUBJECT_TYPE,
    ownerReceizId: input.ownerReceizId,
    createdAtKai: input.asset.manifest.variant.kaiPulse,
    identityDigest: input.asset.proof.digest.replace(/^sha256:/, ""),
    namespaces: namespaces(brain),
    primaryObjects: primaryObjects(input.asset, brain)
  });
  const twin = await runtime.subjects.twin.message(input.asset.id, {
    message: input.message,
    ownerReceizId: input.ownerReceizId,
    threadKey: `wildz:${input.asset.id}`,
    contextHead: artifact.subject.head,
    expectedSubjectDigest: artifact.artifactDigest,
    responseMode: "performance",
    clientMessageId: input.clientMessageId
  });
  const head = runtime.subjects.brain.head(input.asset.id);
  return {
    brain,
    artifactDigest: artifact.artifactDigest,
    subjectHead: artifact.subject.head,
    brainHead: head.subjectHead,
    objectMerkleRoot: head.objectMerkleRoot,
    objectCount: head.objectCount,
    registryDigest: RECEIZ_V120_REGISTRY_DIGEST,
    reducerDigest: RECEIZ_LIVING_SUBJECT_REDUCER_DIGEST,
    twin
  };
}
