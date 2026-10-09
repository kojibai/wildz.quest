/// <reference lib="webworker" />
import { projectWildsWalletSourceAuthorityLocally } from "./wilds-wallet-source-projection";

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event: MessageEvent<{ keyId: string }>) => {
  const keyId = event.data?.keyId;
  if (typeof keyId !== "string" || !keyId) return;
  if (!globalThis.indexedDB) {
    scope.postMessage({ keyId, ok: false, error: "wilds_wallet_source_worker_storage_unavailable", fallbackSafe: true });
    return;
  }
  void projectWildsWalletSourceAuthorityLocally(keyId).then(
    result => scope.postMessage({ keyId, ok: true, result }),
    cause => scope.postMessage({ keyId, ok: false, error: cause instanceof Error ? cause.message : "wilds_wallet_source_projection_failed" })
  );
});
