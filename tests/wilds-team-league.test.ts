import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWildsTeam,
  initialWildsLeague,
  joinWildsTeam,
  scoreWildsLeague
} from "../src/features/play/wilds-team-league.js";

const occurredAt = "2026-07-15T12:00:00.000Z";

describe("Wilds teams and Genesis League", () => {
  it("creates one sanitized stable team and rejects duplicate names", () => {
    const team = createWildsTeam({ captainId: "player:captain", name: "  Prism   Keepers!! ", occurredAt });
    const replay = createWildsTeam({ captainId: "player:captain", name: "Prism Keepers", occurredAt });

    assert.deepEqual(replay, team);
    assert.equal(team.name, "Prism Keepers");
    assert.deepEqual(team.memberIds, ["player:captain"]);
    assert.match(team.id, /^team:[a-f0-9]{24}$/);
    assert.throws(
      () => createWildsTeam({ captainId: "player:other", name: "prism keepers", occurredAt, existingTeams: [team] }),
      /wilds_team_name_exists/
    );
  });

  it("admits each player once and caps teams at twenty-four", () => {
    let team = createWildsTeam({ captainId: "player:0", name: "Heartbound", occurredAt });
    for (let index = 1; index < 24; index += 1) team = joinWildsTeam(team, `player:${index}`);

    assert.equal(team.memberIds.length, 24);
    assert.throws(() => joinWildsTeam(team, "player:24"), /wilds_team_full/);
    assert.throws(() => joinWildsTeam(team, "player:4"), /wilds_team_member_exists/);
  });

  it("scores canonical raid facts once and ranks ties stably", () => {
    let league = initialWildsLeague();
    league = scoreWildsLeague({ league, teamId: "team:b", eventId: "event:b:1", raidContribution: 2_500 });
    league = scoreWildsLeague({ league, teamId: "team:a", eventId: "event:a:1", raidContribution: 2_500 });
    const replay = scoreWildsLeague({ league, teamId: "team:a", eventId: "event:a:1", raidContribution: 2_500 });

    assert.equal(league.scores["team:a"], 25);
    assert.deepEqual(league.standings, [
      { teamId: "team:a", score: 25, rank: 1 },
      { teamId: "team:b", score: 25, rank: 1 }
    ]);
    assert.deepEqual(replay, league);
  });

  it("bounds league points from malformed or extreme contributions", () => {
    assert.throws(() => scoreWildsLeague({ league: initialWildsLeague(), teamId: "team:a", eventId: "event:a", raidContribution: -1 }), /wilds_league_contribution_invalid/);
    const league = scoreWildsLeague({ league: initialWildsLeague(), teamId: "team:a", eventId: "event:max", raidContribution: 9_000_000 });
    assert.equal(league.scores["team:a"], 1_000);
  });
});
