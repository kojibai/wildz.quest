/// <reference lib="webworker" />

import { createWildsPlayerVault } from "../../features/play/wilds-player-vault";
import type { WildzPlayerStateProjectionInput } from "./wildz-player-state-serializer";

type WorkerRequest = { id: string; input: WildzPlayerStateProjectionInput };

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  try {
    const player = createWildsPlayerVault(event.data.input);
    workerScope.postMessage({ id: event.data.id, ok: true, body: JSON.stringify({ player }) });
  } catch (cause) {
    workerScope.postMessage({
      id: event.data.id,
      ok: false,
      error: cause instanceof Error ? cause.message : "wildz_player_state_serialization_failed"
    });
  }
});
