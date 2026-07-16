import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { HearttreeCardCapability } from "./card-capability";
import type { HearttreeExpeditionDefinition } from "./expedition-director";
import { createHearttreeRuntime, hearttreeRuntimeStateDigest, stepHearttreeRuntime, type HearttreeInput, type HearttreeRuntimeState } from "./runtime";

export type HearttreeTranscript = Readonly<{
  schema: "receiz.wilds.hearttree_transcript.v1";
  expeditionId: string;
  squadPins: readonly { assetId: string; proofDigest: string }[];
  inputs: readonly HearttreeInput[];
  checkpoints: readonly { tick: number; stateDigest: string }[];
  finalStateDigest: string;
  digest: string;
}>;

function transcriptDigest(transcript: Omit<HearttreeTranscript, "digest">) {
  return sha256PortableBasis(canonicalPortableCardJson(transcript));
}

export function hearttreeTranscript(state: HearttreeRuntimeState): HearttreeTranscript {
  return createHearttreeTranscript(state, state.squad);
}

export function createHearttreeTranscript(state: HearttreeRuntimeState, squad: readonly HearttreeCardCapability[]): HearttreeTranscript {
  const value = {
    schema: "receiz.wilds.hearttree_transcript.v1" as const,
    expeditionId: state.expeditionId,
    squadPins: squad.map((card) => ({ assetId: card.assetId, proofDigest: card.proofDigest })),
    inputs: state.inputs,
    checkpoints: state.checkpoints,
    finalStateDigest: hearttreeRuntimeStateDigest(state)
  };
  return { ...value, digest: transcriptDigest(value) };
}

export function replayHearttreeTranscript(definition: HearttreeExpeditionDefinition, squad: readonly HearttreeCardCapability[], transcript: HearttreeTranscript) {
  const { digest, ...unsigned } = transcript;
  if (transcriptDigest(unsigned) !== digest) throw new Error("hearttree_transcript_digest_invalid");
  if (transcript.expeditionId !== definition.id) throw new Error("hearttree_transcript_expedition_invalid");
  if (canonicalPortableCardJson(transcript.squadPins) !== canonicalPortableCardJson(definition.squadPins)) throw new Error("hearttree_transcript_squad_invalid");
  let state = createHearttreeRuntime(definition, squad);
  for (const input of transcript.inputs) state = stepHearttreeRuntime(state, input, squad);
  if (canonicalPortableCardJson(state.checkpoints) !== canonicalPortableCardJson(transcript.checkpoints)) throw new Error("hearttree_transcript_checkpoint_invalid");
  const stateDigest = hearttreeRuntimeStateDigest(state);
  if (stateDigest !== transcript.finalStateDigest) throw new Error("hearttree_transcript_final_invalid");
  return { ok: true as const, state, stateDigest };
}
