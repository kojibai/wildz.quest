import assert from "node:assert/strict";
import test from "node:test";
import { projectWildsStoryActivity } from "../src/features/play/wilds-story-activity";
import { createWildsWorldEvent } from "../src/features/play/wilds-world-event";

function event(kind: Parameters<typeof createWildsWorldEvent>[0]["kind"], payload: unknown) {
  return createWildsWorldEvent({ kind, payload, actorId: "ari", causeId: "command:story", pulse: "2026-10-06T00:00:00.000Z", kaiKlok: 1, occurredAt: "2026-10-06T00:00:00.000Z", previousEventId: null });
}

test("a recorded harvest tells the real material, quantity and place with its admitted time", () => {
  const source = event("resource.material_harvested", { lot: { kind: "timber", quantity: 1 }, source: { position: { x: -42, y: 0, z: -4 } } });
  const activity = projectWildsStoryActivity(source);
  assert.equal(activity.title, "Gathered timber");
  assert.match(activity.detail, /Gathered 1 timber/);
  assert.match(activity.detail, /X -42 · Z -4/);
  assert.equal(activity.id, source.eventId);
  assert.equal(activity.uPulse, source.uPulse);
  assert.equal(activity.authority, "world");
});

test("work records distinguish a completed shelter from ongoing construction", () => {
  const structure = { blueprint: "trail-shelter", position: { x: 12, y: 0, z: 18 } };
  assert.match(projectWildsStoryActivity(event("construction.site_worked", { structure, site: { ...structure, position: { ...structure.position } } })).detail, /Built a trail shelter/);
  const ongoing = projectWildsStoryActivity(event("construction.site_worked", { site: structure, structure: null }));
  assert.match(ongoing.detail, /Worked on a trail shelter/);
  assert.doesNotMatch(ongoing.detail, /Built/);
});

test("battle records keep the actual trainer, outcome and earned XP", () => {
  const won = projectWildsStoryActivity(event("story.trainer_battle_settled", { trainer: { name: "Reefway Toma" }, outcome: "player_victory", xpAward: 50 }));
  assert.match(won.detail, /Won a battle against Reefway Toma/);
  assert.match(won.detail, /50 XP/);
  const lost = projectWildsStoryActivity(event("story.trainer_battle_settled", { trainer: { name: "Reefway Toma" }, outcome: "trainer_victory", xpAward: 15 }));
  assert.match(lost.detail, /Reefway Toma won/);
  assert.doesNotMatch(lost.detail, /Won a battle against/);
  assert.match(projectWildsStoryActivity(event("story.trainer_battle_settled", { trainer: { name: "Reefway Toma" }, outcome: "fled", xpAward: 0 })).detail, /Retreated from your battle/);
});

test("objective records describe the admitted action without claiming completion", () => {
  const activity = projectWildsStoryActivity(event("story.objective_contributed", { objectiveId: "path:lantern-current:arrive", verb: "discover", amount: 1 }));
  assert.match(activity.detail, /Reach Trade Crossing/);
  assert.match(activity.detail, /discovery/);
  assert.match(activity.detail, /1 contribution/);
  assert.doesNotMatch(activity.detail, /completed|path:lantern/);
});

test("missing historic details stay unknown and never become invented quantities or places", () => {
  const activity = projectWildsStoryActivity(event("resource.material_harvested", {}));
  assert.match(activity.detail, /No additional action detail was recorded/);
  assert.doesNotMatch(activity.detail, /Gathered 1|X |Z /);
});

test("chapter and trainer arrivals describe shared changes without inventing a personal encounter", () => {
  const chapter = projectWildsStoryActivity(event("story.chapter_opened", { chapter: { chapterId: "chapter:lantern-current" } }));
  assert.match(chapter.detail, /The Lantern Current/);
  assert.match(chapter.detail, /Tidal Lanterns/);
  const trainer = projectWildsStoryActivity(event("story.trainer_encountered", { trainer: { name: "Reefway Toma", locationId: "Trade Crossing", challengeLevel: 7 } }));
  assert.match(trainer.detail, /Reefway Toma/);
  assert.match(trainer.detail, /Trade Crossing/);
  assert.match(trainer.detail, /level 7/);
  assert.doesNotMatch(trainer.detail, /You met|You battled/);
});
