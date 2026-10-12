import assert from 'node:assert/strict';
import {test} from 'node:test';
import {revealPreparedWildzMarket} from '../src/features/market/wildz-market-entry';
import type {WildzMarketServiceV128} from '../src/features/market/wildz-market-service-v128';

const service=(key:string)=>({binding:{keyId:key,ownerHandle:'keeper.receiz.id'}} as WildzMarketServiceV128);
test('Market first paint waits for its decoded first screen and rewarms a replaced same-owner service',async()=>{
 const first=service('first'),next=service('next');let current=first,finish!:()=>void,revealed=0;
 const prepared:WildzMarketServiceV128[]=[];
 const opening=revealPreparedWildzMarket({service:first,current:()=>current,isCurrent:()=>true,ready:async candidate=>{prepared.push(candidate);if(candidate===first)await new Promise<void>(resolve=>{finish=resolve;});},reveal:()=>{revealed++;assert.equal(prepared.at(-1),current);}});
 assert.equal(revealed,0);current=next;finish();assert.equal(await opening,true);assert.deepEqual(prepared,[first,next]);assert.equal(revealed,1);
});
test('Escape, another surface or identity activation discards a delayed Market opening',async()=>{
 for(const reason of ['Escape','Build','Vault','identity']){
  const first=service(reason);let active=true,finish!:()=>void,revealed=0;
  const opening=revealPreparedWildzMarket({service:first,current:()=>first,isCurrent:()=>active,ready:()=>new Promise<void>(resolve=>{finish=resolve;}),reveal:()=>{revealed++;}});
  active=false;finish();assert.equal(await opening,false);assert.equal(revealed,0);
 }
});
