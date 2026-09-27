import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";
import { generateCreatureBirthV11 } from "../src/features/play/wilds-creature-generator-v11";
import { sealWildsV11Birth, verifyWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { WILDS_V11_CONFORMANCE_PUBLIC_KEYS } from "../src/features/play/wilds-v11-conformance-keys";
import { WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "../src/features/play/wilds-v11-release-keys";
import type { WildsV11EncounterResult } from "../src/features/play/wilds-encounter-proof-v11";

describe("v11 one-of-one creature birth", () => {
  const keys = generateKeyPairSync("ed25519");
  const privateKey = keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const pinned = { "unit-birth-v11": keys.publicKey.export({ format: "jwk" }).x! };
  const encounter = (regionX: string, slot = 0) => signWildsV11Encounter({
    schema: "wildz.encounter-input.v11", keyId: "unit-birth-v11", law: "wildz.rarity.v11", actorId: "player.test",
    site: { worldVersion: 11, regionX, regionZ: "-42", localX: 12_000_000, localZ: 6_000_000 }, slot
  }, privateKey);

  it("generates a stable body, voice, lineage, ability pair, and full birth identity", () => {
    const one = generateCreatureBirthV11(encounter("9007199254740993"));
    const repeated = generateCreatureBirthV11(encounter("9007199254740993"));
    const neighbor = generateCreatureBirthV11(encounter("9007199254740994"));
    assert.deepEqual(one, repeated);
    assert.notDeepEqual(one.identity, neighbor.identity);
    assert.notEqual(one.generationDigest, neighbor.generationDigest);
    assert.match(one.lineage.regionFamily, /^wildz\.lineage\.v11:/);
    assert.notEqual(one.abilities[0], one.abilities[1]);
    assert.ok(one.body.scale >= 0.8 && one.body.scale <= 1.4);
  });

  it("binds the exact generated creature to a replayable signed encounter", async () => {
    const signed = encounter("500", 2);
    const birth = await sealWildsV11Birth(signed, pinned);
    assert.equal(await verifyWildsV11Birth(birth, pinned), true);
    assert.equal(await verifyWildsV11Birth(birth, {}), false);
    assert.equal(await verifyWildsV11Birth({ ...birth, birth: { ...birth.birth, temperament: birth.birth.temperament === "bold" ? "calm" : "bold" } }, pinned), false);
    assert.equal(await verifyWildsV11Birth({ ...birth, birth: { ...birth.birth, stats: { ...birth.birth.stats, power: 999 } } }, pinned), false);
    assert.equal(await verifyWildsV11Birth({ ...birth, encounter: { ...signed, className: "eternal" } }, pinned), false);
    await assert.rejects(() => sealWildsV11Birth(signed, WILDS_V11_CONFORMANCE_PUBLIC_KEYS));
    const synthetic = JSON.parse(readFileSync("public/conformance/v11/eternal.json", "utf8")) as WildsV11EncounterResult;
    await assert.rejects(() => sealWildsV11Birth(synthetic, WILDS_V11_ENCOUNTER_PUBLIC_KEYS));
  });
});
