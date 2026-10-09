/// <reference lib="webworker" />
import { serializeReceizIdentityArtifact } from "@receiz/sdk";
import { defaultIdentityRepository } from "./wildz-active-identity";

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event: MessageEvent<{ command: "signing-key"; keyId: string }>) => {
  if (event.data?.command !== "signing-key" || typeof event.data.keyId !== "string" || !event.data.keyId) return;
  if (!globalThis.indexedDB) {
    scope.postMessage({ ok: false, error: "wildz_identity_signing_worker_storage_unavailable", fallbackSafe: true });
    return;
  }
  void defaultIdentityRepository.withKeyFile(event.data.keyId, async keyFile =>
    serializeReceizIdentityArtifact({ ...keyFile, portableState: null })
  ).then(text => scope.postMessage({ ok: true, text }),
    cause => scope.postMessage({ ok: false, error: cause instanceof Error ? cause.message : "wildz_identity_signing_read_failed" }));
});
