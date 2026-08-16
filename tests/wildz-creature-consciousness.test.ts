import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createObservedCreatureTurn,
  creatureConsciousnessMotion,
  creatureObserverClientContext,
  normalizeCreatureTwinReply,
  parseCreatureObserverRequest,
  projectCreatureBrain
} from "../src/features/play/creature-consciousness";
import { currentCreatureHistoryProjection } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import {
  applyWildsInput,
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
  assert.equal(context.creatureBrain.contextDigest, brain.contextDigest);
  assert.match(context.instruction, /never invent a canonical event/i);
  assert.equal(parseCreatureObserverRequest({ card: asset, message: "  Hello   there  " }).message, "Hello there");
  assert.throws(() => parseCreatureObserverRequest({ card: asset, message: "" }), /creature_observer_request_invalid/);
  assert.equal(normalizeCreatureTwinReply({ content: [{ text: "I am here." }] }), "I am here.");
  assert.throws(() => normalizeCreatureTwinReply({ metadata: "no assistant text" }), /creature_observer_reply_missing/);

  const motion = creatureConsciousnessMotion(asset, 0);
  assert.match(motion["--creature-blink"], /^\d+ms$/);
  assert.match(motion["--creature-gaze-range"], /^\d+(?:\.\d+)?px$/);
});

test("Vault consciousness uses the SDK World Twin rail and card-scoped UI", () => {
  const route = readFileSync("app/api/receiz/creature-observer/route.ts", "utf8");
  const panel = readFileSync("src/features/play/CreatureConsciousnessPanel.tsx", "utf8");
  const card = readFileSync("src/features/play/WildsCard.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(route, /resolveWildzCookieActor\(request\)/);
  assert.match(route, /adapter\.worldMessage\(actor\.actorId/);
  assert.match(route, /clientContext: creatureObserverClientContext\(brain\)/);
  assert.match(route, /createObservedCreatureTurn/);
  assert.match(panel, /record-creature-observation|onObserved/);
  assert.match(panel, /speechSynthesis/);
  assert.match(card, /data-speaking/);
  assert.match(css, /wilds-creature-blink/);
  assert.match(css, /wilds-creature-consciousness/);
});
