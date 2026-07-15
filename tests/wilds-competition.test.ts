import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWildsSeason,
  initialWildsCompetition,
  publicWildsRecords,
  recordWildsCompetitionEvent,
  type WildsCompetition
} from "../src/features/play/wilds-competition.js";

const startsAt = "2026-08-01T00:00:00.000Z";
const endsAt = "2026-09-01T00:00:00.000Z";

describe("Slice 5 competition and public records", () => {
  it("creates a deterministic season and rejects invalid windows", () => {
    const season = createWildsSeason({ name: "Aurora Cup", startsAt, endsAt });
    assert.deepEqual(createWildsSeason({ name: " Aurora Cup ", startsAt, endsAt }), season);
    assert.match(season.id, /^season:[a-f0-9]{24}$/);
    assert.throws(() => createWildsSeason({ name: "x", startsAt, endsAt }), /wilds_season_name_invalid/);
    assert.throws(() => createWildsSeason({ name: "Cup", startsAt: endsAt, endsAt: startsAt }), /wilds_season_window_invalid/);
  });

  it("scores canonical events once with newcomer protection and monopoly caps", () => {
    const season = createWildsSeason({ name: "Aurora Cup", startsAt, endsAt });
    let state: WildsCompetition = initialWildsCompetition(season);
    state = recordWildsCompetitionEvent({ state, season, participantId: "team:veteran", eventId: "raid:1", contribution: 100_000, isNewcomer: false });
    assert.equal(state.scores["team:veteran"], 1_000);
    const replay = recordWildsCompetitionEvent({ state, season, participantId: "team:veteran", eventId: "raid:1", contribution: 100_000, isNewcomer: false });
    assert.deepEqual(replay, state);
    state = recordWildsCompetitionEvent({ state, season, participantId: "team:new", eventId: "raid:2", contribution: 100, isNewcomer: true });
    assert.equal(state.scores["team:new"], 2);
    assert.equal(state.standings[0]?.participantId, "team:veteran");
  });

  it("exposes a stable, sanitized public record", () => {
    const season = createWildsSeason({ name: "Aurora Cup", startsAt, endsAt });
    let state = initialWildsCompetition(season);
    state = recordWildsCompetitionEvent({ state, season, participantId: "player:one", eventId: "e:1", contribution: 500, isNewcomer: true });
    const records = publicWildsRecords(state);
    assert.deepEqual(records, [{ participantId: "player:one", score: 10, rank: 1, events: 1 }]);
    assert.equal(Object.prototype.hasOwnProperty.call(records[0], "scoredEventIds"), false);
  });
});
