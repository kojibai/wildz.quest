import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { projectWildsRaidRoles, WILDS_RAID_CARD_ROLES } from "../src/features/play/wilds-raid-roles.js";

const card = sealCollectedCard({ capturedAt: "2026-07-15T12:00:00.000Z", encounterId: "raid-role-card", formId: "mintcub-1", ownerReceizId: "player-1" });

describe("raid card roles", () => {
  it("projects stable primary and secondary roles from sealed card facts", () => {
    const roles = projectWildsRaidRoles(card);
    assert.deepEqual(projectWildsRaidRoles(card), roles);
    assert.equal(WILDS_RAID_CARD_ROLES.includes(roles.primary), true);
    assert.equal(WILDS_RAID_CARD_ROLES.includes(roles.secondary), true);
    assert.notEqual(roles.primary, roles.secondary);
    assert.match(roles.proofDigest, /^sha256:[a-f0-9]{64}$/);
  });
});
