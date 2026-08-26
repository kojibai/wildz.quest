import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { projectCreatureBrain } from "../src/features/play/creature-consciousness";
import { projectCreatureCare } from "../src/features/play/creature-care";
import {
  CREATURE_CONTINUITY_FIRST_EXPERIENCE_MS,
  creatureContinuityProjection,
  nextCreatureContinuityDueAt
} from "../src/features/play/creature-continuity";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { currentCreatureHistoryProjection } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { verifyAnyWildsCard } from "../src/features/play/portable-card";

function timeline() {
  const state = structuredClone(initialPlayState);
  const asset = state.inventory[0]!;
  const ownerReceizId = asset.manifest.ownerReceizId;
  const start = new Date(Date.parse(asset.proof.sealedAt) + 1_000).toISOString();
  const due = new Date(Date.parse(start) + 3_600_000 + 3 * 60_000).toISOString();
  const active = applyWildsInput(state, { type: "activate-creature-continuity", assetId: asset.id, ownerReceizId, at: start });
  const settled = applyWildsInput(active, { type: "settle-creature-continuity", assetId: asset.id, ownerReceizId, at: due });
  return { active, assetId: asset.id, ownerReceizId, settled, start, due };
}

test("an owner-bound mandate deterministically settles replayable creature life", () => {
  const first = timeline();
  const second = timeline();
  const card = first.settled.inventory.find((asset) => asset.id === first.assetId)!;
  const replayed = second.settled.inventory.find((asset) => asset.id === second.assetId)!;
  const continuity = creatureContinuityProjection(card)!;
  const replayedContinuity = creatureContinuityProjection(replayed)!;

  assert.equal(verifyAnyWildsCard(card).ok, true);
  assert.equal(continuity.mandate?.status, "active");
  assert.equal(continuity.mandate?.ownerReceizId, first.ownerReceizId);
  assert.equal(continuity.mandate?.maxActionsPerDay, 24);
  assert.equal(continuity.events.length, 3);
  assert.equal(continuity.events[1]?.digest, replayedContinuity.events[1]?.digest);
  assert.equal(continuity.headDigest, continuity.events.at(-1)?.digest);
  assert.match(continuity.events[0]?.summary ?? "", /awakened to life while away/i);
  assert.match(continuity.events[1]?.summary ?? "", new RegExp(card.manifest.name));
  assert.equal(continuity.events[1]?.kind, "meet");
  assert.ok(continuity.relationships.length >= 1);
  assert.equal(projectCreatureBrain(card).memory.continuity?.livedEvents.at(-1)?.digest, continuity.headDigest);
});

test("the first real roaming experience is sealed immediately and schedules the next bounded experience", () => {
  const state = structuredClone(initialPlayState);
  const asset = state.inventory[0]!;
  const ownerReceizId = asset.manifest.ownerReceizId;
  const start = new Date(Date.parse(asset.proof.sealedAt) + 1_000).toISOString();
  const active = applyWildsInput(state, { type: "activate-creature-continuity", assetId: asset.id, ownerReceizId, at: start });
  const projection = creatureContinuityProjection(active.inventory.find((candidate) => candidate.id === asset.id)!)!;
  assert.equal(projection.events.filter((event) => ["explore", "meet", "bond", "discover", "barter-keepsake"].includes(event.kind)).length, 1);
  assert.equal(projection.events.at(-1)?.kind, "meet");
  assert.equal(nextCreatureContinuityDueAt(active.inventory.find((candidate) => candidate.id === asset.id)!), Date.parse(start) + 3_600_000);
  const tooSoon = new Date(Date.parse(start) + CREATURE_CONTINUITY_FIRST_EXPERIENCE_MS - 1).toISOString();
  const due = new Date(Date.parse(start) + 3_600_000).toISOString();
  const unchanged = applyWildsInput(active, { type: "settle-creature-continuity", assetId: asset.id, ownerReceizId, at: tooSoon });
  const settled = applyWildsInput(active, { type: "settle-creature-continuity", assetId: asset.id, ownerReceizId, at: due });
  const before = active.inventory.find((candidate) => candidate.id === asset.id)!;
  const after = settled.inventory.find((candidate) => candidate.id === asset.id)!;

  assert.equal(unchanged.inventory.find((candidate) => candidate.id === asset.id)?.proof.digest, before.proof.digest);
  assert.notEqual(after.proof.digest, before.proof.digest);
  assert.ok(["explore", "meet", "bond", "discover", "barter-keepsake"].includes(creatureContinuityProjection(after)?.events.at(-1)?.kind ?? ""));
});

test("continuity denials are zero-write and a pause preserves all lived memory", () => {
  const { active, assetId, ownerReceizId, settled, due } = timeline();
  const beforeMismatch = active.inventory.find((asset) => asset.id === assetId)!;
  const denied = applyWildsInput(active, {
    type: "settle-creature-continuity",
    assetId,
    ownerReceizId: "receiz:different-owner",
    at: due
  });
  assert.equal(denied.inventory.find((asset) => asset.id === assetId)?.proof.digest, beforeMismatch.proof.digest);

  const pausedAt = new Date(Date.parse(due) + 1_000).toISOString();
  const paused = applyWildsInput(settled, { type: "pause-creature-continuity", assetId, ownerReceizId, at: pausedAt });
  const pausedCard = paused.inventory.find((asset) => asset.id === assetId)!;
  const beforeEvents = creatureContinuityProjection(pausedCard)!.events;
  const muchLater = new Date(Date.parse(pausedAt) + 48 * 3_600_000).toISOString();
  const noMutation = applyWildsInput(paused, { type: "settle-creature-continuity", assetId, ownerReceizId, at: muchLater });
  const finalCard = noMutation.inventory.find((asset) => asset.id === assetId)!;
  assert.equal(finalCard.proof.digest, pausedCard.proof.digest);
  assert.deepEqual(creatureContinuityProjection(finalCard)!.events, beforeEvents);
  assert.equal(creatureContinuityProjection(finalCard)!.mandate?.status, "paused");
});

test("continuity events are chained and tamper evident inside the exact card", () => {
  const { settled, assetId } = timeline();
  const card = settled.inventory.find((asset) => asset.id === assetId)!;
  assert.equal(isLivingCardAsset(card), true);
  if (!isLivingCardAsset(card)) return;
  const tampered = structuredClone(card);
  const event = currentCreatureHistoryProjection(tampered).continuity?.events[0];
  assert.ok(event);
  (event as { summary: string }).summary = "An invented event that never happened.";
  assert.equal(verifyAnyWildsCard(tampered).ok, false);
});

test("settling the same due command twice is idempotent", () => {
  const { settled, assetId, ownerReceizId, due } = timeline();
  const once = settled.inventory.find((asset) => asset.id === assetId)!;
  const twiceState = applyWildsInput(settled, { type: "settle-creature-continuity", assetId, ownerReceizId, at: due });
  const twice = twiceState.inventory.find((asset) => asset.id === assetId)!;
  assert.equal(twice.proof.digest, once.proof.digest);
});

test("suspending the app settles due roaming life without blocking visible gameplay", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.doesNotMatch(campaign, /window\.addEventListener\("focus", settleLivingCreatures\)/);
  assert.match(campaign, /document\.addEventListener\("visibilitychange", settleWhenHidden\)/);
  assert.match(campaign, /nextCreatureContinuityDueAt/);
  assert.match(campaign, /window\.setTimeout\(settleLivingCreatures/);
  assert.doesNotMatch(campaign, /setInterval\(settleLivingCreatures/);
  assert.match(campaign, /shouldRunWildzOffHotPathWork\(\{ visibility: document\.visibilityState, surface: "gameplay" \}\)/);
  assert.match(campaign, /type: "settle-creature-care"/);
});

test("an active roaming mandate has visible embodied movement in the world", () => {
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  assert.match(world, /creatureContinuityProjection\(asset\)/);
  assert.match(world, /const roaming =/);
  assert.match(world, /roamingRadius/);
  assert.match(world, /clock\.elapsedTime/);
});

test("active creatures develop deterministic real-time needs and earned care restores them", () => {
  const state = structuredClone(initialPlayState);
  const asset = state.inventory[0]!;
  const ownerReceizId = asset.manifest.ownerReceizId;
  const start = new Date(Date.parse(asset.proof.sealedAt) + 1_000).toISOString();
  const active = applyWildsInput(state, { type: "activate-creature-continuity", assetId: asset.id, ownerReceizId, at: start });
  const hungryAt = new Date(Date.parse(start) + 30 * 3_600_000).toISOString();
  const hungryCard = active.inventory.find((candidate) => candidate.id === asset.id)!;
  const hungry = projectCreatureCare(hungryCard, hungryAt);
  assert.equal(hungry.active, true);
  assert.equal(hungry.hunger, 40);
  assert.equal(hungry.attention, 70);

  const fed = applyWildsInput(active, { type: "care-for-creature", assetId: asset.id, ownerReceizId, action: "feed", at: hungryAt });
  const fedCard = fed.inventory.find((candidate) => candidate.id === asset.id)!;
  assert.equal(fed.beans, active.beans - 3);
  assert.equal(projectCreatureCare(fedCard, hungryAt).hunger, 88);
  assert.equal(verifyAnyWildsCard(fedCard).ok, true);
});

test("care never spends resources or mutates proof when the player lacks supplies", () => {
  const state = { ...structuredClone(initialPlayState), beans: 0 };
  const asset = state.inventory[0]!;
  const ownerReceizId = asset.manifest.ownerReceizId;
  const start = new Date(Date.parse(asset.proof.sealedAt) + 1_000).toISOString();
  const active = applyWildsInput(state, { type: "activate-creature-continuity", assetId: asset.id, ownerReceizId, at: start });
  const before = active.inventory.find((candidate) => candidate.id === asset.id)!;
  const denied = applyWildsInput(active, { type: "care-for-creature", assetId: asset.id, ownerReceizId, action: "treat", at: start });
  const after = denied.inventory.find((candidate) => candidate.id === asset.id)!;
  assert.equal(after.proof.digest, before.proof.digest);
  assert.equal(denied.beans, 0);
  assert.match(denied.lastEvent, /Play the world to earn 8 more trail beans/);
});

test("care immediately after activation uses a later click time and appends once", () => {
  const state = structuredClone(initialPlayState);
  const asset = state.inventory[0]!;
  const ownerReceizId = asset.manifest.ownerReceizId;
  const startMs = Date.parse(asset.proof.sealedAt) + 1_000;
  const active = applyWildsInput(state, {
    type: "activate-creature-continuity",
    assetId: asset.id,
    ownerReceizId,
    at: new Date(startMs).toISOString()
  });
  const cared = applyWildsInput(active, {
    type: "care-for-creature",
    assetId: asset.id,
    ownerReceizId,
    action: "feed",
    at: new Date(startMs + 1).toISOString()
  });
  assert.equal(cared.beans, active.beans - 3);
  assert.equal(creatureContinuityProjection(cared.inventory[0]!)?.events.at(-1)?.kind, "feed");
});

test("an explicitly active care mandate can settle irreversible neglect at zero wellness", () => {
  const state = structuredClone(initialPlayState);
  const asset = state.inventory[0]!;
  const ownerReceizId = asset.manifest.ownerReceizId;
  const start = new Date(Date.parse(asset.proof.sealedAt) + 1_000).toISOString();
  const active = applyWildsInput(state, { type: "activate-creature-continuity", assetId: asset.id, ownerReceizId, at: start });
  const fatalAt = new Date(Date.parse(start) + 120 * 3_600_000).toISOString();
  const before = active.inventory.find((candidate) => candidate.id === asset.id)!;
  assert.equal(projectCreatureCare(before, fatalAt).status, "dead");
  const settled = applyWildsInput(active, { type: "settle-creature-care", assetId: asset.id, ownerReceizId, at: fatalAt });
  const after = settled.inventory.find((candidate) => candidate.id === asset.id)!;
  assert.equal(isLivingCardAsset(after), true);
  if (!isLivingCardAsset(after)) return;
  assert.equal(currentCreatureHistoryProjection(after).condition.life, "dead");
  assert.equal(creatureContinuityProjection(after)?.events.at(-1)?.kind, "neglect");
  assert.equal(verifyAnyWildsCard(after).ok, true);
});
