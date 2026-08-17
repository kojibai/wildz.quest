import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createObservedCreatureTurn,
  creatureConsciousnessMotion,
  creatureObserverClientContext,
  creatureObserverMomentContext,
  creatureVoicePerformance,
  creatureVoiceProfile,
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
import { creatureNeuralVoiceIdentity } from "../src/features/play/creature-neural-voice";
import { observeCreatureThroughReceizV120 } from "../src/features/play/receiz-v120-creature-subject";

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

test("Receiz v120 observes the exact creature through a proof brain without creating a world event", async () => {
  const asset = initialPlayState.inventory[0]!;
  const observation = await observeCreatureThroughReceizV120({
    asset,
    ownerReceizId: asset.manifest.ownerReceizId,
    message: "What do you remember about meeting me?",
    clientMessageId: "wildz:test:v120:message",
    speak: async ({ brain, proofContext }) => ({
      provider: "wildz-test",
      model: "deterministic",
      version: "120.0.0",
      speech: `${brain.memory.capture.summary} I still carry that beginning with me.`,
      performance: { emotion: "remembering", contextObjects: proofContext.primaryObjects.length }
    })
  });

  assert.equal(observation.registryDigest, "0728651789b26e1d10c1991ec1c06c1ea4a576f0c6520537b250b171f8857073");
  assert.equal(observation.twin.schema, "receiz.subject.twin_result.v1");
  assert.equal(observation.twin.authority.modelOutputIsWorldEvent, false);
  assert.equal(observation.twin.authority.deterministicAdmissionRequired, true);
  assert.deepEqual(observation.twin.worldEventIds, []);
  assert.ok(Number(observation.objectCount) >= 3);
  assert.ok(observation.twin.proofContext.primaryObjects.some((object) => object.text.some((text) => text.kind === "event")));
  assert.match(observation.twin.spokenResponse, /carry that beginning/i);
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
  const kai = { uPulse: 1_000_000, authority: "local" as const, playerPosition: { x: 4, z: -2 } };
  const moment = creatureObserverMomentContext(kai, brain);
  const context = creatureObserverClientContext(brain, moment);

  assert.equal(brain.identity.assetId, asset.id);
  assert.equal(brain.identity.proofDigest, asset.proof.digest);
  assert.deepEqual(brain.embodiment.stats, asset.manifest.stats);
  assert.equal(brain.authority.observer, "receiz-twin");
  assert.equal(brain.authority.modelMayRewriteProof, false);
  assert.equal(brain.memory.capture.occurredAt, asset.manifest.capturedAt);
  assert.equal(brain.memory.capture.encounterId, asset.manifest.encounterId);
  assert.equal(brain.memory.capture.proofDigest, asset.proof.digest);
  assert.equal(brain.memory.capture.relationshipMeaning, "first-owner-shared-memory");
  assert.equal(brain.memory.innateSelf.kind, "pre-capture-self");
  assert.equal(brain.memory.innateSelf.communication.length > 0, true);
  assert.deepEqual(
    brain.memory.innateSelf.originalStats,
    isLivingCardAsset(asset) ? asset.manifest.revisions[0]?.stats ?? asset.manifest.stats : asset.manifest.stats
  );
  assert.match(brain.performance.expression.voiceSignature, /^expression:[a-f0-9]{16}$/);
  assert.equal(brain.performance.expression.evolvesOnlyFromProofState, true);
  assert.ok(brain.performance.expression.emotionalOpenness >= 0 && brain.performance.expression.emotionalOpenness <= 1);
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
  assert.equal(context.presentKaiMoment.temporalRoot.uPulse, kai.uPulse);
  assert.equal(context.presentKaiMoment.presence.ownerWorldPosition.x, 4);
  assert.match(context.instruction, /never invent a consequential event/i);
  assert.match(context.instruction, /self existed before capture/i);
  assert.match(context.instruction, /never mention cards, brains, proof/i);
  assert.match(context.instruction, /exact Kai moment/i);
  assert.equal(parseCreatureObserverRequest({ card: asset, message: "  Hello   there  ", kai }).message, "Hello there");
  assert.throws(() => parseCreatureObserverRequest({ card: asset, message: "", kai }), /creature_observer_request_invalid/);
  assert.throws(() => parseCreatureObserverRequest({ card: asset, message: "hello" }), /creature_observer_kai_invalid/);
  assert.equal(normalizeCreatureTwinReply({ content: [{ text: "I am here." }] }), "I am here.");
  assert.throws(() => normalizeCreatureTwinReply({ metadata: "no assistant text" }), /creature_observer_reply_missing/);

  const motion = creatureConsciousnessMotion(asset, 0);
  assert.match(motion["--creature-blink"], /^\d+ms$/);
  assert.match(motion["--creature-gaze-range"], /^\d+(?:\.\d+)?px$/);

  const voice = creatureVoiceProfile(asset, [
    { name: "Robot Compact", lang: "en-US", localService: true },
    { name: "Ava Premium", lang: "en-US", localService: true }
  ]);
  assert.equal(voice.voice?.name, "Ava Premium");

  const performance = creatureVoicePerformance(asset, "I remember our beginning. Shall we explore together?");
  assert.equal(performance.length, 2);
  assert.equal(performance[0]?.text, "I remember our beginning.");
  assert.equal(performance[1]?.text, "Shall we explore together?");
  assert.deepEqual(performance, creatureVoicePerformance(asset, "I remember our beginning. Shall we explore together?"));
  assert.ok(performance.every((segment) => segment.rate >= .87 && segment.rate <= 1.055));
  assert.ok(performance.every((segment) => segment.pitch >= .94 && segment.pitch <= 1.065));
  const neuralVoice = creatureNeuralVoiceIdentity(asset);
  assert.match(neuralVoice.signature, /^neural:[a-f0-9]{16}$/);
  assert.deepEqual(neuralVoice, creatureNeuralVoiceIdentity(asset));
  assert.ok(neuralVoice.speed >= .91 && neuralVoice.speed <= 1.09);
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

test("Vault consciousness uses the owner-scoped SDK v120 subject Twin rail and card-scoped UI", () => {
  const route = readFileSync("app/api/receiz/creature-observer/route.ts", "utf8");
  const panel = readFileSync("src/features/play/CreatureConsciousnessPanel.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const card = readFileSync("src/features/play/WildsCard.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(route, /resolveWildzCookieActor\(request\)/);
  assert.match(route, /createReceizClient/);
  assert.match(route, /actor\.accessToken \? \{ accessToken: actor\.accessToken \} : \{\}/);
  assert.doesNotMatch(route, /if \(!actor\.accessToken\) throw new Error\("receiz_authority_required"\)/);
  assert.match(route, /receiz\.subjects\.twin\.message\(input\.card\.id/);
  assert.match(route, /receiz\.world\.message\(actor\.actorId/);
  assert.match(route, /exactSubjectTwin[\s\S]*\[exactSubjectTwin, receizIdTwinObserver\][\s\S]*\[receizIdTwinObserver\]/);
  assert.match(route, /Promise\.any\(observerRequests\)/);
  assert.match(route, /contextHead: proofContext\.head\.subjectHead/);
  assert.match(route, /expectedSubjectDigest: proofContext\.head\.subjectDigest/);
  assert.doesNotMatch(route, /RECEIZ_CONNECT_ACCESS_TOKEN|CREATURE_TWIN_HANDLE/);
  assert.match(route, /creature_observer_owner_mismatch/);
  assert.match(route, /clientOperationId/);
  assert.doesNotMatch(route, /localCreatureTwinReply/);
  assert.match(route, /creature_observer_intelligence_unavailable/);
  assert.match(route, /observeCreatureThroughReceizV120/);
  assert.match(route, /creatureObserverClientContext\(subjectBrain, presentKaiMoment\)/);
  assert.match(route, /creatureObserverMomentContext\(input\.kai, brain\)/);
  assert.match(route, /modelOutputIsWorldEvent/);
  assert.match(route, /createObservedCreatureTurn/);
  assert.match(panel, /record-creature-observation|onObserved/);
  assert.match(panel, /speechSynthesis/);
  assert.match(panel, /playCreatureNeuralVoice/);
  assert.match(panel, /warmCreatureNeuralVoice/);
  assert.match(panel, /isCreatureNeuralVoiceReady/);
  assert.match(panel, /neuralTimeoutMs = isCreatureNeuralVoiceReady\(asset\) \? 10_500 : 900/);
  assert.match(panel, /Promise\.race\(\[[\s\S]*playCreatureNeuralVoice/);
  assert.doesNotMatch(panel, /neuralController\.abort\(\);\s*if \([^)]+neuralController\.signal\.aborted/);
  assert.match(panel, /activeUtterances\.current = \[utterance\]/);
  assert.match(inventory, /selectedSpeakingId = selected\?\.id/);
  assert.doesNotMatch(inventory, /setSelectedCreatureSpeaking[\s\S]{0,180}\}, \[selected\]\)/);
  assert.match(campaign, /requestIdleCallback\?\.\(prime\)/);
  assert.match(campaign, /priority: "background"/);
  assert.match(campaign, /cancelled \|\| started/);
  assert.match(campaign, /import\("\.\/creature-neural-voice"\)/);
  assert.match(campaign, /warmCreatureNeuralVoice\(asset\)/);
  assert.match(panel, /wildz-creature-mouth/);
  assert.match(panel, /requestAnimationFrame\(animateNativeMouth\)/);
  assert.doesNotMatch(panel, /if \(neuralPlayed\)[\s\S]{0,180}finishSpeaking\(\)/);
  const neuralVoice = readFileSync("src/features/play/creature-neural-voice.ts", "utf8");
  assert.match(neuralVoice, /export function isCreatureNeuralVoiceReady/);
  assert.match(neuralVoice, /primedVoices/);
  assert.match(neuralVoice, /appleWebKit/);
  assert.match(neuralVoice, /hasReliableWebGpu/);
  assert.match(neuralVoice, /env\.wasmPaths = `\$\{window\.location\.origin\}\/vendor\/onnxruntime\//);
  const nextConfig = readFileSync("next.config.mjs", "utf8");
  assert.match(nextConfig, /key: "Cross-Origin-Embedder-Policy",\s*value: "require-corp"/);
  assert.match(nextConfig, /script-src 'self' blob:/);
  assert.match(nextConfig, /'wasm-unsafe-eval'/);
  assert.match(neuralVoice, /model\.generate\([\s\S]*10_000/);
  assert.match(neuralVoice, /onEnded\?: \(\) => void/);
  assert.match(neuralVoice, /source\.start\(\);[\s\S]*return true/);
  assert.match(neuralVoice, /createAnalyser\(\)/);
  assert.match(neuralVoice, /getByteTimeDomainData/);
  assert.match(card, /wildz-creature-mouth/);
  assert.match(css, /--creature-mouth-open/);
  assert.match(css, /--creature-talk-tail/);
  assert.match(card, /data-speaking/);
  assert.match(css, /wilds-creature-blink/);
  assert.match(css, /wilds-creature-consciousness/);
});
