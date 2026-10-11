import assert from 'node:assert/strict';
import {test} from 'node:test';
import '../src/lib/receiz/wilds-clearance-action-worker-engine';

async function client(){
 const path='../src/lib/receiz/wilds-clearance-action-worker-client.js';
 const loaded=await import(path).catch(()=>null);
 assert.ok(loaded?.createWildsClearanceActionWorkerClient,'explicit clearance must dispatch through its own bounded worker');
 return loaded as {createWildsClearanceActionWorkerClient(input:{worker:()=>Worker;initialize:()=>unknown;callback:(method:string,args:unknown[])=>Promise<unknown>}):{run(method:string,args:unknown[],beforeCommit?:()=>Promise<void>):Promise<unknown>;dispose():void}};
}
test('clearance dispatch retains exact arguments, awaits live fence and releases worker after result',async()=>{
 const {createWildsClearanceActionWorkerClient}=await client();
 const sent:unknown[]=[],listeners=new Map<string,Set<(event:MessageEvent)=>void>>();let terminated=0,fences=0;
 const worker={postMessage:(value:unknown)=>sent.push(structuredClone(value)),terminate:()=>{terminated++;},addEventListener:(type:string,fn:(event:MessageEvent)=>void)=>{let set=listeners.get(type);if(!set)listeners.set(type,set=new Set());set.add(fn);},removeEventListener:(type:string,fn:(event:MessageEvent)=>void)=>listeners.get(type)?.delete(fn)} as unknown as Worker;
 const emit=(value:unknown)=>{for(const fn of listeners.get('message')??[])fn({data:value} as MessageEvent);};
 const port=createWildsClearanceActionWorkerClient({worker:()=>worker,initialize:()=>({fixture:true}),callback:async()=>{fences++;return null;}});
 const request={attemptId:'exact-retained-attempt',buildingId:'building',buildingHead:'head',kaiUPulse:123};
 const result=port.run('deriveClearance',[request],async()=>{fences++;});
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(sent,[{type:'run',method:'deriveClearance',args:[request],initial:{fixture:true}}]);
 emit({type:'callback',id:1,method:'beforeCommit',args:[]});await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(fences,1);assert.deepEqual(sent[1],{type:'callback-result',id:1,ok:true,value:undefined});
 const admitted={status:'admitted',members:[{id:'exact-member'}]};emit({type:'result',ok:true,value:admitted});
 assert.deepEqual(await result,admitted);assert.equal(terminated,1);
});
test('abort after dispatch has unknown outcome, never invents success, and permits same-attempt recovery',async()=>{
 const {createWildsClearanceActionWorkerClient}=await client();let terminated=0;
 const port=createWildsClearanceActionWorkerClient({worker:()=>({postMessage(){},terminate(){terminated++;},addEventListener(){},removeEventListener(){}} as unknown as Worker),initialize:()=>({}),callback:async()=>null});
 const pending=port.run('recoverClearance',['same-attempt']);await Promise.resolve();await Promise.resolve();port.dispose();
 await assert.rejects(pending,/clearance_worker_cancelled/);assert.equal(terminated,1);
});
test('runtime slot coalesces opening and disposes a client created after owner change or disposal',async()=>{
 const path='../src/lib/receiz/wilds-clearance-action-worker-client.js';const loaded=await import(path);
 assert.equal(typeof loaded.createWildsClearanceRuntimeSlot,'function');
 let resolve!:(value:{dispose:()=>void})=>void,opened=0,disposed=0,current=true;
 const slot=loaded.createWildsClearanceRuntimeSlot(async()=>{opened++;return new Promise(r=>{resolve=r;});},()=>{if(!current)throw Error('owner_changed');});
 const runtime={},first=slot.open(runtime),second=slot.open(runtime);assert.equal(first,second);assert.equal(opened,1);
 slot.dispose();resolve({dispose:()=>{disposed++;}});await assert.rejects(first,/cancelled/);assert.equal(disposed,1);
 const third=slot.open(runtime);current=false;resolve({dispose:()=>{disposed++;}});await assert.rejects(third,/owner_changed/);assert.equal(disposed,2);
});
test('worker public author excludes every private credential without mutating held custody',async()=>{
 const {wildsClearanceWorkerAuthor}=await import('../src/lib/receiz/wilds-clearance-action-worker-runtime');
 const author={ownerReceizId:'fixture.receiz.id',actorSubjectId:'subject',actorSubjectHead:'head',passphrase:'secret-passphrase',grant:{accessToken:'secret-access-token',applicationId:'wildz'},keyFile:{schema:'key',name:'name',version:1,issuedAt:'now',keyId:'key',alg:'Ed25519',owner:{uid:'owner',username:'fixture',email:null,displayName:null},crypto:{publicKeyRawB64u:'public',privateKeyPkcs8B64u:'secret-plain-key',privateKeyPkcs8CiphertextB64u:'secret-encrypted-key',kdf:{saltB64u:'secret-kdf'},cipher:{ivB64u:'secret-cipher'}},attestation:{private:'secret-attestation'},portableState:{private:'secret-state'}}};
 const initial=wildsClearanceWorkerAuthor(author as unknown as Parameters<typeof wildsClearanceWorkerAuthor>[0]);
 assert.equal(JSON.stringify(initial).includes('secret-'),false);assert.equal(initial.keyFile.crypto.publicKeyRawB64u,'public');assert.equal(author.passphrase,'secret-passphrase');
});
test('unsupported RPC method fails closed and concurrent work never queues another source copy',async()=>{
 const {createWildsClearanceActionWorkerClient}=await client();let created=0;
 const port=createWildsClearanceActionWorkerClient({worker:()=>{created++;return {postMessage(){},terminate(){},addEventListener(){},removeEventListener(){}} as unknown as Worker;},initialize:()=>({}),callback:async()=>null});
 await assert.rejects(port.run('wallet.bootstrap',[]),/method_invalid/);assert.equal(created,0);
 const first=port.run('readCurrent',[]);await assert.rejects(port.run('readCurrent',[]),/busy/);assert.equal(created,1);port.dispose();await assert.rejects(first,/cancelled/);
});
test('only compact qualified action projections cross back; full source and SDK history stay worker-local',async()=>{
 const path='../src/lib/receiz/wilds-clearance-action-worker-engine.js';const loaded=await import(path);
 assert.equal(typeof loaded.projectWildsClearanceWorkerResult,'function');
 const source={state:{clearances:{a:{id:'a'}},clearanceTaken:{a:1},traces:{large:'decoded-history'}},predecessor:{head:{head:'exact-native-head'},artifact:{bytes:'Original'}},proof:{bytes:'Original'},events:['decoded-history']};
 const projected=loaded.projectWildsClearanceWorkerResult('readCurrent',source);
 assert.deepEqual(projected,{state:{clearances:source.state.clearances,clearanceTaken:source.state.clearanceTaken},predecessor:{head:{head:'exact-native-head'}}});
 const outcome={status:'admitted',members:[{id:'exact-member'}],projection:{world:'qualified'},nourishment:{items:{}},state:source.state,proof:source.proof};
 assert.deepEqual(loaded.projectWildsClearanceWorkerResult('recoverClearance',outcome),{status:'admitted',members:outcome.members,projection:outcome.projection,nourishment:outcome.nourishment});
});
test('production RPC bridge keeps authorization on main, rejects foreign paths, and fences owner changes',async(t)=>{
 const {createWildsClearanceActionWorkerRuntime}=await import('../src/lib/receiz/wilds-clearance-action-worker-runtime');
 const sent:unknown[]=[],listeners=new Map<string,(event:MessageEvent)=>void>();let fetches=0,current=true;
 const worker={postMessage:(value:unknown)=>sent.push(structuredClone(value)),terminate(){},addEventListener:(type:string,fn:(event:MessageEvent)=>void)=>listeners.set(type,fn),removeEventListener:(type:string)=>listeners.delete(type)} as unknown as Worker;
 const originalWorker=globalThis.Worker;globalThis.Worker=class {constructor(){return worker;}} as unknown as typeof Worker;t.after(()=>{globalThis.Worker=originalWorker;});
 const author={ownerReceizId:'fixture.receiz.id',actorSubjectId:'subject',actorSubjectHead:'head',grant:{accessToken:'fixture-token-main-only',applicationId:'wildz'},keyFile:{schema:'key',name:'name',version:1,issuedAt:'now',keyId:'key',alg:'Ed25519',owner:{uid:'owner',username:'fixture'},crypto:{publicKeyRawB64u:'public',privateKeyPkcs8B64u:'fixture-key-main-only'}}};
 const runtime=createWildsClearanceActionWorkerRuntime({configuration:{applicationId:'wildz',baseUrl:'https://receiz.com'},author,session:{authoritySessionHandle:'fixture-session-only'},gameplayOwnerId:'fixture',sdk:{},assertCurrent:()=>{if(!current)throw Error('owner_changed');},fetcher:async(request:RequestInfo|URL,init?:RequestInit)=>{assert.equal(request,'/api/wilds/wallet/source-sdk');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer fixture-token-main-only');fetches++;return Response.json({ok:true,record:null});}} as unknown as Parameters<typeof createWildsClearanceActionWorkerRuntime>[0]);
 const operation=runtime.exchange.readCurrent();await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(JSON.stringify(sent[0]).includes('main-only'),false);
 const emit=(value:unknown)=>listeners.get('message')!({data:value} as MessageEvent);
 const callback=async(id:number,path:string)=>{emit({type:'callback',id,method:'fetch',args:['/api/wilds/wallet/source-sdk',{headers:[],text:JSON.stringify({path,method:'GET',query:'url=https%3A%2F%2Fwildz.quest%2Freceiz%2Fresource-source-v128',body:null})}]});await new Promise(resolve=>setTimeout(resolve,0));};
 await callback(1,'/api/private/arbitrary');assert.equal(fetches,0);assert.equal((sent.at(-1) as {ok:boolean}).ok,false);
 await callback(2,'/api/public-proof/by-url');assert.equal(fetches,1);assert.equal((sent.at(-1) as {ok:boolean}).ok,true);
 current=false;await callback(3,'/api/public-proof/by-url');assert.equal(fetches,1);assert.match((sent.at(-1) as {error:string}).error,/owner_changed/);
 emit({type:'result',ok:true,value:null});await assert.rejects(operation,/owner_changed/);
});
test('disposal while legacy runtime opens prevents a late clearance port from starting',async()=>{
 const path='../src/lib/receiz/wilds-clearance-action-worker-client.js';const loaded=await import(path);let resolve!:(key:object)=>void,created=0;
 const slot=loaded.createWildsClearanceRuntimeSlot(async()=>{created++;return {dispose(){}};},()=>{});
 assert.equal(typeof slot.openAfter,'function');
 const pending=slot.openAfter(()=>new Promise<object>(done=>{resolve=done;}));slot.dispose();resolve({});
 await assert.rejects(pending,/cancelled/);assert.equal(created,0);
});

test('concurrent legacy opens coalesce one clearance port and allow a later fresh panel',async()=>{
 const {createWildsClearanceRuntimeSlot}=await import('../src/lib/receiz/wilds-clearance-action-worker-client');
 let created=0,disposed=0;const key={};
 const slot=createWildsClearanceRuntimeSlot(async()=>{created++;return {dispose(){disposed++;}};},()=>{});
 const [a,b]=await Promise.all([slot.openAfter(async()=>key),slot.openAfter(async()=>key)]);
 assert.equal(a,b);assert.equal(created,1);slot.dispose();assert.equal(disposed,1);
 assert.notEqual(await slot.openAfter(async()=>key),a);assert.equal(created,2);slot.dispose();
});

test('disposed exchange cannot start another worker after persistence between sequential operations',async()=>{
 const {createWildsClearanceActionWorkerClient}=await client();let created=0,terminated=0;
 let listener:((event:MessageEvent)=>void)|undefined;
 const port=createWildsClearanceActionWorkerClient({worker:()=>{created++;return {postMessage(){},terminate(){terminated++;},addEventListener(type:string,fn:(event:MessageEvent)=>void){if(type==='message')listener=fn;},removeEventListener(){}} as unknown as Worker;},initialize:()=>({}),callback:async()=>null});
 const first=port.run('readCurrent',[]);await Promise.resolve();await Promise.resolve();
 listener!({data:{type:'result',ok:true,value:null}} as MessageEvent);await first;
 let resume!:()=>void;const persistence=new Promise<void>(resolve=>{resume=resolve;});
 const delayed=persistence.then(()=>port.run('recoverClearance',['exact-retained-attempt']));
 port.dispose();resume();
 const outcome=await Promise.race([delayed.then(()=> 'resolved',error=>String(error)),new Promise<string>(resolve=>setTimeout(()=>resolve('old exchange started another worker'),20))]);
 port.dispose();await delayed.catch(()=>undefined);
 assert.match(outcome,/clearance_worker_disposed/);assert.equal(created,1);assert.equal(terminated,1);
});

test('idle disposal retires the old client while a new slot runtime remains usable',async()=>{
 const {createWildsClearanceActionWorkerClient,createWildsClearanceRuntimeSlot}=await import('../src/lib/receiz/wilds-clearance-action-worker-client');
 let created=0;const slot=createWildsClearanceRuntimeSlot(async()=>createWildsClearanceActionWorkerClient({worker:()=>{created++;return {postMessage(){},terminate(){},addEventListener(){},removeEventListener(){}} as unknown as Worker;},initialize:()=>({}),callback:async()=>null}),()=>{});
 const key={},old=await slot.openAfter(async()=>key);slot.dispose();
 const delayed=old.run('readCurrent',[]);
 const outcome=await Promise.race([delayed.then(()=> 'resolved',error=>String(error)),new Promise<string>(resolve=>setTimeout(()=>resolve('disposed idle client started worker'),20))]);
 old.dispose();await delayed.catch(()=>undefined);
 assert.match(outcome,/clearance_worker_disposed/);assert.equal(created,0);
 const fresh=await slot.openAfter(async()=>key);assert.notEqual(fresh,old);
 const active=fresh.run('recoverClearance',['exact-retained-attempt']);assert.equal(created,1);
 slot.dispose();await assert.rejects(active,/clearance_worker_cancelled/);
 await assert.rejects(fresh.run('recoverClearance',['exact-retained-attempt']),/clearance_worker_disposed/);assert.equal(created,1);
});


test('material command shares the one bounded private action slot and retires on completion',async()=>{
 const {createWildsClearanceActionWorkerClient}=await client();let created=0,terminated=0;
 const listeners=new Map<string,(event:MessageEvent)=>void>(),sent:unknown[]=[];
 const port=createWildsClearanceActionWorkerClient({worker:()=>{created++;return {postMessage:(value:unknown)=>sent.push(value),terminate:()=>{terminated++;},addEventListener:(type:string,fn:(event:MessageEvent)=>void)=>listeners.set(type,fn),removeEventListener:(type:string)=>listeners.delete(type)} as unknown as Worker;},initialize:()=>({public:'existing scoped author'}),callback:async()=>null});
 const args=[{attemptId:'material:exact',command:{kind:'world',command:{commandId:'world:exact'}}}];
 const pending=port.run('admitMaterialCommand',args);
 await assert.rejects(port.run('readCurrent',[]),/busy/);assert.equal(created,1);
 await Promise.resolve();await Promise.resolve();assert.deepEqual((sent[0] as {args:unknown[]}).args,args);
 listeners.get('message')!({data:{type:'result',ok:true,value:{kind:'ordinary',command:args[0]!.command}}} as MessageEvent);
 assert.deepEqual(await pending,{kind:'ordinary',command:args[0]!.command});assert.equal(terminated,1);
});
