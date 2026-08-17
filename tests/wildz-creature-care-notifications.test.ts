import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { creatureCareNotificationSchedule } from "../src/features/pwa/creature-care-schedule";

test("active proof-owned creatures produce a bounded deterministic care schedule", () => {
  const state = structuredClone(initialPlayState);
  const asset = state.inventory[0]!;
  const start = new Date(Date.parse(asset.proof.sealedAt) + 1_000).toISOString();
  const active = applyWildsInput(state, {
    type: "activate-creature-continuity",
    assetId: asset.id,
    ownerReceizId: asset.manifest.ownerReceizId,
    at: start
  });
  const first = creatureCareNotificationSchedule(active.inventory, start);
  const second = creatureCareNotificationSchedule(active.inventory, start);
  assert.deepEqual(first, second);
  assert.ok(first.length >= 3);
  assert.deepEqual(first.map((entry) => entry.level), ["needs-care", "urgent", "sick", "dead"]);
  assert.ok(first.every((entry) => entry.assetId === asset.id && Date.parse(entry.notifyAt) > Date.parse(start)));
});

test("resting creatures never create care alerts", () => {
  const asset = initialPlayState.inventory[0]!;
  assert.deepEqual(creatureCareNotificationSchedule([asset], asset.proof.sealedAt), []);
});
