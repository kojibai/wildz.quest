import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertHearttreeCardPlayable,
  emptyHearttreeCondition,
  projectHearttreeCard
} from "../src/features/play/hearttree/card-capability";
import { sealCollectedCard } from "../src/features/play/portable-card";

function card(formId: string, encounterId: string) {
  return sealCollectedCard({
    formId,
    ownerReceizId: "hearttree.player",
    encounterId,
    capturedAt: "2026-07-16T12:00:00.000Z"
  });
}

describe("Hearttree exact card capability projection", () => {
  it("projects real catalog stats, element, abilities, anatomy, and proof identity", () => {
    const source = card("mintcub-1", "hearttree-grove");
    const projected = projectHearttreeCard(source, emptyHearttreeCondition(source.id));

    assert.equal(projected.assetId, source.id);
    assert.equal(projected.proofDigest, source.proof.digest);
    assert.equal(projected.formId, source.manifest.formId);
    assert.equal(projected.familyId, source.manifest.familyId);
    assert.deepEqual(projected.stats, source.manifest.stats);
    assert.equal(projected.element, "Grove");
    assert.deepEqual(projected.abilityNames, source.manifest.abilityNames);
    assert.equal(projected.anatomy.body, "round");
    assert.equal(projected.traversal.has("ground"), true);
    assert.equal(projected.playable, true);
    assert.ok(projected.roles.length >= 2);
  });

  it("turns actual flying and armored anatomy into different traversal options", () => {
    const flying = card("voltray-1", "hearttree-flying");
    const armored = card("titanseal-1", "hearttree-armored");
    const flyingProjection = projectHearttreeCard(flying, emptyHearttreeCondition(flying.id));
    const armoredProjection = projectHearttreeCard(armored, emptyHearttreeCondition(armored.id));

    assert.equal(flyingProjection.traversal.has("flight"), true);
    assert.equal(flyingProjection.traversal.has("break"), false);
    assert.equal(armoredProjection.traversal.has("anchor"), true);
    assert.equal(armoredProjection.traversal.has("break"), true);
  });

  it("applies persistent fatigue and specific injuries without changing the sealed card", () => {
    const source = card("voltray-1", "hearttree-injured");
    const healthy = projectHearttreeCard(source, emptyHearttreeCondition(source.id));
    const injured = projectHearttreeCard(source, {
      ...emptyHearttreeCondition(source.id),
      fatigue: 40,
      injuries: [{ id: "injury:wing", kind: "wing", severity: 2, sourceEventId: "event:fall" }]
    });

    assert.ok(injured.stats.health < healthy.stats.health);
    assert.ok(injured.stats.speed < healthy.stats.speed);
    assert.equal(injured.traversal.has("flight"), false);
    assert.deepEqual(source.manifest.stats, healthy.stats);
  });

  it("keeps death irreversible at the capability boundary", () => {
    const source = card("mintcub-1", "hearttree-dead");
    const dead = projectHearttreeCard(source, {
      ...emptyHearttreeCondition(source.id),
      life: "dead"
    });

    assert.equal(dead.playable, false);
    assert.throws(() => assertHearttreeCardPlayable(dead), /hearttree_card_dead/);
  });

  it("rejects a condition belonging to another card and a tampered proof", () => {
    const source = card("mintcub-1", "hearttree-invalid");
    assert.throws(
      () => projectHearttreeCard(source, emptyHearttreeCondition("wilds:other")),
      /hearttree_condition_asset_mismatch/
    );
    assert.throws(
      () => projectHearttreeCard({ ...source, proof: { ...source.proof, digest: "sha256:tampered" } }, emptyHearttreeCondition(source.id)),
      /hearttree_card_proof_invalid/
    );
  });

  it("fails closed on impossible restored condition values", () => {
    const source = card("mintcub-1", "hearttree-condition-bounds");
    assert.throws(
      () => projectHearttreeCard(source, { ...emptyHearttreeCondition(source.id), fatigue: 101 }),
      /hearttree_condition_fatigue_invalid/
    );
    assert.throws(
      () => projectHearttreeCard(source, {
        ...emptyHearttreeCondition(source.id),
        injuries: [{ id: "injury:invalid", kind: "unknown" as "limb", severity: 1, sourceEventId: "event:invalid" }]
      }),
      /hearttree_condition_injury_invalid/
    );
  });
});
