import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsWorldWorkerClient } from "../src/features/play/wilds-world-work-client";

test("world worker matches out-of-order replies to their requests", async () => {
  const sent: { id: number }[] = [];
  const port = { onmessage: null, onerror: null, postMessage: (message: { id: number }) => { sent.push(message); }, terminate() {} } as unknown as ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;
  const client = createWildsWorldWorkerClient(() => port);
  const first = client.run({ kind: "read", actorId: "first" });
  const second = client.run({ kind: "read", actorId: "second" });
  port.onmessage!({ data: { id: sent[1]!.id, ok: true, value: ["second"] } } as MessageEvent);
  port.onmessage!({ data: { id: sent[0]!.id, ok: true, value: ["first"] } } as MessageEvent);
  assert.deepEqual(await first, ["first"]);
  assert.deepEqual(await second, ["second"]);
  client.close();
});

test("world worker rejects interrupted writes rather than replaying uncertain mutations", async () => {
  let terminated = false;
  const port = { onmessage: null, onerror: null, postMessage() {}, terminate() { terminated = true; } } as unknown as ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;
  const client = createWildsWorldWorkerClient(() => port);
  const pending = client.run({ kind: "acknowledge", actorId: "keeper", commandId: "command:one" });
  const rejection = assert.rejects(pending, /wilds_world_worker_interrupted/);
  port.onerror!({ preventDefault() {} } as ErrorEvent);
  await rejection;
  assert.equal(terminated, true);
});

test("world worker propagates admission errors without accepting a projection", async () => {
  let id = 0;
  const port = { onmessage: null, onerror: null, postMessage(message: { id: number }) { id = message.id; }, terminate() {} } as unknown as ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;
  const client = createWildsWorldWorkerClient(() => port);
  const pending = client.run({ kind: "read", actorId: "keeper" });
  port.onmessage!({ data: { id, ok: false, error: "invalid_source" } } as MessageEvent);
  await assert.rejects(pending, /invalid_source/);
  client.close();
});
