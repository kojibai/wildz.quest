import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import {
  assertMarketCardPlayable,
  projectMarketCard,
} from "../src/features/play/market/card-role";
import { sealCollectedCard } from "../src/features/play/portable-card";

function card(formId: string, encounterId: string) {
  return sealCollectedCard({
    formId,
    ownerReceizId: "market.player",
    encounterId,
    capturedAt: "2026-07-16T21:00:00.000Z",
  });
}

describe("Wayfarer exact card role projection", () => {
  it("preserves exact proof, stats, abilities, anatomy, and condition", () => {
    const source = card("mintcub-1", "market-grove");
    const condition = emptyAdventureCondition(source.id);
    const projected = projectMarketCard(source, condition);

    assert.equal(projected.assetId, source.id);
    assert.equal(projected.proofDigest, source.proof.digest);
    assert.equal(projected.formId, source.manifest.formId);
    assert.deepEqual(projected.stats, source.manifest.stats);
    assert.deepEqual(projected.abilities.map((ability) => ability.name), source.manifest.abilityNames);
    assert.equal(projected.abilities.every((ability) => ability.power > 0), true);
    assert.equal(projected.anatomy.body, "round");
    assert.equal(projected.element, "Grove");
    assert.equal(projected.condition, condition);
    assert.equal(projected.playable, true);
    assert.equal(projected.roles.length, 2);
  });

  it("turns real element and anatomy into different market verbs", () => {
    const grove = card("mintcub-1", "market-verbs-grove");
    const spark = card("voltray-1", "market-verbs-spark");
    const tide = card("ledgerfox-1", "market-verbs-tide");
    const stone = card("titanseal-1", "market-verbs-stone");
    const groveRole = projectMarketCard(grove, emptyAdventureCondition(grove.id));
    const sparkRole = projectMarketCard(spark, emptyAdventureCondition(spark.id));
    const tideRole = projectMarketCard(tide, emptyAdventureCondition(tide.id));
    const stoneRole = projectMarketCard(stone, emptyAdventureCondition(stone.id));

    assert.equal(groveRole.verbs.has("preserve"), true);
    assert.equal(sparkRole.verbs.has("power"), true);
    assert.equal(sparkRole.verbs.has("overfly"), true);
    assert.equal(tideRole.verbs.has("appraise"), true);
    assert.equal(stoneRole.verbs.has("brace"), true);
    assert.equal(stoneRole.verbs.has("heavy-carry"), true);
    assert.notDeepEqual(groveRole.roles, stoneRole.roles);
  });

  it("makes persistent injuries remove physical options and exact stats", () => {
    const source = card("voltray-1", "market-injured");
    const healthy = projectMarketCard(source, emptyAdventureCondition(source.id));
    const injured = projectMarketCard(source, {
      ...emptyAdventureCondition(source.id),
      fatigue: 40,
      injuries: [{ id: "market:wing", kind: "wing", severity: 2, sourceEventId: "market:event:fall" }],
    });

    assert.equal(healthy.verbs.has("overfly"), true);
    assert.equal(injured.verbs.has("overfly"), false);
    assert.ok(injured.stats.health < healthy.stats.health);
    assert.ok(injured.stats.speed < healthy.stats.speed);
  });

  it("rejects dead, foreign-condition, and tampered cards", () => {
    const source = card("mintcub-1", "market-invalid");
    const dead = projectMarketCard(source, { ...emptyAdventureCondition(source.id), life: "dead" });
    assert.equal(dead.playable, false);
    assert.throws(() => assertMarketCardPlayable(dead), /market_card_dead/);
    assert.throws(() => projectMarketCard(source, emptyAdventureCondition("card:other")), /condition_asset_mismatch/);
    assert.throws(
      () => projectMarketCard({ ...source, proof: { ...source.proof, digest: "sha256:tampered" } }, emptyAdventureCondition(source.id)),
      /card_proof_invalid/,
    );
  });
});
