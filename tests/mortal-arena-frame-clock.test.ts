import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCanonicalArenaSession } from "../src/features/games/mortal-arena/canonical-adapter";
import { createArenaPath, projectCampaignOpponent } from "../src/features/games/mortal-arena/campaign";
import { advanceMortalArenaFrameClock, advanceMortalArenaSessionFrames } from "../src/features/games/mortal-arena/use-mortal-arena";
import { sealCollectedCard } from "../src/features/play/portable-card";

const stepMs = 1_000 / 60;

describe("Mortal Arena animation-frame simulation", () => {
  it("advances at canonical 60 Hz and bounds work after a stalled frame", () => {
    const start = { lastFrameAtMs: 0, accumulatorMs: 0 };
    const half = advanceMortalArenaFrameClock(start, stepMs / 2);
    assert.equal(half.steps, 0);
    const first = advanceMortalArenaFrameClock(half.clock, stepMs);
    assert.equal(first.steps, 1);
    const second = advanceMortalArenaFrameClock(first.clock, stepMs * 2);
    assert.equal(second.steps, 1);

    const stalled = advanceMortalArenaFrameClock(second.clock, 10_000);
    assert.equal(stalled.steps, 4);
    assert.ok(stalled.clock.accumulatorMs < stepMs, "stalled time is discarded instead of replaying a long backlog");
    assert.ok(advanceMortalArenaFrameClock(stalled.clock, 10_000 + stepMs).steps <= 2);
  });

  it("keeps held movement across catch-up steps and consumes a pulse on only the first", () => {
    const roster = [sealCollectedCard({
      formId: "mintcub-1", ownerReceizId: "player", encounterId: "arena-frame-clock",
      capturedAt: "2026-07-16T16:00:00.000Z"
    })];
    const path = createArenaPath("player");
    const session = createCanonicalArenaSession({ roster, path, opponent: projectCampaignOpponent(path), mode: "practice" });
    const playerId = session.canonical.teams[0].activeAssetId;
    const advanced = advanceMortalArenaSessionFrames(session, 2, { x: 1, z: 0 }, { guard: true }, { jump: true });
    const inputs = advanced.canonical.inputs.filter((input) => input.actorId === playerId);
    assert.deepEqual(inputs.map((input) => input.movement.jumpPressed), [true, false]);
    assert.deepEqual(inputs.map((input) => input.movement.moveX), [1, 1]);

    const withdrawn = advanceMortalArenaSessionFrames(session, 4, { x: 0, z: 0 }, {}, { withdraw: true });
    assert.equal(withdrawn.canonical.frame, 1, "terminal settlement cannot accrue extra catch-up frames");
    assert.equal(withdrawn.canonical.terminal?.reason, "withdrawal");
  });
});
