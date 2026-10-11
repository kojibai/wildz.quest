import type {WildsClearanceDisplayHistory} from '../../lib/receiz/wilds-clearance-public-read-v128';
import {freezeConstructionProof} from './wilds-construction-project';
import {emitWildsPlaytestDuration} from './wilds-playtest-events';
/** Public source opening/replay runs in its own worker. Only compact geometry
 * and finite counts cross to the renderer; worker failure keeps known history. */
export function createWildsClearancePublicWorkerReader(){
 let cached:WildsClearanceDisplayHistory|null=null;let cancelActive:(()=>void)|null=null;
 let worker:Worker|null=null,id=0,active:Promise<WildsClearanceDisplayHistory|null>|null=null;
 return {dispose(){cancelActive?.();worker?.terminate();worker=null;cached=null;},read(signal?:AbortSignal){
  if(active)return active;
  if(typeof Worker==='undefined')return Promise.reject(Error('Public clearance worker unavailable.'));
  worker??=new Worker(new URL('./wilds-clearance-public.worker.ts',import.meta.url),{type:'module'});
  const current=worker,requestId=++id;
  const operation=new Promise<WildsClearanceDisplayHistory|null>((resolve,reject)=>{
   const cleanup=()=>{cancelActive=null;current.removeEventListener('message',message);current.removeEventListener('error',failure);signal?.removeEventListener('abort',cancel);clearTimeout(timer);};
   const cancel=()=>{cleanup();current.terminate();if(worker===current)worker=null;reject(Error('Public clearance read cancelled.'));};
   const failure=()=>{cleanup();current.terminate();if(worker===current)worker=null;reject(Error('Public clearance worker failed.'));};
   const message=(event:MessageEvent<{id:number;ok:boolean;value:WildsClearanceDisplayHistory|null;error?:string;durationMs?:number;unchanged?:boolean}>)=>{
    if(event.data.id!==requestId)return;cleanup();if(!event.data.ok){reject(Error(event.data.error));return;}
    if(typeof event.data.durationMs==='number')emitWildsPlaytestDuration('world-worker',event.data.durationMs);
    if(!event.data.unchanged)cached=event.data.value?freezeConstructionProof(event.data.value):null;resolve(cached);
   };
   cancelActive=cancel;const timer=setTimeout(failure,60_000);current.addEventListener('message',message);current.addEventListener('error',failure);signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted){cancel();return;}current.postMessage({id:requestId});
  });active=operation;void operation.finally(()=>{if(active===operation)active=null;}).catch(()=>undefined);return operation;
 }};
}
