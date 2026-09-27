import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { resolveCardForm } from "../src/features/play/wilds-card-form-resolution";
import { sealWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { sealLocalWildsV11Card } from "../src/features/play/wilds-portable-card-v11";
import { admitWildsV11Collection } from "../src/features/play/wilds-v11-collection-admission";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

const ownerId = "player.test";
const keys = generateKeyPairSync("ed25519");
const keyId = "test-collection-v11";
const pinnedKeys = { [keyId]: keys.publicKey.export({ format: "jwk" }).x! };

async function fixture() {
  const signed = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId,
    law: "wildz.rarity.v11", actorId: ownerId, slot: 0,
    site: { worldVersion: 11, regionX: "9", regionZ: "1", localX: 4_000_000, localZ: 7_000_000 }
  }, keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString());
  const birth = await sealWildsV11Birth(signed, pinnedKeys);
  const first = await sealLocalWildsV11Card(birth, ownerId, "2026-09-27T12:00:00.000Z", pinnedKeys);
  const second = await sealLocalWildsV11Card(birth, ownerId, "2026-09-27T12:01:00.000Z", pinnedKeys);
  return { first, second };
}

describe("offline procedural collection admission", () => {
  it("verifies every exact envelope, rejects tampering and foreign owners, and selects one stable presentation", async () => {
    const { first, second } = await fixture();
    const altered = { ...first, birth: { ...first.birth,
      birth: { ...first.birth.birth, stats: { ...first.birth.birth.stats, power: 999 } } } };
    const foreign = { ...first, ownerId: "other.player" };
    const left = await admitWildsV11Collection({ evidence: [second, altered, foreign, first], ownerId, pinnedKeys });
    const right = await admitWildsV11Collection({ evidence: [first, foreign, altered, second], ownerId, pinnedKeys });
    assert.deepEqual(left.rejected, [1, 2]);
    assert.deepEqual(right.rejected, [1, 2]);
    assert.equal(left.cards.length, 1);
    assert.deepEqual(left.cards[0], right.cards[0]);
    assert.equal(resolveCardForm(left.cards[0]!)?.rarity, first.birth.birth.rarity);
    assert.equal(resolveCardForm(altered), null);
  });

  it("yields during a large restore without imposing a collection cap and cancels safely", async () => {
    const { first } = await fixture();
    let yields = 0;
    const admitted = await admitWildsV11Collection({ evidence: Array(17).fill(first), ownerId, pinnedKeys,
      yieldToFrame: async () => { yields += 1; } });
    assert.equal(admitted.cards.length, 1);
    assert.equal(yields, 2);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => admitWildsV11Collection({ evidence: [first], ownerId, pinnedKeys,
      signal: controller.signal }), /aborted/);
  });
});
