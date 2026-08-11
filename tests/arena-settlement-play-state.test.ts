import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealRetirement } from "../src/features/games/lifecycle/creature-retirement.js";
import type { ArenaSettlement } from "../src/features/games/mortal-arena/settlement.js";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition.js";
import {
  applyCommittedArenaSettlement,
  initialPlayState,
  restorePlayState,
  serializePlayState,
  type PlayState
} from "../src/features/play/game-state.js";
import { admitLegacyCard, currentRevision, emptyLivingGrowth } from "../src/features/play/living-card-proof.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";

describe("Arena settlement play-state commit", () => {
  it("atomically persists every owned card and selects a living fallback when a reserve retires", () => {
    const survivorBase = sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId: "arena.player",
      encounterId: "arena-atomic-survivor",
      capturedAt: "2026-08-11T00:00:00.000Z"
    });
    const reserveBase = sealCollectedCard({
      formId: "voltray-1",
      ownerReceizId: "arena.player",
      encounterId: "arena-atomic-reserve",
      capturedAt: "2026-08-11T00:00:01.000Z"
    });
    const survivor = admitLegacyCard(survivorBase, "2026-08-11T00:01:00.000Z");
    const reserve = admitLegacyCard(reserveBase, "2026-08-11T00:01:00.000Z");
    const retiredReserve = sealRetirement(reserve, {
      creatureId: reserve.id,
      previousRevisionDigest: currentRevision(reserve).digest,
      matchReceiptDigest: `sha256:${"a".repeat(64)}`,
      finalVitality: 0,
      teamOutcome: "defeat",
      retiredAt: "2026-08-11T00:02:00.000Z",
      kaiUPulse: reserve.manifest.history!.events.at(-1)!.kai.uPulse + 1
    }, { verified: true, mortalOptIn: true }).card;
    const state: PlayState = {
      ...structuredClone(initialPlayState),
      inventory: [survivorBase, reserveBase],
      selectedAssetId: reserveBase.id,
      selectedCardId: reserveBase.manifest.familyId,
      livingProgress: {
        [survivorBase.id]: emptyLivingGrowth(0),
        [reserveBase.id]: emptyLivingGrowth(0)
      },
      adventureConditions: {
        [survivorBase.id]: emptyAdventureCondition(survivorBase.id),
        [reserveBase.id]: emptyAdventureCondition(reserveBase.id)
      },
      hearttreeConditions: {},
      pendingSyncAssetIds: []
    };
    const settlement = {
      schema: "receiz.wildz.mortal_arena_settlement.v2",
      id: "arena-settlement:aaaaaaaaaaaaaaaaaaaaaaaa",
      status: "committed",
      receiptDigest: `sha256:${"b".repeat(64)}`,
      playerSide: 0,
      completedAt: "2026-08-11T00:02:00.000Z",
      result: {
        matchId: "arena:atomic",
        winnerSide: 1,
        outcome: "defeat",
        mortal: true,
        finalVitality: [400, 500],
        retiredCreatureIds: [reserveBase.id],
        affectedOwnedCards: [
          { cardId: survivorBase.id, finalVitality: 400, maxVitality: 500, status: "active" },
          { cardId: reserveBase.id, finalVitality: 0, maxVitality: 500, status: "retired" }
        ]
      },
      card: survivor,
      cards: [survivor, retiredReserve],
      cardPins: [
        { assetId: survivorBase.id, proofDigest: survivorBase.proof.digest },
        { assetId: reserveBase.id, proofDigest: reserveBase.proof.digest }
      ],
      canonicalReceipt: null,
      kai: null
    } satisfies ArenaSettlement;

    const committed = applyCommittedArenaSettlement(state, settlement);

    assert.equal(committed.inventory.find((card) => card.id === survivor.id), survivor);
    assert.equal(committed.inventory.find((card) => card.id === reserve.id), retiredReserve);
    assert.deepEqual(new Set(committed.pendingSyncAssetIds), new Set([survivor.id, reserve.id]));
    assert.equal(committed.selectedAssetId, survivor.id);
    assert.equal(committed.selectedCardId, survivor.manifest.familyId);
    assert.equal(committed.adventureConditions[reserve.id]?.life, "dead");
    assert.deepEqual(committed.livingProgress[survivor.id], currentRevision(survivor).growth);
    assert.deepEqual(committed.livingProgress[reserve.id], currentRevision(retiredReserve).growth);

    const replayed = applyCommittedArenaSettlement(committed, settlement);
    assert.deepEqual(replayed, committed);
    assert.deepEqual(replayed.appliedArenaSettlementIds, [settlement.id]);
    assert.deepEqual(restorePlayState(serializePlayState(replayed)).appliedArenaSettlementIds, [settlement.id]);
  });

  it("fails closed before changing state when any pre-match proof pin is stale", () => {
    const card = initialPlayState.inventory[0]!;
    const settlement = {
      schema: "receiz.wildz.mortal_arena_settlement.v2",
      status: "committed",
      cards: [card],
      cardPins: [{ assetId: card.id, proofDigest: `sha256:${"0".repeat(64)}` }]
    } as unknown as ArenaSettlement;

    assert.throws(() => applyCommittedArenaSettlement(initialPlayState, settlement), /proof pin/i);
  });
});
