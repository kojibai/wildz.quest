import assert from "node:assert/strict";
import { it } from "node:test";
import { createWildsCrewJournal } from "../src/features/play/wilds-crew-journal";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
const request = {workerId:"a",jobId:"gather",commandDigest:"gather-a",observedKaiUPulse:100,expectedWorkerHead:null,phase:"proposed" as const,lotIds:["lot"]};

it("atomically arbitrates concurrent workers competing for the same material", async () => {
  const db = createMemoryWildzContinuityDatabase();
  const a = createWildsCrewJournal("owner",db), b = createWildsCrewJournal("owner",db);
  const results = await Promise.allSettled([a.append(request),b.append({...request,workerId:"b",commandDigest:"b"})]);
  assert.equal(results.filter(r=>r.status === "fulfilled").length,1);
  assert.equal((await a.reservation("lot"))?.workerId,"a");
  assert.equal(await b.workerHead("b"),null);
});

it("preserves pending reservations and complete history across journal instances", async () => {
  const db = createMemoryWildzContinuityDatabase();
  const a = createWildsCrewJournal("owner",db);
  const proposed = await a.append(request);
  const pending = await a.append({...request,expectedWorkerHead:proposed.event.eventId,phase:"pending",observedKaiUPulse:99});
  const restored = createWildsCrewJournal("owner",db);
  assert.equal((await restored.command(request.commandDigest))?.head,pending.event.eventId);
  assert.ok(await restored.reservation("lot"));
  const completed = await restored.append({...request,expectedWorkerHead:pending.event.eventId,phase:"admitted",admittedWorldEventIds:["world:harvest"],observedKaiUPulse:98});
  assert.equal(await restored.reservation("lot"),null);
  const page = await restored.history("a",undefined,1);
  assert.equal(page.events[0].eventId,completed.event.eventId);
  assert.equal(page.nextCursor,pending.event.eventId);
  assert.equal((await restored.history("a",page.nextCursor!,2)).events.length,2);
  assert.equal((await restored.readEvent(proposed.event.eventId))?.observedKaiUPulse,100);
});

it("makes exact append retries idempotent and blocks old commands after intervening work", async () => {
  const db = createMemoryWildzContinuityDatabase();
  const journal = createWildsCrewJournal("owner",db);
  const first = await journal.append(request);
  assert.equal((await journal.append(request)).replay,true);
  const rejected = await journal.append({...request,expectedWorkerHead:first.event.eventId,phase:"rejected"});
  const second = await journal.append({...request,commandDigest:"b",jobId:"b",expectedWorkerHead:rejected.event.eventId});
  const finished = await journal.append({...request,commandDigest:"b",jobId:"b",expectedWorkerHead:second.event.eventId,phase:"rejected"});
  await assert.rejects(journal.append({...request,expectedWorkerHead:finished.event.eventId}),/command_replayed/);
});

it("rolls back event, command, worker head and reservations on a storage failure", async () => {
  const db = createMemoryWildzContinuityDatabase();
  const journal = createWildsCrewJournal("owner",db);
  db.failNextTransactionAfterPuts(2);
  await assert.rejects(journal.append(request));
  assert.equal(await journal.workerHead("a"),null);
  assert.equal(await journal.command("gather-a"),null);
  assert.equal(await journal.reservation("lot"),null);
  assert.equal(db.dump().meta.length,0);
});

it("isolates owners and rejects stale worker heads and changing reserved lots", async () => {
  const db = createMemoryWildzContinuityDatabase();
  const a = createWildsCrewJournal("owner",db), other = createWildsCrewJournal("other",db);
  const first = await a.append(request);
  await other.append(request);
  await assert.rejects(a.append({...request,commandDigest:"new"}),/head_conflict/);
  await assert.rejects(a.append({...request,expectedWorkerHead:first.event.eventId,phase:"pending",lotIds:[]}),/lots_changed/);
  assert.ok(await a.reservation("lot"));
  assert.ok(await other.reservation("lot"));
});

it("cancels only provably undispatched proposals and rejects conflicting append replays",async()=>{
 const db=createMemoryWildzContinuityDatabase();const journal=createWildsCrewJournal("owner",db);
 const first=await journal.append(request);
 await assert.rejects(journal.append({...request,lotIds:["changed"]}),/replay_conflict/);
 const pending=await journal.append({...request,expectedWorkerHead:first.event.eventId,phase:"pending"});
 assert.equal((await journal.cancelProposed(request.commandDigest,101)).cancelled,false);
 assert.ok(await journal.reservation("lot"));
 await journal.append({...request,expectedWorkerHead:pending.event.eventId,phase:"rejected"});
 const next=await journal.append({...request,jobId:"next",commandDigest:"next",expectedWorkerHead:await journal.workerHead("a")});
 assert.equal(next.replay,false);
 assert.equal((await journal.cancelProposed("next",102)).cancelled,true);
 assert.equal(await journal.reservation("lot"),null);
});
