import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { creatureForm } from "../src/features/play/creature-catalog";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { sealWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { admitVerifiedWildsV11LocalCard, sealLocalWildsV11Card } from "../src/features/play/wilds-portable-card-v11";
import { resolveCardForm } from "../src/features/play/wilds-card-form-resolution";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

describe("card-scoped form resolution", () => {
  it("returns the exact catalog form for an existing card", () => {
    const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player.test",
      encounterId: "existing:site", capturedAt: "2026-09-27T12:00:00.000Z" });
    assert.equal(resolveCardForm(card), creatureForm(card.manifest.formId));
  });

  it("projects a new creature from its proven birth without adding a fixed catalog form", async () => {
    const keys = generateKeyPairSync("ed25519");
    const keyId = "test-form-v11";
    const pinned = { [keyId]: keys.publicKey.export({ format: "jwk" }).x! };
    const ownerId = "player.test";
    const encounter = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId,
      law: "wildz.rarity.v11", actorId: ownerId, slot: 1,
      site: { worldVersion: 11, regionX: "9007199254740993", regionZ: "-7", localX: 7_000_000, localZ: 4_000_000 }
    }, keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString());
    const birth = await sealWildsV11Birth(encounter, pinned);
    const card = await sealLocalWildsV11Card(birth, ownerId, "2026-09-27T12:00:00.000Z", pinned);
    const form = resolveCardForm(card);
    assert.deepEqual(form, resolveCardForm(card));
    assert.equal(form?.id, card.id);
    assert.equal(form?.familyId, birth.birth.lineage.regionFamily);
    assert.equal(form?.rarity, birth.birth.rarity);
    assert.deepEqual(form?.stats, birth.birth.stats);
    assert.deepEqual(form?.anatomy, {
      body: birth.birth.body.body, detail: birth.birth.body.detail, aura: birth.birth.body.aura
    });
    assert.deepEqual(form?.palette, { primary: birth.birth.surface.primary,
      accent: birth.birth.surface.accent, glow: birth.birth.surface.glow });
    assert.equal(creatureForm(card.id), null);
    const restored = JSON.parse(JSON.stringify(card));
    assert.equal(resolveCardForm(restored), null, "raw restored bytes do not become playable traits");
    const admitted = await admitVerifiedWildsV11LocalCard(restored, pinned);
    assert.deepEqual(resolveCardForm(admitted), form);
    assert.equal(Object.isFrozen(admitted.birth.birth.stats), true);
  });
});
