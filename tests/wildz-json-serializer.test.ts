import assert from "node:assert/strict";
import test from "node:test";
import { createWildzJsonSerializer } from "../src/lib/performance/wildz-json-serializer";

test("large checkpoint JSON is produced by the worker boundary", async () => {
  const worker = {
    onmessage: null as ((event: MessageEvent<{ id: string; ok: true; json: string } | { id: string; ok: false; error: string }>) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage(message: { id: string; value: unknown }) {
      queueMicrotask(() => this.onmessage?.({
        data: { id: message.id, ok: true, json: JSON.stringify(message.value) }
      } as MessageEvent));
    },
    terminate() {}
  };
  const serializer = createWildzJsonSerializer({ createWorker: () => worker, createId: () => "checkpoint-1" });

  assert.equal(await serializer.serialize({ player: { x: 4, z: 9 } }), "{\"player\":{\"x\":4,\"z\":9}}");
});

test("a silent checkpoint worker releases the save queue through the existing fallback", async () => {
  let deadline: (() => void) | undefined, terminated = 0;
  const worker = { onmessage: null, onerror: null, postMessage() {}, terminate() { terminated += 1; } };
  const options = { createWorker: () => worker, createId: () => "silent-checkpoint",
    setTimer: (callback: () => void) => { deadline = callback; return 1; }, clearTimer() {}, timeoutMs: 5_000 };
  const serializer = createWildzJsonSerializer(options);
  const saving = serializer.serialize({ playerBreaths: { mode: "sleep" }, playerNourishment: { items: { food: {} } } });
  assert.ok(deadline, "Every checkpoint serialization must have a deadline");
  deadline();
  assert.equal(await saving, null);
  assert.equal(terminated, 1);
  assert.equal(await serializer.serialize({ next: true }), null);
});
