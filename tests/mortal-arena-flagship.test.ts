import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceArenaPath, createArenaPath, projectCampaignOpponent } from "../src/features/games/mortal-arena/campaign";
import { createArenaNpc, stepArenaNpc } from "../src/features/games/mortal-arena/npc-controller";
import { createArenaSettlement, recoverArenaSettlement } from "../src/features/games/mortal-arena/settlement";
import { MORTAL_ARENA_MODULE } from "../src/features/games/mortal-arena/module";
import type { MortalArenaSetup } from "../src/features/games/mortal-arena/types";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { currentRevision } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";

const setup: MortalArenaSetup = {
  matchId: "match:flagship",
  seed: 81,
  mortal: true,
  sides: [
    { actorId: "player", fighters: [{ creatureId: "player-card", affinity: "Grove", vitality: 1_000, power: 118, guard: 90, speed: 105 }] },
    { actorId: "rival", fighters: [{ creatureId: "rival-card", affinity: "Ember", vitality: 1_000, power: 112, guard: 92, speed: 98 }] }
  ]
};

describe("Mortal Arena flagship loop", () => {
  it("gives an NPC only deterministic delayed legal inputs", () => {
    const state = MORTAL_ARENA_MODULE.create(setup);
    const npc = createArenaNpc({ actorId: "rival", tier: "scout", seed: 91 });
    const left = stepArenaNpc(npc, state);
    const right = stepArenaNpc(npc, structuredClone(state));
    assert.deepEqual(left, right);
    assert.ok(left.atTick >= state.tick + npc.reactionTicks);
    assert.equal(left.actorId, "rival");
    assert.ok(Math.abs(left.input.moveX ?? 0) <= 1_000);
    assert.ok(Math.abs(left.input.moveZ ?? 0) <= 1_000);
    assert.equal(Boolean(left.input.light && left.input.heavy), false);
  });

  it("escalates saved campaign stages into declared bosses", () => {
    let path = createArenaPath("player");
    path = advanceArenaPath(path, { matchId: "m1", outcome: "victory", retiredCreatureIds: [] });
    path = advanceArenaPath(path, { matchId: "m2", outcome: "victory", retiredCreatureIds: [] });
    const opponent = projectCampaignOpponent(path);
    assert.equal(path.stage, 3);
    assert.equal(opponent.kind, "boss");
    assert.ok(opponent.phases.length >= 3);
  });

  it("journals a result before applying it and recovers idempotently", () => {
    const card = sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId: "player",
      encounterId: "encounter:arena-test",
      capturedAt: "2026-07-16T16:00:00.000Z"
    });
    const pending = createArenaSettlement({
      card,
      result: { matchId: "m1", winnerSide: 0, outcome: "victory", mortal: true, finalVitality: [760, 0], retiredCreatureIds: ["rival-card"] },
      playerSide: 0,
      completedAt: "2026-07-16T16:05:00.000Z"
    });
    assert.equal(pending.status, "pending");
    const committed = recoverArenaSettlement(pending);
    assert.equal(committed.status, "committed");
    assert.equal(committed.card.id, card.id);
    assert.deepEqual(recoverArenaSettlement(committed), committed);
  });

  it("seals the active card permanently when its mortal result reaches zero", () => {
    const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player", encounterId: "encounter:final", capturedAt: "2026-07-16T17:00:00.000Z" });
    const committed = recoverArenaSettlement(createArenaSettlement({
      card,
      result: { matchId: "m:final", winnerSide: 1, outcome: "defeat", mortal: true, finalVitality: [0, 420], retiredCreatureIds: [card.id] },
      playerSide: 0,
      completedAt: "2026-07-16T17:02:00.000Z"
    }));
    assert.equal(isLivingCardAsset(committed.card), true);
    if (!isLivingCardAsset(committed.card)) throw new Error("expected living card");
    assert.equal(currentRevision(committed.card).growth.life?.retired, true);
    assert.equal(currentRevision(committed.card).growth.life?.retirement?.cause, "mortal-arena-zero-vitality");
  });
});
