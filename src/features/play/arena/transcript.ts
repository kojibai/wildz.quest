import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { advanceArenaMatch, createArenaMatch, type ArenaInputFrame, type ArenaMatchDefinition, type ArenaMatchState } from "./runtime";
import { ARENA_RULESET_ID } from "./rules";

export type ArenaCheckpoint = Readonly<{
  frame: number;
  sequence: number;
  reason: "genesis" | "interval" | "phase" | "retirement" | "terminal";
  stateDigest: string;
}>;
export type ArenaTranscript = Readonly<{
  schema: "receiz.wilds.arena_transcript.v1";
  matchId: string;
  rulesetId: string;
  definitionDigest: string;
  inputFrames: readonly ArenaInputFrame[];
  checkpoints: readonly ArenaCheckpoint[];
  digest: string;
}>;
export type ArenaReplayResult = Readonly<{
  state: ArenaMatchState;
  stateDigest: string;
  transcriptDigest: string;
}>;

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

function checkpoint(state: ArenaMatchState, reason: ArenaCheckpoint["reason"]): ArenaCheckpoint {
  return { frame: state.frame, sequence: state.sequence, reason, stateDigest: digest(state) };
}

function replayInputs(definition: ArenaMatchDefinition, inputs: readonly ArenaInputFrame[]) {
  let state = createArenaMatch(definition);
  const checkpoints: ArenaCheckpoint[] = [checkpoint(state, "genesis")];
  let nextInterval = 120;
  for (const input of inputs) {
    const priorEventCount = state.events.length;
    try {
      state = advanceArenaMatch(state, [input]);
    } catch (error) {
      throw new Error(`arena_transcript_input_invalid:${error instanceof Error ? error.message : "unknown"}`);
    }
    if (input.frame >= nextInterval) {
      checkpoints.push(checkpoint(state, "interval"));
      while (nextInterval <= input.frame) nextInterval += 120;
    }
    if (state.events.slice(priorEventCount).some((event) => event.kind === "fighter.retired")) checkpoints.push(checkpoint(state, "retirement"));
    if (state.events.slice(priorEventCount).some((event) => event.kind === "boss.phase-transition")) checkpoints.push(checkpoint(state, "phase"));
  }
  if (state.phase !== "terminal") throw new Error("arena_transcript_terminal_required");
  checkpoints.push(checkpoint(state, "terminal"));
  return { state, checkpoints };
}

function unsignedTranscript(transcript: ArenaTranscript) {
  const { digest: _digest, ...unsigned } = transcript;
  return unsigned;
}

export function createArenaTranscript(definition: ArenaMatchDefinition, terminalState: ArenaMatchState): ArenaTranscript {
  if (terminalState.phase !== "terminal") throw new Error("arena_transcript_terminal_required");
  const replayed = replayInputs(definition, terminalState.inputs);
  if (canonicalPortableCardJson(replayed.state) !== canonicalPortableCardJson(terminalState)) throw new Error("arena_transcript_state_invalid");
  const unsigned = {
    schema: "receiz.wilds.arena_transcript.v1" as const,
    matchId: terminalState.id,
    rulesetId: terminalState.rulesetId,
    definitionDigest: terminalState.definitionDigest,
    inputFrames: terminalState.inputs,
    checkpoints: replayed.checkpoints,
  };
  return { ...unsigned, digest: digest(unsigned) };
}

export function replayArenaTranscript(definition: ArenaMatchDefinition, transcript: ArenaTranscript): ArenaReplayResult {
  const initial = createArenaMatch(definition);
  if (transcript.schema !== "receiz.wilds.arena_transcript.v1") throw new Error("arena_transcript_schema_invalid");
  if (transcript.rulesetId !== ARENA_RULESET_ID || transcript.rulesetId !== initial.rulesetId) throw new Error("arena_transcript_ruleset_invalid");
  if (transcript.definitionDigest !== initial.definitionDigest || transcript.matchId !== initial.id) throw new Error("arena_transcript_definition_invalid");
  if (digest(unsignedTranscript(transcript)) !== transcript.digest) throw new Error("arena_transcript_digest_invalid");
  const replayed = replayInputs(definition, transcript.inputFrames);
  if (canonicalPortableCardJson(replayed.checkpoints) !== canonicalPortableCardJson(transcript.checkpoints)) throw new Error("arena_transcript_checkpoint_invalid");
  return { state: replayed.state, stateDigest: digest(replayed.state), transcriptDigest: transcript.digest };
}
