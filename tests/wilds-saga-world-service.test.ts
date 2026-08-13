import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment, type KaiArkName } from "../src/features/play/kai-klok-moment.js";
import { createKaiTemporalRoot } from "../src/features/play/kai-temporal-root.js";
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
  it("derives and opens the active chapter from command uPulse without a scheduler tick", () => {
    const ignite = fixtureForArk("Ignite");
    const saga = projectWildsSaga({ moment: ignite.moment, framework: wildsSagaFramework(), memories: [] });
    const objective = saga.chapter.missions.find((mission) => mission.primary)!.nodes[0]!;
    const service = new WildsWorldService();
    const kai = createKaiTemporalRoot(ignite.moment);

    const result = service.execute({
      type: "story.contribute",
      dayId: saga.dayId,
      objectiveId: objective.id,
      verb: objective.acceptedVerbs[0]!,
      amount: 1,
      commandId: "command:story:no-tick",
      kai
    }, {
      actorId: "player:ari",
      canonical: true,
      pulse: "2026-07-15T00:00:00.000Z",
      occurredAt: "2026-07-15T00:00:00.000Z"
    });

    assert.equal(result.projection.story.activeChapter?.dayId, saga.dayId);
    assert.ok(result.events.some((event) => event.kind === "story.chapter_opened"));
    assert.equal(result.events.at(-1)?.kind, "story.objective_contributed");
    assert.equal(result.projection.players["player:ari"]?.trainerXp, 1);
  });

  it("rejects a day that disagrees with the command uPulse rather than a stale chapter cache", () => {
    const ignite = fixtureForArk("Ignite");
    const saga = projectWildsSaga({ moment: ignite.moment, framework: wildsSagaFramework(), memories: [] });
    const objective = saga.chapter.missions.find((mission) => mission.primary)!.nodes[0]!;
    const service = new WildsWorldService();

    assert.throws(() => service.execute({
      type: "story.contribute",
      dayId: "saga:day:Y999:M1:D1",
      objectiveId: objective.id,
      verb: objective.acceptedVerbs[0]!,
      amount: 1,
      commandId: "command:story:wrong-day",
      kai: createKaiTemporalRoot(ignite.moment)
    }, {
      actorId: "player:ari",
      canonical: true,
      pulse: ignite.occurredAt,
      occurredAt: ignite.occurredAt
    }), /wilds_story_chapter_mismatch/);
    assert.equal(service.snapshot().revision, 0);
  });

  it("produces the same chapter events when descriptive ISO metadata changes", () => {
    const ignite = fixtureForArk("Ignite");
    const saga = projectWildsSaga({ moment: ignite.moment, framework: wildsSagaFramework(), memories: [] });
    const objective = saga.chapter.missions.find((mission) => mission.primary)!.nodes[0]!;
    const command = {
      type: "story.contribute" as const,
      dayId: saga.dayId,
      objectiveId: objective.id,
      verb: objective.acceptedVerbs[0]!,
      amount: 1,
      commandId: "command:story:iso-independent",
      kai: createKaiTemporalRoot(ignite.moment)
    };
    const executeAt = (occurredAt: string) => new WildsWorldService().execute(command, {
      actorId: "player:ari",
      canonical: true,
      pulse: occurredAt,
      occurredAt
    });

    assert.deepEqual(
      executeAt("2020-01-01T00:00:00.000Z").events,
      executeAt("2030-01-01T00:00:00.000Z").events
    );
  });

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
    assert.equal(battle.projection.players["player:ari"]?.trainerXp, 51);

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
