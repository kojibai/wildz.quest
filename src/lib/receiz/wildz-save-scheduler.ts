export type WildzLatestSaveScheduler<Value> = {
  schedule(value: Value): void;
  flush(): Promise<void>;
  cancel(): void;
  hasPending(): boolean;
};

export function createLatestOnlySaveScheduler<
  Value,
  TimerHandle = ReturnType<typeof setTimeout>
>(options: {
  write(value: Value): Promise<unknown> | unknown;
  delayMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}): WildzLatestSaveScheduler<Value> {
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? 400));
  const setTimer = options.setTimer ?? ((callback: () => void, delay: number) => setTimeout(callback, delay) as TimerHandle);
  const clearTimer = options.clearTimer ?? ((handle: TimerHandle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let latest: Value | undefined;
  let hasLatest = false;
  let timer: TimerHandle | undefined;
  let inFlight: Promise<void> | null = null;
  let cancelled = false;

  const clearScheduled = () => {
    if (timer === undefined) return;
    clearTimer(timer);
    timer = undefined;
  };

  const arm = () => {
    clearScheduled();
    timer = setTimer(() => {
      timer = undefined;
      if (inFlight) return;
      void writeLatest().catch(() => undefined);
    }, delayMs);
  };

  const writeLatest = async (): Promise<void> => {
    if (inFlight || !hasLatest || cancelled) return;
    const value = latest as Value;
    latest = undefined;
    hasLatest = false;
    const activeWrite = Promise.resolve().then(() => options.write(value)).then(() => undefined);
    inFlight = activeWrite;
    try {
      await activeWrite;
    } catch (error) {
      if (!hasLatest && !cancelled) {
        latest = value;
        hasLatest = true;
      }
      throw error;
    } finally {
      if (inFlight === activeWrite) inFlight = null;
      if (hasLatest && timer === undefined && !cancelled) arm();
    }
  };

  return {
    schedule(value) {
      if (cancelled) return;
      latest = value;
      hasLatest = true;
      arm();
    },
    async flush() {
      clearScheduled();
      while (inFlight || hasLatest) {
        if (inFlight) await inFlight;
        clearScheduled();
        if (hasLatest) await writeLatest();
      }
    },
    cancel() {
      cancelled = true;
      clearScheduled();
      latest = undefined;
      hasLatest = false;
    },
    hasPending() {
      return hasLatest || inFlight !== null;
    }
  };
}
