import { createLatestOnlySaveScheduler } from "./wildz-save-scheduler";

export type WildzPlayStatePersistenceCoordinator<Value> = {
  schedule(value: Value, vaultChanged: boolean): void;
  flush(): Promise<void>;
  cancel(): void;
};

export function createWildzPlayStatePersistenceCoordinator<
  Value,
  TimerHandle = ReturnType<typeof setTimeout>
>(options: {
  writeRuntime(value: Value): Promise<unknown> | unknown;
  writeVault(value: Value): Promise<unknown> | unknown;
  stagePendingVault(value: Value): void;
  delayMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
}): WildzPlayStatePersistenceCoordinator<Value> {
  const shared = {
    delayMs: options.delayMs,
    setTimer: options.setTimer,
    clearTimer: options.clearTimer
  };
  const runtime = createLatestOnlySaveScheduler<Value, TimerHandle>({ ...shared, write: options.writeRuntime });
  const vault = createLatestOnlySaveScheduler<Value, TimerHandle>({
    ...shared,
    write: async (value) => {
      try {
        await options.writeVault(value);
      } catch {
        // The synchronous pending-inventory checkpoint remains the retry authority.
        // Never turn a storage outage into a gameplay-time retry loop.
      }
    }
  });

  return {
    schedule(value, vaultChanged) {
      runtime.schedule(value);
      if (!vaultChanged) return;
      options.stagePendingVault(value);
      vault.schedule(value);
    },
    async flush() {
      await Promise.all([runtime.flush(), vault.flush()]);
    },
    cancel() {
      runtime.cancel();
      vault.cancel();
    }
  };
}
