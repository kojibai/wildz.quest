import assert from "node:assert/strict";
import test from "node:test";
import { applyWildsInput, initialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state";
import { createWildsDreamTrial, verifyWildsDreamTrial, wildsDreamStory, type WildsDreamTrial, type WildsDreamTap } from "../src/features/play/wilds-dream-trial";
import { deriveKaiKlokMoment, KAI_N_DAY_MICRO } from "../src/features/play/kai-klok-moment";

const pulse = deriveKaiKlokMoment({occurredAt: "2026-10-09T18:00:00.000Z", authority: "local"}).uPulse;
function win(trial: WildsDreamTrial) {
  let now = trial.enteredUPulse;
  const taps: WildsDreamTap[] = [];
  for (const round of trial.rounds) { now += 600_000; for (const rune of round) {now += 50_000; taps.push({rune, uPulse: now});} }
  return {taps, completedUPulse: now + 1};
}
test("dream story and patterns derive from the exact entry Kai moment", () => {
  const trial = createWildsDreamTrial("companion", pulse), story = wildsDreamStory(trial);
  assert.deepEqual(trial, createWildsDreamTrial("companion", pulse));
  assert.equal(story.moment.uPulse, pulse);
  assert.ok(story.opening.includes(story.expression.day.name));
  assert.ok(story.opening.includes(story.expression.ark.meaning));
  assert.notDeepEqual(trial.rounds, createWildsDreamTrial("companion", pulse + Number(KAI_N_DAY_MICRO)).rounds);
});
test("dream replay rejects wrong, missing, instant, expired and altered patterns", () => {
  const trial = createWildsDreamTrial("companion", pulse), result = win(trial);
  assert.equal(verifyWildsDreamTrial(trial, result.taps, result.completedUPulse), true);
  assert.equal(verifyWildsDreamTrial(trial, result.taps.slice(1), result.completedUPulse), false);
  assert.equal(verifyWildsDreamTrial(trial, result.taps.map((tap,index) => index ? tap : {...tap, rune: (tap.rune + 1) % 4}), result.completedUPulse), false);
  assert.equal(verifyWildsDreamTrial(trial, result.taps.map(tap => ({...tap, uPulse: pulse})), result.completedUPulse), false);
  assert.equal(verifyWildsDreamTrial(trial, result.taps, pulse + 15_000_000), false);
  assert.equal(verifyWildsDreamTrial({...trial, rounds: [[0],[0],[0]]}, result.taps, result.completedUPulse), false);
});
test("won dream uses bounded bond training, keeps sleep, persists and cannot award twice", () => {
  const sleeping = applyWildsInput(initialPlayState, {type: "sleep", kaiUPulse: pulse});
  const trial = createWildsDreamTrial(sleeping.selectedAssetId, pulse), result = win(trial);
  const next = applyWildsInput(sleeping, {type: "dream-trial", trial, taps: result.taps, kaiUPulse: result.completedUPulse});
  assert.equal(next.cardXp, sleeping.cardXp + 10);
  assert.equal(next.playerBreaths?.mode, "sleep");
  assert.equal(next.energy, sleeping.energy);
  assert.ok(next.actionHistory.some(entry => entry.id === trial.id));
  assert.equal(applyWildsInput(next, {type: "dream-trial", trial, taps: result.taps, kaiUPulse: result.completedUPulse}), next);
  const restored = restorePlayState(serializePlayState(next));
  assert.ok(restored.actionHistory.some(entry => entry.id === trial.id));
  const laterTrial = createWildsDreamTrial(next.selectedAssetId, result.completedUPulse + 1), later = win(laterTrial);
  const recovery = applyWildsInput(next, {type: "dream-trial", trial: laterTrial, taps: later.taps, kaiUPulse: later.completedUPulse});
  assert.equal(recovery.cardXp, next.cardXp);
});
test("waking or changing companion before a dream result prevents its reward", () => {
  const sleeping = applyWildsInput(initialPlayState, {type: "sleep", kaiUPulse: pulse});
  const trial = createWildsDreamTrial(sleeping.selectedAssetId, pulse), result = win(trial);
  const awake = applyWildsInput(sleeping, {type: "wake", kaiUPulse: pulse + 1});
  assert.equal(applyWildsInput(awake, {type: "dream-trial", trial, taps: result.taps, kaiUPulse: result.completedUPulse}), awake);
  assert.equal(applyWildsInput(sleeping, {type: "dream-trial", trial: {...trial,assetId:"another"}, taps: result.taps, kaiUPulse: result.completedUPulse}), sleeping);
});
