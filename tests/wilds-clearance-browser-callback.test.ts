import assert from 'node:assert/strict';
import {test} from 'node:test';
import {startClearanceBrowserWorker} from '../src/features/play/fixtures/clearance-browser.worker.js';
import {createWildsClearanceActionWorkerClient} from '../src/lib/receiz/wilds-clearance-action-worker-client';
import {planWildsClearancePickupV128} from '../src/lib/receiz/wilds-clearance-admission-v128';
import {projectWildsBuildingClearancePiles} from '../src/features/play/wilds-building-clearance';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
import type {WildsResourceJournalV128} from '../src/lib/receiz/wilds-resource-journal-v128';

type Reply={type:string;id?:number;ok?:boolean;error?:string;value?:unknown;current?:{state:WildsResourceJournalV128;predecessor:{head:{head:string}}}};
class FixtureWorker extends EventTarget {
 terminated=0;incoming:Reply[]=[];outgoing:Reply[]=[];receive!:(event:MessageEvent)=>void;
 constructor(database:ReturnType<typeof createMemoryWildzContinuityDatabase>){super();startClearanceBrowserWorker({addEventListener:(_type:string,listener:EventListenerOrEventListenerObject)=>{this.receive=listener as (event:MessageEvent)=>void;},postMessage:(value:Reply)=>{this.outgoing.push(structuredClone(value));queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:structuredClone(value)})));}} as unknown as DedicatedWorkerGlobalScope,database);}
 postMessage(value:Reply){this.incoming.push(structuredClone(value));queueMicrotask(()=>this.receive(new MessageEvent('message',{data:structuredClone(value)})));}
 terminate(){this.terminated++;}
}
async function fixture(){
 const database=createMemoryWildzContinuityDatabase(),workers:FixtureWorker[]=[];
 const port=(initial:unknown={})=>createWildsClearanceActionWorkerClient({worker:()=>{const w=new FixtureWorker(database);workers.push(w);return w as unknown as Worker;},initialize:()=>initial,callback:async()=>{throw Error('unexpected_fixture_callback');},timeoutMs:5000});
 const built=await port({op:'build',kind:'small'}).run('deriveClearance',[]) as {current:{state:WildsResourceJournalV128;predecessor:{head:{head:string}}}};
 const pile=projectWildsBuildingClearancePiles(Object.values(built.current.state.clearances??{}),{}) .find(p=>p.kind==='food')!;
 const proposal=(id:string)=>planWildsClearancePickupV128({source:built.current,clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:built.current.predecessor.head.head,ownerReceizId:'bob.receiz.id',gameplayOwnerId:'bob',player:pile.position,spaceId:'wildz.space.outer.v1',kaiUPulse:100000500,commandId:id});
 return {database,workers,port,proposal};
}
test('actual fixture worker/client rejects live owner, room and pose fences with zero source, outcome or local credit change',async()=>{
 const f=await fixture(),before=f.database.dump();let localCredit=0;
 for(const reason of ['owner_changed','food_pack_full','pose_out_of_reach']){
  const work=f.port().run('admitClearancePickup',[f.proposal('qa:reject:'+reason)],async()=>{throw Error(reason);}).then(value=>{const result=(value as {result:{status:string;members:unknown[]}}).result;if(result.status==='admitted')localCredit+=result.members.length;return value;});
  await assert.rejects(work,new RegExp(reason));assert.deepEqual(f.database.dump(),before);assert.equal(localCredit,0);assert.equal(f.workers.at(-1)!.terminated,1);
  assert.equal(f.workers.at(-1)!.incoming.at(-1)?.ok,false,'real client sends rejected callback to the actual fixture worker');
 }
});
test('actual fixture worker requires matching callback ID, ignores late replies and admits a valid fence exactly once',async()=>{
 const f=await fixture(),before=f.database.dump();let release!:()=>void,fenceCalls=0,localCredit=0;
 const fence=new Promise<void>(resolve=>{release=resolve;});
 const pending=f.port().run('admitClearancePickup',[f.proposal('qa:valid')],async()=>{fenceCalls++;await fence;});
 while(!fenceCalls)await new Promise(resolve=>setTimeout(resolve,0));
 const worker=f.workers.at(-1)!,callback=worker.outgoing.find(row=>row.type==='callback')!;
 worker.postMessage({type:'callback-result',id:callback.id!+99,ok:true});await new Promise(resolve=>setTimeout(resolve,10));
 assert.deepEqual(f.database.dump(),before,'foreign reply cannot authorize the write');
 release();const value=await pending as {result:{status:string;members:unknown[]}};assert.equal(value.result.status,'admitted');localCredit+=value.result.members.length;
 const after=f.database.dump();assert.notDeepEqual(after,before);assert.equal(localCredit,1);assert.equal(after.meta.filter(([key])=>String(key).startsWith('qa:outcome:')).length,1);assert.equal(fenceCalls,1);
 worker.postMessage({type:'callback-result',id:callback.id,ok:false,error:'late_rejection'});worker.postMessage({type:'callback-result',id:callback.id,ok:true});await new Promise(resolve=>setTimeout(resolve,10));
 assert.deepEqual(f.database.dump(),after);assert.equal(localCredit,1);assert.equal(worker.terminated,1);
});
