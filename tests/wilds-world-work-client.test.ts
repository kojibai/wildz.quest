import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareAndPersistWildsWorldOutboxEntry, type WildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox.js";
import { createWildsWorldWorkerClient } from "../src/features/play/wilds-world-work-client.js";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state.js";

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

test("ordinary admission prepares and persists through one worker request", async () => {
  type Port = ReturnType<NonNullable<Parameters<typeof createWildsWorldWorkerClient>[0]>>;
  type ReplyEvent = Parameters<NonNullable<Port["onmessage"]>>[0];
  const posted: string[] = [];
  const persisted: string[] = [];
  const worker: Port = {
    onmessage: null,
    onerror: null,
    terminate() {},
    postMessage(message) {
      const request = structuredClone(message);
      posted.push(request.work.kind);
      queueMicrotask(() => {
        void (async () => {
          if (request.work.kind !== "prepare-persist") throw new Error("unexpected work");
          return prepareAndPersistWildsWorldOutboxEntry(request.work.base, request.work.entry, request.work.anchorId, async entry => {
            persisted.push(entry.command.commandId);
          });
        })().then(
          value => worker.onmessage?.({ data: { id: request.id, ok: true, value: structuredClone(value) } } as ReplyEvent),
          error => worker.onmessage?.({ data: { id: request.id, ok: false, error: error instanceof Error ? error.message : "unknown" } } as ReplyEvent)
        );
      });
    }
  };
  const client = createWildsWorldWorkerClient(() => worker);
  const entry: WildsWorldOutboxEntry = {
    schema: "receiz.wilds_world_outbox_entry.v1",
    actorId: "global_keeper.receiz.id",
    guestId: "guest-12345678",
    command: { type: "construction.project.create", commandId: "command:one-worker-hop", name: "One worker hop", region: { x: 0, z: 0 } },
    queuedAt: "2026-07-19T12:00:00.000Z"
  };
  const result = await client.run({ kind: "prepare-persist", base: initialWildsWorldProjection(), entry });
  assert.deepEqual(posted, ["prepare-persist"]);
  assert.deepEqual(persisted, [entry.command.commandId]);
  assert.equal((result as { projection: { revision: number } }).projection.revision, 1);
  client.close();
});
