import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createObservedCreatureTurn,
  creatureConsciousnessMotion,
  creatureObserverClientContext,
  creatureObserverMomentContext,
  normalizeCreatureSpokenPerspective,
  normalizeCreatureTwinReply,
  parseCreatureObserverRequest,
  proofGroundedCreatureReply,
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
import { observeCreatureThroughReceizV120 } from "../src/features/play/receiz-v120-creature-subject";
import { wildzStreamingVoiceProfile } from "../src/lib/receiz/wildz-voice-lock";

test("proof signatures select stable unique streaming neural voice profiles", () => {
  const firstSignature = "expression:0123456789abcdef";
  const secondSignature = "expression:fedcba9876543210";
  assert.deepEqual(wildzStreamingVoiceProfile(firstSignature), wildzStreamingVoiceProfile(firstSignature));
  assert.notDeepEqual(wildzStreamingVoiceProfile(firstSignature), wildzStreamingVoiceProfile(secondSignature));
});

test("the verified proof brain always forms a real creature response when both live rails fail", () => {
  const brain = projectCreatureBrain(initialPlayState.inventory[0]!);
  const prompts = ["How are you feeling?", "What do you remember about us?", "What should we explore next?"];
  for (const prompt of prompts) {
    const first = proofGroundedCreatureReply(brain, prompt);
    assert.equal(first, proofGroundedCreatureReply(brain, prompt));
    assert.ok(first.length > 24);
    assert.doesNotMatch(first, /could not form a response|no world event was created|try once more/i);
  }
});

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
  const brain = projectCreatureBrain(asset);
  const observation = await observeCreatureThroughReceizV120({
    asset,
    brain,
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
  assert.equal(brain.performance.neuralInterface.signature, brain.performance.expression.voiceSignature);
  assert.equal(brain.performance.neuralInterface.engine, "receiz-v120-neural");
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
  assert.equal(
    normalizeCreatureTwinReply({ content: [{ text: `${brain.identity.name} remembers its owner and ${brain.identity.name}'s first trail.` }] }, brain.identity.name),
    "I remember you and my first trail."
  );
  assert.equal(
    normalizeCreatureSpokenPerspective(`My owner says ${brain.identity.name} feels ready.`, brain.identity.name),
    "you say I feel ready."
  );
  assert.throws(() => normalizeCreatureTwinReply({ metadata: "no assistant text" }), /creature_observer_reply_missing/);

  const motion = creatureConsciousnessMotion(asset, 0);
  assert.match(motion["--creature-blink"], /^\d+ms$/);
  assert.match(motion["--creature-gaze-range"], /^\d+(?:\.\d+)?px$/);
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
  const voicePlayback = readFileSync("src/features/play/creature-voice-playback.ts", "utf8");
  const localVoice = readFileSync("src/features/play/local-neural-voice.ts", "utf8");
  const localVoiceWorker = readFileSync("src/features/play/local-neural-voice.worker.ts", "utf8");
  const cookieActor = readFileSync("src/lib/receiz/wildz-cookie-actor.ts", "utf8");
  const card = readFileSync("src/features/play/WildsCard.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(route, /resolveWildzGameplayCookieActor\(request\)/);
  assert.match(route, /createReceizClient/);
  assert.match(route, /actor\.accessToken \? \{ accessToken: actor\.accessToken \} : \{\}/);
  assert.doesNotMatch(route, /if \(!actor\.accessToken\) throw new Error\("receiz_authority_required"\)/);
  assert.doesNotMatch(route, /RECEIZ_CREATURE_TWIN_HANDLE|receiz\.world\.streamProfile/);
  assert.match(route, /observeCreatureThroughReceizV120/);
  assert.match(route, /proofGroundedCreatureReply\(subjectBrain, input\.message, presentKaiMoment\.temporalRoot\.uPulse\)/);
  assert.match(route, /Present Kai causal context/);
  assert.match(route, /clientUserMessageId: clientOperationId/);
  assert.match(route, /text\/event-stream/);
  assert.match(route, /type: "reply_reset"/);
  assert.match(route, /type: "reply_done"/);
  assert.match(route, /type: "audio_chunk"/);
  assert.match(route, /voiceSignature: subjectBrain\.performance\.expression\.voiceSignature/);
  assert.match(route, /receiz-v120-proof-performance/);
  assert.doesNotMatch(route, /Promise\.any|generateWildzCreatureVoice|audioDataUrl/);
  assert.doesNotMatch(route, /RECEIZ_CONNECT_ACCESS_TOKEN/);
  assert.match(route, /creature_observer_owner_mismatch/);
  assert.match(route, /clientOperationId/);
  assert.match(route, /receiz\.world\.message\("wildz"/);
  assert.match(route, /proofGroundedCreatureReply/);
  assert.match(route, /proof-grounded-creature-twin/);
  assert.match(route, /type: "reply_reset"/);
  assert.match(route, /finalPerformanceAudio/);
  assert.match(route, /audioAsset/);
  assert.doesNotMatch(route, /if \(!audioSent\) throw/);
  assert.match(route, /PERFORMANCE_ENRICHMENT_BUDGET_MS/);
  assert.match(route, /genuine: observer === "receiz-twin"/);
  assert.match(panel, /Receiz v120 Twin · proof-bound intelligence/);
  assert.doesNotMatch(panel, /proof-grounded local/);
  assert.match(route, /observeCreatureThroughReceizV120/);
  assert.match(route, /creatureObserverClientContext\(subjectBrain, presentKaiMoment\)/);
  assert.match(route, /creatureObserverMomentContext\(input\.kai, brain\)/);
  assert.match(route, /modelOutputIsWorldEvent/);
  assert.match(route, /createObservedCreatureTurn/);
  assert.match(route, /normalizeCreatureTwinReply\(subjectObservation\.twin\.spokenResponse, brain\.identity\.name\)/);
  assert.match(route, /allowBrowserVoiceFallback: false/);
  assert.doesNotMatch(route, /reply_preview/);
  assert.match(route, /export const maxDuration = 90/);
  assert.match(panel, /record-creature-observation|onObserved/);
  assert.doesNotMatch(panel, /speechSynthesis|native character voice/i);
  assert.match(panel, /unlockCreatureVoice\(\)/);
  assert.match(panel, /beginCreatureVoiceStream\(asset\.id, brain\.performance\.neuralInterface, \{/);
  assert.match(panel, /birthMomentMs: Date\.parse\(asset\.manifest\.capturedAt\)/);
  assert.match(panel, /voiceStream\?\.pushText\(event\.delta\)/);
  assert.match(panel, /voiceStream\?\.pushAudio\(event\)/);
  assert.match(panel, /event\.type === "reply_reset"/);
  assert.match(panel, /voiceStream\.completed\.then\(\(played\)/);
  assert.match(panel, /code === "receiz_authority_required"/);
  assert.doesNotMatch(panel, /proofTwinCanRecover[\s\S]{0,320}creature_observer_owner_mismatch/);
  assert.match(panel, /onObserved\(result\.turn\)/);
  assert.match(panel, /setStreamingExchange/);
  assert.doesNotMatch(panel, /unique neural voice could not play|No substitute voice|enrichment unavailable/i);
  assert.match(panel, /Unique proof voice · ready locally/);
  assert.match(inventory, /selectedSpeakingId = selected\?\.id/);
  assert.doesNotMatch(inventory, /setSelectedCreatureSpeaking[\s\S]{0,180}\}, \[selected\]\)/);
  assert.match(panel, /wildz-creature-mouth/);
  assert.match(voicePlayback, /decodeAudioData\(bytes\.slice\(0\)\)/);
  assert.match(voicePlayback, /source\.playbackRate\.value = 1/);
  assert.match(voicePlayback, /Math\.log2\(neural\.pitch\)/);
  assert.match(voicePlayback, /remote waveform is not played|never replaces the creature's audible proof voice/i);
  assert.match(voicePlayback, /getByteTimeDomainData/);
  assert.match(voicePlayback, /wildz-creature-voice-latency/);
  assert.match(voicePlayback, /targetMs: 300/);
  assert.match(voicePlayback, /synthesizeProofVoice/);
  assert.match(voicePlayback, /VOWEL_FORMANTS/);
  assert.match(voicePlayback, /birthMomentMs/);
  assert.match(voicePlayback, /speakingMoment\.uPulse/);
  assert.match(voicePlayback, /KAI_PULSE_DURATION_MS/);
  assert.match(voicePlayback, /KAI_BREATH_INHALE_SHARE/);
  assert.match(voicePlayback, /one complete Golden breath/i);
  assert.match(voicePlayback, /receiz-proof-source-filter/);
  assert.match(voicePlayback, /requestAnimationFrame\(animate\)/);
  assert.doesNotMatch(voicePlayback, /projectCreatureBrain|kokoro|onnx|transformers|speechSynthesis|WebSocket|elevenlabs/i);
  assert.match(localVoice, /new Worker\(new URL\(/);
  assert.match(localVoice, /momentCadence/);
  assert.match(localVoiceWorker, /allowRemoteModels = false/);
  assert.match(localVoiceWorker, /numThreads = 1/);
  assert.match(localVoiceWorker, /device: "wasm"/);
  assert.doesNotMatch(localVoiceWorker, /fetch\(["'`]https?:\/\//);
  assert.match(cookieActor, /Read-only gameplay uses the already authenticated proof session directly/);
  const nextConfig = readFileSync("next.config.mjs", "utf8");
  assert.match(nextConfig, /script-src 'self' blob:/);
  assert.match(nextConfig, /'wasm-unsafe-eval'/);
  assert.doesNotMatch(nextConfig, /kokoro|onnxruntime/i);
  assert.match(card, /wildz-creature-mouth/);
  assert.match(css, /--creature-mouth-open/);
  assert.match(css, /--creature-talk-tail/);
  assert.match(card, /data-speaking/);
  assert.match(css, /wilds-creature-blink/);
  assert.match(css, /wilds-creature-consciousness/);
});
