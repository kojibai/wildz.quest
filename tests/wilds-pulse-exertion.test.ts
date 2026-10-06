import assert from "node:assert/strict";
import { test } from "node:test";
import { KAI_N_DAY_MICRO } from "../src/features/play/kai-klok-moment";
import { createPlayerBreaths, advancePlayerBreaths, playerBreathReadout, playerBreathEnergy, restorePlayerBreaths } from "../src/features/play/player-breath-energy";
import { initialPlayState, applyWildsInput } from "../src/features/play/game-state";
const DAY = Number(KAI_N_DAY_MICRO), BASE = DAY * 100;
const body = (value: unknown) => value as Record<string, number | string>;

test("each actual Kai pulse advances one breath independent of gameplay and reserve", () => {
  const pulse = Math.floor(BASE / 1_000_000) * 1_000_000 + 1_000_000;
  for (const energy of [0, 40, 100]) {
    const state = createPlayerBreaths(BASE, energy);
    assert.equal(playerBreathReadout(state, pulse).elapsedBreaths - playerBreathReadout(state, pulse - 1).elapsedBreaths, 1);
  }
});
test("day rollover carries body fatigue while starting a new clock cycle", () => {
  const next = advancePlayerBreaths(createPlayerBreaths(BASE, 100), BASE + DAY);
  assert.equal(playerBreathReadout(next).elapsedBreaths, 0);
  assert.equal(body(next).fatigueMicroPercent, 100_000_000);
  assert.ok(playerBreathEnergy(next) <= 10);
});
test("camp releases strain but bed sleep clears sustained fatigue", () => {
  const tired = advancePlayerBreaths(createPlayerBreaths(BASE, 100), BASE + Math.floor(DAY * .6));
  const camp = advancePlayerBreaths(advancePlayerBreaths(tired, tired.lastKaiUPulse, "camp"), tired.lastKaiUPulse + Math.floor(DAY / 4));
  const bed = advancePlayerBreaths(advancePlayerBreaths(tired, tired.lastKaiUPulse, "bed"), tired.lastKaiUPulse + Math.floor(DAY / 4));
  assert.ok(Number(body(camp).fatigueMicroPercent) >= Number(body(tired).fatigueMicroPercent));
  assert.equal(body(bed).fatigueMicroPercent, 0);
  assert.ok(playerBreathEnergy(bed) > playerBreathEnergy(camp));
});
test("an exhausted explorer can still walk and records the work without adding clock breaths", () => {
  const start = { ...initialPlayState, energy: 0, playerBreaths: createPlayerBreaths(BASE, 0) };
  const moved = applyWildsInput(start, { type: "move", direction: "east", kaiUPulse: BASE });
  assert.notDeepEqual(moved.player, start.player);
  assert.equal(moved.playerBreaths?.lastKaiUPulse, BASE);
  assert.equal(playerBreathReadout(moved.playerBreaths!).elapsedBreaths, 0);
  assert.ok(Number(body(moved.playerBreaths).effortMicro) > 0);
});
test("failed physical actions and blocked input record no workload", () => {
  const start = { ...initialPlayState, playerBreaths: createPlayerBreaths(BASE, 84) };
  const blocked = applyWildsInput(start, { type: "move-vector", x: 0, z: 0, kaiUPulse: BASE });
  assert.equal(body(blocked.playerBreaths).effortMicro, 0);
  assert.equal(body(blocked.playerBreaths).strainMicroPercent, 0);
});
test("legacy checkpoint migration preserves reserve and does not rewrite the source proof", () => {
  const legacy = { schema: "wildz.player-breaths.v1", clockRooted: true, reserveMicroBreaths: 17491 * 420000, spentMicroBreaths: 0, restoredMicroBreaths: 0, spentTodayMicroBreaths: 0, lastKaiUPulse: BASE, day: 100, mode: "active", timeRemainder: "0" };
  const bytes = JSON.stringify(legacy);
  const restored = restorePlayerBreaths(legacy, BASE, 1);
  assert.equal(playerBreathEnergy(restored), 42);
  const settled = advancePlayerBreaths(restored, BASE);
  assert.equal(settled.schema, "wildz.player-breaths.v2");
  assert.equal(body(settled).fatigueMicroPercent, 0);
  assert.equal(JSON.stringify(legacy), bytes);
});

import { recordPlayerExertion, recoverPlayerBreaths, playerBodyBreathExpansion } from '../src/features/play/player-breath-energy';
import { KAI_PULSE_DURATION_MS, KAI_BREATH_INHALE_SECONDS } from '../src/features/play/kai-klok-moment';
import { createGroundedWildsAerialState, beginWildsAerialTraversal, createWildsAerialRuntimeResult, writeWildsAerialRuntimeStep } from '../src/features/play/wilds-aerial-traversal';

test('work within a pulse aggregates without spending extra clock breaths', () => {
  const start = createPlayerBreaths(BASE, 100), once = recordPlayerExertion(start, 1.2);
  let split = start as ReturnType<typeof recordPlayerExertion>;
  for (let i = 0; i < 12; i++) split = recordPlayerExertion(split, .1);
  assert.deepEqual(split, once);
  assert.equal(playerBreathReadout(once).pulseEffort, 1.2);
  assert.equal(playerBreathReadout(once).elapsedBreaths, 0);
  const next = advancePlayerBreaths(once, (Math.floor(BASE / 1_000_000) + 1) * 1_000_000);
  assert.equal(playerBreathReadout(next).pulseEffort, 0);
  assert.equal(body(next).effortMicro, 1_200_000);
});
test('offline quiet time stores no missing breath log or imaginary physical work', () => {
  const start = createPlayerBreaths(BASE, 100), next = advancePlayerBreaths(start, BASE + 500 * DAY + 20_000_000);
  assert.equal(body(next).effortMicro, 0);
  assert.equal(body(next).effortTodayMicro, 0);
  assert.equal(Object.keys(next).length, Object.keys(start).length);
  assert.ok(playerBreathReadout(next).elapsedBreaths > 0);
});
test('analytical body projection is independent of checkpoint frequency across saturation and days', () => {
  for (const mode of ['active', 'camp', 'bed', 'swim', 'flight', 'glide'] as const) {
    const start = advancePlayerBreaths(recordPlayerExertion(createPlayerBreaths(BASE + DAY - 1_234_567, 45), 37.4), BASE + DAY - 1_234_567, mode);
    const end = start.lastKaiUPulse + 2 * DAY + 543_210;
    let split = start;
    for (let i = 1; i <= 100; i++) split = advancePlayerBreaths(split, start.lastKaiUPulse + Math.floor((end - start.lastKaiUPulse) * i / 100));
    assert.deepEqual(split, advancePlayerBreaths(start, end), mode);
  }
});
test('nourishment restores fuel without erasing strain or sleep debt', () => {
  const tired = advancePlayerBreaths(recordPlayerExertion(createPlayerBreaths(BASE, 30), 50), BASE + Math.floor(DAY / 2));
  const fed = recoverPlayerBreaths(tired, 17491);
  assert.equal(body(fed).fatigueMicroPercent, body(tired).fatigueMicroPercent);
  assert.equal(body(fed).strainMicroPercent, body(tired).strainMicroPercent);
  assert.ok(playerBreathEnergy(fed) < 50);
});
test('ordinary walking remains sustainable while a harder pace builds short-term strain', () => {
  let walking = createPlayerBreaths(BASE, 100) as ReturnType<typeof recordPlayerExertion>, running = walking;
  for (let i = 1; i <= 100; i++) {
    walking = recordPlayerExertion(advancePlayerBreaths(walking, BASE + i * 1_000_000), 10 * .03);
    running = recordPlayerExertion(advancePlayerBreaths(running, BASE + i * 1_000_000), 12.5 * .09);
  }
  assert.ok(playerBreathReadout(walking).strainPercent < 1);
  assert.ok(playerBreathReadout(running).strainPercent > 40);
  assert.ok(playerBreathEnergy(walking) > 90);
  assert.ok(playerBreathEnergy(running) < 60);
});
test('exhaustion eases running into walking and permits directing a creature', () => {
  const start = { ...initialPlayState, energy: 0, playerBreaths: createPlayerBreaths(BASE, 0) };
  const run = applyWildsInput(start, { type: 'move-vector', x: .3, z: .4, mode: 'run', kaiUPulse: BASE });
  const walk = applyWildsInput(start, { type: 'move-vector', x: .3, z: .4, mode: 'walk', kaiUPulse: BASE });
  assert.deepEqual(run.player, walk.player);
  assert.deepEqual(run.playerBreaths, walk.playerBreaths);
  const commanded = applyWildsInput(start, { type: 'record-steward-work', assetId: start.inventory[0].id, kaiUPulse: BASE });
  assert.notEqual(commanded.adventureConditions, start.adventureConditions);
  assert.ok(Number(body(commanded.playerBreaths).effortMicro) > 0);
});
test('the avatar breathes once per Kai pulse with the existing inhale/exhale cadence', () => {
  const pulse = Math.floor(BASE / 1_000_000) * 1_000_000;
  assert.equal(playerBodyBreathExpansion(pulse), 0);
  assert.ok(Math.abs(playerBodyBreathExpansion(pulse, KAI_BREATH_INHALE_SECONDS * 1000) - 1) < 1e-9);
  assert.ok(Math.abs(playerBodyBreathExpansion(pulse, KAI_PULSE_DURATION_MS)) < 1e-9);
});
test('flight endurance cannot recharge beyond the body and exhaustion retains safe fallback', () => {
  const state = createGroundedWildsAerialState({ x: 0, z: 0 }, 0), output = createWildsAerialRuntimeResult();
  const input = { deltaSeconds: .1, groundElevation: 0, hasFlight: true, hasGlide: true, horizontalDistance: 0, positionX: 0, positionZ: 0, verticalOffset: 4, bodyReadiness: 25 };
  writeWildsAerialRuntimeStep(state, input, output);
  assert.equal(state.stamina, 25);
  const flying = beginWildsAerialTraversal(state, { kind: 'flight', capabilities: ['flight', 'glide'] }).state;
  writeWildsAerialRuntimeStep(flying, { ...input, bodyReadiness: 0 }, output);
  assert.equal(flying.mode, 'glide');
  assert.equal(output.reason, 'flight-exhausted');
});

test('a suspended physical scene settles real work then breathes quietly offline', () => {
  const start = { ...initialPlayState, energy: 100, playerBreaths: createPlayerBreaths(BASE, 100) };
  const flying = applyWildsInput(start, { type: 'energy-tick', energyActivity: 'flight', kaiUPulse: BASE });
  const hidden = applyWildsInput(flying, { type: 'energy-tick', energyActivity: 'active', kaiUPulse: BASE + 10_000_000 });
  const work = body(hidden.playerBreaths).effortMicro;
  assert.equal(work, 30_000_000);
  const returned = applyWildsInput(hidden, { type: 'energy-tick', energyActivity: 'flight', kaiUPulse: BASE + DAY });
  assert.equal(body(returned.playerBreaths).effortMicro, work);
  assert.equal(playerBreathReadout(returned.playerBreaths!).elapsedBreaths, 0);
  assert.equal(returned.playerBreaths?.mode, 'flight');
});
