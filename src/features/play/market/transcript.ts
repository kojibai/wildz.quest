import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import type { MarketCardCapability } from "./card-role";
import type { MarketContractDefinition } from "./contract-director";
import type { MarketTerms } from "./negotiation-resolver";
import {
  createMarketRuntime,
  marketRuntimeStateDigest,
  stepMarketRuntime,
  type MarketInput,
  type MarketRuntimeState,
} from "./runtime";

export type MarketTranscriptCheckpoint = Readonly<{
  sequence: number;
  stateDigest: string;
}>;

export type MarketTranscript = Readonly<{
  schema: "receiz.wilds.market_transcript.v1";
  contractDigest: string;
  termsDigest: string;
  squadPins: readonly Readonly<{ assetId: string; proofDigest: string }>[];
  inputs: readonly MarketInput[];
  checkpoints: readonly MarketTranscriptCheckpoint[];
  finalStateDigest: string;
  digest: string;
}>;

export type MarketReplayResult = Readonly<{
  ok: true;
  state: MarketRuntimeState;
  stateDigest: string;
  transcriptDigest: string;
}>;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function unsignedTranscript(transcript: MarketTranscript) {
  const { digest: _digest, ...unsigned } = transcript;
  return unsigned;
}

function samePins(
  left: readonly Readonly<{ assetId: string; proofDigest: string }>[],
  right: readonly Readonly<{ assetId: string; proofDigest: string }>[],
) {
  return left.length === right.length && left.every((pin, index) => (
    pin.assetId === right[index]?.assetId && pin.proofDigest === right[index]?.proofDigest
  ));
}

export function marketTranscript(state: MarketRuntimeState): MarketTranscript {
  const finalStateDigest = marketRuntimeStateDigest(state);
  const unsigned = {
    schema: "receiz.wilds.market_transcript.v1" as const,
    contractDigest: state.contractDigest,
    termsDigest: digest(state.terms),
    squadPins: state.squad.map(({ assetId, proofDigest }) => ({ assetId, proofDigest })),
    inputs: [...state.inputs],
    checkpoints: [{ sequence: state.sequence, stateDigest: finalStateDigest }],
    finalStateDigest,
  };
  return { ...unsigned, digest: digest(unsigned) };
}

export function replayMarketTranscript(
  contract: MarketContractDefinition,
  baselineTerms: MarketTerms,
  squad: readonly MarketCardCapability[],
  transcript: MarketTranscript,
): MarketReplayResult {
  if (transcript.schema !== "receiz.wilds.market_transcript.v1") throw new Error("market_transcript_schema_invalid");
  if (digest(unsignedTranscript(transcript)) !== transcript.digest) throw new Error("market_transcript_digest_invalid");
  if (contract.digest !== transcript.contractDigest) throw new Error("market_transcript_contract_invalid");
  if (!samePins(contract.squadPins, transcript.squadPins) || !samePins(
    squad.map(({ assetId, proofDigest }) => ({ assetId, proofDigest })),
    transcript.squadPins,
  )) throw new Error("market_transcript_pins_invalid");

  let state = createMarketRuntime(contract, baselineTerms, squad);
  for (const input of transcript.inputs) {
    try {
      state = stepMarketRuntime(state, input, contract);
    } catch (error) {
      throw new Error("market_transcript_input_invalid", { cause: error });
    }
  }

  if (digest(state.terms) !== transcript.termsDigest) throw new Error("market_transcript_terms_invalid");
  for (const checkpoint of transcript.checkpoints) {
    if (checkpoint.sequence !== state.sequence || checkpoint.stateDigest !== marketRuntimeStateDigest(state)) {
      throw new Error("market_transcript_checkpoint_invalid");
    }
  }
  const stateDigest = marketRuntimeStateDigest(state);
  if (stateDigest !== transcript.finalStateDigest) throw new Error("market_transcript_final_invalid");
  return { ok: true, state, stateDigest, transcriptDigest: transcript.digest };
}
