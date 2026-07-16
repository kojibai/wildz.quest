export type WildzFixedStepClock = { accumulatorMs: number; tick: number };
export type WildzFixedStepResult = WildzFixedStepClock & { steps: number; dropped: boolean };

export function runFixedSteps(clock: WildzFixedStepClock, elapsedMs: number, tickRate: number, maxCatchUpSteps = 8): WildzFixedStepResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("Elapsed time must be finite and nonnegative");
  if (!Number.isInteger(tickRate) || tickRate < 1 || tickRate > 240) throw new Error("Tick rate is out of bounds");
  const stepMs = 1_000 / tickRate;
  const available = Math.floor((clock.accumulatorMs + elapsedMs) / stepMs);
  const steps = Math.min(available, maxCatchUpSteps);
  return {
    accumulatorMs: clock.accumulatorMs + elapsedMs - steps * stepMs,
    tick: clock.tick + steps,
    steps,
    dropped: available > maxCatchUpSteps
  };
}
