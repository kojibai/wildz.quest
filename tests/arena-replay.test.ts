import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceArenaMatch, createArenaMatch } from "../src/features/play/arena/runtime";
import { createArenaTranscript, replayArenaTranscript } from "../src/features/play/arena/transcript";
import { arenaFixtureAuthorizeDefinition, arenaFixtureCreateMatch, arenaFixtureDefinition, arenaFixtureFighterHealth, arenaFixtureFrame, arenaFixtureTerminal, arenaFixtureVerification } from "./support/arena-fixtures";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";

function reseal(transcript: ReturnType<typeof createArenaTranscript>) {
  const { digest: _digest, ...unsigned } = transcript;
  return { ...unsigned, digest: sha256PortableBasis(canonicalPortableCardJson(unsigned)) };
}

describe("Arena deterministic transcript replay", () => {
  it("replays the exact terminal state with genesis and terminal checkpoints", () => {
    const { definition, state } = arenaFixtureTerminal();
    const transcript = createArenaTranscript(definition, state, arenaFixtureVerification);
    const replay = replayArenaTranscript(definition, transcript, arenaFixtureVerification);
    assert.deepEqual(replay.state, state);
    assert.equal(replay.stateDigest, transcript.checkpoints.at(-1)?.stateDigest);
    assert.equal(transcript.checkpoints[0]?.reason, "genesis");
    assert.equal(transcript.checkpoints.at(-1)?.reason, "terminal");
    assert.deepEqual(transcript.kai, definition.kai);
  });

  it("rejects sequential authoritative transcripts while retaining Practice compatibility", () => {
    const authoritative = arenaFixtureDefinition("adventure", 1);
    let state = arenaFixtureCreateMatch(authoritative);
    const actorId = state.teams[0].activeAssetId;
    state = advanceArenaMatch(state, [{ sequence: 1, frame: 1, actorId, movement: { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false }, combat: null, tagAssetId: null, contextTargetId: null, withdraw: true }]);
    assert.throws(() => createArenaTranscript(authoritative, state, arenaFixtureVerification), /arena_transcript_atomic_batch_required/);

    const practice = arenaFixtureDefinition("practice", 1);
    let practiceState = arenaFixtureCreateMatch(practice);
    const practiceActor = practiceState.teams[0].activeAssetId;
    practiceState = advanceArenaMatch(practiceState, [{ sequence: 1, frame: 1, actorId: practiceActor, movement: { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false }, combat: null, tagAssetId: null, contextTargetId: null, withdraw: true }]);
    assert.equal(createArenaTranscript(practice, practiceState).schema, "receiz.wilds.arena_transcript.v2");
  });

  it("creates interval and retirement checkpoints from replayed state", () => {
    const base = arenaFixtureDefinition("mortal", 2);
    const fragile = arenaFixtureFighterHealth(base.teams[0].fighters[0]!, 1);
    const definition = arenaFixtureAuthorizeDefinition({ ...base, teams: [{ ...base.teams[0], fighters: [fragile, base.teams[0].fighters[1]!] }, base.teams[1]] });
    let state = arenaFixtureCreateMatch(definition);
    const victimId = state.teams[0].activeAssetId;
    state = arenaFixtureFrame(state, [{}, { combat: { kind: "heavy", direction: { x: -1, y: 0, z: 0 } } }]);
    while (state.frame < 120) state = arenaFixtureFrame(state);
    state = arenaFixtureFrame(state, [{ withdraw: true }, {}]);
    const transcript = createArenaTranscript(definition, state, arenaFixtureVerification);
    assert.equal(transcript.checkpoints.some((checkpoint) => checkpoint.reason === "retirement"), true);
    assert.equal(transcript.checkpoints.some((checkpoint) => checkpoint.reason === "interval"), true);
    assert.deepEqual(replayArenaTranscript(definition, transcript, arenaFixtureVerification).state, state);
  });

  it("checkpoints boss changes only after sealed threshold and transition frame", () => {
    const base = arenaFixtureDefinition("mortal", 1);
    const bossFighter = arenaFixtureFighterHealth(base.teams[1].fighters[0]!, 23);
    const definition = arenaFixtureAuthorizeDefinition({
      ...base,
      teams: [base.teams[0], { ...base.teams[1], fighters: [bossFighter] }],
      boss: { teamId: base.teams[1].id, phases: [{ id: "boss:phase:one", vitalityThreshold: 0.75, transitionFrame: 13, weakness: "exposed-core", hazard: "crystal-faults", legalActions: ["guard", "heavy"] }] },
    } as typeof base & { boss: { teamId: string; phases: { id: string; vitalityThreshold: number; transitionFrame: number; weakness: string; hazard: string; legalActions: string[] }[] } });
    let state = arenaFixtureCreateMatch(definition);
    state = arenaFixtureFrame(state, [{ combat: { kind: "heavy", direction: { x: 1, y: 0, z: 0 } } }, {}]);
    while (state.frame < 13) state = arenaFixtureFrame(state);
    assert.deepEqual(state.boss?.transitionedPhaseIds, ["boss:phase:one"]);
    assert.equal(state.stage.activeBossHazard, "crystal-faults");
    assert.deepEqual(state.stage.bossLegalActions, ["guard", "heavy"]);
    state = arenaFixtureFrame(state, [{}, { withdraw: true }]);
    const transcript = createArenaTranscript(definition, state, arenaFixtureVerification);
    assert.equal(transcript.checkpoints.some((checkpoint) => checkpoint.reason === "phase"), true);
    assert.deepEqual(replayArenaTranscript(definition, transcript, arenaFixtureVerification).state, state);
  });

  it("rejects definition, ruleset, input, checkpoint, terminal, and digest mutation", () => {
    const { definition, state } = arenaFixtureTerminal();
    const transcript = createArenaTranscript(definition, state, arenaFixtureVerification);
    const expectInvalid = (value: typeof transcript) => assert.throws(() => replayArenaTranscript(definition, reseal(value), arenaFixtureVerification), /arena_transcript_/);
    expectInvalid({ ...transcript, rulesetId: "wilds.arena.v0" });
    expectInvalid({ ...transcript, kai: { ...transcript.kai, uPulse: transcript.kai.uPulse + 1 } });
    expectInvalid({ ...transcript, definitionDigest: `sha256:${"0".repeat(64)}` });
    expectInvalid({ ...transcript, inputFrames: transcript.inputFrames.map((input) => ({ ...input, frame: input.frame + 1 })) });
    expectInvalid({ ...transcript, inputFrames: transcript.inputFrames.map((input) => ({ ...input, actorId: "card:foreign" })) });
    expectInvalid({ ...transcript, inputFrames: transcript.inputFrames.map((input) => ({ ...input, movement: { ...input.movement, moveX: 2 } })) });
    expectInvalid({ ...transcript, inputFrames: transcript.inputFrames.map((input) => ({ ...input, combat: { kind: "ability" as const, slot: 1 as const, targetId: "card:foreign" } })) });
    expectInvalid({ ...transcript, inputFrames: transcript.inputFrames.map((input) => ({ ...input, tagAssetId: "card:foreign" })) });
    expectInvalid({ ...transcript, inputFrames: transcript.inputFrames.map((input) => ({ ...input, contextTargetId: "item:heal" })) });
    expectInvalid({ ...transcript, checkpoints: transcript.checkpoints.map((checkpoint, index) => index ? checkpoint : { ...checkpoint, stateDigest: `sha256:${"1".repeat(64)}` }) });
    assert.throws(() => replayArenaTranscript(definition, { ...transcript, digest: `sha256:${"2".repeat(64)}` }, arenaFixtureVerification), /arena_transcript_digest_invalid/);
    const changedDefinition = { ...definition, seed: "arena:changed-seed" };
    assert.throws(() => replayArenaTranscript(changedDefinition, transcript, arenaFixtureVerification), /arena_transcript_definition_invalid|arena_mortal_covenant_invalid/);
    const changedProof = { ...definition, teams: [{ ...definition.teams[0], fighters: [{ ...definition.teams[0].fighters[0]!, proofDigest: `sha256:${"3".repeat(64)}` }, ...definition.teams[0].fighters.slice(1)] }, definition.teams[1]] } as typeof definition;
    assert.throws(() => replayArenaTranscript(changedProof, transcript, arenaFixtureVerification), /arena_transcript_definition_invalid|arena_mortal_covenant_invalid/);
    const changedRevision = { ...definition, teams: [{ ...definition.teams[0], fighters: [{ ...definition.teams[0].fighters[0]!, revisionDigest: `sha256:${"4".repeat(64)}` }, ...definition.teams[0].fighters.slice(1)] }, definition.teams[1]] } as typeof definition;
    assert.throws(() => replayArenaTranscript(changedRevision, transcript, arenaFixtureVerification), /arena_transcript_definition_invalid|arena_mortal_covenant_invalid/);
  });
});
