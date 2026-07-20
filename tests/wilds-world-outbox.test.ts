import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizInMemoryOfflineProofQueueStorage } from "@receiz/sdk";
import {
  acknowledgeWildsWorldCommand,
  enqueueWildsWorldCommand,
  projectWildsWorldOutbox,
  readWildsWorldOutbox,
  type WildsWorldOutboxEntry
} from "../src/features/play/wilds-world-outbox.js";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state.js";

function entry(commandId = "command:team:create:offline"): WildsWorldOutboxEntry {
  return {
    schema: "receiz.wilds_world_outbox_entry.v1",
    actorId: "global_keeper.receiz.id",
    guestId: "guest-12345678",
    command: { type: "team.create", name: "Offline Keepers", commandId },
    queuedAt: "2026-07-19T12:00:00.000Z"
  };
}

test("the SDK offline queue durably persists and deduplicates the canonical command id", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  await enqueueWildsWorldCommand(entry(), storage);
  await enqueueWildsWorldCommand(entry(), storage);

  const queued = await readWildsWorldOutbox("global_keeper.receiz.id", storage);
  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.command.commandId, "command:team:create:offline");
  assert.deepEqual(await acknowledgeWildsWorldCommand("global_keeper.receiz.id", queued[0]!.command.commandId, storage), []);
  assert.deepEqual(await readWildsWorldOutbox("global_keeper.receiz.id", storage), []);
});

test("a saved live command immediately projects while remaining queued for global Receiz commitment", () => {
  const base = initialWildsWorldProjection();
  const projection = projectWildsWorldOutbox(base, "global_keeper.receiz.id", [entry()]);

  assert.equal(projection.revision, 1);
  assert.equal(Object.values(projection.teams)[0]?.captainId, "global_keeper.receiz.id");
  assert.equal(base.revision, 0);
});
