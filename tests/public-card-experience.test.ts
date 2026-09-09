import assert from "node:assert/strict";
import {test} from "node:test";
import {openPublicCreatureTrail} from "../examples/public-card-experience";
import {initialPlayState} from "../src/features/play/game-state";
import {createPublicWildsCardRecord} from "../src/features/play/public-card-registry";

test("an external experience reads an exact public creature without owner cookies",async()=>{
  const asset=initialPlayState.inventory[0]!;
  const record=createPublicWildsCardRecord(asset,"https://wildz.quest","2026-09-09T11:00:00.000Z");
  const result=await openPublicCreatureTrail(asset.id,(async (url,options)=>{
    assert.equal(String(url),`https://wildz.quest/api/cards/${encodeURIComponent(asset.id)}`);
    assert.equal(options?.credentials,"omit");
    return Response.json({ok:true,record});
  }) as typeof fetch);
  assert.equal(result.ok,true);
  if(result.ok)assert.equal(result.creature.assetId,asset.id);
  assert.deepEqual(await openPublicCreatureTrail(asset.id,(async()=>Response.json({ok:false},{status:404})) as typeof fetch),{ok:false,reason:"public_card_unavailable"});
  const changed=structuredClone(record);changed.asset.proof.digest="sha256:tampered";
  assert.deepEqual(await openPublicCreatureTrail(asset.id,(async()=>Response.json({ok:true,record:changed})) as typeof fetch),{ok:false,reason:"public_card_unverified"});
});
