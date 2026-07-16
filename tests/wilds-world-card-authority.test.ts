import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import {
  verifyWildsWorldCommandCard,
  worldCommandRequiresCard
} from "../src/features/play/wilds-world-authority.js";

const capturedAt = "2026-07-15T12:00:00.000Z";
const card = sealCollectedCard({ capturedAt, encounterId: "world-authority-card", formId: "mintcub-1", ownerReceizId: "player-1" });

describe("Wilds canonical card authority", () => {
  it("requires cards for every command that can contribute canonical value", () => {
    assert.equal(worldCommandRequiresCard({ type: "raid.act", bossId: "boss:one", roundId: "round:one", intent: "strike", commandId: "command:act" }), true);
    assert.equal(worldCommandRequiresCard({ type: "raid.contribute", bossId: "boss:one", damage: 1, support: 0, cardProofDigest: card.proof.digest, commandId: "command:raid" }), true);
    assert.equal(worldCommandRequiresCard({ type: "ecology.contribute", siteId: "site:one", position: { x: 0, z: 0 }, amount: 1, cardProofDigest: card.proof.digest, commandId: "command:ecology" }), true);
    assert.equal(worldCommandRequiresCard({ type: "raid.join", bossId: "boss:one", commandId: "command:join" }), false);
  });

  it("admits only a verified card matching the command proof", () => {
    const command = { type: "ecology.contribute" as const, siteId: "site:one", position: { x: 0, z: 0 }, amount: 1, cardProofDigest: card.proof.digest, commandId: "command:ecology" };
    assert.throws(() => verifyWildsWorldCommandCard({ command, card: undefined }), /wilds_world_verified_card_required/);
    assert.throws(() => verifyWildsWorldCommandCard({ command: { ...command, cardProofDigest: `sha256:${"f".repeat(64)}` }, card }), /wilds_world_card_proof_invalid/);
    assert.equal(verifyWildsWorldCommandCard({ command, card }), card);
  });
});
