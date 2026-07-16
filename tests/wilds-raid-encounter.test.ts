import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { generateWildsBoss } from "../src/features/play/wilds-boss-ecology.js";
import { advanceDynamicSite, generateCrystalBurrow } from "../src/features/play/wilds-dynamic-sites.js";
import { applyWildsRaidIntent, createWildsRaidEncounter, projectWildsRaidTelegraph } from "../src/features/play/wilds-raid-encounter.js";

const now = "2026-07-15T12:00:00.000Z";
const card = sealCollectedCard({ capturedAt: now, encounterId: "raid-action-card", formId: "mintcub-1", ownerReceizId: "player-1" });
const site = advanceDynamicSite(advanceDynamicSite(generateCrystalBurrow({ pulse: now, ordinal: 1, activeSites: [] }), "tracked"), "emerged");
const boss = generateWildsBoss({ familyId: "crystal-burrower", site, pulse: now, ordinal: 1, existingBosses: [] });
const authority = { actorId: "player-1", card, eventOrdinal: 1, occurredAt: now };

describe("semantic raid encounter", () => {
  it("derives impact from the verified card instead of client damage", () => {
    const encounter = createWildsRaidEncounter({ boss, roundId: "round:1", openedAt: now });
    const next = applyWildsRaidIntent(encounter, { type: "strike", commandId: "command:strike:1" }, authority);
    assert.equal(next.acceptedImpact > 0, true);
    assert.equal(next.bossHealth < encounter.bossHealth, true);
    assert.ok(next.acceptedIntent);
    assert.equal("damage" in next.acceptedIntent, false);
    assert.deepEqual(applyWildsRaidIntent(encounter, { type: "strike", commandId: "command:strike:1" }, authority), next);
  });

  it("projects telegraphs and enforces deterministic cooldowns", () => {
    const encounter = createWildsRaidEncounter({ boss, roundId: "round:2", openedAt: now });
    const focused = applyWildsRaidIntent(encounter, { type: "focus", commandId: "command:focus:1" }, authority);
    assert.match(projectWildsRaidTelegraph(focused).hazard, /.+/);
    assert.throws(() => applyWildsRaidIntent(focused, { type: "focus", commandId: "command:focus:2" }, { ...authority, eventOrdinal: 2, occurredAt: "2026-07-15T12:00:01.000Z" }), /wilds_raid_action_cooldown/);
  });
});
