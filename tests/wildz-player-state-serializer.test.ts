import assert from "node:assert/strict";
import test from "node:test";
import { createWildzPlayerStateSerializer } from "../src/lib/performance/wildz-player-state-serializer";

test("player-state projection serialization completes through the worker without main-thread JSON work", async () => {
  const posted: unknown[] = [];
  const worker = {
    onmessage: null as ((event: MessageEvent<
      { id: string; ok: true; body: string } | { id: string; ok: false; error: string }
    >) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage(message: { id: string }) {
      posted.push(message);
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, ok: true, body: "{\"player\":true}" } } as MessageEvent));
    },
    terminate() {}
  };
  const serializer = createWildzPlayerStateSerializer({
    createWorker: () => worker,
    createId: () => "projection-1"
  });

  const body = await serializer.serialize({ playerId: "wildz" } as never);

  assert.equal(body, "{\"player\":true}");
  assert.equal((posted[0] as { id: string }).id, "projection-1");
});
