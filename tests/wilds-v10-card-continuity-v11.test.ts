import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy";
import { sealCollectedCard, sealDiscoveredCard } from "../src/features/play/portable-card";
import { projectV10CardContinuityV11, upgradeVerifiedV10Card, verifyV10CardContinuityV11 } from "../src/features/play/wilds-card-continuity-v11";
import { initialPlayState, restorePlayState, serializePlayState, upgradeV10PlayStateToV11 } from "../src/features/play/game-state";

const owner = "player.receiz.id";
const at = "2026-07-17T12:00:00.000Z";

describe("non-destructive v10 card continuity", () => {
  it("retains the old rarity and proof while leaving unknown locations unknown", () => {
    const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: owner, encounterId: "legacy-test", capturedAt: at });
    const before = JSON.stringify(card);
    const continuity = upgradeVerifiedV10Card(card);
    assert.equal(JSON.stringify(card), before);
    assert.equal(continuity.originalRarity, card.manifest.rarity);
    assert.equal(continuity.sourceProofDigest, card.proof.digest);
    assert.equal(continuity.firstMeeting, null);
    assert.equal(continuity.birthLaw, "v10-catalog");
    assert.deepEqual(upgradeVerifiedV10Card(card), continuity);
    const inventory = [card];
    assert.equal(projectV10CardContinuityV11(inventory), projectV10CardContinuityV11(inventory));
    assert.equal(verifyV10CardContinuityV11(card, continuity), true);
    assert.equal(verifyV10CardContinuityV11(card, { ...continuity, originalRarity: "eternal" }), false);
  });

  it("carries a verified v3 meeting location through living-card admission", () => {
    const form = creatureForm("mintcub-1")!;
    const identity = discoverLivingCreature({
      encounterId: "encounter:v3-continuity",
      form,
      discoveredAt: at,
      location: { x: 4.25, z: -8.5 },
      ownerScope: owner,
      moment: deriveKaiKlokMoment({ occurredAt: at, authority: "world" })
    });
    const legacy = sealDiscoveredCard({ identity, formId: form.id, ownerReceizId: owner, capturedAt: "2026-07-17T12:04:00.000Z" });
    const living = admitLegacyCard(legacy, legacy.manifest.capturedAt);
    for (const card of [legacy, living]) {
      const continuity = upgradeVerifiedV10Card(card);
      assert.deepEqual(continuity.firstMeeting, { x: 4.25, z: -8.5 });
      assert.equal(continuity.originalRarity, card.manifest.rarity);
      assert.equal(verifyV10CardContinuityV11(card, continuity), true);
    }
  });

  it("automatically binds old cards on v11 resave and rebuilds a forged saved projection", () => {
    const old = initialPlayState.inventory[0]!;
    const upgraded = upgradeV10PlayStateToV11(initialPlayState);
    assert.equal(upgraded.cardContinuityV11?.[old.id]?.sourceProofDigest, old.proof.digest);
    const saved = serializePlayState(upgraded);
    const restored = restorePlayState(saved);
    assert.equal(restored.cardContinuityV11?.[old.id]?.originalRarity, old.manifest.rarity);
    const forged = JSON.parse(saved);
    forged.state.cardContinuityV11[old.id].originalRarity = "eternal";
    const recovered = restorePlayState(JSON.stringify(forged));
    assert.equal(recovered.cardContinuityV11?.[old.id]?.originalRarity, old.manifest.rarity);
    assert.deepEqual(restorePlayState(serializePlayState(recovered)).cardContinuityV11, recovered.cardContinuityV11);
  });
});
