import assert from "node:assert/strict";
import test from "node:test";
import { applyWildsInput, createOwnerBoundInitialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { nearbyHiddenHotspots } from "../src/features/play/hidden-hotspots";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "../src/features/play/kai-klok-moment";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { appendLivingCardHistory, currentCreatureHistoryProjection, currentRevision } from "../src/features/play/living-card-proof";
import { verifyAnyWildsCard } from "../src/features/play/portable-card";

function captureReadyState() {
  const owner = "kai-capture-order";
  let state = createOwnerBoundInitialPlayState(owner, "2026-08-21T14:00:00.000Z");
  let uPulse = deriveKaiKlokMoment({ occurredAt: "2026-08-21T15:00:00.000Z", authority: "local" }).uPulse + 1;
  while (deriveKaiKlokMoment({ occurredAt: kaiUPulseToISOString(uPulse), authority: "local" }).uPulse >= uPulse) uPulse++;
  const hotspot = nearbyHiddenHotspots(state.player).find(candidate => candidate.requiredCapability === null)!;
  assert.ok(hotspot);
  state = applyWildsInput({ ...state, player: { ...hotspot.position } }, {
    type: "search-point", x: hotspot.position.x, z: hotspot.position.z,
    searchedAt: kaiUPulseToISOString(uPulse), ownerReceizId: owner, kaiUPulse: uPulse,
    verticalWorldY: hotspot.worldY
  });
  assert.equal(state.encounter.phase, "battle_intro");
  const selected = state.inventory.find(card => card.id === state.selectedAssetId)!;
  assert.ok(isLivingCardAsset(selected));
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse, authority: "local" });
  const { pulse, beat, stepIndex, weekday, chakra, coordinate } = moment;
  const leader = appendLivingCardHistory({ asset: selected, event: {
    eventId: "prior-exact-gameplay", rulesetVersion: "wildz.gameplay.v4-alpha",
    occurredAt: kaiUPulseToISOString(uPulse), kai: { uPulse, pulse, beat, stepIndex, weekday, chakra, coordinate },
    source: { mode: "world", activityId: "prior-exact-gameplay", actorId: owner, authority: "local" },
    evidence: {}, effects: [{ kind: "legacy-checkpoint", projection: currentCreatureHistoryProjection(selected) }]
  } });
  state = { ...state, inventory: state.inventory.map(card => card.id === leader.id ? leader : card) };
  assert.equal(leader.manifest.history?.events.at(-1)?.kai.uPulse, uPulse);
  state = applyWildsInput(state, { type: "start-battle", at: kaiUPulseToISOString(uPulse), kaiUPulse: uPulse });
  assert.ok(state.battle);
  assert.ok(state.encounter.phase !== "idle");
  return { state: { ...state, encounter: { ...state.encounter, phase: "capture_ready" as const }, battle: {
    ...state.battle, phase: "capture_ready" as const,
    player: { ...state.battle.player, hp: Math.floor(state.battle.player.maxHp / 2), hpRatio: .5 },
    wild: { ...state.battle.wild, hp: 1, hpRatio: .01 }
  } }, uPulse, leaderId: leader.id };
}

test("capture retains exact Kai order through vitality settlement, reveal, replay and restore", () => {
  const { state, uPulse, leaderId } = captureReadyState();
  const captured = applyWildsInput(state, { type: "battle-action", action: { type: "capture" }, kaiUPulse: uPulse });
  assert.equal(captured.encounter.phase, "capsule");
  const fighter = captured.inventory.find(card => card.id === leaderId)!;
  assert.ok(isLivingCardAsset(fighter));
  assert.equal(fighter.manifest.history?.events.at(-1)?.kai.uPulse, uPulse);
  assert.equal(currentRevision(fighter).kaiPulse, String(uPulse));
  assert.equal(verifyAnyWildsCard(fighter).ok, true);
  const sealed = applyWildsInput(captured, { type: "advance-encounter", at: kaiUPulseToISOString(uPulse + 100000), kaiUPulse: uPulse + 100000 });
  assert.equal(sealed.encounter.phase, "sealed");
  assert.match(sealed.lastEvent, /was captured and sealed as one portable card/);
  assert.equal(sealed.inventory.length, state.inventory.length + 1);
  const revealed = applyWildsInput(sealed, { type: "advance-encounter", at: kaiUPulseToISOString(uPulse + 200000), kaiUPulse: uPulse + 200000 });
  assert.equal(revealed.encounter.phase, "revealed");
  assert.match(revealed.lastEvent, /Capture complete/);
  const replay = applyWildsInput(revealed, { type: "battle-action", action: { type: "capture" }, kaiUPulse: uPulse + 200000 });
  assert.equal(replay.inventory.length, revealed.inventory.length);
  const restored = restorePlayState(serializePlayState(revealed));
  assert.equal(restored.encounter.phase, "revealed");
  assert.equal(restored.inventory.length, revealed.inventory.length);
  for (const card of restored.inventory) assert.equal(verifyAnyWildsCard(card).ok, true);
});

test("capture still rejects an actually regressing Kai event", () => {
  const { state, uPulse } = captureReadyState();
  assert.throws(() => applyWildsInput(state, { type: "battle-action", action: { type: "capture" }, kaiUPulse: uPulse - 100000 }), /creature_history_kai_regression/);
});

test("camp recovery preserves the exact gameplay pulse after capture damage", () => {
  const { state, uPulse, leaderId } = captureReadyState();
  const captured = applyWildsInput(state, { type: "battle-action", action: { type: "capture" }, kaiUPulse: uPulse });
  const prior = captured.inventory.find(card => card.id === leaderId)!;
  assert.ok(isLivingCardAsset(prior));
  const rested = applyWildsInput(captured, { type: "rest", kaiUPulse: uPulse });
  const healed = rested.inventory.find(card => card.id === leaderId)!;
  assert.ok(isLivingCardAsset(healed));
  assert.ok(currentRevision(healed).growth.life!.vitality > currentRevision(prior).growth.life!.vitality);
  assert.equal(healed.manifest.history?.events.at(-1)?.kai.uPulse, uPulse);
  assert.equal(currentRevision(healed).kaiPulse, String(uPulse));
  assert.equal(verifyAnyWildsCard(healed).ok, true);
});

test("wild battle retirement preserves the exact gameplay pulse", () => {
  const { state, uPulse, leaderId } = captureReadyState();
  const vulnerable = { ...state, battle: { ...state.battle, player: { ...state.battle.player, hp: 1, hpRatio: .001 } } };
  const defeated = applyWildsInput(vulnerable, { type: "battle-action", action: { type: "guard" }, kaiUPulse: uPulse });
  assert.equal(defeated.battle?.phase, "defeated");
  const retired = defeated.inventory.find(card => card.id === leaderId)!;
  assert.ok(isLivingCardAsset(retired));
  assert.equal(currentRevision(retired).growth.life?.retired, true);
  assert.equal(retired.manifest.history?.events.at(-1)?.kai.uPulse, uPulse);
  assert.equal(currentRevision(retired).kaiPulse, String(uPulse));
  assert.equal(verifyAnyWildsCard(retired).ok, true);
});
