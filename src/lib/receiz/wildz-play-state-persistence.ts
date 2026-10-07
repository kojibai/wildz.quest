import { createLatestOnlySaveScheduler } from "./wildz-save-scheduler";

export type WildzPlayStatePersistenceCoordinator<Value> = {
  schedule(value: Value, change: boolean | Readonly<{
    durableChanged: boolean;
    inventoryChanged: boolean;
  }>): void;
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
  let latest: Value | undefined;
  let failedVault: Value | undefined;
  let hasFailedVault = false;
  const runtime = createLatestOnlySaveScheduler<Value, TimerHandle>({ ...shared, write: options.writeRuntime });
  const vault = createLatestOnlySaveScheduler<Value, TimerHandle>({
    ...shared,
    write: async (value) => {
      try {
        await options.writeVault(value);
        failedVault = undefined;
        hasFailedVault = false;
      } catch {
        // Preserve one complete latest snapshot, including finite food/world
        // receipts. Explicit flush or the next durable mutation can retry;
        // ordinary movement never starts a storage-outage retry loop.
        failedVault = latest ?? value;
        hasFailedVault = true;
      }
    }
  });

  return {
    schedule(value, change) {
      latest = value;
      if (hasFailedVault) failedVault = value;
      const durableChanged = typeof change === "boolean" ? change : change.durableChanged;
      const inventoryChanged = typeof change === "boolean" ? change : change.inventoryChanged;
      runtime.schedule(value);
      if (!durableChanged) return;
      if (inventoryChanged) options.stagePendingVault(value);
      vault.schedule(value);
    },
    async flush() {
      if (hasFailedVault) {
        vault.schedule(failedVault as Value);
        failedVault = undefined;
        hasFailedVault = false;
      }
      await Promise.all([runtime.flush(), vault.flush()]);
    },
    cancel() {
      latest = undefined;
      failedVault = undefined;
      hasFailedVault = false;
      runtime.cancel();
      vault.cancel();
    }
  };
}
