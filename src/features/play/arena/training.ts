import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";

export type ArenaTrainingDrillKind = "spacing" | "defense" | "punish" | "ability" | "tag" | "hazard" | "matchup";
export type ArenaTrainingAids = Readonly<{ readableTelegraphs: boolean; timeScale: number }>;
export type ArenaTrainingDrill = Readonly<{
  schema: "receiz.wilds.arena_training_drill.v1";
  id: string;
  kind: ArenaTrainingDrillKind;
  seed: string;
  mode: "practice";
  information: "observable-only";
  aids: ArenaTrainingAids;
}>;

type RatioPerformance = Readonly<{ opportunities: number }>;
export type ArenaTrainingPerformance =
  | Readonly<{ kind: "spacing"; meanDistanceErrorMilli: number }>
  | (RatioPerformance & Readonly<{ kind: "defense"; successfulResponses: number; meanReactionFrames: number }>)
  | (RatioPerformance & Readonly<{ kind: "punish"; successfulResponses: number; meanResponseFrames: number; meanWindowFrames: number }>)
  | Readonly<{ kind: "ability"; hits: number; attempts: number }>
  | (RatioPerformance & Readonly<{ kind: "tag"; successfulResponses: number; meanResponseFrames: number; meanWindowFrames: number }>)
  | Readonly<{ kind: "hazard"; exposureFrames: number; durationFrames: number }>
  | (RatioPerformance & Readonly<{ kind: "matchup"; correctResponses: number }>);
export type ArenaTrainingAttempt = Readonly<{ drillId: string; performance: ArenaTrainingPerformance }>;
export type ArenaTrainingScore = Readonly<{
  schema: "receiz.wilds.arena_training_score.v1";
  drillId: string;
  kind: ArenaTrainingDrillKind;
  score: number;
  grade: "foundation" | "developing" | "advanced" | "master";
}>;

export type ArenaGhostInput = Readonly<{
  frame: number;
  movement: Readonly<{ moveX: number; moveZ: number; jumpPressed: boolean; sprint: boolean }>;
  combat: "light" | "heavy" | "guard" | "parry" | "dodge" | "focus" | "ability:0" | "ability:1" | null;
  tagAssetId: string | null;
}>;
export type ArenaLocalGhost = Readonly<{
  schema: "receiz.wilds.arena_local_ghost.v1";
  drillId: string;
  playerId: string;
  mode: "practice";
  storage: "local-only";
  includesOpponentInputs: false;
  inputs: readonly ArenaGhostInput[];
  digest: string;
}>;

const DRILL_KINDS: readonly ArenaTrainingDrillKind[] = ["spacing", "defense", "punish", "ability", "tag", "hazard", "matchup"];
const COMBAT_INPUTS: readonly NonNullable<ArenaGhostInput["combat"]>[] = ["light", "heavy", "guard", "parry", "dodge", "focus", "ability:0", "ability:1"];
const ID_PATTERN = /^[a-z0-9:._-]{1,160}$/i;

function clampScore(value: number) {
  return Math.max(0, Math.min(10_000, Math.round(value)));
}

function finiteNonnegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function positiveInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}

function trainingDrillId(kind: ArenaTrainingDrillKind, seed: string, aids: ArenaTrainingAids) {
  const basis = { schema: "receiz.wilds.arena_training_drill.v1", kind, seed, mode: "practice", information: "observable-only", aids };
  return `training:${sha256PortableBasis(canonicalPortableCardJson(basis)).slice(7, 31)}`;
}

function validateTrainingDrill(drill: ArenaTrainingDrill) {
  if (drill.schema !== "receiz.wilds.arena_training_drill.v1" || drill.mode !== "practice" || drill.information !== "observable-only"
    || !DRILL_KINDS.includes(drill.kind) || !ID_PATTERN.test(drill.seed)
    || typeof drill.aids.readableTelegraphs !== "boolean" || !Number.isFinite(drill.aids.timeScale)
    || drill.aids.timeScale < 0.5 || drill.aids.timeScale > 1
    || drill.id !== trainingDrillId(drill.kind, drill.seed, drill.aids)) throw new Error("arena_training_drill_invalid");
}

export function createArenaTrainingDrill(input: Readonly<{
  kind: ArenaTrainingDrillKind;
  seed: string;
  mode: "practice";
  aids?: Partial<ArenaTrainingAids>;
}>): ArenaTrainingDrill {
  if (input.mode !== "practice") throw new Error("arena_training_practice_only");
  if (!DRILL_KINDS.includes(input.kind) || !ID_PATTERN.test(input.seed)) throw new Error("arena_training_drill_invalid");
  const aids = {
    readableTelegraphs: input.aids?.readableTelegraphs ?? false,
    timeScale: input.aids?.timeScale ?? 1,
  };
  if (typeof aids.readableTelegraphs !== "boolean" || !Number.isFinite(aids.timeScale) || aids.timeScale < 0.5 || aids.timeScale > 1) {
    throw new Error("arena_training_aids_invalid");
  }
  return {
    schema: "receiz.wilds.arena_training_drill.v1",
    id: trainingDrillId(input.kind, input.seed, aids),
    kind: input.kind,
    seed: input.seed,
    mode: "practice",
    information: "observable-only",
    aids,
  };
}

function scorePerformance(performance: ArenaTrainingPerformance) {
  switch (performance.kind) {
    case "spacing":
      if (!exactKeys(performance, ["kind", "meanDistanceErrorMilli"])
        || !finiteNonnegative(performance.meanDistanceErrorMilli)) throw new Error("arena_training_performance_invalid");
      return 10_000 - performance.meanDistanceErrorMilli * 5;
    case "defense":
      if (!exactKeys(performance, ["kind", "successfulResponses", "opportunities", "meanReactionFrames"])
        || !positiveInteger(performance.opportunities) || !Number.isSafeInteger(performance.successfulResponses)
        || performance.successfulResponses < 0 || performance.successfulResponses > performance.opportunities
        || !finiteNonnegative(performance.meanReactionFrames)) throw new Error("arena_training_performance_invalid");
      return performance.successfulResponses / performance.opportunities * 10_000 - performance.meanReactionFrames * 125;
    case "punish":
    case "tag":
      if (!exactKeys(performance, ["kind", "successfulResponses", "opportunities", "meanResponseFrames", "meanWindowFrames"])
        || !positiveInteger(performance.opportunities) || !Number.isSafeInteger(performance.successfulResponses)
        || performance.successfulResponses < 0 || performance.successfulResponses > performance.opportunities
        || !finiteNonnegative(performance.meanResponseFrames) || !finiteNonnegative(performance.meanWindowFrames)
        || performance.meanWindowFrames <= 0) throw new Error("arena_training_performance_invalid");
      return performance.successfulResponses / performance.opportunities * 10_000
        - performance.meanResponseFrames / performance.meanWindowFrames * 5_000;
    case "ability":
      if (!exactKeys(performance, ["kind", "hits", "attempts"])
        || !positiveInteger(performance.attempts) || !Number.isSafeInteger(performance.hits)
        || performance.hits < 0 || performance.hits > performance.attempts) throw new Error("arena_training_performance_invalid");
      return performance.hits / performance.attempts * 10_000;
    case "hazard":
      if (!exactKeys(performance, ["kind", "exposureFrames", "durationFrames"])
        || !positiveInteger(performance.durationFrames) || !Number.isSafeInteger(performance.exposureFrames)
        || performance.exposureFrames < 0 || performance.exposureFrames > performance.durationFrames) throw new Error("arena_training_performance_invalid");
      return (1 - performance.exposureFrames / performance.durationFrames) * 10_000;
    case "matchup":
      if (!exactKeys(performance, ["kind", "correctResponses", "opportunities"])
        || !positiveInteger(performance.opportunities) || !Number.isSafeInteger(performance.correctResponses)
        || performance.correctResponses < 0 || performance.correctResponses > performance.opportunities) throw new Error("arena_training_performance_invalid");
      return performance.correctResponses / performance.opportunities * 10_000;
  }
}

export function scoreArenaTrainingAttempt(drill: ArenaTrainingDrill, attempt: ArenaTrainingAttempt): ArenaTrainingScore {
  validateTrainingDrill(drill);
  if (attempt.drillId !== drill.id || attempt.performance.kind !== drill.kind) throw new Error("arena_training_attempt_invalid");
  const score = clampScore(scorePerformance(attempt.performance));
  const grade = score >= 9000 ? "master" : score >= 7500 ? "advanced" : score >= 5000 ? "developing" : "foundation";
  return { schema: "receiz.wilds.arena_training_score.v1", drillId: drill.id, kind: drill.kind, score, grade };
}

function exactKeys(value: object, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function validateGhostInput(input: ArenaGhostInput, previousFrame: number) {
  if (!exactKeys(input, ["frame", "movement", "combat", "tagAssetId"])
    || !exactKeys(input.movement, ["moveX", "moveZ", "jumpPressed", "sprint"])
    || !Number.isSafeInteger(input.frame) || input.frame <= previousFrame
    || !Number.isFinite(input.movement.moveX) || Math.abs(input.movement.moveX) > 1
    || !Number.isFinite(input.movement.moveZ) || Math.abs(input.movement.moveZ) > 1
    || typeof input.movement.jumpPressed !== "boolean" || typeof input.movement.sprint !== "boolean"
    || (input.combat !== null && !COMBAT_INPUTS.includes(input.combat))
    || (input.tagAssetId !== null && !ID_PATTERN.test(input.tagAssetId))) {
    throw new Error("arena_training_ghost_input_invalid");
  }
}

function unsignedGhost(ghost: ArenaLocalGhost) {
  const { digest: _digest, ...unsigned } = ghost;
  return unsigned;
}

export function recordArenaLocalGhost(
  drill: ArenaTrainingDrill,
  recording: Readonly<{ playerId: string; inputs: readonly ArenaGhostInput[] }>,
): ArenaLocalGhost {
  validateTrainingDrill(drill);
  if (!ID_PATTERN.test(recording.playerId) || recording.inputs.length > 36_000) throw new Error("arena_training_ghost_invalid");
  let previousFrame = -1;
  for (const input of recording.inputs) {
    validateGhostInput(input, previousFrame);
    previousFrame = input.frame;
  }
  const unsigned = {
    schema: "receiz.wilds.arena_local_ghost.v1" as const,
    drillId: drill.id,
    playerId: recording.playerId,
    mode: "practice" as const,
    storage: "local-only" as const,
    includesOpponentInputs: false as const,
    inputs: recording.inputs,
  };
  return { ...unsigned, digest: sha256PortableBasis(canonicalPortableCardJson(unsigned)) };
}

export function verifyArenaLocalGhost(ghost: ArenaLocalGhost) {
  const errors: string[] = [];
  try {
    if (ghost.schema !== "receiz.wilds.arena_local_ghost.v1" || ghost.mode !== "practice" || ghost.storage !== "local-only"
      || ghost.includesOpponentInputs !== false || !ID_PATTERN.test(ghost.playerId) || !ID_PATTERN.test(ghost.drillId)
      || ghost.inputs.length > 36_000) throw new Error("arena_training_ghost_invalid");
    let previousFrame = -1;
    for (const input of ghost.inputs) {
      validateGhostInput(input, previousFrame);
      previousFrame = input.frame;
    }
    if (sha256PortableBasis(canonicalPortableCardJson(unsignedGhost(ghost))) !== ghost.digest) throw new Error("arena_training_ghost_digest_invalid");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "arena_training_ghost_invalid");
  }
  return { ok: errors.length === 0, errors };
}

export function projectArenaLocalGhostThroughFrame(ghost: ArenaLocalGhost, frame: number) {
  if (!Number.isSafeInteger(frame) || frame < 0) throw new Error("arena_training_ghost_frame_invalid");
  const verification = verifyArenaLocalGhost(ghost);
  if (!verification.ok) throw new Error(verification.errors[0] ?? "arena_training_ghost_invalid");
  return ghost.inputs.filter((input) => input.frame <= frame);
}
