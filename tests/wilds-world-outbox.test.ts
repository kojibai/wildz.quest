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
  restoreWildsWorldEdgeSource,
  type WildsWorldOutboxEntry
} from "../src/features/play/wilds-world-outbox.js";
import { initialWildsWorldProjection } from "../src/features/play/wilds-world-state.js";
import { createWildsConstructionSite } from "../src/features/play/wilds-construction-site.js";
import { projectWildsResourceRegion } from "../src/features/play/wilds-resource-authority.js";
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from "../src/features/play/wilds-steward-construction.js";
import { mergeWildsOwnedWorldAdditions, projectWildsOwnedWorldAdditions } from "../src/features/play/wilds-player-world-additions.js";
import { createOwnerBoundInitialPlayState, restorePlayState, serializePlayState } from "../src/features/play/game-state.js";
import { acceptWildsWorldSnapshot } from "../src/features/play/use-wilds-world.js";

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

test("offline source restoration and later admission retain portable owner sites and exact spent lots", async () => {
  const actorId = entry().actorId;
  const site = createWildsConstructionSite({ blueprint: "trail-shelter", placedByReceizId: actorId, actorPosition: { x: 10, z: 10 }, position: { x: 12, z: 11 }, rotationQuarterTurns: 0, existingStructures: [], existingSites: [], kaiUPulse: 2_000_010 });
  const source = Array.from({ length: 25 }, (_, index) => projectWildsResourceRegion(index - 12, 0)).flat().find((source) => source.kind === "timber")!;
  const harvest = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: actorId, actorPosition: source.position, kaiUPulse: 2_000_020 });
  const saved = { ...initialWildsWorldProjection(), constructionSites: { [site.siteId]: site }, materialLots: { [harvest.lot.lotId]: harvest.lot }, harvestedSources: { [source.sourceId]: harvest.source }, consumedMaterialLots: { [harvest.lot.lotId]: "structure:completed" } };
  const owned = projectWildsOwnedWorldAdditions(saved, actorId);
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const prior = createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: (entry) => enqueueWildsWorldCommand(entry, storage) });
  const first = projectEntry("command:restore:owner:first", "Restored Home");
  await prior.admit(first);
  await acknowledgeWildsWorldCommand(actorId, first.command.commandId, storage);
  const presented: ReturnType<typeof prior.current>[] = [];
  const options = {
    initialProjection: mergeWildsOwnedWorldAdditions(initialWildsWorldProjection(), owned),
    persist: (entry: WildsWorldOutboxEntry) => enqueueWildsWorldCommand(entry, storage),
    onAdmitted: (projection: ReturnType<typeof prior.current>) => presented.push(acceptWildsWorldSnapshot(null, projection, owned))
  };
  const reopened = createWildsWorldEdgeAdmissionQueue(options);
  reopened.adopt(initialWildsWorldProjection());
  // The durable source's older checkpoint predates the separate portable save.
  const restored = await restoreWildsWorldEdgeSource(reopened.current(), actorId, storage);
  const visible = reopened.adopt(acceptWildsWorldSnapshot(null, restored, owned));
  assert.equal(visible.constructionSites[site.siteId]?.head, site.head);
  assert.equal(visible.materialLots[harvest.lot.lotId]?.head, harvest.lot.head);
  assert.equal(visible.consumedMaterialLots[harvest.lot.lotId], "structure:completed");
  await reopened.admit(projectEntry("command:restore:owner:next", "Next Home"));
  assert.equal(presented.length, 1);
  const additions = projectWildsOwnedWorldAdditions(presented[0]!, actorId);
  const play = createOwnerBoundInitialPlayState(actorId);
  const roundTrip = restorePlayState(serializePlayState({ ...play, ownedWorldAdditions: additions }), actorId);
  assert.deepEqual(roundTrip.ownedWorldAdditions.constructionSites, owned.constructionSites);
  assert.deepEqual(roundTrip.ownedWorldAdditions.materialLots, owned.materialLots);
  assert.deepEqual(roundTrip.ownedWorldAdditions.consumedMaterialLots, owned.consumedMaterialLots);
  assert.equal(Object.keys(roundTrip.ownedWorldAdditions.constructionProjects ?? {}).length, 2);
});

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

test("restoration replays pending legacy reports but never executes settled reports again", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const report: WildsWorldOutboxEntry = {
    ...entry("command:report:legacy"),
    command: { type: "social.report", subjectId: "player:spam", reason: "Repeated spam", commandId: "command:report:legacy" }
  };
  await enqueueWildsWorldCommand(report, storage);
  const pending = await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), report.actorId, storage);
  assert.equal(pending.revision, 1);
  await acknowledgeWildsWorldCommand(report.actorId, report.command.commandId, storage);
  // A different report was settled by a prior session, absent from this session's in-memory deduplication.
  const priorSession: WildsWorldOutboxEntry = { ...report, command: { type: "social.report", subjectId: "player:prior-session", reason: "Prior session report", commandId: "command:report:prior-session" } };
  await enqueueWildsWorldCommand(priorSession, storage);
  await acknowledgeWildsWorldCommand(report.actorId, priorSession.command.commandId, storage);
  assert.deepEqual(await restoreWildsWorldEdgeSource(pending, report.actorId, storage), pending);
  assert.deepEqual(await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), report.actorId, storage), initialWildsWorldProjection());
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
