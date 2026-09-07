import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizInMemoryOfflineProofQueueStorage } from "@receiz/sdk";
import {
  admitWildsWorldOutboxEntry,
  acknowledgeWildsWorldCommand,
  acknowledgeWildsWorldPublication,
  createWildsWorldEdgeAdmissionQueue,
  drainWildsWorldOutbox,
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

function projectEntry(commandId: string, name: string): WildsWorldOutboxEntry {
  return {
    ...entry(commandId),
    command: {
      type: "construction.project.create",
      name,
      region: { x: 0, z: 0 },
      commandId
    }
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

test("edge admission becomes authoritative only after the exact command is durably appended", async () => {
  let releasePersist!: () => void;
  const persisted = new Promise<void>((resolve) => {
    releasePersist = resolve;
  });
  const presented: number[] = [];
  const admission = createWildsWorldEdgeAdmissionQueue({
    initialProjection: initialWildsWorldProjection(),
    persist: async () => persisted,
    onAdmitted: (projection) => presented.push(projection.revision)
  });

  const pending = admission.admit(projectEntry("command:construction:durable:first", "Durable First"));
  await Promise.resolve();
  assert.equal(admission.current().revision, 0);
  assert.deepEqual(presented, []);

  releasePersist();
  const admitted = await pending;
  assert.equal(admitted.revision, 1);
  assert.equal(admission.current(), admitted);
  assert.deepEqual(presented, [1]);
});

test("a durable append failure rejects without publishing non-durable local authority", async () => {
  const initial = initialWildsWorldProjection();
  const presented: number[] = [];
  const admission = createWildsWorldEdgeAdmissionQueue({
    initialProjection: initial,
    persist: async () => {
      throw new Error("indexeddb_write_failed");
    },
    onAdmitted: (projection) => presented.push(projection.revision)
  });

  await assert.rejects(
    admission.admit(projectEntry("command:construction:durable:failed", "Never Visible")),
    /indexeddb_write_failed/
  );
  assert.equal(admission.current(), initial);
  assert.deepEqual(presented, []);
});

test("rapid durable admissions serialize from synchronous local authority without losing either command", async () => {
  const persistOrder: string[] = [];
  const admission = createWildsWorldEdgeAdmissionQueue({
    initialProjection: initialWildsWorldProjection(),
    persist: async (queued) => {
      persistOrder.push(queued.command.commandId);
      await Promise.resolve();
    }
  });
  const first = projectEntry("command:construction:rapid:first", "Rapid First");
  const second = projectEntry("command:construction:rapid:second", "Rapid Second");

  const [afterFirst, afterSecond] = await Promise.all([admission.admit(first), admission.admit(second)]);

  assert.equal(afterFirst.revision, 1);
  assert.equal(afterSecond.revision, 2);
  assert.equal(Object.keys(afterSecond.constructionProjects).length, 2);
  assert.equal(admission.current(), afterSecond);
  assert.deepEqual(persistOrder, [first.command.commandId, second.command.commandId]);
});

test("persisted replication drains oldest-first and retains the head on throw or unpublished result", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const first = projectEntry("command:construction:drain:first", "Drain First");
  const second = projectEntry("command:construction:drain:second", "Drain Second");
  await enqueueWildsWorldCommand(first, storage);
  await enqueueWildsWorldCommand(second, storage);

  const thrownCalls: string[] = [];
  await assert.rejects(drainWildsWorldOutbox(first.actorId, async (queued) => {
    thrownCalls.push(queued.command.commandId);
    throw new Error("transport_failed");
  }, storage), /transport_failed/);
  assert.deepEqual(thrownCalls, [first.command.commandId]);
  assert.deepEqual((await readWildsWorldOutbox(first.actorId, storage)).map((queued) => queued.command.commandId), [
    first.command.commandId,
    second.command.commandId
  ]);

  const unpublishedCalls: string[] = [];
  await drainWildsWorldOutbox(first.actorId, async (queued) => {
    unpublishedCalls.push(queued.command.commandId);
    return { commandId: queued.command.commandId, globallyPublished: false };
  }, storage);
  assert.deepEqual(unpublishedCalls, [first.command.commandId]);
  assert.equal((await readWildsWorldOutbox(first.actorId, storage)).length, 2);

  const publishedCalls: string[] = [];
  const remaining = await drainWildsWorldOutbox(first.actorId, async (queued) => {
    publishedCalls.push(queued.command.commandId);
    return { commandId: queued.command.commandId, globallyPublished: true };
  }, storage);
  assert.deepEqual(publishedCalls, [first.command.commandId, second.command.commandId]);
  assert.deepEqual(remaining, []);
});

test("replication never acknowledges a published command id that does not match the persisted head", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const first = projectEntry("command:construction:drain:mismatch:first", "Mismatch First");
  const second = projectEntry("command:construction:drain:mismatch:second", "Mismatch Second");
  await enqueueWildsWorldCommand(first, storage);
  await enqueueWildsWorldCommand(second, storage);

  await assert.rejects(drainWildsWorldOutbox(first.actorId, async () => ({
    commandId: second.command.commandId,
    globallyPublished: true
  }), storage), /published_head_mismatch/);
  assert.deepEqual((await readWildsWorldOutbox(first.actorId, storage)).map((queued) => queued.command.commandId), [
    first.command.commandId,
    second.command.commandId
  ]);
});

test("a saved live command immediately projects while remaining queued for global Receiz commitment", () => {
  const base = initialWildsWorldProjection();
  const projection = projectWildsWorldOutbox(base, "global_keeper.receiz.id", [entry()]);

  assert.equal(projection.revision, 1);
  assert.equal(Object.values(projection.teams)[0]?.captainId, "global_keeper.receiz.id");
  assert.equal(base.revision, 0);
});

test("source authority admits a valid command before any global projection responds", () => {
  const base = initialWildsWorldProjection();
  const projection = admitWildsWorldOutboxEntry(base, entry("command:team:create:edge"));

  assert.equal(projection.revision, 1);
  assert.equal(Object.values(projection.teams)[0]?.captainId, "global_keeper.receiz.id");
  assert.equal(base.revision, 0);
});

test("a failed admission does not poison later admissions and persists exact source events", async () => {
  const persisted: WildsWorldOutboxEntry[] = [];
  let fail = true;
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: async (entry) => {
    if (fail) { fail = false; throw new Error("disk_full"); }
    persisted.push(entry);
  } });
  const failed = queue.admit(projectEntry("command:fail:first", "Failed"));
  const succeeding = queue.admit(projectEntry("command:after:failure", "Saved"));
  await assert.rejects(failed, /disk_full/);
  const admitted = await succeeding;
  assert.equal(admitted.revision, 1);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.admittedSource?.events.length, 1);
  assert.deepEqual(admitWildsWorldOutboxEntry(initialWildsWorldProjection(), persisted[0]!), admitted);
});

test("overlapping acknowledgement and enqueue cannot overwrite a newer SDK entry", async () => {
  const underlying = createReceizInMemoryOfflineProofQueueStorage();
  let delayNextWrite = false;
  let release!: () => void;
  let reached!: () => void;
  const writing = new Promise<void>((resolve) => { reached = resolve; });
  const storage: typeof underlying = {
    ...underlying,
    write: async (snapshot) => {
      if (delayNextWrite) {
        delayNextWrite = false;
        reached();
        await new Promise<void>((resolve) => { release = resolve; });
      }
      await underlying.write(snapshot);
    }
  };
  const first = projectEntry("command:race:first", "First");
  const second = projectEntry("command:race:second", "Second");
  await enqueueWildsWorldCommand(first, storage);
  delayNextWrite = true;
  const acknowledging = acknowledgeWildsWorldCommand(first.actorId, first.command.commandId, storage);
  await writing;
  const enqueuing = enqueueWildsWorldCommand(second, storage);
  await Promise.resolve();
  release();
  await Promise.all([acknowledging, enqueuing]);
  assert.deepEqual((await readWildsWorldOutbox(first.actorId, storage)).map((item) => item.command.commandId), [second.command.commandId]);
});

test("successor entries share one durable anchor and restore after that anchor is acknowledged", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const persisted: WildsWorldOutboxEntry[] = [];
  const admission = createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: async (entry) => { persisted.push(entry); await enqueueWildsWorldCommand(entry, storage); } });
  for (let index = 0; index < 8; index++) await admission.admit(projectEntry(`command:anchor:${index}`, `Place ${index}`));
  assert.ok(persisted[0]?.admittedSource?.checkpoint);
  assert.equal(persisted.filter((entry) => entry.admittedSource?.checkpoint).length, 1);
  assert.ok(persisted.every((entry) => entry.admittedSource?.anchorId === persisted[0]?.command.commandId));
  await acknowledgeWildsWorldCommand(persisted[0]!.actorId, persisted[0]!.command.commandId, storage);
  const pending = await readWildsWorldOutbox(persisted[0]!.actorId, storage);
  assert.ok(pending[0]?.admittedSource?.checkpoint, "publication obtains verified transient source context from the shared anchor");
  assert.deepEqual(projectWildsWorldOutbox(initialWildsWorldProjection(), persisted[0]!.actorId, pending), admission.current());
});


test("direct confirmed legacy publication settles its exact durable entry before later construction drains", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const actorId = entry().actorId;
  const admission = createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: (queued) => enqueueWildsWorldCommand(queued, storage) });
  const legacy = entry("command:online:legacy");
  assert.deepEqual(await readWildsWorldOutbox(actorId, storage), []);
  await admission.admit(legacy);
  assert.equal((await readWildsWorldOutbox(actorId, storage)).length, 1);
  assert.deepEqual(await acknowledgeWildsWorldPublication(legacy, { commandId: legacy.command.commandId, globallyPublished: true }, storage), []);
  const construction = projectEntry("command:online:next:construction", "Next Place");
  await admission.admit(construction);
  const published: string[] = [];
  const remaining = await drainWildsWorldOutbox(actorId, async (queued) => {
    published.push(queued.command.commandId);
    assert.ok(queued.admittedSource);
    return { commandId: queued.command.commandId, globallyPublished: true };
  }, storage);
  assert.deepEqual(published, [construction.command.commandId]);
  assert.deepEqual(remaining, []);
  const persisted = JSON.parse(storage.readText()!);
  assert.deepEqual(persisted.settled.map((item: { id: string }) => item.id), [legacy.command.commandId, construction.command.commandId]);
});

test("unpublished, mismatched or failed direct publication retains the durable legacy head", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const legacy = entry("command:direct:unpublished");
  const admission = createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: (queued) => enqueueWildsWorldCommand(queued, storage) });
  await admission.admit(legacy);
  const publish = async (confirmed: boolean) => acknowledgeWildsWorldPublication(legacy, { commandId: legacy.command.commandId, globallyPublished: confirmed }, storage);
  assert.equal((await publish(false))[0]?.command.commandId, legacy.command.commandId);
  await assert.rejects(acknowledgeWildsWorldPublication(legacy, { commandId: "command:different", globallyPublished: true }, storage), /published_head_mismatch/);
  await assert.rejects((async () => {
    await Promise.reject(new Error("transport_failed"));
    return publish(true);
  })(), /transport_failed/);
  assert.deepEqual((await readWildsWorldOutbox(legacy.actorId, storage)).map((queued) => queued.command.commandId), [legacy.command.commandId]);
});
