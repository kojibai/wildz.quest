import { KAI_N_DAY_MICRO, KAI_PULSE_DURATION_MS, KAI_BREATH_INHALE_SECONDS } from './kai-klok-moment';

export const PLAYER_BREATHS_PER_DAY = 17491;
// Legacy fixed-point reserve units remain stable for existing checkpoints and food proofs.
export const PLAYER_BREATH_CAPACITY_MICRO = PLAYER_BREATHS_PER_DAY * 1_000_000;
const MICRO = 1_000_000n;
const PERCENT_CAPACITY = 100_000_000;
const DENOMINATOR = KAI_N_DAY_MICRO * 20n;
const MODES = ['active', 'camp', 'bed', 'sleep', 'swim', 'flight', 'glide'] as const;
type BodyMode = typeof MODES[number];
type CommonState = Readonly<{
    clockRooted: boolean;
    reserveMicroBreaths: number;
    spentMicroBreaths: number;
    restoredMicroBreaths: number;
    spentTodayMicroBreaths: number;
    lastKaiUPulse: number;
    day: number;
    mode: BodyMode;
    timeRemainder: string;
}>;
type LegacyPlayerBreaths = CommonState & Readonly<{ schema: 'wildz.player-breaths.v1' }>;
export type PlayerBodyState = CommonState & Readonly<{
    schema: 'wildz.player-breaths.v2';
    strainMicroPercent: number;
    fatigueMicroPercent: number;
    strainRemainder: string;
    fatigueRemainder: string;
    effortMicro: number;
    effortTodayMicro: number;
    effortRemainder: string;
    // Work in the current global Kai pulse, including sub-pulse continuous effort.
    // No breath history is stored: the pulse identity follows lastKaiUPulse.
    pulseEffortNumerator: string;
}>;
export type PlayerBreaths = LegacyPlayerBreaths | PlayerBodyState;
const COMMON_KEYS = ['schema', 'clockRooted', 'reserveMicroBreaths', 'spentMicroBreaths', 'restoredMicroBreaths', 'spentTodayMicroBreaths', 'lastKaiUPulse', 'day', 'mode', 'timeRemainder'];
const BODY_KEYS = ['strainMicroPercent', 'fatigueMicroPercent', 'strainRemainder', 'fatigueRemainder', 'effortMicro', 'effortTodayMicro', 'effortRemainder', 'pulseEffortNumerator'];
const LEGACY_KEY_SET = new Set(COMMON_KEYS);
const BODY_KEY_SET = new Set([...COMMON_KEYS, ...BODY_KEYS]);
const PULSE_EFFORT_CAP = BigInt(Number.MAX_SAFE_INTEGER) * MICRO;
const add = (a: number, b: number) => Math.min(Number.MAX_SAFE_INTEGER, a + b);
function validKai(value: number) { return Number.isSafeInteger(value) && value >= 0; }
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max; }
function remainder(value: unknown, denominator: bigint, signed = true): boolean {
    if (typeof value !== 'string' || !/^-?(0|[1-9][0-9]{0,21})$/.test(value)) return false;
    const parsed = BigInt(value);
    return parsed < denominator && parsed > (signed ? -denominator : -1n);
}
export function isPlayerBreaths(value: unknown): value is PlayerBreaths {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const s = value as PlayerBreaths;
    try {
        if (s.schema !== 'wildz.player-breaths.v1' && s.schema !== 'wildz.player-breaths.v2') return false;
        const allowed = s.schema === 'wildz.player-breaths.v2' ? BODY_KEY_SET : LEGACY_KEY_SET;
        const keys = Object.keys(s);
        if (keys.length !== allowed.size || keys.some(key => !allowed.has(key)) || typeof s.clockRooted !== 'boolean'
            || !integer(s.reserveMicroBreaths, PLAYER_BREATH_CAPACITY_MICRO) || !integer(s.spentMicroBreaths)
            || !integer(s.restoredMicroBreaths) || !integer(s.spentTodayMicroBreaths) || !validKai(s.lastKaiUPulse)
            || s.day !== Number(BigInt(s.lastKaiUPulse) / KAI_N_DAY_MICRO) || !MODES.includes(s.mode)
            || !remainder(s.timeRemainder, DENOMINATOR)) return false;
        return s.schema === 'wildz.player-breaths.v1' || (integer(s.strainMicroPercent, PERCENT_CAPACITY)
            && integer(s.fatigueMicroPercent, PERCENT_CAPACITY) && remainder(s.strainRemainder, MICRO)
            && remainder(s.fatigueRemainder, KAI_N_DAY_MICRO) && integer(s.effortMicro) && integer(s.effortTodayMicro)
            && remainder(s.effortRemainder, MICRO, false) && remainder(s.pulseEffortNumerator, PULSE_EFFORT_CAP + 1n, false));
    } catch { return false; }
}
function upgrade(state: PlayerBreaths): PlayerBodyState {
    if (state.schema === 'wildz.player-breaths.v2') return state;
    return { ...state, schema: 'wildz.player-breaths.v2', strainMicroPercent: 0, fatigueMicroPercent: 0,
        strainRemainder: '0', fatigueRemainder: '0', effortMicro: 0, effortTodayMicro: 0, effortRemainder: '0', pulseEffortNumerator: '0' };
}
export function createPlayerBreaths(kaiUPulse: number, legacyEnergy = 100, clockRooted = true): PlayerBodyState {
    if (!validKai(kaiUPulse)) throw Error('player_breath_time_invalid');
    const percent = Number.isFinite(legacyEnergy) ? Math.max(0, Math.min(100, legacyEnergy)) : 84;
    return upgrade({ schema: 'wildz.player-breaths.v1', clockRooted, reserveMicroBreaths: Math.round(PLAYER_BREATH_CAPACITY_MICRO * percent / 100),
        spentMicroBreaths: 0, restoredMicroBreaths: 0, spentTodayMicroBreaths: 0, lastKaiUPulse: kaiUPulse,
        day: Number(BigInt(kaiUPulse) / KAI_N_DAY_MICRO), mode: 'active', timeRemainder: '0' });
}
export function restorePlayerBreaths(value: unknown, kaiUPulse: number, legacyEnergy = 84): PlayerBreaths {
    // Keep admitted legacy bytes intact. The next body transition creates a new v2 checkpoint.
    return isPlayerBreaths(value) ? value : createPlayerBreaths(kaiUPulse, legacyEnergy);
}
function integrate(value: number, carry: string, elapsed: bigint, rate: bigint, denominator: bigint, capacity: number) {
    const numerator = elapsed * rate + BigInt(carry), raw = BigInt(value) + numerator / denominator;
    const cap = BigInt(capacity), next = Number(raw < 0n ? 0n : raw > cap ? cap : raw);
    const saturated = raw < 0n || raw > cap || (raw === 0n && numerator < 0n) || (raw === cap && numerator > 0n);
    return { value: next, carry: saturated ? '0' : String(numerator % denominator), difference: next - value };
}
function effortRate(mode: BodyMode): bigint { return mode === 'swim' ? 2_000_000n : mode === 'flight' ? 3_000_000n : mode === 'glide' ? 500_000n : 0n; }
export function advancePlayerBreaths(source: PlayerBreaths, kaiUPulse: number, mode: BodyMode = source.mode, clockRooted = true): PlayerBreaths {
    if (!isPlayerBreaths(source)) throw Error('player_breath_state_invalid');
    return advanceValidatedPlayerBreaths(source, kaiUPulse, mode, clockRooted);
}
// Internal callers already validate or create their source in this operation.
// Mutable checkpoints are still checked afresh at every public boundary.
function advanceValidatedPlayerBreaths(source: PlayerBreaths, kaiUPulse: number, mode: BodyMode = source.mode, clockRooted = true): PlayerBreaths {
    if (!validKai(kaiUPulse) || !MODES.includes(mode)) throw Error('player_breath_state_invalid');
    if (kaiUPulse < source.lastKaiUPulse) return source;
    const state = upgrade(source), day = Number(BigInt(kaiUPulse) / KAI_N_DAY_MICRO);
    if (!state.clockRooted && clockRooted) return { ...state, clockRooted: true, lastKaiUPulse: kaiUPulse, day,
        spentTodayMicroBreaths: day === state.day ? state.spentTodayMicroBreaths : 0, effortTodayMicro: day === state.day ? state.effortTodayMicro : 0,
        pulseEffortNumerator: '0', mode, timeRemainder: '0', strainRemainder: '0', fatigueRemainder: '0', effortRemainder: '0' };
    if (kaiUPulse === state.lastKaiUPulse && mode === state.mode) return state;
    // Rates describe the previous interval; switching activity never rewrites its history.
    const load = effortRate(state.mode);
    const reserveRate = state.mode === 'bed' ? 240n : state.mode === 'sleep' ? 200n : state.mode === 'camp' ? 160n : state.mode === 'swim' ? -61n : state.mode === 'flight' ? -101n : state.mode === 'glide' ? -11n : -1n;
    const strainRate = state.mode === 'bed' ? -1_500_000n : state.mode === 'sleep' ? -1_250_000n : state.mode === 'camp' ? -1_000_000n : load * 3n / 4n - 350_000n;
    const fatigueRate = state.mode === 'bed' ? -300_000_000n : state.mode === 'sleep' ? -180_000_000n : state.mode === 'camp' ? 60_000_000n : 120_000_000n + load * KAI_N_DAY_MICRO / (MICRO * 500n);
    let reserve = state.reserveMicroBreaths, timeCarry = state.timeRemainder, spent = state.spentMicroBreaths,
        restored = state.restoredMicroBreaths, today = state.spentTodayMicroBreaths, strain = state.strainMicroPercent,
        strainCarry = state.strainRemainder, fatigue = state.fatigueMicroPercent, fatigueCarry = state.fatigueRemainder,
        effort = state.effortMicro, effortToday = state.effortTodayMicro, effortCarry = state.effortRemainder;
    const apply = (elapsed: bigint, countToday: boolean) => {
        const energy = integrate(reserve, timeCarry, elapsed, BigInt(PLAYER_BREATH_CAPACITY_MICRO) * reserveRate, DENOMINATOR, PLAYER_BREATH_CAPACITY_MICRO);
        const drain = Math.max(0, -energy.difference);
        reserve = energy.value; timeCarry = energy.carry; spent = add(spent, drain); restored = add(restored, Math.max(0, energy.difference));
        if (countToday) today = add(today, drain);
        const immediate = integrate(strain, strainCarry, elapsed, strainRate, MICRO, PERCENT_CAPACITY);
        strain = immediate.value; strainCarry = immediate.carry;
        const deep = integrate(fatigue, fatigueCarry, elapsed, fatigueRate, KAI_N_DAY_MICRO, PERCENT_CAPACITY);
        fatigue = deep.value; fatigueCarry = deep.carry;
        const work = elapsed * load + BigInt(effortCarry), amount = Number(work / MICRO > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : work / MICRO);
        effort = add(effort, amount); if (countToday) effortToday = add(effortToday, amount); effortCarry = String(work % MICRO);
    };
    if (day !== state.day) {
        const boundary = BigInt(day) * KAI_N_DAY_MICRO;
        apply(boundary - BigInt(state.lastKaiUPulse), false); today = 0; effortToday = 0;
        apply(BigInt(kaiUPulse) - boundary, true);
    } else apply(BigInt(kaiUPulse - state.lastKaiUPulse), true);
    const elapsed = BigInt(kaiUPulse - state.lastKaiUPulse), samePulse = Math.floor(kaiUPulse / 1_000_000) === Math.floor(state.lastKaiUPulse / 1_000_000);
    const pulseWork = samePulse ? BigInt(state.pulseEffortNumerator) + elapsed * load : BigInt(kaiUPulse % 1_000_000) * load;
    return { ...state, reserveMicroBreaths: reserve, spentMicroBreaths: spent, restoredMicroBreaths: restored, spentTodayMicroBreaths: today,
        strainMicroPercent: strain, fatigueMicroPercent: fatigue, strainRemainder: strainCarry, fatigueRemainder: fatigueCarry,
        effortMicro: effort, effortTodayMicro: effortToday, effortRemainder: effortCarry, pulseEffortNumerator: String(pulseWork > PULSE_EFFORT_CAP ? PULSE_EFFORT_CAP : pulseWork),
        lastKaiUPulse: kaiUPulse, day, mode, timeRemainder: timeCarry };
}
/** Legacy reserve debit, retained for checkpoint compatibility. It never advances clock breaths. */
export function spendPlayerBreaths(state: PlayerBreaths, reserveUnits: number): PlayerBreaths {
    if (!isPlayerBreaths(state) || !Number.isFinite(reserveUnits) || reserveUnits < 0 || reserveUnits > 1_000_000) throw Error('player_breath_cost_invalid');
    const cost = Math.min(state.reserveMicroBreaths, Math.round(reserveUnits * 1_000_000));
    if (!cost) return state;
    return { ...state, reserveMicroBreaths: state.reserveMicroBreaths - cost, spentMicroBreaths: add(state.spentMicroBreaths, cost),
        spentTodayMicroBreaths: add(state.spentTodayMicroBreaths, cost), mode: state.mode === 'camp' || state.mode === 'bed' || state.mode === 'sleep' ? 'active' : state.mode };
}
/** Actual successful work, in effort units, inside the current breath. Works even at zero reserve. */
export function recordPlayerExertion(source: PlayerBreaths, effort: number, wakesBody = true): PlayerBreaths {
    if (!isPlayerBreaths(source) || !Number.isFinite(effort) || effort < 0 || effort > 1_000_000) throw Error('player_exertion_invalid');
    if (!effort) return source;
    const state = upgrade(source), micro = Math.round(effort * 1_000_000);
    const fuel = integrate(state.reserveMicroBreaths, state.timeRemainder, BigInt(micro), -(DENOMINATOR * BigInt(PLAYER_BREATH_CAPACITY_MICRO) / 2_000_000_000n), DENOMINATOR, PLAYER_BREATH_CAPACITY_MICRO);
    const cost = Math.max(0, -fuel.difference);
    const immediate = integrate(state.strainMicroPercent, state.strainRemainder, BigInt(micro), 750_000n, MICRO, PERCENT_CAPACITY);
    const deep = integrate(state.fatigueMicroPercent, state.fatigueRemainder, BigInt(micro), KAI_N_DAY_MICRO / 500n, KAI_N_DAY_MICRO, PERCENT_CAPACITY);
    const pulse = BigInt(state.pulseEffortNumerator) + BigInt(micro) * MICRO, cap = PULSE_EFFORT_CAP;
    return { ...state, reserveMicroBreaths: fuel.value, timeRemainder: fuel.carry, spentMicroBreaths: add(state.spentMicroBreaths, cost),
        spentTodayMicroBreaths: add(state.spentTodayMicroBreaths, cost), effortMicro: add(state.effortMicro, micro), effortTodayMicro: add(state.effortTodayMicro, micro),
        strainMicroPercent: immediate.value, fatigueMicroPercent: deep.value, strainRemainder: immediate.carry,
        fatigueRemainder: deep.carry, pulseEffortNumerator: String(pulse > cap ? cap : pulse),
        mode: wakesBody && (state.mode === 'bed' || state.mode === 'camp' || state.mode === 'sleep') ? 'active' : state.mode };
}
export function playerBreathEnergy(source: PlayerBreaths) {
    const state = upgrade(source);
    return Math.max(0, Math.min(state.reserveMicroBreaths / PLAYER_BREATH_CAPACITY_MICRO * 100, 100 - state.strainMicroPercent / 1_000_000, 100 - .9 * state.fatigueMicroPercent / 1_000_000));
}
export function playerBodyCondition(state: PlayerBreaths): 'ready' | 'tired' | 'low' | 'exhausted' {
    return conditionForEnergy(playerBreathEnergy(state));
}
function conditionForEnergy(energy: number): 'ready' | 'tired' | 'low' | 'exhausted' {
    return energy <= 10 ? 'exhausted' : energy < 20 ? 'low' : energy < 60 ? 'tired' : 'ready';
}
export function playerBreathReadout(source: PlayerBreaths, kaiUPulse = source.lastKaiUPulse) {
    if (!validKai(kaiUPulse)) throw Error('player_breath_time_invalid');
    const state = upgrade(advancePlayerBreaths(source, kaiUPulse)), kai = BigInt(kaiUPulse), day = kai / KAI_N_DAY_MICRO, start = day * KAI_N_DAY_MICRO;
    // Count actual global pulse boundaries. The precise Kai day has a fractional pulse,
    // so its integer boundary count can be 17,491 or 17,492; never alter the klok to hide it.
    const elapsed = Number(kai / MICRO - start / MICRO), cycle = Number(((start + KAI_N_DAY_MICRO - 1n) / MICRO) - start / MICRO);
    const energyPercent = playerBreathEnergy(state);
    return { breathsPerDay: PLAYER_BREATHS_PER_DAY, cycleBreaths: cycle, elapsedBreaths: elapsed, remainingDayBreaths: cycle - elapsed,
        pulseNumber: Number(kai / MICRO), pulseFractionMicro: Number(kai % MICRO), pulseEffort: Number(BigInt(state.pulseEffortNumerator) / MICRO) / 1_000_000,
        effortToday: state.effortTodayMicro / 1_000_000, strainPercent: state.strainMicroPercent / 1_000_000, fatiguePercent: state.fatigueMicroPercent / 1_000_000,
        fuelPercent: state.reserveMicroBreaths / PLAYER_BREATH_CAPACITY_MICRO * 100,
        energyPercent, condition: conditionForEnergy(energyPercent), day: Number(day), mode: state.mode };
}
/** An admitted nourishment consequence restores fuel; it cannot erase strain or missed sleep. */
export function recoverPlayerBreaths(state: PlayerBreaths, reserveUnits: number): PlayerBreaths {
    if (!isPlayerBreaths(state) || !Number.isFinite(reserveUnits) || reserveUnits < 0 || reserveUnits > 1_000_000) throw Error('player_breath_recovery_invalid');
    const amount = Math.min(PLAYER_BREATH_CAPACITY_MICRO - state.reserveMicroBreaths, Math.round(reserveUnits * 1_000_000));
    if (!amount) return state;
    return { ...state, reserveMicroBreaths: state.reserveMicroBreaths + amount, restoredMicroBreaths: add(state.restoredMicroBreaths, amount) };
}
/** Read-only projection; clock display changes never publish the durable checkpoint. */
export function projectPlayerBreathState(state: { energy: number; playerBreaths?: PlayerBreaths }, kaiUPulse: number): { energy: number; playerBreaths: PlayerBreaths } {
    const source = isPlayerBreaths(state.playerBreaths) ? state.playerBreaths : createPlayerBreaths(kaiUPulse, state.energy);
    const playerBreaths = advanceValidatedPlayerBreaths(source, kaiUPulse);
    return { energy: playerBreathEnergy(playerBreaths), playerBreaths };
}

/** One inhale/exhale per exact Kai pulse; rendering interpolates from the observed clock. */
export function playerBodyBreathExpansion(kaiUPulse: number, millisecondsSinceObservation = 0): number {
    if (!validKai(kaiUPulse) || !Number.isFinite(millisecondsSinceObservation) || millisecondsSinceObservation < 0) throw Error('player_breath_time_invalid');
    const phase = ((kaiUPulse % 1_000_000) / 1_000_000 + millisecondsSinceObservation / KAI_PULSE_DURATION_MS) % 1;
    const inhale = KAI_BREATH_INHALE_SECONDS * 1000 / KAI_PULSE_DURATION_MS;
    return phase < inhale ? (1 - Math.cos(Math.PI * phase / inhale)) / 2 : (1 + Math.cos(Math.PI * (phase - inhale) / (1 - inhale))) / 2;
}
