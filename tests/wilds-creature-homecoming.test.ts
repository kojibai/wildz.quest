import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";
import { discoverLivingCreature } from "../src/features/play/living-taxonomy";
import { sealCollectedCard, sealDiscoveredCard, verifyAnyWildsCard } from "../src/features/play/portable-card";
import { upgradeVerifiedV10Card } from "../src/features/play/wilds-card-continuity-v11";
import { v10PositionToWildsAddress } from "../src/features/play/wilds-world-address";
import { projectWildsHomecomingOffer } from "../src/features/play/wilds-creature-homecoming";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { isLivingCardAsset } from "../src/features/play/living-card-types";

describe("proven first-meeting homecoming", () => {
  it("offers a return only for a present companion at its proven v10-v3 meeting place", () => {
    const at = "2026-07-17T12:00:00.000Z";
    const form = creatureForm("mintcub-1")!;
    const identity = discoverLivingCreature({ encounterId: "encounter:homecoming-test", form, discoveredAt: at,
      location: { x: 4.25, z: -8.5 }, ownerScope: "homecoming-owner", moment: deriveKaiKlokMoment({ occurredAt: at, authority: "world" }) });
    const card = sealDiscoveredCard({ identity, formId: form.id, ownerReceizId: "homecoming-owner", capturedAt: at });
    const continuity = upgradeVerifiedV10Card(card);
    assert.ok(continuity.firstMeeting);
    const nearby = projectWildsHomecomingOffer({ card, continuity, playerAddress: v10PositionToWildsAddress(continuity.firstMeeting.x, continuity.firstMeeting.z), present: true, completed: false });
    assert.ok(nearby);
    assert.equal(nearby.choices.length, 3);
    assert.equal(projectWildsHomecomingOffer({ card, continuity, playerAddress: v10PositionToWildsAddress(continuity.firstMeeting.x + 10, continuity.firstMeeting.z), present: true, completed: false }), null);
    assert.equal(projectWildsHomecomingOffer({ card, continuity, playerAddress: v10PositionToWildsAddress(continuity.firstMeeting.x, continuity.firstMeeting.z), present: false, completed: false }), null);
    assert.equal(projectWildsHomecomingOffer({ card, continuity, playerAddress: v10PositionToWildsAddress(continuity.firstMeeting.x, continuity.firstMeeting.z), present: true, completed: true }), null);
    assert.equal(projectWildsHomecomingOffer({ card, continuity: { ...continuity, sourceProofDigest: "sha256:tampered" }, playerAddress: v10PositionToWildsAddress(continuity.firstMeeting.x, continuity.firstMeeting.z), present: true, completed: false }), null);
    const oldCard = sealCollectedCard({ formId: form.id, ownerReceizId: "homecoming-owner", encounterId: "old-meeting", capturedAt: at });
    assert.equal(projectWildsHomecomingOffer({ card: oldCard, continuity: upgradeVerifiedV10Card(oldCard), playerAddress: v10PositionToWildsAddress(4.25, -8.5), present: true, completed: false }), null);
  });
  it("records one player-chosen return in the portable creature history and journey journal", () => {
    const at = "2026-07-17T12:00:00.000Z";
    const form = creatureForm("mintcub-1")!;
    const identity = discoverLivingCreature({ encounterId: "encounter:homecoming-ledger", form, discoveredAt: at,
      location: { x: 4.25, z: -8.5 }, ownerScope: "homecoming-owner", moment: deriveKaiKlokMoment({ occurredAt: at, authority: "world" }) });
    const card = sealDiscoveredCard({ identity, formId: form.id, ownerReceizId: "homecoming-owner", capturedAt: at });
    const continuity = upgradeVerifiedV10Card(card);
    const state = { ...initialPlayState, inventory: [card], selectedAssetId: card.id,
      worldAddress: v10PositionToWildsAddress(4.25, -8.5), cardContinuityV11: { [card.id]: continuity },
      journeyJournal: { version: 1 as const, ownerId: "homecoming-owner", memories: [] } };
    const input = { type: "complete-homecoming" as const, assetId: card.id, ownerReceizId: "homecoming-owner",
      choice: "rest" as const, at: "2026-07-18T12:00:00.000Z" };
    const returned = applyWildsInput(state, input);
    assert.notEqual(returned, state);
    assert.equal(returned.journeyJournal?.memories.length, 1);
    assert.equal(returned.journeyJournal?.memories[0].kind, "homecoming");
    assert.ok(isLivingCardAsset(returned.inventory[0]));
    if (!isLivingCardAsset(returned.inventory[0])) return;
    assert.equal(returned.inventory[0].manifest.history?.events.at(-1)?.rulesetVersion, "wildz.homecoming.v11");
    assert.equal(verifyAnyWildsCard(returned.inventory[0]).ok, true);
    assert.equal(applyWildsInput(returned, input).inventory[0].proof.digest, returned.inventory[0].proof.digest);
    assert.equal(applyWildsInput(state, { ...input, ownerReceizId: "another-owner" }), state);
    assert.equal(applyWildsInput({ ...state, worldAddress: v10PositionToWildsAddress(50, 50) }, input).inventory[0].proof.digest, card.proof.digest);
  });
});
