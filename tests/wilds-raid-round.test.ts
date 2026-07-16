import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateWildsBoss } from "../src/features/play/wilds-boss-ecology.js";
import { advanceDynamicSite, generateCrystalBurrow } from "../src/features/play/wilds-dynamic-sites.js";
import {
  admitWildsRaidParticipant,
  createWildsRaidRound,
  renewWildsRaidLease,
  retreatWildsRaidParticipant,
  rotateExpiredWildsRaidSlots,
  settleWildsRaidRound
} from "../src/features/play/wilds-raid-round.js";

const openedAt = "2026-07-15T12:00:00.000Z";
const site = advanceDynamicSite(advanceDynamicSite(generateCrystalBurrow({ pulse: openedAt, ordinal: 1, activeSites: [] }), "tracked"), "emerged");
const boss = generateWildsBoss({ familyId: "crystal-burrower", site, pulse: openedAt, ordinal: 1, existingBosses: [] });

function fillRound() {
  let round = createWildsRaidRound({ boss, ordinal: 1, openedAt });
  for (let index = 0; index < 180; index += 1) {
    round = admitWildsRaidParticipant(round, {
      playerId: `player:${index.toString().padStart(3, "0")}`,
      occurredAt: openedAt,
      eventOrdinal: index + 1
    }).round;
  }
  return round;
}

describe("bounded global raid rounds", () => {
  it("admits 36 fighters, 144 support participants, and rejects overflow", () => {
    const filled = fillRound();
    assert.equal(filled.squads.flat().length, 36);
    assert.equal(filled.supportPlayerIds.length, 144);
    assert.throws(() => admitWildsRaidParticipant(filled, {
      playerId: "player:overflow",
      occurredAt: openedAt,
      eventOrdinal: 181
    }), /wilds_raid_capacity_full/);
  });

  it("preserves a fighter for 90 seconds then rotates the oldest support request", () => {
    const filled = fillRound();
    const fighterId = "player:000";
    const waitingSupportId = "player:036";
    const disconnectedAt = "2026-07-15T12:01:00.000Z";
    const disconnected = renewWildsRaidLease(filled, { playerId: fighterId, status: "disconnected", occurredAt: disconnectedAt });

    assert.deepEqual(rotateExpiredWildsRaidSlots(disconnected, "2026-07-15T12:02:29.000Z"), disconnected);
    const rotated = rotateExpiredWildsRaidSlots(disconnected, "2026-07-15T12:02:31.000Z");
    assert.equal(rotated.squads.flat().includes(fighterId), false);
    assert.equal(rotated.squads.flat().includes(waitingSupportId), true);
    assert.equal(rotated.supportPlayerIds.includes(waitingSupportId), false);
  });

  it("makes duplicate admission, retreat, rotation, and settlement idempotent", () => {
    let round = createWildsRaidRound({ boss, ordinal: 2, openedAt });
    const admitted = admitWildsRaidParticipant(round, { playerId: "player:stable", occurredAt: openedAt, eventOrdinal: 1 });
    round = admitted.round;
    assert.deepEqual(admitWildsRaidParticipant(round, { playerId: "player:stable", occurredAt: openedAt, eventOrdinal: 2 }).round, round);
    const retreated = retreatWildsRaidParticipant(round, { playerId: "player:stable", occurredAt: "2026-07-15T12:01:00.000Z" });
    assert.deepEqual(retreatWildsRaidParticipant(retreated, { playerId: "player:stable", occurredAt: "2026-07-15T12:01:01.000Z" }), retreated);
    const settled = settleWildsRaidRound(retreated, { occurredAt: "2026-07-15T12:10:00.000Z", winningEventId: null });
    assert.deepEqual(settleWildsRaidRound(settled, { occurredAt: "2026-07-15T12:10:01.000Z", winningEventId: null }), settled);
  });
});
