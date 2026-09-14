/// <reference lib="webworker" />
import { signWildzCardPublication, type WildzCardSigningInput } from "./wildz-card-signing";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event: MessageEvent<WildzCardSigningInput>) => {
  void signWildzCardPublication(event.data).then(
    body => scope.postMessage({ ok: true, body }),
    cause => scope.postMessage({ ok: false, error: cause instanceof Error ? cause.message : "wildz_card_signing_failed" })
  );
});
