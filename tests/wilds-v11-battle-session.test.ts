import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import { admitLocallySealedWildsInventory } from "../src/features/play/admitted-inventory";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { sealWildsV11Birth } from "../src/features/play/wilds-card-proof-v11";
import { advanceWildsV11BattleSession, sealCapturedWildsV11BattleSession,
  startWildsV11BattleSession } from "../src/features/play/wilds-battle-session-v11";
import { verifyLocalWildsV11Card } from "../src/features/play/wilds-portable-card-v11";
import { signWildsV11Encounter } from "../src/lib/receiz/wilds-v11-encounter-signer";

const actorId = "player.test";
const keys = generateKeyPairSync("ed25519");
const keyId = "test-battle-v11";
const pinnedKeys = { [keyId]: keys.publicKey.export({ format: "jwk" }).x! };

async function fixture() {
  const encounter = signWildsV11Encounter({ schema: "wildz.encounter-input.v11", keyId,
    law: "wildz.rarity.v11", actorId, slot: 0,
    site: { worldVersion: 11, regionX: "1", regionZ: "0", localX: 4_000_000, localZ: 8_000_000 }
  }, keys.privateKey.export({ format: "pem", type: "pkcs8" }).toString());
  const birth = await sealWildsV11Birth(encounter, pinnedKeys);
  const player = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: actorId,
    encounterId: "starter:test", capturedAt: "2026-09-27T12:00:00.000Z" });
  admitLocallySealedWildsInventory([player]);
  return { birth, player };
}

describe("signed procedural encounter battle", () => {
  it("enters with verified birth and admitted player, and cannot be spoofed from JSON", async () => {
    const { birth, player } = await fixture();
    const started = await startWildsV11BattleSession({ birth, player, ownerId: actorId, pinnedKeys });
    assert.equal(started.battle.wild.name.length > 0, true);
    assert.equal(started.battle.wild.power, birth.birth.stats.power);
    assert.equal(started.battle.wild.guard, birth.birth.stats.guard);
    assert.equal(Object.isFrozen(started.battle), true);
    assert.throws(() => advanceWildsV11BattleSession(structuredClone(started), { type: "guard" }), /unadmitted/);
    assert.throws(() => advanceWildsV11BattleSession(started, { type: "switch",
      player: { assetId: "forged", name: "Forged", health: 9999, power: 9999, guard: 9999, speed: 9999 } }), /action_unadmitted/);
    await assert.rejects(() => sealCapturedWildsV11BattleSession(started, "2026-09-27T12:01:00.000Z", pinnedKeys), /capture_required/);
  });

  it("refuses altered birth, foreign ownership, and unadmitted historical cards", async () => {
    const { birth, player } = await fixture();
    const forged = { ...birth, birth: { ...birth.birth, stats: { ...birth.birth.stats, power: 999 } } };
    await assert.rejects(() => startWildsV11BattleSession({ birth: forged, player, ownerId: actorId, pinnedKeys }), /proof_required/);
    await assert.rejects(() => startWildsV11BattleSession({ birth, player, ownerId: "other.player", pinnedKeys }), /proof_required/);
    await assert.rejects(() => startWildsV11BattleSession({ birth, player: structuredClone(player), ownerId: actorId, pinnedKeys }), /proof_required/);
  });

  it("seals the actual captured session as a locally verified card", async () => {
    const { birth, player } = await fixture();
    let session = await startWildsV11BattleSession({ birth, player, ownerId: actorId, pinnedKeys });
    for (let turn = 0; turn < 40 && session.battle.phase !== "captured" && session.battle.phase !== "defeated"; turn++) {
      session = advanceWildsV11BattleSession(session,
        session.battle.wild.hpRatio <= 0.3 ? { type: "capture" } : { type: "ability", slot: 0 });
    }
    assert.equal(session.battle.phase, "captured");
    const card = await sealCapturedWildsV11BattleSession(session, "2026-09-27T12:01:00.000Z", pinnedKeys);
    assert.equal(card.birth.proofDigest, birth.proofDigest);
    assert.equal(await verifyLocalWildsV11Card(card, pinnedKeys), true);
  });
});
