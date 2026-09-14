/// <reference lib="webworker" />
import { signWildzProfilePublication, type WildzProfileSigningInput } from "./wildz-profile-signing";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.addEventListener("message", (event: MessageEvent<{ input: WildzProfileSigningInput; admittedCards: boolean }>) => {
  void signWildzProfilePublication(event.data.input, event.data.admittedCards).then(
    result => scope.postMessage({ ok: true, result }),
    cause => scope.postMessage({ ok: false, error: cause instanceof Error ? cause.message : "wildz_profile_signing_failed" })
  );
});
