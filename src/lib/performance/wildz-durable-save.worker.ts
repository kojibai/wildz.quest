/// <reference lib="webworker" />
import { createWildzContinuityDatabase } from "../storage/wildz-indexed-db";
import { createWildzDurableSaveProcessor, type WildzDurableSaveMessage } from "./wildz-durable-save-projection";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const save = createWildzDurableSaveProcessor(createWildzContinuityDatabase());
scope.addEventListener("message", (event: MessageEvent<WildzDurableSaveMessage>) => {
  if (!globalThis.indexedDB) {
    // This platform cannot store in a worker. No save has started, so the
    // guarded caller can use its original main-thread transaction once.
    scope.postMessage({ id: event.data.id, ok: false, error: "wildz_durable_save_worker_storage_unavailable", fallbackSafe: true });
    return;
  }
  void save(event.data).then(reply => scope.postMessage(reply)).catch(cause => {
    scope.postMessage({ id: event.data.id, ok: false, error: cause instanceof Error ? cause.message : "wildz_durable_save_failed" });
  });
});
