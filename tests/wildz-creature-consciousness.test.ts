import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createObservedCreatureTurn,
  creatureConsciousnessMotion,
  creatureObserverClientContext,
  creatureVoiceProfile,
  localCreatureTwinReply,
  normalizeCreatureTwinReply,
  parseCreatureObserverRequest,
  projectCreatureBrain
} from "../src/features/play/creature-consciousness";
import { admitLegacyCard, appendLivingCardHistory, currentCreatureHistoryProjection } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import {
  applyWildsInput,
  createOwnerBoundInitialPlayState,
  initialPlayState,
  restorePlayState,
  serializePlayState
} from "../src/features/play/game-state";
import { verifyAnyWildsCard } from "../src/features/play/portable-card";

test("a Receiz Twin observation appends to the exact portable card brain", () => {
  const original = initialPlayState.inventory[0]!;
  const brain = projectCreatureBrain(original);
  const observedAt = new Date(Math.max(Date.parse(original.proof.sealedAt), Date.parse(original.manifest.capturedAt)) + 1_000).toISOString();
  const turn = createObservedCreatureTurn({
    brain,
    ownerActorId: original.manifest.ownerReceizId,
    message: "What do you remember about us?",
    reply: `I remember the exact proof moment when you found me in ${brain.personality.habitat}.`,
    observedAt,
    clientUserMessageId: "creature-message:test-1"
  });
  const next = applyWildsInput(structuredClone(initialPlayState), { type: "record-creature-observation", turn });
  const remembered = next.inventory.find((asset) => asset.id === original.id)!;

  assert.equal(isLivingCardAsset(remembered), true);
  assert.equal(verifyAnyWildsCard(remembered).ok, true);
  if (!isLivingCardAsset(remembered)) return;
  const memory = currentCreatureHistoryProjection(remembered).observerMemory;
  assert.equal(memory?.turns.length, 1);
  assert.equal(memory?.headDigest, turn.digest);
  assert.equal(memory?.turns[0]?.creatureText, turn.creatureText);
  assert.equal(next.pendingSyncAssetIds.includes(remembered.id), true);

  const restored = restorePlayState(serializePlayState(next), original.manifest.ownerReceizId);
  const restoredCard = restored.inventory.find((asset) => asset.id === original.id)!;
  assert.equal(verifyAnyWildsCard(restoredCard).ok, true);
  assert.equal(isLivingCardAsset(restoredCard) && currentCreatureHistoryProjection(restoredCard).observerMemory?.headDigest, turn.digest);
});

test("creature observer memory is chained and tamper evident", () => {
  const original = initialPlayState.inventory[0]!;
  const firstBrain = projectCreatureBrain(original);
  const first = createObservedCreatureTurn({
    brain: firstBrain,
    ownerActorId: original.manifest.ownerReceizId,
    message: "How are you feeling?",
    reply: "My guard is steady, and my bond makes my aura feel bright.",
    observedAt: new Date(Date.parse(original.proof.sealedAt) + 1_000).toISOString()
  });
  const once = applyWildsInput(structuredClone(initialPlayState), { type: "record-creature-observation", turn: first });
  const living = once.inventory.find((asset) => asset.id === original.id)!;
  const secondBrain = projectCreatureBrain(living);
  const second = createObservedCreatureTurn({
    brain: secondBrain,
    ownerActorId: original.manifest.ownerReceizId,
    message: "What should we explore next?",
    reply: "Let us choose a path that fits my speed and gives us room to build trust.",
    observedAt: new Date(Date.parse(first.observedAt) + 1_000).toISOString()
  });
  const twice = applyWildsInput(once, { type: "record-creature-observation", turn: second });
  const twiceCard = twice.inventory.find((asset) => asset.id === original.id)!;
  assert.equal(verifyAnyWildsCard(twiceCard).ok, true);
  assert.equal(second.previousTurnDigest, first.digest);
  assert.equal(isLivingCardAsset(twiceCard) && currentCreatureHistoryProjection(twiceCard).observerMemory?.turns.length, 2);

  const tampered = structuredClone(twiceCard);
  if (!isLivingCardAsset(tampered) || !tampered.manifest.history?.projection.observerMemory) return;
  (tampered.manifest.history.projection.observerMemory.turns[1] as { creatureText: string }).creatureText = "Rewritten by UI state";
  assert.equal(verifyAnyWildsCard(tampered).ok, false);
});

test("the creature brain gives the Twin exact proof context and model boundaries", () => {
  const asset = initialPlayState.inventory[0]!;
  const brain = projectCreatureBrain(asset);
  const context = creatureObserverClientContext(brain);

  assert.equal(brain.identity.assetId, asset.id);
  assert.equal(brain.identity.proofDigest, asset.proof.digest);
  assert.deepEqual(brain.embodiment.stats, asset.manifest.stats);
  assert.equal(brain.authority.observer, "receiz-twin");
  assert.equal(brain.authority.modelMayRewriteProof, false);
  assert.equal(brain.memory.capture.occurredAt, asset.manifest.capturedAt);
  assert.equal(brain.memory.capture.encounterId, asset.manifest.encounterId);
  assert.equal(brain.memory.capture.proofDigest, asset.proof.digest);
  if (isLivingCardAsset(asset) && asset.manifest.history) {
    assert.equal(brain.memory.eventLedger.length, asset.manifest.history.events.length);
    assert.deepEqual(
      brain.memory.eventLedger.map((event) => ({
        eventId: event.eventId,
        source: event.source,
        evidence: event.evidence,
        effects: event.effects,
        digest: event.digest
      })),
      asset.manifest.history.events.map((event) => ({
        eventId: event.eventId,
        source: event.source,
        evidence: event.evidence,
        effects: event.effects,
        digest: event.digest
      }))
    );
  }
  assert.equal(context.creatureBrain.contextDigest, brain.contextDigest);
  assert.match(context.instruction, /never invent a canonical event/i);
  assert.equal(parseCreatureObserverRequest({ card: asset, message: "  Hello   there  " }).message, "Hello there");
  assert.throws(() => parseCreatureObserverRequest({ card: asset, message: "" }), /creature_observer_request_invalid/);
  assert.equal(normalizeCreatureTwinReply({ content: [{ text: "I am here." }] }), "I am here.");
  assert.throws(() => normalizeCreatureTwinReply({ metadata: "no assistant text" }), /creature_observer_reply_missing/);

  const motion = creatureConsciousnessMotion(asset, 0);
  assert.match(motion["--creature-blink"], /^\d+ms$/);
  assert.match(motion["--creature-gaze-range"], /^\d+(?:\.\d+)?px$/);

  const fallback = localCreatureTwinReply(brain, "How are you feeling?");
  assert.match(fallback, new RegExp(String(brain.embodiment.stats.health)));
  assert.match(fallback, new RegExp(String(brain.embodiment.bond)));

  const captureReply = localCreatureTwinReply(brain, "Do you remember when I captured you?");
  assert.match(captureReply, new RegExp(asset.manifest.encounterId));
  assert.match(captureReply, new RegExp(asset.manifest.capturedAt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  const voice = creatureVoiceProfile(asset, [
    { name: "Robot Compact", lang: "en-US", localService: true },
    { name: "Ava Premium", lang: "en-US", localService: true }
  ]);
  assert.equal(voice.voice?.name, "Ava Premium");
});

test("training becomes exact autobiographical memory without replacing capture", () => {
  const state = createOwnerBoundInitialPlayState("autobiography_keeper", "2026-08-11T11:00:00.000Z");
  const source = state.inventory[0]!;
  const before = isLivingCardAsset(source) ? source : admitLegacyCard(source, source.manifest.capturedAt);
  const occurredAt = new Date(Date.parse(before.proof.sealedAt) + 60_000).toISOString();
  const after = appendLivingCardHistory({
    asset: before,
    event: {
      eventId: `training:${before.id}:memory-test`,
      rulesetVersion: "wildz.training.v1",
      occurredAt,
      source: { mode: "training", activityId: "training:memory-test", actorId: before.manifest.ownerReceizId, authority: "local" },
      evidence: {},
      effects: [{
        kind: "progress",
        xpDelta: 40,
        growthEvents: [{ eventId: `bond:${before.id}:memory-test`, kind: "bond_moment", path: "bond", amount: 1, occurredAt }]
      }]
    }
  });
  const brain = projectCreatureBrain(after);
  assert.equal(brain.memory.capture.occurredAt, before.manifest.capturedAt);
  assert.equal(brain.memory.eventLedger.some((event) => event.source.mode === "training"), true);
  assert.equal(brain.memory.eventLedger.length, isLivingCardAsset(after) ? after.manifest.history?.events.length : 0);
});

test("Vault consciousness uses the SDK World Twin rail and card-scoped UI", () => {
  const route = readFileSync("app/api/receiz/creature-observer/route.ts", "utf8");
  const panel = readFileSync("src/features/play/CreatureConsciousnessPanel.tsx", "utf8");
  const card = readFileSync("src/features/play/WildsCard.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(route, /resolveWildzCookieActor\(request\)/);
  assert.match(route, /adapter\.worldMessage\(twinHandle/);
  assert.match(route, /clientOperationId/);
  assert.match(route, /quoteExpiresAt/);
  assert.match(route, /localCreatureTwinReply/);
  assert.match(route, /clientContext: creatureObserverClientContext\(brain\)/);
  assert.match(route, /createObservedCreatureTurn/);
  assert.match(panel, /record-creature-observation|onObserved/);
  assert.match(panel, /speechSynthesis/);
  assert.match(card, /data-speaking/);
  assert.match(css, /wilds-creature-blink/);
  assert.match(css, /wilds-creature-consciousness/);
});
