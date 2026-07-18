import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment, type KaiArkName } from "../src/features/play/kai-klok-moment.js";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga } from "../src/features/play/wilds-saga-director.js";
import { WildsWorldService } from "../src/features/play/wilds-world-service.js";

function fixtureForArk(ark: KaiArkName, after = Date.parse("2026-07-16T00:00:00.000Z"), differentDayId?: string) {
  for (let index = 0; index < 240; index += 1) {
    const occurredAt = new Date(after + index * 15 * 60 * 1_000).toISOString();
    const moment = deriveKaiKlokMoment({ occurredAt, authority: "world" });
    const dayId = `saga:day:Y${moment.year}:M${moment.month}:D${moment.day}`;
    if (moment.ark === ark && (!differentDayId || dayId !== differentDayId)) return { occurredAt, moment, dayId };
  }
  throw new Error(`missing ${ark} fixture`);
}

describe("authoritative Kai saga lifecycle", () => {
  it("opens once, admits play, opens Purify, and settles before the next day", () => {
    const ignite = fixtureForArk("Ignite");
    const service = new WildsWorldService();
    const opened = service.tick({ pulse: ignite.occurredAt, occurredAt: ignite.occurredAt, systemActorId: "receiz:pulse" });
    assert.equal(opened.events.filter((event) => event.kind === "story.chapter_opened").length, 1);
    assert.equal(service.tick({ pulse: ignite.occurredAt, occurredAt: ignite.occurredAt, systemActorId: "receiz:pulse" }).events.length, 0);

    const chapter = service.snapshot().story.activeChapter!;
    const saga = projectWildsSaga({ moment: ignite.moment, framework: wildsSagaFramework(), memories: [] });
    const objective = saga.chapter.missions.find((mission) => mission.primary)!.nodes[0]!;
    const contributionAt = new Date(Date.parse(ignite.occurredAt) + 60_000).toISOString();
    const contribution = service.execute({ type: "story.contribute", dayId: chapter.dayId, objectiveId: objective.id, verb: objective.acceptedVerbs[0]!, amount: 1, commandId: "command:story:travel" }, { actorId: "player:ari", canonical: true, pulse: contributionAt, occurredAt: contributionAt });
    assert.equal(contribution.events[0]?.kind, "story.objective_contributed");
    assert.equal(contribution.projection.players["player:ari"]?.trainerXp, 1);
    assert.throws(() => service.execute({ type: "story.contribute", dayId: chapter.dayId, objectiveId: objective.id, verb: objective.acceptedVerbs[0]!, amount: 1, commandId: "command:story:local" }, { actorId: "player:ari", canonical: false, pulse: contributionAt, occurredAt: contributionAt }), /wilds_world_canonical_authority_required/);

    const trainerId = Object.keys(service.snapshot().trainers)[0]!;
    const battleAt = new Date(Date.parse(contributionAt) + 60_000).toISOString();
    const card = sealCollectedCard({ capturedAt: battleAt, encounterId: "saga-trainer-card", formId: "mintcub-1", ownerReceizId: "player:ari" });
    const battle = service.execute({ type: "story.trainer_battle", dayId: chapter.dayId, trainerId, matchId: "match:saga:one", outcome: "player_victory", cardProofDigest: card.proof.digest, commandId: "command:story:battle" }, { actorId: "player:ari", canonical: true, card, pulse: battleAt, occurredAt: battleAt });
    assert.equal(battle.events[0]?.kind, "story.trainer_battle_settled");

    const purify = fixtureForArk("Purify", Date.parse(battleAt));
    const tournamentTick = service.tick({ pulse: purify.occurredAt, occurredAt: purify.occurredAt, systemActorId: "receiz:pulse" });
    assert.ok(tournamentTick.events.some((event) => event.kind === "story.tournament_opened"));
    assert.equal(Object.values(service.snapshot().tournaments)[0]?.phase, "open");

    const nextDay = fixtureForArk("Ignite", Date.parse(purify.occurredAt) + 60_000, chapter.dayId);
    const rollover = service.tick({ pulse: nextDay.occurredAt, occurredAt: nextDay.occurredAt, systemActorId: "receiz:pulse" });
    assert.ok(rollover.events.some((event) => event.kind === "story.chapter_settled"));
    assert.equal(service.snapshot().story.memories[0]?.outcome, "failure");
    assert.equal(service.snapshot().story.activeChapter?.dayId, nextDay.dayId);
    assert.equal(Object.values(service.snapshot().tournaments)[0]?.phase, "settled");
  });
});
