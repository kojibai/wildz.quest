import assert from "node:assert/strict";
import { test } from "node:test";
import { startWildBattle } from "../src/features/play/battle-engine";
import { currentRevision } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { healWildBattleCard, settleWildBattleCard } from "../src/features/play/wild-battle-life";

const card = () => sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "battle-life", encounterId: "battle-life-card", capturedAt: "2026-07-18T12:00:00.000Z" });

test("wild battle damage persists and camp recovery is bounded", () => {
  const asset = card();
  const battle = startWildBattle({ encounterSeed: "wild-damage", player: { assetId: asset.id, name: asset.manifest.name, ...asset.manifest.stats, health: 100, currentHealth: 34 }, wild: { formId: "voltray-1", name: "Wild", health: 100, power: 10, guard: 10, speed: 10 } });
  const damaged = settleWildBattleCard(asset, { ...battle, phase: "captured" }, "2026-07-18T12:05:00.000Z");
  assert.equal(isLivingCardAsset(damaged), true);
  if (!isLivingCardAsset(damaged)) throw new Error("expected living battle card");
  assert.equal(currentRevision(damaged).growth.life?.vitality, 34);
  const healed = healWildBattleCard(damaged, 20, "2026-07-18T12:06:00.000Z");
  if (!isLivingCardAsset(healed)) throw new Error("expected healed living card");
  assert.equal(currentRevision(healed).growth.life?.vitality, 54);
});

test("zero health in a wild battle permanently retires the creature", () => {
  const asset = card();
  const battle = startWildBattle({ encounterSeed: "wild-death", player: { assetId: asset.id, name: asset.manifest.name, ...asset.manifest.stats, health: 100 }, wild: { formId: "voltray-1", name: "Wild", health: 100, power: 10, guard: 10, speed: 10 } });
  const retired = settleWildBattleCard(asset, { ...battle, phase: "defeated", player: { ...battle.player, hp: 0, hpRatio: 0 } }, "2026-07-18T12:05:00.000Z");
  if (!isLivingCardAsset(retired)) throw new Error("expected retired living card");
  assert.equal(currentRevision(retired).growth.life?.retired, true);
  assert.equal(currentRevision(retired).growth.life?.retirement?.cause, "wild-battle-zero-vitality");
  assert.equal(healWildBattleCard(retired, 20, "2026-07-18T12:06:00.000Z"), retired);
});
