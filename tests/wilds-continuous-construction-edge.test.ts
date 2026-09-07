import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizInMemoryOfflineProofQueueStorage } from "@receiz/sdk";
import { WildsWorldService, type WildsWorldCommand } from "../src/features/play/wilds-world-service";
import { createWildsMaterialContribution, createWildsWorkContribution, projectWildsConstructionProgress } from "../src/features/play/wilds-construction-component";
import { constructionProofDigest } from "../src/features/play/wilds-construction-project";
import { worldCommandRequiresCard, isWildsEdgeImmediateConstructionCommand } from "../src/features/play/wilds-world-authority";
import { projectWildsProductionPlacementEvidence } from "../src/features/play/wilds-construction-placement";
import { projectWildsConstructionStageGeometry } from "../src/features/play/wilds-construction-geometry";
import { previewWildsBlueprintPlacement } from "../src/features/play/wilds-world-construction";
import { checkpointWildsWorld, initialWildsWorldProjection, projectWildsConstructionProgressFromWorld, reduceWildsWorldEvent, replayWildsWorld } from "../src/features/play/wilds-world-state";
import { createWildsWorldEdgeAdmissionQueue, enqueueWildsWorldCommand, acknowledgeWildsWorldCommand, restoreWildsWorldEdgeSource, preserveWildsConstructionHistory, type WildsWorldOutboxEntry } from "../src/features/play/wilds-world-outbox";
import { publishWildsConstructionEntry } from "../src/features/play/wilds-construction-publication";
import { createWildsWorldEvent } from "../src/features/play/wilds-world-event";
const actorId = "builder.receiz.id";
const authority = { actorId, canonical: true, pulse: "2026-08-26T00:00:00.000Z", occurredAt: "2026-08-26T00:00:00.000Z", uPulse: 10 };
const request = { pointer: { x: 2, y: 0, z: 2 }, rotationQuarterTurns: 0, heightStep: 0 };
function fixture() {
  const service = new WildsWorldService();
  const create: WildsWorldCommand = { type: "construction.project.create", name: "Home", region: { x: 0, z: 0 }, commandId: "command:project:home" };
  service.execute(create, authority);
  const project = Object.values(service.snapshot().constructionProjects)[0]!;
  const evidence = projectWildsProductionPlacementEvidence(service.snapshot(), project.projectId, request);
  const placement = previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: "foundation", ...evidence });
  assert.equal(placement.valid, true);
  const place: WildsWorldCommand = { type: "construction.component.place", projectId: project.projectId, request, placement, actorPosition: request.pointer, commandId: "command:place:foundation" };
  return { service, create, project, place };
}
function stone(index: number, kind: "stone" | "timber" | "hay" = "stone") {
  const basis = { schema: "wildz.material-lot.v1" as const, lotId: `wildz:material:${kind}:${index.toString(16).padStart(64,"0")}`, kind, quantity: 1 as const, quality: 1 as const, ownerReceizId: actorId, source: { sourceId: "source:test", sourceHead: `sha256:${"a".repeat(64)}`, admittedSourceHead: `sha256:${"b".repeat(64)}`, kaiUPulse: 1 }, contributors: { explorerReceizId: actorId }, authority: "source-proof-object" as const };
  return { ...basis, head: constructionProofDigest(basis) };
}
test("owner places with zero lots and partial deposits support exact baseline player work", () => {
  const f = fixture();
  for (const command of [f.create, f.place]) {
    assert.equal(worldCommandRequiresCard(command), false);
    assert.equal(isWildsEdgeImmediateConstructionCommand(command), true);
  }
  assert.equal(f.service.execute(f.place, authority).events.length, 1);
  const component = Object.values(f.service.snapshot().constructionComponents)[0]!;
  assert.equal(component.kind, "foundation");
  assert.deepEqual(f.service.snapshot().reservedMaterialLots, {});
  assert.deepEqual(projectWildsConstructionStageGeometry(component, [], []).solids, []);
  const lots = [stone(1), stone(2)];
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld({ ...f.service.snapshot(), materialLots: Object.fromEntries(lots.map((lot) => [lot.lotId, lot])) }) });
  const work: WildsWorldCommand = { type: "construction.component.work", componentId: component.componentId, componentHead: component.head, actorPosition: request.pointer, commandId: "command:work:first" };
  const deposit = (index: number): WildsWorldCommand => ({ type: "construction.component.deposit", componentId: component.componentId, componentHead: component.head, lotIds: [lots[index]!.lotId], actorPosition: request.pointer, commandId: `command:deposit:${index}` });
  assert.throws(() => service.execute(work, authority));
  assert.equal(service.execute(deposit(0), authority).events.length, 1);
  assert.throws(() => service.execute(work, authority));
  assert.equal(projectWildsConstructionProgressFromWorld(service.snapshot(), component.componentId).materials.stone.contributed, 1);
  service.execute(deposit(1), authority);
  assert.equal(service.execute(work, authority).events.length, 1);
  assert.equal(projectWildsConstructionProgressFromWorld(service.snapshot(), component.componentId).stage, "framed");
  assert.equal(Object.values(service.snapshot().constructionWorkContributions)[0]?.amount, 1);
  assert.deepEqual(Object.keys(service.snapshot().consumedMaterialLots).sort(), lots.map((lot) => lot.lotId).sort());
  assert.equal(service.snapshot().constructionComponents[component.componentId]?.head, component.head);
  assert.throws(() => service.execute({ ...work, creature: { subjectId: "creature:fake", head: constructionProofDigest("fake") }, commandId: "command:work:creature" }, authority), /creature_authority/);
  const restored = new WildsWorldService({ checkpoint: service.checkpoint() });
  assert.equal(restored.execute(work, authority).events.length, 0);
  assert.throws(() => restored.execute({ ...work, actorPosition: { x: 3, z: 2 } }, authority), /command_conflict/);
  assert.throws(() => restored.execute(work, { ...authority, actorId: "other" }), /command_conflict/);
});
test("excess deposits reject atomically while exact remaining material batches remain available", () => {
  const f = fixture();
  f.service.execute(f.place, authority);
  const component = Object.values(f.service.snapshot().constructionComponents)[0]!;
  const lots = [stone(101), stone(102), stone(103), stone(104), stone(105, "hay"), stone(106, "timber")];
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld({ ...f.service.snapshot(),
    materialLots: Object.fromEntries(lots.map(lot => [lot.lotId, lot])) }) });
  const deposit = (indexes: number[], commandId: string): WildsWorldCommand => ({
    type: "construction.component.deposit", componentId: component.componentId, componentHead: component.head,
    lotIds: indexes.map(index => lots[index]!.lotId), actorPosition: request.pointer, commandId
  });
  const empty = service.checkpoint();
  assert.throws(() => service.execute(deposit([0, 1, 2, 3, 4], "command:deposit:excess-batch"), authority), /lots_exceed_remaining/);
  assert.deepEqual(service.checkpoint(), empty, "no event, reservation, or command receipt may survive batch rejection");
  service.execute(deposit([0, 1], "command:deposit:frame"), authority);
  service.execute({ type: "construction.component.work", componentId: component.componentId, componentHead: component.head,
    actorPosition: request.pointer, commandId: "command:work:frame" }, authority);
  const framed = service.checkpoint();
  assert.throws(() => service.execute(deposit([2, 3, 4], "command:deposit:excess-remaining"), authority), /lots_exceed_remaining/);
  assert.deepEqual(service.checkpoint(), framed);
  service.execute(deposit([2, 4, 5], "command:deposit:remaining"), authority);
  const progress = projectWildsConstructionProgressFromWorld(service.snapshot(), component.componentId);
  assert.deepEqual(progress.unusedLotIds, []);
  assert.equal(progress.materials.stone.remaining + progress.materials.hay.remaining + progress.materials.timber.remaining, 0);
  assert.equal(service.snapshot().reservedMaterialLots[lots[3]!.lotId], undefined);
  const supplied = service.checkpoint();
  assert.throws(() => service.execute(deposit([3], "command:deposit:already-supplied"), authority), /lots_exceed_remaining/);
  assert.deepEqual(service.checkpoint(), supplied);
});

test("excess deposits cannot displace an earlier unembedded reservation", () => {
  const f = fixture();
  f.service.execute(f.place, authority);
  const component = Object.values(f.service.snapshot().constructionComponents)[0]!;
  const originalLots = [stone(201), stone(202), stone(203)];
  const originalProofs = originalLots.map(lot => createWildsMaterialContribution({ component, lot,
    custodianReceizId: actorId, contributorReceizId: actorId, commandId: "command:deposit:original", kaiUPulse: 10 }));
  const incoming = Array.from({ length: 100 }, (_, index) => stone(300 + index)).find(lot => {
    const proof = createWildsMaterialContribution({ component, lot, custodianReceizId: actorId,
      contributorReceizId: actorId, commandId: "command:deposit:displace", kaiUPulse: 10 });
    return !projectWildsConstructionProgress(component, [...originalProofs, proof], []).unusedLotIds.includes(lot.lotId);
  });
  assert.ok(incoming, "fixture must sort the incoming contribution before an existing allocated lot");
  const allLots = [...originalLots, incoming];
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld({ ...f.service.snapshot(),
    materialLots: Object.fromEntries(allLots.map(lot => [lot.lotId, lot])) }) });
  const deposit = (lotIds: string[], commandId: string): WildsWorldCommand => ({
    type: "construction.component.deposit", componentId: component.componentId, componentHead: component.head,
    lotIds, actorPosition: request.pointer, commandId
  });
  service.execute(deposit(originalLots.map(lot => lot.lotId), "command:deposit:original"), authority);
  const before = service.checkpoint();
  assert.throws(() => service.execute(deposit([incoming.lotId], "command:deposit:displace"), authority), /lots_exceed_remaining/);
  assert.deepEqual(service.checkpoint(), before);
});

test("historical surplus deposits replay exactly and do not block newly needed material", () => {
  const f = fixture();
  f.service.execute(f.place, authority);
  const component = Object.values(f.service.snapshot().constructionComponents)[0]!;
  const lots = [stone(501), stone(502), stone(503), stone(504), stone(505, "hay")];
  const before = { ...f.service.snapshot(), materialLots: Object.fromEntries(lots.map(lot => [lot.lotId, lot])) };
  const causeId = "command:deposit:historical-surplus";
  const contributions = lots.slice(0, 4).map(lot => createWildsMaterialContribution({ component, lot,
    custodianReceizId: actorId, contributorReceizId: actorId, commandId: causeId, kaiUPulse: 10 }));
  // The prior admission policy allowed this event. Its exact proof remains
  // replayable; the new command guard must not retroactively rewrite custody.
  const historical = createWildsWorldEvent({ actorId, pulse: authority.pulse, occurredAt: authority.occurredAt, uPulse: authority.uPulse,
    kind: "construction.material_contributed", causeId,
    kaiKlok: before.revision + 1, previousEventId: before.cursor?.eventId ?? null,
    payload: { contributions, commandDigest: constructionProofDigest({ causeId }) } });
  const restored = replayWildsWorld([historical], checkpointWildsWorld(before));
  assert.deepEqual(restored, reduceWildsWorldEvent(before, historical));
  assert.equal(projectWildsConstructionProgressFromWorld(restored, component.componentId).unusedLotIds.length, 1);
  const oldUnused = projectWildsConstructionProgressFromWorld(restored, component.componentId).unusedLotIds;
  const service = new WildsWorldService({ checkpoint: checkpointWildsWorld(restored) });
  assert.equal(service.execute({ type: "construction.component.deposit", componentId: component.componentId,
    componentHead: component.head, lotIds: [lots[4]!.lotId], actorPosition: request.pointer,
    commandId: "command:deposit:historical-needed" }, authority).events.length, 1);
  assert.deepEqual(projectWildsConstructionProgressFromWorld(service.snapshot(), component.componentId).unusedLotIds, oldUnused);
  assert.deepEqual(new WildsWorldService({ checkpoint: service.checkpoint() }).snapshot(), service.snapshot());
});

test("production placement derives current terrain, planned reservations and rejects tampered/stale source without writes", () => {
  const f = fixture();
  assert.equal(f.place.type, "construction.component.place");
  if (f.place.type !== "construction.component.place") return;
  const before = f.service.checkpoint();
  assert.throws(() => f.service.execute({ ...f.place, placement: { ...f.place.placement, valid: true, collisionSolids: [] } }, authority));
  assert.deepEqual(f.service.checkpoint(), before);
  f.service.execute(f.place, authority);
  const evidence = projectWildsProductionPlacementEvidence(f.service.snapshot(), f.project.projectId, request);
  assert.equal(evidence.physical.solids.length, 0);
  assert.equal(evidence.sourceBlueprint.pieces.length, 1);
  const overlapping = previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: "foundation", ...evidence });
  assert.equal(overlapping.valid, false);
  assert.ok(overlapping.cues.includes("blueprint-collision"));
  const after = f.service.checkpoint();
  assert.throws(() => f.service.execute({ ...f.place, commandId: "command:place:overlap" }, authority));
  assert.deepEqual(f.service.checkpoint(), after);
  assert.throws(() => f.service.execute({ ...f.place, commandId: "command:place:far", actorPosition: { x: NaN, z: 2 } }, authority), /unreachable/);
});
test("durable source survives acknowledgment and exact replication never reexecutes or demotes it", async () => {
  const storage = createReceizInMemoryOfflineProofQueueStorage();
  const entries: WildsWorldOutboxEntry[] = [];
  const queue = createWildsWorldEdgeAdmissionQueue({ initialProjection: initialWildsWorldProjection(), persist: async (entry) => { entries.push(entry); await enqueueWildsWorldCommand(entry, storage); } });
  const command: WildsWorldCommand = { type: "construction.project.create", name: "Offline Home", region: { x: 0, z: 0 }, commandId: "command:offline:home" };
  const local = await queue.admit({ schema: "receiz.wilds_world_outbox_entry.v1", actorId, guestId: "guest-12345678", command, queuedAt: authority.occurredAt });
  const exact = entries[0]!;
  let draft: unknown;
  const result = await publishWildsConstructionEntry(exact, "https://wildz.quest/api/wilds/world/snapshot", { read: async () => null, publish: async (value) => { draft = value; } });
  assert.equal(result.commandId, command.commandId);
  assert.deepEqual(result.projection, local);
  assert.deepEqual((draft as { storeStateRecord: { eventTail: unknown } }).storeStateRecord.eventTail, exact.admittedSource!.events);
  await acknowledgeWildsWorldCommand(actorId, command.commandId, storage);
  assert.deepEqual(await restoreWildsWorldEdgeSource(initialWildsWorldProjection(), actorId, storage), local);
  const weaker = { ...initialWildsWorldProjection(), revision: local.revision + 10 };
  assert.equal(preserveWildsConstructionHistory(local, weaker), local);
  await assert.rejects(publishWildsConstructionEntry(exact, "https://wildz.quest/api/wilds/world/snapshot", { read: async () => ({ checkpoint: checkpointWildsWorld(weaker), eventTail: [] }), publish: async () => { throw new Error("must_not_publish"); } }), /source_conflict/);
  await assert.rejects(publishWildsConstructionEntry({ ...exact, command: { ...command, name: "Changed" } }, "https://wildz.quest/api/wilds/world/snapshot", { read: async () => null, publish: async () => {} }), /source_mismatch/);
  assert.equal(queue.current(), local);
});

test("candidate snapshots cannot retain receipts while erasing exact construction or custody", () => {
  const f = fixture(); f.service.execute(f.place, authority);
  const local = f.service.snapshot();
  assert.equal(preserveWildsConstructionHistory(local, { ...local, revision: local.revision + 1, constructionComponents: {} }), local);
  assert.equal(preserveWildsConstructionHistory(local, { ...local, revision: local.revision + 1, constructionChunks: {} }), local);
  assert.equal(preserveWildsConstructionHistory(local, { ...local, revision: local.revision + 1, constructionProjects: {} }), local);
});


test("the shared stage geometry folds funded proofs and keeps room openings intact", () => {
  const f = fixture(); f.service.execute(f.place, authority);
  const roomRequest = { ...request, pointer: Object.values(f.service.snapshot().constructionComponents)[0]!.anchors[0]!.position };
  const evidence = projectWildsProductionPlacementEvidence(f.service.snapshot(), f.project.projectId, roomRequest);
  const placement = previewWildsBlueprintPlacement({ blueprint: evidence.sourceBlueprint, kind: "room", ...evidence });
  assert.equal(placement.valid, true);
  f.service.execute({ type: "construction.component.place", projectId: f.project.projectId, request: roomRequest, placement, actorPosition: request.pointer, commandId: "command:place:room" }, authority);
  const room = Object.values(f.service.snapshot().constructionComponents).find((component) => component.kind === "room")!;
  let index = 10;
  const materials = room.recipe.stages.slice(0,2).flatMap((stage) => (["hay", "timber", "stone"] as const).flatMap((kind) => Array.from({ length: stage.materials[kind] }, () => {
    const lot = stone(index++, kind);
    return createWildsMaterialContribution({ component: room, lot, custodianReceizId: actorId, contributorReceizId: actorId, commandId: `command:geometry:deposit:${index}`, kaiUPulse: 10 });
  })));
  const first = createWildsWorkContribution({ component: room, materials, worker: { kind: "player", receizId: actorId }, amount: room.recipe.stages[0].work, commandId: "command:geometry:frame", kaiUPulse: 10 });
  const framed = projectWildsConstructionStageGeometry(room, materials, [first]);
  assert.equal(framed.stage, "framed");
  assert.equal(framed.solids.length, 1);
  assert.ok(framed.solids[0]!.id.endsWith(":floor"));
  const second = createWildsWorkContribution({ component: room, materials, work: [first], worker: { kind: "player", receizId: actorId }, amount: room.recipe.stages[1].work, commandId: "command:geometry:function", kaiUPulse: 10 });
  const functional = projectWildsConstructionStageGeometry(room, materials, [first, second]);
  assert.equal(functional.stage, "functional");
  assert.deepEqual(functional.solids, room.placement.collisionSolids);
  assert.equal(functional.solids.some((solid) => solid.id.endsWith(":body")), false);
  assert.deepEqual(projectWildsConstructionStageGeometry(room, [], [first, second]).solids, []);
});
