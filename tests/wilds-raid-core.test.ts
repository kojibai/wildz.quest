import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateCrystalBurrower } from "../src/features/play/wilds-boss-generator.js";
import { advanceDynamicSite, generateCrystalBurrow } from "../src/features/play/wilds-dynamic-sites.js";
import {
  admitRaidPlayer,
  applyRaidContribution,
  createWildsRaid,
  WILDS_RAID_FIGHTERS_PER_SQUAD,
  WILDS_RAID_SQUADS
} from "../src/features/play/wilds-raid-core.js";

const pulse = "2026-07-15T12:00:00.000Z";

function raidFixture() {
  const site = advanceDynamicSite(advanceDynamicSite(generateCrystalBurrow({ pulse, ordinal: 1, activeSites: [] }), "tracked"), "emerged");
  const boss = generateCrystalBurrower({ site, pulse, ordinal: 1 });
  return { boss, raid: createWildsRaid({ boss, openedAt: pulse }) };
}

describe("globally shared Wilds raid", () => {
  it("admits exactly six squads of six before using the support field", () => {
    let { raid } = raidFixture();
    const roles: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const admitted = admitRaidPlayer(raid, `player:${index.toString().padStart(2, "0")}`);
      raid = admitted.raid;
      roles.push(admitted.role);
    }

    assert.equal(WILDS_RAID_SQUADS, 6);
    assert.equal(WILDS_RAID_FIGHTERS_PER_SQUAD, 6);
    assert.equal(raid.squads.flat().length, 36);
    assert.deepEqual(raid.squads.map((squad) => squad.length), [6, 6, 6, 6, 6, 6]);
    assert.equal(roles.filter((role) => role === "fighter").length, 36);
    assert.equal(raid.supportPlayerIds.length, 4);
  });

  it("allocates lowest-fill squads stably and deduplicates every participant", () => {
    let { raid } = raidFixture();
    raid = admitRaidPlayer(raid, "player:a", 4).raid;
    const fallback = admitRaidPlayer(raid, "player:b");
    const duplicate = admitRaidPlayer(fallback.raid, "player:a");

    assert.equal(raid.squads[4][0], "player:a");
    assert.equal(fallback.squad, 0);
    assert.deepEqual(duplicate.raid, fallback.raid);
    assert.equal(duplicate.role, "fighter");
    assert.equal(duplicate.squad, 4);
  });

  it("credits bounded fighter and support contributions idempotently", () => {
    let { raid, boss } = raidFixture();
    raid = admitRaidPlayer(raid, "player:fighter").raid;
    for (let index = 0; index < 36; index += 1) raid = admitRaidPlayer(raid, `player:fill:${index}`).raid;
    assert.equal(raid.supportPlayerIds.includes("player:fill:35"), true);

    const fighter = applyRaidContribution({ raid, boss, playerId: "player:fighter", eventId: "event:fighter:1", damage: 9_999, support: 0 });
    const support = applyRaidContribution({ raid: fighter.raid, boss: fighter.boss, playerId: "player:fill:35", eventId: "event:support:1", damage: 9_999, support: 9_999 });
    const replay = applyRaidContribution({ raid: support.raid, boss: support.boss, playerId: "player:fill:35", eventId: "event:support:1", damage: 9_999, support: 9_999 });

    assert.equal(fighter.boss.health, boss.health - 2_500);
    assert.equal(support.boss.health, fighter.boss.health);
    assert.deepEqual(support.raid.contributions["player:fighter"], { damage: 2_500, support: 0, eventIds: ["event:fighter:1"] });
    assert.deepEqual(support.raid.contributions["player:fill:35"], { damage: 0, support: 1_000, eventIds: ["event:support:1"] });
    assert.deepEqual(replay, { raid: support.raid, boss: support.boss, defeated: false });
  });

  it("settles one irreversible global defeat", () => {
    let { raid, boss } = raidFixture();
    raid = admitRaidPlayer(raid, "player:finisher").raid;
    boss = { ...boss, health: 1 };
    const result = applyRaidContribution({ raid, boss, playerId: "player:finisher", eventId: "event:lethal", damage: 1, support: 0, occurredAt: "2026-07-15T12:05:00.000Z" });

    assert.equal(result.defeated, true);
    assert.equal(result.boss.phase, "defeated");
    assert.equal(result.raid.phase, "settled");
    assert.equal(result.raid.winningEventId, "event:lethal");
    assert.throws(() => applyRaidContribution({ raid: result.raid, boss: result.boss, playerId: "player:finisher", eventId: "event:late", damage: 1, support: 0 }), /wilds_raid_settled/);
  });
});
