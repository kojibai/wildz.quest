'use client';
import {useEffect,useState} from 'react';
import {createReceizClient} from '@receiz/sdk';
import {createWildsClearanceActionWorkerRuntime} from '@/lib/receiz/wilds-clearance-action-worker-runtime';
import {createWildsClearanceActionWorkerClient} from '@/lib/receiz/wilds-clearance-action-worker-client';
declare global{interface Window{clearancePerformance:{run:(mode:string)=>Promise<unknown>;frames:number[];workers:{created:number;terminated:number;resident:number};results:unknown[]}}}
export default function Probe(){
 const [status,setStatus]=useState('ready');
 useEffect(()=>{const frames:number[]=[],workers={created:0,terminated:0,resident:0},results:unknown[]=[];let previous=0,frame=0;
 const animate=(now:number)=>{if(previous&&frames.length<30000)frames.push(now-previous);previous=now;frame=requestAnimationFrame(animate);};frame=requestAnimationFrame(animate);
 const nativeWorker=()=>{const worker=new Worker(new URL('../../../src/lib/receiz/wilds-clearance-action.worker.ts',import.meta.url),{type:'module'});workers.created++;workers.resident++;const terminate=worker.terminate.bind(worker);worker.terminate=()=>{workers.terminated++;workers.resident--;terminate();};return worker;};
 const production=createWildsClearanceActionWorkerRuntime({configuration:{applicationId:'wildz',baseUrl:'https://receiz.com'},author:{ownerReceizId:'fixture.receiz.id',actorSubjectId:'fixture',actorSubjectHead:'fixture',grant:{applicationId:'wildz',accessToken:'fixture-unusable-token'},keyFile:{owner:{uid:'fixture',username:'fixture'},crypto:{publicKeyRawB64u:'fixture'}}},session:{authoritySessionHandle:'fixture-unusable-session'},gameplayOwnerId:'fixture',sdk:createReceizClient({applicationId:'wildz',fetchImpl:async()=>{throw Error('qualification_native_network_forbidden');}}),assertCurrent:()=>{},worker:nativeWorker,fetcher:async(_request:RequestInfo|URL,init?:RequestInit)=>{const body=JSON.parse(String(init?.body));if(body.path!=='/api/public-proof/by-url'||body.method!=='GET')throw Error('qualification_native_write_forbidden');return Response.json({ok:true,record:null});}} as unknown as Parameters<typeof createWildsClearanceActionWorkerRuntime>[0]);
 const client=createWildsClearanceActionWorkerClient({worker:()=>{const worker=new Worker(new URL('./qualification.worker.ts',import.meta.url),{type:'module'});workers.created++;workers.resident++;const terminate=worker.terminate.bind(worker);worker.terminate=()=>{workers.terminated++;workers.resident--;terminate();};return worker;},initialize:()=>({}),callback:async()=>{throw Error('qualification_callback_forbidden');}});
 window.clearancePerformance={frames,workers,results,run:async(mode)=>{setStatus(mode);const start=performance.now(),result=mode==='production-empty'?await production.exchange.readCurrent():await client.run('readCurrent',[mode],async()=>{throw Error('qualification_native_write_forbidden');});const output={mode,wallMs:performance.now()-start,result:result&&typeof result==='object'&&'qualification'in result?result.qualification:result};results.push(output);setStatus('ready');return output;}};
 return ()=>{cancelAnimationFrame(frame);client.dispose();production.dispose();};
 },[]);
 return <main><h1>Clearance worker performance qualification</h1><p>Controlled semantic fixtures and retained genuine Originals. No identity access, signing, sealing or external requests.</p><output>{status}</output></main>;
}
