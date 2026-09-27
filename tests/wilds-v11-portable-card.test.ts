import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";
import { sealWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { sealLocalWildsV11Card, verifyLocalWildsV11Card } from "../src/features/play/wilds-portable-card-v11";

const keys = generateKeyPairSync("ed25519");
const privateKeyPem = keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const pinned = { "test-v11-card": keys.publicKey.export({ format: "jwk" }).x! };
const ownerId = "explorer.test";

async function birth(regionX = "42") {
  return sealWildsV11Birth(signWildsV11Encounter({ schema: "wildz.encounter-input.v11",
    keyId: "test-v11-card", law: "wildz.rarity.v11", actorId: ownerId,
    site: { worldVersion: 11, regionX, regionZ: "-5", localX: 4_000_000, localZ: 7_000_000 }, slot: 2
  }, privateKeyPem), pinned);
}

describe("local portable creature envelope", () => {
  it("preserves the signed one-of-one birth and a stable full identity across local reseals", async () => {
    const original = await birth();
    const first = await sealLocalWildsV11Card(original, ownerId, "2026-09-27T12:00:00.000Z", pinned);
    const repeated = await sealLocalWildsV11Card(original, ownerId, "2026-09-27T12:01:00.000Z", pinned);
    const neighbor = await sealLocalWildsV11Card(await birth("43"), ownerId, "2026-09-27T12:00:00.000Z", pinned);
    assert.equal(first.id, repeated.id);
    assert.notEqual(first.proofDigest, repeated.proofDigest);
    assert.notEqual(first.id, neighbor.id);
    assert.deepEqual(first.birth, original);
    assert.equal(first.status, "sealed_local");
    assert.equal(await verifyLocalWildsV11Card(first, pinned), true);
  });

  it("fails closed on a foreign owner, changed birth, changed capture time, or unknown key", async () => {
    const original = await birth();
    await assert.rejects(() => sealLocalWildsV11Card(original, "foreign.explorer", "2026-09-27T12:00:00.000Z", pinned));
    const card = await sealLocalWildsV11Card(original, ownerId, "2026-09-27T12:00:00.000Z", pinned);
    assert.equal(await verifyLocalWildsV11Card({ ...card, ownerId: "foreign.explorer" }, pinned), false);
    assert.equal(await verifyLocalWildsV11Card({ ...card, capturedAt: "2026-09-27T12:00:01.000Z" }, pinned), false);
    assert.equal(await verifyLocalWildsV11Card({ ...card, birth: { ...original,
      birth: { ...original.birth, stats: { ...original.birth.stats, power: 999 } } } }, pinned), false);
    assert.equal(await verifyLocalWildsV11Card(card, {}), false);
  });
});
