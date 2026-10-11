import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createWildsClearanceActionWorkerRuntime,type WildsClearanceActionWorkerInitial} from '../src/lib/receiz/wilds-clearance-action-worker-runtime';
import {mergeQualifiedWildsResourceWorldV128} from '../src/features/play/wilds-resource-application-world-v128';
import {replayWildsResourceGameplayV128} from '../src/lib/receiz/wilds-resource-gameplay-v128';
import {createWildsSourceAuthorityProjection,planWildsMaterialHarvest} from '../src/features/play/wilds-source-work-authority';
import {projectWildsResourceRegion} from '../src/features/play/wilds-resource-authority';

// Separate V8 worker realm runs the real replay and result projector. SDK host
// currentness is deliberately outside this transport qualification.
const initial={configuration:{applicationId:'wildz',baseUrl:'https://wildz.quest'},author:{ownerReceizId:'bob.receiz.id',actorSubjectId:'bob',actorSubjectHead:'head',grant:{},keyFile:{owner:{},crypto:{publicKeyRawB64u:'public'}}},session:{},gameplayOwnerId:'bob'} as unknown as WildsClearanceActionWorkerInitial;
for(const label of ['previewGameplay','admitMaterialCommand','deriveClearance','admitClearancePickup','recoverClearance','owner-change','cancel','foreign-custody'] as const)test(`actual runtime receives qualified imported custody across worker realm: ${label}`,async(t)=>{
 const method=label==='owner-change'||label==='cancel'||label==='foreign-custody'?'previewGameplay':label;
 const source=projectWildsResourceRegion(0,0).find(row=>row.kind==='hay')!;
 const command=planWildsMaterialHarvest({projection:createWildsSourceAuthorityProjection(),source,actorId:'alice',actorPosition:source.position,kaiUPulse:100000000,commandId:'worker:hay:harvest'});
 const born=await replayWildsResourceGameplayV128({gameplayOwnerId:'alice',commands:[{kind:'world',command,kaiUPulse:100000000}]});
 const members=Object.values(born.members),base=new URL('../src/lib/receiz/',import.meta.url).href;
 let terminated=0,current=true;
 const createWorker=()=>{
  const w=new NodeWorker(`const {parentPort,workerData}=require('node:worker_threads');parentPort.on('message',async data=>{if(data.type!=='run')return;try{const {replayWildsResourceGameplayV128}=await import(workerData.base+'wilds-resource-gameplay-v128.js');const {projectWildsClearanceWorkerResult}=await import(workerData.base+'wilds-clearance-action-worker-engine.js');const replay=await replayWildsResourceGameplayV128({gameplayOwnerId:workerData.foreign?'mallory':'bob',commands:[],imports:[{packageId:'package:worker',receiptId:'wildz:resource:worker',kaiUPulse:100000001,sourceArtifactSha256:'a'.repeat(64),members:workerData.members}]});const raw=data.method==='previewGameplay'?{replay}:data.method==='admitMaterialCommand'?{kind:'ordinary',projection:replay.world,command:data.args[0].command,events:[],memberIds:[]}:{status:'admitted',projection:replay.world,nourishment:replay.nourishment,members:[]};parentPort.postMessage({type:'result',ok:true,value:projectWildsClearanceWorkerResult(data.method,raw)});}catch(e){parentPort.postMessage({type:'result',ok:false,error:e.message});}});`,{eval:true,workerData:{base,members,foreign:label==='foreign-custody'}});
  const handlers=new Map<unknown,(data:unknown)=>void>();
  return {postMessage:(data:unknown)=>w.postMessage(data),terminate:()=>{terminated++;void w.terminate();},addEventListener:(kind:string,fn:(event:MessageEvent)=>void)=>{const cb=(data:unknown)=>{if(label==='owner-change')current=false;fn({data} as MessageEvent);};handlers.set(fn,cb);w.on(kind==='message'?'message':'error',cb);},removeEventListener:(kind:string,fn:unknown)=>{const cb=handlers.get(fn);if(cb)w.off(kind==='message'?'message':'error',cb);}} as unknown as Worker;
 };
 const originalWorker=globalThis.Worker;
 globalThis.Worker=class {constructor(url:URL){assert.ok(url.pathname.endsWith('/wilds-clearance-action.worker.ts'));return createWorker();}} as unknown as typeof Worker;
 t.after(()=>{globalThis.Worker=originalWorker;});
 const runtime=createWildsClearanceActionWorkerRuntime({...initial,sdk:{} as never,assertCurrent:()=>{if(!current)throw Error('owner_changed');}});
 const exchange=runtime.exchange;
 const pending=method==='previewGameplay'?exchange.previewGameplay():method==='admitMaterialCommand'?exchange.admitMaterialCommand({attemptId:'worker:material',command:{kind:'world',command,kaiUPulse:100000002}}):method==='deriveClearance'?exchange.deriveClearance({attemptId:'worker:derive'} as never):method==='admitClearancePickup'?exchange.admitClearancePickup({command:{commandId:'worker:pickup'}} as never):exchange.recoverClearance('worker:recover');
 if(label==='cancel')runtime.dispose();
 if(label==='owner-change'||label==='cancel'||label==='foreign-custody'){await assert.rejects(pending,/owner_changed|cancelled|custody_scope_invalid/);assert.equal(terminated,1);runtime.dispose();return;}
 const result=await pending;
 const world=result&&('replay'in result?result.replay.world:'projection'in result?result.projection:null);assert.ok(world);
 assert.doesNotThrow(()=>mergeQualifiedWildsResourceWorldV128(null,world));
 assert.throws(()=>mergeQualifiedWildsResourceWorldV128(null,structuredClone(world)),/not_admitted/);
 assert.equal(terminated,1);runtime.dispose();
});

test('a caller-created generic worker and forged world cannot invoke a custody qualification grant',async()=>{
 const {createWildsClearanceActionWorkerClient}=await import('../src/lib/receiz/wilds-clearance-action-worker-client');
 const gameplay=await import('../src/lib/receiz/wilds-resource-gameplay-v128');
 const world={...createWildsSourceAuthorityProjection(),materialLots:{forged:{lotId:'forged',head:'sha256:forged',ownerReceizId:'alice'}},applicationSourceCustody:{forged:{scheme:'wildz.resource-source.v128',ownerReceizId:'bob',packageId:'forged',unpackAppendId:'forged',sourceArtifactSha256:'forged'}}} as never;
 let listener!:(event:MessageEvent)=>void;
 const client=createWildsClearanceActionWorkerClient({worker:()=>({postMessage:()=>queueMicrotask(()=>listener({data:{type:'result',ok:true,value:{replay:{world}}}} as MessageEvent)),terminate(){},addEventListener:(type:string,fn:(event:MessageEvent)=>void)=>{if(type==='message')listener=fn;},removeEventListener(){}} as unknown as Worker),initialize:()=>({gameplayOwnerId:'bob'}),callback:async()=>null});
 const result=await client.run('previewGameplay',[]);
 const grant=(gameplay as unknown as Record<string,unknown>).receiveWildsResourceWorkerResultV128;
 if(typeof grant==='function')grant(result,'previewGameplay','bob');
 assert.throws(()=>mergeQualifiedWildsResourceWorldV128(null,(result as {replay:{world:Parameters<typeof mergeQualifiedWildsResourceWorldV128>[1]}}).replay.world),/custody_not_admitted/);
});
