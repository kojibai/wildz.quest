import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyHearttreeCondition, projectHearttreeCard } from "../src/features/play/hearttree/card-capability";
import { generateHearttreeExpedition } from "../src/features/play/hearttree/expedition-director";
import { createHearttreeRuntime, stepHearttreeRuntime, type HearttreeInput } from "../src/features/play/hearttree/runtime";
import { hearttreeTranscript, replayHearttreeTranscript } from "../src/features/play/hearttree/transcript";
import { sealCollectedCard } from "../src/features/play/portable-card";

function fixture() {
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "hearttree.player", encounterId: "replay", capturedAt: "2026-07-16T16:00:00.000Z" });
  const capability = projectHearttreeCard(card, emptyHearttreeCondition(card.id));
  const definition = generateHearttreeExpedition({ seed: "replay:expedition", squad: [capability], history: [], mortal: false });
  let state = createHearttreeRuntime(definition, [capability]);
  for (let index = 0; index < 140; index += 1) {
    const input: HearttreeInput = { sequence: state.sequence + 1, tick: state.tick + 1, kind: "move", vector: { x: index % 3 === 0 ? 0 : 1, z: index % 3 === 0 ? 1 : 0 } };
    state = stepHearttreeRuntime(state, input);
  }
  return { capability, definition, state };
}

describe("Hearttree deterministic transcript replay", () => {
  it("replays every accepted input to the same checkpoints and final state", () => {
    const { capability, definition, state } = fixture();
    const transcript = hearttreeTranscript(state);
    const replay = replayHearttreeTranscript(definition, [capability], transcript);

    assert.equal(transcript.schema, "receiz.wilds.hearttree_transcript.v1");
    assert.ok(transcript.checkpoints.length >= 1);
    assert.equal(replay.ok, true);
    assert.equal(replay.stateDigest, transcript.finalStateDigest);
  });

  it("rejects changed inputs, proof pins, checkpoints, and final digests", () => {
    const { capability, definition, state } = fixture();
    const transcript = hearttreeTranscript(state);
    const changedInput = { ...transcript, inputs: transcript.inputs.map((value, index) => index === 5 && value.kind === "move" ? { ...value, vector: { x: -1, z: 0 } } : value) };
    const changedPin = { ...transcript, squadPins: [{ ...transcript.squadPins[0]!, proofDigest: "sha256:changed" }] };
    const changedCheckpoint = { ...transcript, checkpoints: transcript.checkpoints.map((value, index) => index === 0 ? { ...value, stateDigest: "sha256:changed" } : value) };
    const changedFinal = { ...transcript, finalStateDigest: "sha256:changed" };

    assert.throws(() => replayHearttreeTranscript(definition, [capability], changedInput), /hearttree_transcript_digest_invalid/);
    assert.throws(() => replayHearttreeTranscript(definition, [capability], changedPin), /hearttree_transcript_digest_invalid/);
    assert.throws(() => replayHearttreeTranscript(definition, [capability], changedCheckpoint), /hearttree_transcript_digest_invalid/);
    assert.throws(() => replayHearttreeTranscript(definition, [capability], changedFinal), /hearttree_transcript_digest_invalid/);
  });
});
