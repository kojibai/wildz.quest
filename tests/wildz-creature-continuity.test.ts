import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { projectCreatureBrain } from "../src/features/play/creature-consciousness";
import {
  CREATURE_CONTINUITY_FIRST_EXPERIENCE_MS,
  creatureContinuityProjection
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
  const due = new Date(Date.parse(start) + CREATURE_CONTINUITY_FIRST_EXPERIENCE_MS + 3 * 60_000).toISOString();
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
  assert.equal(continuity.events.length, 2);
  assert.equal(continuity.events[1]?.digest, replayedContinuity.events[1]?.digest);
  assert.equal(continuity.headDigest, continuity.events.at(-1)?.digest);
  assert.match(continuity.events[0]?.summary ?? "", /awakened to life while away/i);
  assert.match(continuity.events[1]?.summary ?? "", new RegExp(card.manifest.name));
  assert.equal(continuity.events[1]?.kind, "meet");
  assert.equal(continuity.relationships.length, 1);
  assert.equal(projectCreatureBrain(card).memory.continuity?.livedEvents.at(-1)?.digest, continuity.headDigest);
});

test("the first real roaming experience arrives in minutes without exceeding its mandate", () => {
  const state = structuredClone(initialPlayState);
  const asset = state.inventory[0]!;
  const ownerReceizId = asset.manifest.ownerReceizId;
  const start = new Date(Date.parse(asset.proof.sealedAt) + 1_000).toISOString();
  const active = applyWildsInput(state, { type: "activate-creature-continuity", assetId: asset.id, ownerReceizId, at: start });
  const tooSoon = new Date(Date.parse(start) + CREATURE_CONTINUITY_FIRST_EXPERIENCE_MS - 1).toISOString();
  const due = new Date(Date.parse(start) + 5 * 60_000).toISOString();
  const unchanged = applyWildsInput(active, { type: "settle-creature-continuity", assetId: asset.id, ownerReceizId, at: tooSoon });
  const settled = applyWildsInput(active, { type: "settle-creature-continuity", assetId: asset.id, ownerReceizId, at: due });
  const before = active.inventory.find((candidate) => candidate.id === asset.id)!;
  const after = settled.inventory.find((candidate) => candidate.id === asset.id)!;

  assert.equal(unchanged.inventory.find((candidate) => candidate.id === asset.id)?.proof.digest, before.proof.digest);
  assert.notEqual(after.proof.digest, before.proof.digest);
  assert.equal(creatureContinuityProjection(after)?.events.at(-1)?.kind, "meet");
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

test("returning to a suspended app immediately settles due roaming life", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(campaign, /window\.addEventListener\("focus", settleLivingCreatures\)/);
  assert.match(campaign, /document\.addEventListener\("visibilitychange", settleWhenVisible\)/);
});
