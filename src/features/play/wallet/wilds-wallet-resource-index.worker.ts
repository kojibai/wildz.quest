/// <reference lib="webworker" />
import { validateWalletResourceIndex, type ResourceIndex, type ResourceIndexScope } from "./wilds-wallet-resource-index-validation";
const workerScope = self as unknown as DedicatedWorkerGlobalScope;
workerScope.onmessage = (event: MessageEvent<{index: ResourceIndex; scope: ResourceIndexScope}>) => {
  void validateWalletResourceIndex(event.data.index, event.data.scope).then(
    positions => workerScope.postMessage({ok: true, positions}),
    () => workerScope.postMessage({ok: false})
  );
};
