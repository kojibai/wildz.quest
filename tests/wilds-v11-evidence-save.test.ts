import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { createOwnerBoundInitialPlayState, restorePlayState, serializePlayState,
  upgradeV10PlayStateToV11 } from "../src/features/play/game-state";
import { resolveCardForm } from "../src/features/play/wilds-card-form-resolution";
import { sealWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { admitVerifiedWildsV11LocalCard, sealLocalWildsV11Card } from "../src/features/play/wilds-portable-card-v11";
import { mergeWildsPlayerPlayStates } from "../src/features/play/wilds-player-vault";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

const actorId = "player.test";
const keys = generateKeyPairSync("ed25519");
const keyId = "test-save-v11";
const pinned = { [keyId]: keys.publicKey.export({ format: "jwk" }).x! };

async function card() {
  const signed = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId,
    law: "wildz.rarity.v11", actorId, slot: 1,
    site: { worldVersion: 11, regionX: "8", regionZ: "-3", localX: 4_000_000, localZ: 7_000_000 }
  }, keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString());
  return sealLocalWildsV11Card(await sealWildsV11Birth(signed, pinned), actorId,
    "2026-09-27T12:00:00.000Z", pinned);
}

describe("procedural card evidence through old Vault and play saves", () => {
  it("preserves exact bytes, while raw restored bytes remain unplayable until async verification", async () => {
    const newCard = await card();
    const state = { ...upgradeV10PlayStateToV11(createOwnerBoundInitialPlayState(actorId)), proceduralCardEvidenceV11: [newCard] };
    const historical = state.inventory[0]!;
    const saved = serializePlayState(state);
    const restored = restorePlayState(saved, actorId);
    assert.deepEqual(restored.proceduralCardEvidenceV11, [newCard]);
    assert.equal(restored.inventory[0]?.proof.digest, historical.proof.digest);
    assert.equal(resolveCardForm(restored.proceduralCardEvidenceV11![0]!), null);
    const admitted = await admitVerifiedWildsV11LocalCard(restored.proceduralCardEvidenceV11![0]!, pinned);
    assert.equal(resolveCardForm(admitted)?.rarity, newCard.birth.birth.rarity);
  });

  it("keeps a tampered payload only as untrusted evidence and excludes foreign owner bytes", async () => {
    const newCard = await card();
    const state = { ...upgradeV10PlayStateToV11(createOwnerBoundInitialPlayState(actorId)), proceduralCardEvidenceV11: [newCard] };
    const tampered = JSON.parse(serializePlayState(state));
    tampered.state.proceduralCardEvidenceV11[0].birth.birth.stats.power = 999;
    const restored = restorePlayState(JSON.stringify(tampered), actorId);
    assert.equal(resolveCardForm(restored.proceduralCardEvidenceV11![0]!), null);
    await assert.rejects(() => admitVerifiedWildsV11LocalCard(restored.proceduralCardEvidenceV11![0]!, pinned), /unverified/);
    assert.equal(restorePlayState(serializePlayState(state), "foreign.player").proceduralCardEvidenceV11?.length, 0);
  });

  it("retains competing local envelopes without treating array order or capture time as authority", async () => {
    const first = await card();
    const second = await sealLocalWildsV11Card(first.birth, actorId, "2026-09-27T12:01:00.000Z", pinned);
    const state = upgradeV10PlayStateToV11(createOwnerBoundInitialPlayState(actorId));
    const merged = mergeWildsPlayerPlayStates({ local: { ...state, proceduralCardEvidenceV11: [first] },
      restored: { ...state, proceduralCardEvidenceV11: [second] }, actorId });
    assert.deepEqual(new Set(merged.proceduralCardEvidenceV11?.map(value => value.proofDigest)),
      new Set([first.proofDigest, second.proofDigest]));
  });
});
