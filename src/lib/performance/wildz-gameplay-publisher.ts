import { createLatestOnlySaveScheduler } from "../receiz/wildz-save-scheduler";

export type WildzGameplayPublisher<Value> = {
  schedule(value: Value, urgent: boolean): void;
  flush(): Promise<void>;
  cancel(): void;
};

export function createWildzGameplayPublisher<
  Value,
  TimerHandle = ReturnType<typeof setTimeout>
>(options: {
  publish(value: Value): Promise<unknown> | unknown;
  cadenceMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}): WildzGameplayPublisher<Value> {
  const scheduler = createLatestOnlySaveScheduler<Value, TimerHandle>({
    write: options.publish,
    delayMs: options.cadenceMs ?? 140,
    setTimer: options.setTimer,
    clearTimer: options.clearTimer
  });
  return {
    schedule(value, urgent) {
      scheduler.schedule(value);
      if (urgent) void scheduler.flush().catch(() => undefined);
    },
    flush: () => scheduler.flush(),
    cancel: () => scheduler.cancel()
  };
}
