import { KAI_N_DAY_MICRO } from './kai-klok-moment';
export const PLAYER_BREATHS_PER_DAY = 17491;
export const PLAYER_BREATH_CAPACITY_MICRO = PLAYER_BREATHS_PER_DAY * 1000000;
const DENOMINATOR = KAI_N_DAY_MICRO * 20n;
export type PlayerBreaths = Readonly<{
    schema: 'wildz.player-breaths.v1';
    clockRooted: boolean;
    reserveMicroBreaths: number;
    spentMicroBreaths: number;
    restoredMicroBreaths: number;
    spentTodayMicroBreaths: number;
    lastKaiUPulse: number;
    day: number;
    mode: 'active' | 'camp' | 'bed' | 'swim' | 'flight' | 'glide';
    timeRemainder: string;
}>;
function validKai(value: number) { return Number.isSafeInteger(value) && value >= 0; }
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max; }
export function isPlayerBreaths(value: unknown): value is PlayerBreaths { if (!value || typeof value !== 'object' || Array.isArray(value))
    return false; const s = value as PlayerBreaths; try {
    return s.schema === 'wildz.player-breaths.v1' && typeof s.clockRooted === 'boolean' && Object.keys(s).sort().join(',') === 'clockRooted,day,lastKaiUPulse,mode,reserveMicroBreaths,restoredMicroBreaths,schema,spentMicroBreaths,spentTodayMicroBreaths,timeRemainder' && integer(s.reserveMicroBreaths, PLAYER_BREATH_CAPACITY_MICRO) && integer(s.spentMicroBreaths) && integer(s.restoredMicroBreaths) && integer(s.spentTodayMicroBreaths) && validKai(s.lastKaiUPulse) && s.day === Number(BigInt(s.lastKaiUPulse) / KAI_N_DAY_MICRO) && ['active', 'camp', 'bed', 'swim', 'flight', 'glide'].includes(s.mode) && typeof s.timeRemainder === 'string' && /^-?(0|[1-9][0-9]{0,12})$/.test(s.timeRemainder) && BigInt(s.timeRemainder) > -DENOMINATOR && BigInt(s.timeRemainder) < DENOMINATOR;
}
catch {
    return false;
} }
export function createPlayerBreaths(kaiUPulse: number, legacyEnergy = 100, clockRooted = true): PlayerBreaths { if (!validKai(kaiUPulse))
    throw Error('player_breath_time_invalid'); const percent = Number.isFinite(legacyEnergy) ? Math.max(0, Math.min(100, legacyEnergy)) : 84; return { schema: 'wildz.player-breaths.v1', clockRooted, reserveMicroBreaths: Math.round(PLAYER_BREATH_CAPACITY_MICRO * percent / 100), spentMicroBreaths: 0, restoredMicroBreaths: 0, spentTodayMicroBreaths: 0, lastKaiUPulse: kaiUPulse, day: Number(BigInt(kaiUPulse) / KAI_N_DAY_MICRO), mode: 'active', timeRemainder: '0' }; }
export function restorePlayerBreaths(value: unknown, kaiUPulse: number, legacyEnergy = 84): PlayerBreaths { return isPlayerBreaths(value) ? value : createPlayerBreaths(kaiUPulse, legacyEnergy); }
export function advancePlayerBreaths(state: PlayerBreaths, kaiUPulse: number, mode: PlayerBreaths['mode'] = state.mode, clockRooted = true): PlayerBreaths {
    if (!isPlayerBreaths(state) || !validKai(kaiUPulse) || !['active', 'camp', 'bed', 'swim', 'flight', 'glide'].includes(mode))
        throw Error('player_breath_state_invalid');
    const day = Number(BigInt(kaiUPulse) / KAI_N_DAY_MICRO);
    if (!state.clockRooted && clockRooted)
        return { ...state, clockRooted: true, lastKaiUPulse: kaiUPulse, day, spentTodayMicroBreaths: day === state.day ? state.spentTodayMicroBreaths : 0, mode, timeRemainder: '0' };
    if (kaiUPulse < state.lastKaiUPulse)
        return state;
    if (kaiUPulse === state.lastKaiUPulse && mode === state.mode)
        return state;
    // Fixed denominator and fractional carry survive both day boundaries and activity changes.
    const rate = state.mode === 'bed' ? 240n : state.mode === 'camp' ? 160n : state.mode === 'swim' ? -60n : state.mode === 'flight' ? -20n : state.mode === 'glide' ? -8n : -1n;
    const capacity = BigInt(PLAYER_BREATH_CAPACITY_MICRO);
    const interval = (reserve: number, remainder: string, elapsed: bigint) => {
        const numerator = elapsed * capacity * rate + BigInt(remainder), remaining = BigInt(reserve) + numerator / DENOMINATOR;
        const next = Number(remaining < 0n ? 0n : remaining > capacity ? capacity : remaining);
        return { reserve: next, difference: next - reserve, remainder: remaining < 0n || remaining > capacity ? '0' : String(numerator % DENOMINATOR) };
    };
    let reserve = state.reserveMicroBreaths, remainder = state.timeRemainder, spent = 0, restored = 0, today = state.spentTodayMicroBreaths;
    const add = (a: number, b: number) => Math.min(Number.MAX_SAFE_INTEGER, a + b);
    const apply = (elapsed: bigint, countToday: boolean) => {
        const next = interval(reserve, remainder, elapsed);
        const drain = Math.max(0, -next.difference);
        spent = add(spent, drain);
        restored = add(restored, Math.max(0, next.difference));
        if (countToday)
            today = add(today, drain);
        reserve = next.reserve;
        remainder = next.remainder;
    };
    if (day !== state.day) {
        // All earlier days form one analytical prefix. Only the final day's suffix is today's usage.
        const boundary = BigInt(day) * KAI_N_DAY_MICRO;
        apply(boundary - BigInt(state.lastKaiUPulse), false);
        today = 0;
        apply(BigInt(kaiUPulse) - boundary, true);
    }
    else
        apply(BigInt(kaiUPulse - state.lastKaiUPulse), true);
    return { ...state, reserveMicroBreaths: reserve, spentMicroBreaths: add(state.spentMicroBreaths, spent), restoredMicroBreaths: add(state.restoredMicroBreaths, restored), spentTodayMicroBreaths: today, lastKaiUPulse: kaiUPulse, day, mode, timeRemainder: remainder };
}
export function spendPlayerBreaths(state: PlayerBreaths, breaths: number): PlayerBreaths { if (!isPlayerBreaths(state) || !Number.isFinite(breaths) || breaths < 0 || breaths > 1000000)
    throw Error('player_breath_cost_invalid'); const cost = Math.min(state.reserveMicroBreaths, Math.round(breaths * 1000000)); if (cost === 0)
    return state; return { ...state, reserveMicroBreaths: state.reserveMicroBreaths - cost, spentMicroBreaths: Math.min(Number.MAX_SAFE_INTEGER, state.spentMicroBreaths + cost), spentTodayMicroBreaths: Math.min(Number.MAX_SAFE_INTEGER, state.spentTodayMicroBreaths + cost), mode: state.mode === 'camp' || state.mode === 'bed' ? 'active' : state.mode }; }
export function playerBreathEnergy(state: PlayerBreaths) { return state.reserveMicroBreaths / PLAYER_BREATH_CAPACITY_MICRO * 100; }
export function playerBreathReadout(state: PlayerBreaths, kaiUPulse = state.lastKaiUPulse) { if (!validKai(kaiUPulse))
    throw Error('player_breath_time_invalid'); const kai = BigInt(kaiUPulse), elapsed = Number(kai % KAI_N_DAY_MICRO * BigInt(PLAYER_BREATHS_PER_DAY) / KAI_N_DAY_MICRO); return { breathsPerDay: PLAYER_BREATHS_PER_DAY, elapsedBreaths: elapsed, remainingDayBreaths: PLAYER_BREATHS_PER_DAY - elapsed, reserveBreaths: Math.floor(state.reserveMicroBreaths / 1000000), spentTodayBreaths: Math.floor(state.spentTodayMicroBreaths / 1000000), energyPercent: playerBreathEnergy(state), day: Number(kai / KAI_N_DAY_MICRO), mode: state.mode }; }
/** A bounded recovery amount; only an admitted gameplay consequence may adopt the resulting state. */
export function recoverPlayerBreaths(state: PlayerBreaths, breaths: number): PlayerBreaths {
    if (!isPlayerBreaths(state) || !Number.isFinite(breaths) || breaths < 0 || breaths > 1000000)
        throw Error('player_breath_recovery_invalid');
    const amount = Math.min(PLAYER_BREATH_CAPACITY_MICRO - state.reserveMicroBreaths, Math.round(breaths * 1000000));
    if (!amount)
        return state;
    return { ...state, reserveMicroBreaths: state.reserveMicroBreaths + amount, restoredMicroBreaths: Math.min(Number.MAX_SAFE_INTEGER, state.restoredMicroBreaths + amount) };
}

/** Read-only clock projection. Only meaningful gameplay/lifecycle events adopt elapsed energy. */
export function projectPlayerBreathState(state:{energy:number;playerBreaths?:PlayerBreaths},kaiUPulse:number):{energy:number;playerBreaths:PlayerBreaths}{
 const source=isPlayerBreaths(state.playerBreaths)?state.playerBreaths:createPlayerBreaths(kaiUPulse,state.energy);
 const playerBreaths=advancePlayerBreaths(source,kaiUPulse);
 return {energy:playerBreathEnergy(playerBreaths),playerBreaths};
}
