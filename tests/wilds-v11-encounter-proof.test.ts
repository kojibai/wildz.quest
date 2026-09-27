import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { verifyEncounterResultV11, type WildsEncounterInputV11 } from "../src/features/play/wilds-encounter-proof-v11";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

const site = { worldVersion: 11, regionX: "9007199254740993", regionZ: "-17", localX: 7_000_000, localZ: 19_000_000 } as const;
const input: WildsEncounterInputV11 = { schema: "wildz.encounter-input.v11", keyId: "test-release-v11", law: "wildz.rarity.v11", actorId: "player.receiz.id", site, slot: 3 };

describe("offline v11 encounter proof", () => {
  it("replays one signed rarity and rejects altered claims or an unknown key", async () => {
    const keys = generateKeyPairSync("ed25519");
    const privateKey = keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const publicKeyB64u = keys.publicKey.export({ format: "jwk" }).x!;
    const pins = { "test-release-v11": publicKeyB64u };
    const result = signWildsV11Encounter(input, privateKey);
    assert.deepEqual(signWildsV11Encounter(input, privateKey), result);
    assert.equal(await verifyEncounterResultV11(result, pins), true);
    assert.equal(await verifyEncounterResultV11(result, {}), false);
    assert.equal(await verifyEncounterResultV11({ ...result, className: result.className === "eternal" ? "trail" : "eternal" }, pins), false);
    assert.equal(await verifyEncounterResultV11({ ...result, draw: (result.draw + 1) % 10_000_000 }, pins), false);
    assert.equal(await verifyEncounterResultV11({ ...result, input: { ...input, site: { ...site, regionX: "9007199254740994" } } }, pins), false);
    assert.equal(await verifyEncounterResultV11({ ...result, input: { ...input, actorId: "other.player" } }, pins), false);
  });
});
