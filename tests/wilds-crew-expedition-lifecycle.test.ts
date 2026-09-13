import assert from "node:assert/strict";
import { test } from "node:test";
import { createWildsCrewExpeditionGuard } from "../src/features/play/use-wilds-crew-expeditions";
import { createWildsCrewExpeditions } from "../src/features/play/wilds-crew-expedition";
import type { PortableCardAsset } from "../src/features/play/portable-card";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

const card=(proofDigest="a".repeat(64),owner="owner")=>({id:"asset",proof:{digest:proofDigest},manifest:{ownerReceizId:owner}} as PortableCardAsset);
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}
const start={ownerReceizId:"owner",assetId:"asset",proofDigest:"a".repeat(64),
  disposition:{assetId:"asset",proofDigest:"a".repeat(64),identityAnchor:"genome",temperament:"curious",workFamilies:[],riskTolerance:22,restAtFatigue:60,preferenceSeed:123},
  origin:{x:0,y:0,z:0},spaceId:"outer",candidates:[{pointId:"known",spaceId:"outer",position:{x:12,y:0,z:0},risk:0,reachable:true}],kaiUPulse:100,requestId:"trip"};

test("delayed restore cannot resume changed proofs, removed crew or transferred ownership",async()=>{
  for(const change of ["proof","removed","transferred","owner"]){
    const scope={owner:"owner",cards:[card()]},guard=createWildsCrewExpeditionGuard(()=>scope),ticket=guard.begin("asset")!;
    const read=deferred();let resumed=false;
    const restore=(async()=>{await read.promise;if(guard.valid(ticket))resumed=true;})();
    if(change==="proof")scope.cards=[card("b".repeat(64))];
    if(change==="removed")scope.cards=[];
    if(change==="transferred")scope.cards=[card("a".repeat(64),"other")];
    if(change==="owner")scope.owner="other";
    read.resolve();await restore;assert.equal(resumed,false,change);
  }
});

test("recall invalidates an outstanding restore before that read resolves",async()=>{
  const scope={owner:"owner",cards:[card()]},guard=createWildsCrewExpeditionGuard(()=>scope);
  const restoring=guard.begin("asset")!,read=deferred();let resumed=0;
  const restore=(async()=>{await read.promise;if(guard.valid(restoring))resumed++;})();
  const recalling=guard.begin("asset")!;
  read.resolve();await restore;
  assert.equal(resumed,0);assert.equal(guard.valid(recalling),true);
});

test("recall queued behind an already committing start retains both journal observations",async()=>{
  const scope={owner:"owner",cards:[card()]},guard=createWildsCrewExpeditionGuard(()=>scope);
  const store=createWildsCrewExpeditions(createMemoryWildzContinuityDatabase());
  const starting=guard.begin("asset")!,entered=deferred(),release=deferred();
  const first=guard.run("asset",async()=>{
    assert.equal(guard.valid(starting),true);entered.resolve();await release.promise;
    const row=await store.start(start);
    return {row,publish:guard.valid(starting)};
  });
  await entered.promise;
  const recalling=guard.begin("asset")!;
  const second=guard.run("asset",async()=>{
    assert.equal(guard.valid(recalling),true);
    const row=(await store.read("owner","asset"))!;
    return store.recall({ownerReceizId:"owner",assetId:"asset",expectedHead:row.head,kaiUPulse:101,returnPosition:start.origin,spaceId:"outer"});
  });
  release.resolve();assert.equal((await first).publish,false);
  assert.equal((await second).phase,"returning");
  const journal=await store.history("owner","asset");
  assert.deepEqual(journal.observations.map(row=>row.kind),["recalled","started"]);
  assert.deepEqual(journal.observations[0].visitedPointIds,[]);
});

test("scope cancellation preserves history and cannot poison the next control queue",async()=>{
  const scope={owner:"owner",cards:[card()]},guard=createWildsCrewExpeditionGuard(()=>scope);
  const store=createWildsCrewExpeditions(createMemoryWildzContinuityDatabase()),trip=await store.start(start);
  const old=guard.begin("asset")!;guard.clear();assert.equal(guard.valid(old),false);
  assert.equal((await store.read("owner","asset"))?.head,trip.head);
  const next=guard.begin("asset")!;
  await assert.rejects(guard.run("asset",async()=>{throw new Error("read unavailable");}),/unavailable/);
  assert.equal(await guard.run("asset",async()=>guard.valid(next)),true);
});

test("read-only snapshots do not invalidate travel controls and reject later proof changes",()=>{
  const scope={owner:"owner",cards:[card()]},guard=createWildsCrewExpeditionGuard(()=>scope),active=guard.begin("asset")!;
  const read=guard.context("asset")!;assert.equal(guard.valid(active),true);assert.equal(guard.contextValid(read),true);
  scope.cards=[card("c".repeat(64))];assert.equal(guard.contextValid(read),false);
});

test("proof replacement can end and restart a trip while an old restore remains invalid",async()=>{
  const scope={owner:"owner",cards:[card()]},guard=createWildsCrewExpeditionGuard(()=>scope);
  const store=createWildsCrewExpeditions(createMemoryWildzContinuityDatabase()),old=await store.start(start);
  const restoring=guard.begin("asset")!,read=deferred();let stalePublished=false;
  const pending=(async()=>{await read.promise;stalePublished=guard.valid(restoring);})();
  const replacement="b".repeat(64);scope.cards=[card(replacement)];const explicit=guard.begin("asset")!;
  await guard.run("asset",async()=>{
    const ended=await store.supersede({ownerReceizId:"owner",assetId:"asset",expectedHead:old.head,kaiUPulse:101,replacementProofDigest:replacement});
    assert.equal(ended.proofDigest,old.proofDigest);assert.equal(ended.actualPosition,null);
    await store.start({...start,requestId:"replacement",proofDigest:replacement,disposition:{...start.disposition,proofDigest:replacement},kaiUPulse:102});
  });
  read.resolve();await pending;
  assert.equal(stalePublished,false);assert.equal(guard.valid(explicit),true);
  assert.equal((await store.read("owner","asset"))?.proofDigest,replacement);
  assert.equal((await store.history("owner","asset")).observations.length,3);
});
