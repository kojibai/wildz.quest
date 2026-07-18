import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment, type KaiArkName } from "../src/features/play/kai-klok-moment.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga } from "../src/features/play/wilds-saga-director.js";
import { projectSagaTrainers } from "../src/features/play/wilds-saga-trainers.js";
import { projectSagaTournament, recordTournamentResult, settleSagaTournament } from "../src/features/play/wilds-saga-tournament.js";

function instantForArk(ark: KaiArkName) {
  const start = Date.parse("2026-07-16T00:00:00.000Z");
  for (let index = 0; index < 120; index += 1) {
    const occurredAt = new Date(start + index * 30 * 60 * 1_000).toISOString();
    const moment = deriveKaiKlokMoment({ occurredAt, authority: "world" });
    if (moment.ark === ark) return { occurredAt, moment };
  }
  throw new Error(`missing ${ark} fixture`);
}

const purify = instantForArk("Purify");
const dream = instantForArk("Dream");
const saga = projectWildsSaga({ moment: purify.moment, framework: wildsSagaFramework(), memories: [] });
const trainers = projectSagaTrainers({ saga, playerLevel: 7, battleMemories: [] });

describe("Wilds Kai tournaments", () => {
  it("backfills zero and sparse populations to one unique eight-entrant bracket", () => {
    const zero = projectSagaTournament({ saga, moment: purify.moment, qualifiedPlayers: [], trainers, results: [] });
    assert.equal(zero.entrants.length, 8);
    assert.ok(zero.entrants.every((entrant) => entrant.kind === "npc"));
    assert.ok(zero.entrants.every((entrant) => entrant.label.includes("Trainer") && !entrant.label.includes("NPC")));

    const sparse = projectSagaTournament({ saga, moment: purify.moment, qualifiedPlayers: [{ id: "player:ari", seedScore: 42 }], trainers, results: [] });
    assert.equal(sparse.entrants.length, 8);
    assert.equal(sparse.entrants.filter((entrant) => entrant.kind === "player").length, 1);
    assert.equal(new Set(sparse.entrants.map((entrant) => entrant.id)).size, 8);
    assert.equal(sparse.matches.length, 4);
  });

  it("records admitted results once and settles unfinished rounds deterministically in Dream", () => {
    const sparse = projectSagaTournament({ saga, moment: purify.moment, qualifiedPlayers: [{ id: "player:ari", seedScore: 42 }], trainers, results: [] });
    const firstMatch = sparse.matches[0]!;
    const recorded = recordTournamentResult({ tournament: sparse, matchId: firstMatch.id, winnerId: firstMatch.entrantIds[0], settledEventId: "wve:match" });
    assert.deepEqual(recorded, recordTournamentResult({ tournament: recorded, matchId: firstMatch.id, winnerId: firstMatch.entrantIds[0], settledEventId: "wve:match" }));
    assert.throws(() => recordTournamentResult({ tournament: recorded, matchId: firstMatch.id, winnerId: firstMatch.entrantIds[1], settledEventId: "wve:changed" }), /wilds_tournament_result_divergent/);

    const settled = settleSagaTournament({ tournament: recorded, occurredAt: dream.occurredAt });
    assert.equal(settled.phase, "settled");
    assert.ok(settled.championId);
    assert.equal(settled.matches.length, 7);
    assert.deepEqual(settled, settleSagaTournament({ tournament: settled, occurredAt: dream.occurredAt }));
  });
});
