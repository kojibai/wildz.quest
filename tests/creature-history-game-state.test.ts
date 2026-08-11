import assert from "node:assert/strict";
import test from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { admitLegacyCard, currentCreatureHistoryProjection, currentRevision } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { projectVaultCompanionRoster } from "../src/features/play/vault-companion-roster";
import { settleWildBattleCard } from "../src/features/play/wild-battle-life";
import { startWildBattle } from "../src/features/play/battle-engine";

test("training writes level, XP, bond, and growth into only the exact selected creature", () => {
  const owner = "exact_history_keeper";
  const firstCapturedAt = "2026-08-11T12:00:00.000Z";
  const first = admitLegacyCard(sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: owner,
    encounterId: "same-family:first",
    capturedAt: firstCapturedAt
  }), firstCapturedAt);
  const secondCapturedAt = "2026-08-11T12:01:00.000Z";
  const second = admitLegacyCard(sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: owner,
    encounterId: "same-family:second",
    capturedAt: secondCapturedAt
  }), secondCapturedAt);
  let state = createOwnerBoundInitialPlayState(owner, "2026-08-11T11:00:00.000Z");
  state = applyWildsInput(state, { type: "import-card", asset: first });
  state = applyWildsInput(state, { type: "import-card", asset: second });
  state = applyWildsInput(state, { type: "select-asset", assetId: first.id });

  const firstBefore = state.inventory.find((asset) => asset.id === first.id);
  const secondBefore = state.inventory.find((asset) => asset.id === second.id);
  assert.ok(firstBefore && secondBefore && isLivingCardAsset(firstBefore) && isLivingCardAsset(secondBefore));
  const firstEvents = firstBefore.manifest.history?.events.length ?? 0;
  const secondEvents = secondBefore.manifest.history?.events.length ?? 0;
  const firstBond = currentCreatureHistoryProjection(firstBefore).bond;
  const firstBondPath = currentCreatureHistoryProjection(firstBefore).growth.paths.bond;

  state = applyWildsInput(state, { type: "train", cardId: first.manifest.familyId, at: "2026-08-11T13:00:00.000Z" });

  const trained = state.inventory.find((asset) => asset.id === first.id);
  const untouched = state.inventory.find((asset) => asset.id === second.id);
  assert.ok(trained && untouched && isLivingCardAsset(trained) && isLivingCardAsset(untouched));
  const projection = currentCreatureHistoryProjection(trained);
  assert.equal(trained.manifest.history?.events.length, firstEvents + 1);
  assert.equal(untouched.manifest.history?.events.length, secondEvents);
  assert.equal(projection.level, 1);
  assert.equal(projection.xp, 40);
  assert.equal(projection.bond, firstBond + 1);
  assert.equal(projection.growth.paths.bond, firstBondPath + 1);
  assert.equal(projection.growth.eventIds.some((id) => id.startsWith(`bond_moment:${first.id}:`)), true);
  assert.equal(state.pendingSyncAssetIds.includes(first.id), true);

  const roster = projectVaultCompanionRoster({
    inventory: state.inventory.filter((asset) => asset.id === first.id || asset.id === second.id),
    companionProgress: { [first.manifest.familyId]: { level: 10, xp: 99, bond: 999 } },
    cardConditions: state.adventureConditions,
    activeAssetId: first.id,
    newAssetId: null
  });
  assert.equal(roster.find((entry) => entry.asset.id === first.id)?.xp, 40);
  assert.equal(roster.find((entry) => entry.asset.id === second.id)?.xp, 0);

  state = applyWildsInput(state, { type: "select-asset", assetId: second.id });
  assert.equal(state.companionProgress[second.manifest.familyId]?.xp, 0);
  state = applyWildsInput(state, { type: "train", cardId: second.manifest.familyId, at: "2026-08-11T14:00:00.000Z" });
  const firstAfterBoth = state.inventory.find((asset) => asset.id === first.id);
  const secondAfterBoth = state.inventory.find((asset) => asset.id === second.id);
  assert.ok(firstAfterBoth && secondAfterBoth && isLivingCardAsset(firstAfterBoth) && isLivingCardAsset(secondAfterBoth));
  assert.equal(currentCreatureHistoryProjection(firstAfterBoth).xp, 40);
  assert.equal(currentCreatureHistoryProjection(secondAfterBoth).xp, 40);
});

test("camp recovery persists the exact creature revision and history immediately", () => {
  const owner = "exact_history_healer";
  const capturedAt = "2026-08-11T10:00:00.000Z";
  const base = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: owner,
    encounterId: "recovery:exact",
    capturedAt
  });
  const battle = startWildBattle({
    encounterSeed: "recovery:exact",
    player: { assetId: base.id, name: base.manifest.name, ...base.manifest.stats, health: 100, currentHealth: 35 },
    wild: { formId: "mintcub-1", name: "Wild", health: 100, power: 10, guard: 10, speed: 10 }
  });
  const damaged = settleWildBattleCard(base, { ...battle, phase: "captured" }, "2026-08-11T11:00:00.000Z");
  const initial = createOwnerBoundInitialPlayState(owner, capturedAt);
  const state = {
    ...initial,
    inventory: [damaged],
    selectedAssetId: damaged.id,
    selectedCardId: damaged.manifest.familyId,
    livingProgress: { [damaged.id]: currentRevision(damaged).growth },
    adventureConditions: { [damaged.id]: initial.adventureConditions[initial.selectedAssetId]! },
    pendingSyncAssetIds: []
  };
  const before = damaged.manifest.history?.events.length ?? 0;
  const rested = applyWildsInput(state, { type: "rest", at: "2026-08-11T12:00:00.000Z" });
  const recovered = rested.inventory[0]!;
  assert.ok(isLivingCardAsset(recovered));
  assert.equal(recovered.manifest.history?.events.length, before + 1);
  assert.equal(rested.pendingSyncAssetIds.includes(recovered.id), true);
  assert.deepEqual(rested.livingProgress[recovered.id], currentRevision(recovered).growth);
});
