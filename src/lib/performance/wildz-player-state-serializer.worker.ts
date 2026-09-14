/// <reference lib="webworker" />

import { createWildzPlayerProjectionEncoder, type WildzPlayerProjectionMessage } from "./wildz-player-state-projection";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const encode = createWildzPlayerProjectionEncoder();

workerScope.addEventListener("message", (event: MessageEvent<WildzPlayerProjectionMessage>) => {
  try {
    workerScope.postMessage({ id: event.data.id, ok: true, body: encode(event.data) });
  } catch (cause) {
    workerScope.postMessage({
      id: event.data.id,
      ok: false,
      error: cause instanceof Error ? cause.message : "wildz_player_state_serialization_failed"
    });
  }
});
