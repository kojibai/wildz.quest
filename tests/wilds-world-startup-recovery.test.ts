import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceizOfflineProofQueueSnapshot, ReceizOfflineProofQueueStorage } from "@receiz/sdk";
import { prepareWildsWorldOutboxEntry, projectWildsWorldOutbox, restoreWildsWorldEdgeSource, type WildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state";

function history(count: number) {
  const actorId = "startup-recovery-explorer";
  let projection = initialWildsWorldProjection();
  const entries: WildsWorldOutboxEntry[] = [];
  for (let i = 0; i < count; i++) {
    const prepared = prepareWildsWorldOutboxEntry(projection, {
      schema: "receiz.wilds_world_outbox_entry.v1", actorId, guestId: "guest-startup-recovery",
      command: { type: "construction.project.create", commandId: `startup:${i}`, name: `Home ${i}`, region: { x: i, z: 0 } },
      queuedAt: "2026-10-07T12:00:00.000Z"
    }, i ? "startup:0" : undefined);
    projection = prepared.projection;
    entries.push(prepared.entry);
  }
  const snapshot: ReceizOfflineProofQueueSnapshot = {
    schema: "receiz.sdk.offline_proof_queue.v1", ownerId: actorId,
    createdAt: "2026-10-07T12:00:00.000Z", updatedAt: "2026-10-07T12:00:00.000Z",
    pending: [], failed: [], settled: entries.map(entry => ({
      id: entry.command.commandId, kind: "wilds.world.command", payload: { entry: entry as never },
      idempotencyKey: entry.command.commandId, createdAt: entry.queuedAt, attempts: 1, lastError: null
    }))
  };
  const storage: ReceizOfflineProofQueueStorage = { async read() { return structuredClone(snapshot); }, async write() { throw Error("restore must not write"); } };
  return { actorId, entries, projection, snapshot, storage };
}

test("startup recovery gives rendering a turn while restoring every settled source", async () => {
  const fixture = history(48);
  let rendered = false;
  const timer = setTimeout(() => { rendered = true; }, 0);
  try {
    const restored = await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), fixture.actorId, fixture.storage);
    assert.equal(rendered, true, "account history must not monopolize the gameplay thread when a worker is unavailable");
    assert.deepEqual(restored, fixture.projection);
    assert.equal(Object.keys(restored.constructionProjects).length, 48);
    assert.equal(fixture.entries.filter(entry => entry.admittedSource?.checkpoint).length, 1);
  } finally { clearTimeout(timer); }
});

test("startup recovery rejects a changed stored checkpoint and cannot grant it an anchor", async () => {
  const fixture = history(4);
  const first = fixture.snapshot.settled[0].payload.entry as unknown as WildsWorldOutboxEntry;
  first.admittedSource!.checkpoint!.projectionDigest = `sha256:${"f".repeat(64)}`;
  // The successors cannot replay against an absent valid project predecessor.
  for (const row of fixture.snapshot.settled.slice(1)) {
    const entry = row.payload.entry as unknown as WildsWorldOutboxEntry;
    entry.admittedSource!.events[0].previousEventId = "missing:predecessor";
  }
  const restored = await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), fixture.actorId, fixture.storage);
  assert.deepEqual(restored, initialWildsWorldProjection());
});

test("duplicate stored command IDs retain last-source precedence and first insertion order", async () => {
  const fixture = history(1);
  const replacement = prepareWildsWorldOutboxEntry(initialWildsWorldProjection(), {
    ...fixture.entries[0], admittedSource: undefined,
    command: { ...fixture.entries[0].command, name: "Replacement home" } as WildsWorldOutboxEntry["command"]
  }).entry;
  fixture.snapshot.settled.push({ ...fixture.snapshot.settled[0], payload: { entry: replacement as never } });
  const expected = projectWildsWorldOutbox(initialWildsWorldProjection(), fixture.actorId, [replacement]);
  assert.deepEqual(await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), fixture.actorId, fixture.storage), expected);
  replacement.admittedSource!.checkpoint!.projectionDigest = `sha256:${"f".repeat(64)}`;
  assert.deepEqual(await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), fixture.actorId, fixture.storage), initialWildsWorldProjection());
});
