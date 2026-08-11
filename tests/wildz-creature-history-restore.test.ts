import assert from "node:assert/strict";
import { test } from "node:test";
import { createOwnerBoundInitialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { admitLegacyCard, appendLivingCardHistory, currentCreatureHistoryProjection } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";

test("restore projects the verified exact-card history condition before stale side maps", () => {
  const state = createOwnerBoundInitialPlayState("history_restore_keeper", "2026-08-11T12:00:00.000Z");
  const source = state.inventory[0]!;
  const base = isLivingCardAsset(source) ? source : admitLegacyCard(source, "2026-08-11T12:00:00.000Z");
  const trained = appendLivingCardHistory({
    asset: base,
    event: {
      eventId: "restore:condition",
      rulesetVersion: "wildz.adventure.v1",
      occurredAt: "2026-08-11T12:10:00.000Z",
      source: { mode: "arena", activityId: "arena:restore", actorId: "history_restore_keeper", authority: "local" },
      evidence: {},
      effects: [{
        kind: "condition",
        delta: {
          assetId: base.id,
          lifeBefore: "alive",
          lifeAfter: "alive",
          fatigueDelta: 7,
          injuriesAdded: [],
          xp: { arena: 9 },
          mastery: { arena: 3 },
          upgradeIdsAdded: ["arena:guard-i"],
          receiptDigestsAdded: []
        }
      }]
    }
  });
  const stale = {
    ...state,
    inventory: [trained],
    adventureConditions: { [trained.id]: emptyAdventureCondition(trained.id) }
  };
  const restored = restorePlayState(serializePlayState(stale));
  assert.deepEqual(restored.adventureConditions[trained.id], currentCreatureHistoryProjection(trained).condition);
});
