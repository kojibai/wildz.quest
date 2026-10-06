import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KAI_N_DAY_MICRO } from '../src/features/play/kai-klok-moment';
import { createPlayerBreaths, advancePlayerBreaths, spendPlayerBreaths, playerBreathEnergy, playerBreathReadout, restorePlayerBreaths } from '../src/features/play/player-breath-energy';
import { applyWildsInput, initialPlayState, serializePlayState, restorePlayState } from '../src/features/play/game-state';
const DAY = Number(KAI_N_DAY_MICRO), BASE = DAY * 100;
test('17491 breath allocation follows the exact existing Kai day without clock drift', () => { const s = createPlayerBreaths(BASE, 100); assert.equal(playerBreathReadout(s, BASE).breathsPerDay, 17491); assert.equal(playerBreathReadout(s, BASE + DAY - 1).elapsedBreaths, 17490); assert.equal(playerBreathReadout(s, BASE + DAY).elapsedBreaths, 0); assert.equal(playerBreathReadout(s, BASE + DAY).day, 101); });
test('split clock advancement conserves fractional recovery and never multiplies it', () => { let split = spendPlayerBreaths(createPlayerBreaths(BASE, 100), 1000); split = advancePlayerBreaths(split, BASE, 'camp'); const start = split, end = BASE + 1000000; for (let i = 1; i <= 100; i++)
    split = advancePlayerBreaths(split, BASE + i * 10000); const once = advancePlayerBreaths(start, end); assert.deepEqual(split, once); assert.ok(split.reserveMicroBreaths > start.reserveMicroBreaths); });
test('rest clicks grant no immediate energy and repeated ticks at the same pulse are inert', () => { const s = createPlayerBreaths(BASE, 20), rest = advancePlayerBreaths(s, BASE, 'camp'); assert.equal(playerBreathEnergy(rest), 20); assert.deepEqual(advancePlayerBreaths(rest, BASE, 'camp'), rest); assert.deepEqual(advancePlayerBreaths(rest, BASE - 1), rest); });
test('active offline time drains only analytical metabolism and rest is bounded by capacity', () => { const s = createPlayerBreaths(BASE, 100), idle = advancePlayerBreaths(s, BASE + DAY); assert.equal(playerBreathEnergy(idle), 95); const resting = advancePlayerBreaths(createPlayerBreaths(BASE, 20), BASE, 'bed'); assert.equal(playerBreathEnergy(advancePlayerBreaths(resting, BASE + DAY * 1000)), 100); });
test('actual walking distance costs the same across input rates and blocked input costs nothing', () => { const a = spendPlayerBreaths(createPlayerBreaths(BASE, 100), 10), b = Array.from({ length: 20 }).reduce<ReturnType<typeof createPlayerBreaths>>(s => spendPlayerBreaths(s, .5), createPlayerBreaths(BASE, 100)); assert.equal(a.reserveMicroBreaths, b.reserveMicroBreaths); const state = { ...initialPlayState, playerBreaths: createPlayerBreaths(BASE, 84) }; const blocked = applyWildsInput(state, { type: 'move-vector', x: 0, z: 0, kaiUPulse: BASE }); assert.equal(blocked.energy, 84); assert.equal(blocked.playerBreaths!.spentMicroBreaths, 0); });
test('gameplay movement replaces one-energy-per-input and the reserve persists through save restoration', () => { const s = { ...initialPlayState, playerBreaths: createPlayerBreaths(BASE, 84) }, next = applyWildsInput(s, { type: 'move', direction: 'east', kaiUPulse: BASE }); assert.ok(next.energy > 83.9 && next.energy < 84); assert.ok(next.playerBreaths!.spentMicroBreaths > 0); const restored = restorePlayState(serializePlayState(next)); assert.equal(restored.playerBreaths!.reserveMicroBreaths, next.playerBreaths!.reserveMicroBreaths); });
test('camp cannot repeatedly heal or refill the player at one pulse', () => { const start = { ...initialPlayState, energy: 20, playerBreaths: createPlayerBreaths(BASE, 20) }; const once = applyWildsInput(start, { type: 'rest', kaiUPulse: BASE }), twice = applyWildsInput(once, { type: 'rest', kaiUPulse: BASE }); assert.equal(once.energy, 20); assert.equal(twice.energy, 20); assert.equal(once.inventory, start.inventory); assert.equal(twice.inventory, start.inventory); const recovered = applyWildsInput(twice, { type: 'energy-tick', kaiUPulse: BASE + 100000000 }); assert.ok(recovered.energy > 20); assert.equal(recovered.actionHistory.length, twice.actionHistory.length); });
test('save migration preserves legacy energy and rejects invalid breath state', () => { const migrated = restorePlayerBreaths(undefined, BASE, 42); assert.equal(playerBreathEnergy(migrated), 42); const altered = restorePlayerBreaths({ ...migrated, reserveMicroBreaths: Infinity }, BASE, 42); assert.equal(playerBreathEnergy(altered), 42); assert.equal(restorePlayerBreaths(migrated, BASE, 1), migrated); });
test('untimed legacy housekeeping cannot charge time from Kai genesis on its first clock observation', () => { const housekeeping = applyWildsInput(initialPlayState, { type: 'dismiss-reveal' }); const rooted = applyWildsInput(housekeeping, { type: 'energy-tick', kaiUPulse: BASE }); assert.equal(rooted.energy, initialPlayState.energy); assert.equal(rooted.playerBreaths!.lastKaiUPulse, BASE); });
test('a nearly empty reserve cannot pay for a full movement step', () => { const start = { ...initialPlayState, energy: .000001, playerBreaths: createPlayerBreaths(BASE, .000001) }; const moved = applyWildsInput(start, { type: 'move', direction: 'east', kaiUPulse: BASE }); assert.deepEqual(moved.player, start.player); assert.equal(moved.playerBreaths!.reserveMicroBreaths, start.playerBreaths.reserveMicroBreaths); });
test('sustained swimming and flight spend real elapsed Kai breaths independently of frame frequency', () => { const start = createPlayerBreaths(BASE, 100); const swim = advancePlayerBreaths(start, BASE, 'swim'); const once = advancePlayerBreaths(swim, BASE + Math.floor(DAY / 10)); let split = swim; for (let i = 1; i <= 100; i++)
    split = advancePlayerBreaths(split, BASE + Math.floor(DAY * i / 1000)); assert.deepEqual(split, once); assert.ok(playerBreathEnergy(once) < 71); assert.ok(playerBreathEnergy(once) > 69); const flight = advancePlayerBreaths(advancePlayerBreaths(start, BASE, 'flight'), BASE + Math.floor(DAY / 10)); assert.ok(playerBreathEnergy(flight) > playerBreathEnergy(once)); assert.equal(spendPlayerBreaths(flight, 1).mode, 'flight'); });
test('an unsuccessful capture cannot spend an action breath budget', () => { const state = { ...initialPlayState, player: { x: 100000, z: 100000 }, playerBreaths: createPlayerBreaths(BASE, 84) }; const next = applyWildsInput(state, { type: 'capture', encounterId: 'missing', capturedAt: '2026-10-05T00:00:00.000Z', ownerReceizId: 'owner', kaiUPulse: BASE }); assert.equal(next.playerBreaths!.reserveMicroBreaths, state.playerBreaths.reserveMicroBreaths); assert.equal(next.inventory, state.inventory); });
test('camp does not refill while the player is swimming or airborne', () => { const state = { ...initialPlayState, playerBreaths: createPlayerBreaths(BASE, 20), energy: 20 }; for (const activity of ['swim', 'flight'] as const) {
    const next = applyWildsInput(state, { type: 'rest', energyActivity: activity, kaiUPulse: BASE });
    assert.equal(next.playerBreaths!.mode, 'active');
    assert.equal(next.energy, 20);
} });
test('replaying a field effect cannot award experience or charge breaths again', () => { const asset = initialPlayState.inventory[0], request = { type: 'use-field-ability' as const, assetId: asset.id, abilityIndex: 0, usedAt: '2026-10-05T00:00:00.000Z', kaiUPulse: BASE }; const first = applyWildsInput({ ...initialPlayState, playerBreaths: createPlayerBreaths(BASE, 84) }, request), second = applyWildsInput(first, request); assert.equal(second, first); assert.equal(second.playerBreaths!.reserveMicroBreaths, first.playerBreaths!.reserveMicroBreaths); });
test('rollover at the exact Kai day boundary attributes no previous-day drain to today', () => {
    for (const mode of ['active', 'swim', 'flight', 'glide'] as const) {
        const start = advancePlayerBreaths(createPlayerBreaths(BASE, 100), BASE, mode);
        const next = advancePlayerBreaths(start, BASE + DAY);
        assert.ok(next.spentMicroBreaths > 0);
        assert.equal(next.spentTodayMicroBreaths, 0, mode);
    }
});
test('a rollover tick counts only the current day portion while preserving exact fractional spending', () => {
    for (const mode of ['active', 'swim', 'flight', 'glide'] as const) {
        const kai = BASE + DAY - 1000001, start = advancePlayerBreaths(createPlayerBreaths(kai, 100), kai, mode);
        const boundary = advancePlayerBreaths(start, BASE + DAY), end = BASE + DAY + 123456789, once = advancePlayerBreaths(start, end);
        assert.equal(once.spentTodayMicroBreaths, boundary.reserveMicroBreaths - once.reserveMicroBreaths, mode);
        const split = advancePlayerBreaths(boundary, end);
        assert.deepEqual(once, split, mode);
    }
});
test('multi-day offline drain exhausted before today contributes zero to today', () => {
    for (const mode of ['active', 'swim', 'flight', 'glide'] as const) {
        const start = advancePlayerBreaths(createPlayerBreaths(BASE, 100), BASE, mode);
        const end = BASE + DAY * 1000 + Math.floor(DAY / 2), next = advancePlayerBreaths(start, end);
        assert.equal(next.reserveMicroBreaths, 0);
        assert.equal(next.spentTodayMicroBreaths, 0, mode);
        assert.equal(next.spentMicroBreaths, 17491 * 1000000);
    }
});
test('a reserve exhausted during today counts only the finite reserve present at rollover', () => {
    const kai = BASE + DAY - 10000000;
    const start = advancePlayerBreaths(createPlayerBreaths(kai, 10), kai, 'swim');
    const boundary = advancePlayerBreaths(start, BASE + DAY), end = advancePlayerBreaths(start, BASE + DAY + Math.floor(DAY / 2));
    assert.equal(end.reserveMicroBreaths, 0);
    assert.equal(end.spentTodayMicroBreaths, boundary.reserveMicroBreaths);
});
test('rest recovery clears the old day counter without recording recovery as spending', () => {
    for (const mode of ['camp', 'bed'] as const) {
        const kai = BASE + DAY - 1000000, start = advancePlayerBreaths(spendPlayerBreaths(createPlayerBreaths(kai, 50), 7), kai, mode);
        const end = advancePlayerBreaths(start, BASE + DAY + 1000000);
        assert.equal(end.spentTodayMicroBreaths, 0);
        assert.ok(end.restoredMicroBreaths > start.restoredMicroBreaths);
    }
});
