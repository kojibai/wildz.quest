import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWildzMarketUiActionRuntime,readWildzMarketListingUiAttempt,retainWildzMarketListingUiAttempt,releaseWildzMarketListingUiAttempt,type WildzMarketUiActionState} from '../src/features/market/wildz-market-presentation';
import type {WildzMarketServiceV128} from '../src/features/market/wildz-market-service-v128';

test('market UI duplicate clicks cannot start a second action before the first finishes',async()=>{
 let finish!:(value:string)=>void,calls=0;
 const states:WildzMarketUiActionState[]=[],gate=new Promise<string>(resolve=>{finish=resolve;});
 const runtime=createWildzMarketUiActionRuntime({isCurrent:()=>true,onChange:state=>states.push(state)});
 const first=runtime.run('Review purchase',async()=>{calls++;return gate;});
 assert.equal(await runtime.run('Review purchase',async()=>{calls++;return 'duplicate';}),undefined);
 assert.equal(calls,1);assert.equal(runtime.snapshot().busy,'Review purchase');
 finish('exact-review');assert.equal(await first,'exact-review');assert.equal(runtime.snapshot().busy,null);
 assert.equal(await runtime.run('Read market',async()=>{calls++;return 'fresh';}),'fresh');assert.equal(calls,2);
 assert.equal(states[0]?.busy,'Review purchase');
});

test('a changed Explorer ignores an older market result and never overwrites the new view',async()=>{
 let current=true,finish!:(value:string)=>void;
 const states:WildzMarketUiActionState[]=[],gate=new Promise<string>(resolve=>{finish=resolve;});
 const runtime=createWildzMarketUiActionRuntime({isCurrent:()=>current,onChange:state=>states.push(state)});
 const action=runtime.run('Resume purchase',()=>gate);current=false;
 finish('old-result');assert.equal(await action,undefined);assert.equal(states.length,1);
 assert.equal(await runtime.run('Approve sale',async()=>assert.fail('old identity cannot start an action')),undefined);
});

test('an uncertain market action is shown honestly without inventing a payment or delivery result',async()=>{
 const runtime=createWildzMarketUiActionRuntime({isCurrent:()=>true,onChange(){}});
 await runtime.run('Resume purchase',async()=>{throw Error('The original payment could not be checked. Resume this purchase.');});
 assert.equal(runtime.snapshot().busy,null);assert.equal(runtime.snapshot().error,true);
 assert.match(runtime.snapshot().message,/original payment could not be checked/);
});

test('overlapping list gestures cannot replace the retained request, and reopening keeps its exact selection',async()=>{
 const service={} as WildzMarketServiceV128,other={} as WildzMarketServiceV128;
 let finish!:()=>void,prepared=0;
 const gate=new Promise<void>(resolve=>{finish=resolve;});
 const input={request:{attemptId:'listing:original',asset:{kind:'inventory' as const,foodItemIds:['fruit:one'],materialLotIds:['timber:one'],resourceLotIds:['honey:one']},priceUsdCents:'1234'},title:'Trail provisions',summary:'Fruit, timber and honey'};
 const runtime=createWildzMarketUiActionRuntime({isCurrent:()=>true,onChange(){}});
 const first=runtime.run('List asset',async()=>{prepared++;retainWildzMarketListingUiAttempt(service,input);await gate;return 'pending';});
 const second=await runtime.run('List asset',async()=>{prepared++;retainWildzMarketListingUiAttempt(service,{...input,request:{...input.request,attemptId:'listing:duplicate'}});return 'pending';});
 assert.equal(second,undefined);assert.equal(prepared,1);
 input.request.asset.foodItemIds.push('fruit:changed');input.request.priceUsdCents='9999';
 finish();assert.equal(await first,'pending');
 const reopened=readWildzMarketListingUiAttempt(service);
 assert.equal(reopened?.request.attemptId,'listing:original');assert.equal(reopened?.request.priceUsdCents,'1234');
 assert.deepEqual(reopened?.request.asset,{kind:'inventory',foodItemIds:['fruit:one'],materialLotIds:['timber:one'],resourceLotIds:['honey:one']});
 assert.equal(readWildzMarketListingUiAttempt(other),null);
 releaseWildzMarketListingUiAttempt(service,'listing:duplicate');assert.equal(readWildzMarketListingUiAttempt(service),reopened);
 releaseWildzMarketListingUiAttempt(service,'listing:original');assert.equal(readWildzMarketListingUiAttempt(service),null);
});
