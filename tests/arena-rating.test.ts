import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARENA_RATING_POLICY,
  applyArenaRatingPeriod,
  createArenaRatingProfile,
  projectArenaDivision,
  type ArenaRatingSettlement,
} from "../src/features/play/arena/rating";

function settlement(
  receiptDigest: string,
  opponentRating: number,
  opponentDeviation: number,
  playerScore: 0 | 0.5 | 1,
  settledUPulse = 20_000_000,
): ArenaRatingSettlement {
  return {
    schema: "receiz.wilds.arena_rating_settlement.v1",
    mode: "ranked",
    authority: "global",
    publication: "published",
    publicationRevision: 1,
    receiptDigest: `sha256:${receiptDigest.repeat(64).slice(0, 64)}`,
    definitionDigest: `sha256:${"d".repeat(64)}`,
    rulesetDigest: `sha256:${"e".repeat(64)}`,
    playerId: "player:one",
    opponentId: `player:${receiptDigest}`,
    opponentRating,
    opponentDeviation,
    playerScore,
    settledUPulse,
  };
}

const verifyPublishedSettlement = () => true;

describe("deterministic Arena Glicko-2 rating", () => {
  it("matches the published three-opponent Glicko-2 reference period", () => {
    const profile = createArenaRatingProfile("player:one", {
      rating: 1500,
      deviation: 200,
      volatility: 0.06,
      lastSettledUPulse: 20_000_000,
    });
    const rated = applyArenaRatingPeriod(profile, [
      settlement("a", 1400, 30, 1),
      settlement("b", 1550, 100, 0),
      settlement("c", 1700, 300, 0),
    ], verifyPublishedSettlement);

    assert.equal(rated.rating, 1464.050671);
    assert.equal(rated.deviation, 151.516524);
    assert.equal(rated.volatility, 0.059996);
    assert.deepEqual(rated.settlementDigests, [
      `sha256:${"a".repeat(64)}`,
      `sha256:${"b".repeat(64)}`,
      `sha256:${"c".repeat(64)}`,
    ]);
  });

  it("is idempotent for an already applied receipt and handles a draw", () => {
    const profile = createArenaRatingProfile("player:one", { rating: 1600, deviation: 80, lastSettledUPulse: 10_000_000 });
    const drawn = settlement("f", 1700, 80, 0.5, 20_000_000);
    const once = applyArenaRatingPeriod(profile, [drawn], verifyPublishedSettlement);
    const twice = applyArenaRatingPeriod(once, [drawn], verifyPublishedSettlement);

    assert.ok(once.rating > profile.rating, "a draw against the stronger opponent should improve rating");
    assert.deepEqual(twice, once);
    assert.throws(() => applyArenaRatingPeriod(once, [drawn], () => false), /arena_rating_settlement_unverified/);
    assert.deepEqual(applyArenaRatingPeriod(once, [], verifyPublishedSettlement, once.lastSettledUPulse), once);
  });

  it("is byte-repeatable regardless of verified settlement arrival order", () => {
    const profile = createArenaRatingProfile("player:one", { rating: 1500, deviation: 200, lastSettledUPulse: 20_000_000 });
    const first = settlement("7", 1400, 30, 1);
    const second = settlement("8", 1700, 300, 0);
    assert.deepEqual(
      applyArenaRatingPeriod(profile, [first, second], verifyPublishedSettlement),
      applyArenaRatingPeriod(profile, [second, first], verifyPublishedSettlement),
    );
  });

  it("expands uncertainty during Kai uPulse inactivity without changing rating", () => {
    const profile = createArenaRatingProfile("player:one", { rating: 1800, deviation: 60, volatility: 0.06, lastSettledUPulse: 0 });
    const inactive = applyArenaRatingPeriod(profile, [], verifyPublishedSettlement, 12 * ARENA_RATING_POLICY.periodUPulses);

    assert.equal(inactive.rating, 1800);
    assert.ok(inactive.deviation > 60);
    assert.ok(inactive.deviation <= ARENA_RATING_POLICY.maximumDeviation);
    assert.equal(inactive.lastSettledUPulse, 12 * ARENA_RATING_POLICY.periodUPulses);
  });

  it("retains complete receipt idempotency beyond a short recent window", () => {
    const profile = createArenaRatingProfile("player:one", { rating: 1500, deviation: 100, lastSettledUPulse: 20_000_000 });
    const period = Array.from({ length: 257 }, (_, index) => settlement(
      index.toString(16).padStart(64, "0"),
      1500,
      100,
      index % 2 === 0 ? 1 : 0,
    ));
    const once = applyArenaRatingPeriod(profile, period, verifyPublishedSettlement);
    assert.equal(once.settlementDigests.length, 257);
    assert.deepEqual(applyArenaRatingPeriod(once, [period[0]!], verifyPublishedSettlement), once);
  });

  it("fails closed for unverified, local, stale, malformed, or future settlements", () => {
    const profile = createArenaRatingProfile("player:one", { lastSettledUPulse: 20_000_000 });
    const valid = settlement("1", 1500, 100, 1, 30_000_000);
    assert.throws(() => applyArenaRatingPeriod(profile, [valid], () => false), /arena_rating_settlement_unverified/);
    assert.throws(() => applyArenaRatingPeriod(profile, [{ ...valid, authority: "local" as never }], verifyPublishedSettlement), /arena_rating_settlement_invalid/);
    assert.throws(() => applyArenaRatingPeriod(profile, [{ ...valid, settledUPulse: 19_999_999 }], verifyPublishedSettlement), /arena_rating_settlement_stale/);
    assert.throws(() => applyArenaRatingPeriod(profile, [{ ...valid, opponentDeviation: 999 }], verifyPublishedSettlement), /arena_rating_settlement_invalid/);
    assert.throws(() => applyArenaRatingPeriod(profile, [valid], verifyPublishedSettlement, 29_999_999), /arena_rating_settlement_future/);
  });

  it("projects bounded integer divisions from conservative skill", () => {
    assert.deepEqual(projectArenaDivision({ rating: 1500, deviation: 350 }), { id: "bronze", division: 1, points: 800 });
    assert.deepEqual(projectArenaDivision({ rating: 1800, deviation: 50 }), { id: "platinum", division: 2, points: 1700 });
    assert.deepEqual(projectArenaDivision({ rating: 3000, deviation: 30 }), { id: "legend", division: 1, points: 2940 });
  });
});
