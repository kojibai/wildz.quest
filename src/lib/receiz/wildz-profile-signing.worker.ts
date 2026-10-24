/// <reference lib="webworker" />
import { createWildzProfileSigningReceiver, type WildzProfileSigningRequest } from "./wildz-profile-signing-protocol";
const scope = self as unknown as DedicatedWorkerGlobalScope;
const receive = createWildzProfileSigningReceiver(value => scope.postMessage(value));
scope.addEventListener("message", (event: MessageEvent<WildzProfileSigningRequest>) => receive(event.data));
