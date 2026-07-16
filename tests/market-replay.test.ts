import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  stepMarketRuntime,
  type MarketInput,
  type MarketRuntimeState,
} from "../src/features/play/market/runtime";
import {
  marketTranscript,
  replayMarketTranscript,
} from "../src/features/play/market/transcript";
import { marketRuntimeFixture } from "./support/market-fixtures";

type InputIntent = MarketInput extends infer Value ? Value extends MarketInput ? Omit<Value, "sequence" | "tick"> : never : never;

function apply(state: MarketRuntimeState, input: InputIntent, contract: ReturnType<typeof marketRuntimeFixture>["contract"]) {
  return stepMarketRuntime(state, { ...input, sequence: state.sequence + 1, tick: state.tick + 1 } as MarketInput, contract);
}

function completedFixture() {
  const fixture = marketRuntimeFixture();
  let state = fixture.state;
  const cargo = fixture.contract.intelligence.find((node) => node.kind === "cargo")!;
  for (let index = 0; index < 40 && Math.hypot(state.player.x - cargo.position.x, state.player.z - cargo.position.z) > 1; index += 1) {
    state = apply(state, { kind: "move", vector: { x: Math.sign(cargo.position.x - state.player.x), z: Math.sign(cargo.position.z - state.player.z) } }, fixture.contract);
  }
  state = apply(state, { kind: "inspect", targetId: cargo.id }, fixture.contract);
  state = apply(state, { kind: "negotiate", action: { kind: "commit" } }, fixture.contract);
  state = apply(state, { kind: "extract" }, fixture.contract);
  return { ...fixture, completedState: state };
}

describe("Wayfarer deterministic transcript replay", () => {
  it("replays every accepted input to the identical final checkpoint", () => {
    const fixture = completedFixture();
    const transcript = marketTranscript(fixture.completedState);
    const replay = replayMarketTranscript(fixture.contract, fixture.terms, fixture.squad, transcript);

    assert.equal(replay.ok, true);
    assert.deepEqual(replay.state, fixture.completedState);
    assert.equal(replay.stateDigest, transcript.finalStateDigest);
    assert.equal(replay.transcriptDigest, transcript.digest);
  });

  it("rejects changed input, proof, checkpoint, final state, terms, and digest", () => {
    const fixture = completedFixture();
    const transcript = marketTranscript(fixture.completedState);
    const last = transcript.inputs.at(-1)!;
    const changedInput = { ...transcript, inputs: [...transcript.inputs.slice(0, -1), { ...last, tick: last.tick + 1 }] };
    const changedPin = { ...transcript, squadPins: [{ ...transcript.squadPins[0]!, proofDigest: `sha256:${"f".repeat(64)}` }, ...transcript.squadPins.slice(1)] };
    const changedCheckpoint = { ...transcript, checkpoints: [{ ...transcript.checkpoints[0]!, stateDigest: `sha256:${"e".repeat(64)}` }] };
    const changedFinal = { ...transcript, finalStateDigest: `sha256:${"d".repeat(64)}` };
    const changedDigest = { ...transcript, digest: `sha256:${"c".repeat(64)}` };
    const changedTerms = { ...fixture.terms, cargo: fixture.terms.cargo + 1 };

    assert.throws(() => replayMarketTranscript(fixture.contract, fixture.terms, fixture.squad, changedInput), /market_transcript_digest_invalid|market_transcript_input_invalid/);
    assert.throws(() => replayMarketTranscript(fixture.contract, fixture.terms, fixture.squad, changedPin), /market_transcript_digest_invalid|market_transcript_pins_invalid/);
    assert.throws(() => replayMarketTranscript(fixture.contract, fixture.terms, fixture.squad, changedCheckpoint), /market_transcript_digest_invalid|market_transcript_checkpoint_invalid/);
    assert.throws(() => replayMarketTranscript(fixture.contract, fixture.terms, fixture.squad, changedFinal), /market_transcript_digest_invalid|market_transcript_final_invalid/);
    assert.throws(() => replayMarketTranscript(fixture.contract, fixture.terms, fixture.squad, changedDigest), /market_transcript_digest_invalid/);
    assert.throws(() => replayMarketTranscript(fixture.contract, changedTerms, fixture.squad, transcript), /market_transcript_terms_invalid|market_runtime_terms_invalid/);
  });
});
