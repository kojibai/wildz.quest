import assert from "node:assert/strict";
import { test } from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { lineageEligibility } from "../src/features/play/living-lineage";

const owner = "explorer:trail-resources";
const at = "2026-07-15T12:00:00.000Z";
const initial = () => createOwnerBoundInitialPlayState(owner, at);
function earnTrainingMilestone(state: ReturnType<typeof initial>, startAt: string) {
  for (let session = 0; session < 3; session++) state = applyWildsInput(state, { type: "train", at: new Date(Date.parse(startAt) + session * 10 * 60 * 1000).toISOString() });
  return state;
}

test("a completed expedition earns one breeding Spark without re-awarding on replay or restore", () => {
  const start = { ...initial(), fusionSparks: 0, missionProgress: 99 };
  const trained = earnTrainingMilestone(start, at);
  assert.equal(trained.fusionSparks, 1);
  assert.equal(trained.completedMissionIds.length, 1);
  assert.equal(trained.beans, start.beans + 12);
  assert.equal(applyWildsInput(trained, { type: "train", at }).fusionSparks, 1);
  const restored = restorePlayState(serializePlayState(trained), owner);
  assert.equal(restored.fusionSparks, 1);
  assert.equal(restored.missionProgress, trained.missionProgress);
  assert.equal(applyWildsInput(restored, { type: "mission" }).fusionSparks, 1);
});

test("partial or rejected training never grants a Spark", () => {
  const start = { ...initial(), fusionSparks: 0 };
  const trained = applyWildsInput(start, { type: "train", at });
  assert.equal(trained.fusionSparks, 0);
  assert.equal(applyWildsInput({ ...start, energy: 0 }, { type: "train", at }).fusionSparks, 0);
});

test("one starter Spark permits the first child; another child needs earned supplies", () => {
  const start = initial();
  const parentA = start.inventory[0]!;
  const parentB = sealCollectedCard({ formId: "titanseal-1", encounterId: "trail-second-parent", ownerReceizId: owner, capturedAt: at });
  const ready = { ...start, inventory: [...start.inventory, parentB] };
  const first = applyWildsInput(ready, { type: "fuse-cards", parentAId: parentA.id, parentBId: parentB.id, inheritance: "balanced", fusedAt: at });
  assert.equal(first.inventory.length, 3);
  assert.equal(first.fusionSparks, 0);
  const later = "2026-07-17T12:00:00.000Z";
  const denied = applyWildsInput(first, { type: "fuse-cards", parentAId: parentA.id, parentBId: parentB.id, inheritance: "balanced", fusedAt: later });
  assert.equal(denied.inventory.length, 3);
  assert.equal(denied.fusionSparks, 0);
  const earned = earnTrainingMilestone({ ...denied, missionProgress: 99 }, later);
  const next = applyWildsInput(earned, { type: "fuse-cards", parentAId: parentA.id, parentBId: parentB.id, inheritance: "balanced", fusedAt: "2026-07-17T12:21:00.000Z" });
  assert.equal(next.inventory.length, 4);
  assert.equal(next.fusionSparks, 0);
});

test("resource balances remain finite whole units and valid old balances are preserved", () => {
  for (const invalid of [-1, 1.5, "9", null] as unknown[]) {
    const state = initial();
    const restored = restorePlayState(serializePlayState({ ...state, beans: invalid, fusionSparks: invalid } as never), owner);
    assert.equal(restored.beans, 0);
    assert.equal(restored.fusionSparks, 0);
  }
  const state = initial();
  const restored = restorePlayState(serializePlayState({ ...state, beans: 42, fusionSparks: 7 }), owner);
  assert.equal(restored.beans, 42);
  assert.equal(restored.fusionSparks, 7);
  assert.equal(applyWildsInput({ ...state, beans: Number.MAX_SAFE_INTEGER }, { type: "train", at }).beans, Number.MAX_SAFE_INTEGER);
  const other = sealCollectedCard({ formId: "titanseal-1", encounterId: "trail-invalid-sparks", ownerReceizId: owner, capturedAt: at });
  assert.equal(lineageEligibility({ parentA: state.inventory[0]!, parentB: other, inheritance: "balanced", sparkId: "spark:invalid",
    kaiPulse: "1000000", createdAt: at, fusionSparks: Number.NaN, recovery: {} }).ok, false);
});

test("beans pay for actual creature feeding and treatment without changing birth identity", () => {
  const state = initial(), asset = state.inventory[0]!;
  const awakened = applyWildsInput(state, { type: "activate-creature-continuity", assetId: asset.id, ownerReceizId: owner, at });
  const fed = applyWildsInput(awakened, { type: "care-for-creature", assetId: asset.id, ownerReceizId: owner, action: "feed", at });
  assert.equal(fed.beans, state.beans - 3);
  const treated = applyWildsInput(fed, { type: "care-for-creature", assetId: asset.id, ownerReceizId: owner, action: "treat", at: "2026-07-15T12:01:00.000Z" });
  assert.equal(treated.beans, state.beans - 11);
  assert.deepEqual(treated.inventory[0]?.manifest.variant, asset.manifest.variant);
});
