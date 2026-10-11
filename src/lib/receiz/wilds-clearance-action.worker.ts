/// <reference lib="webworker" />
import {runWildsClearanceWorkerExchange} from './wilds-clearance-action-worker-engine';
const scope=self as unknown as DedicatedWorkerGlobalScope;
const pending=new Map<number,{resolve:(value:unknown)=>void;reject:(cause:Error)=>void}>();let nextId=0,started=false;
const callback=(method:string,args:unknown[])=>new Promise<unknown>((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});scope.postMessage({type:'callback',id,method,args});});
scope.addEventListener('message',(event:MessageEvent)=>{
 const data=event.data;
 if(data?.type==='callback-result'){const held=pending.get(data.id);if(!held)return;pending.delete(data.id);if(data.ok)held.resolve(data.value);else held.reject(Error(data.error));return;}
 if(data?.type!=='run'||started)return;started=true;
 void runWildsClearanceWorkerExchange(data.initial,data.method,data.args,callback).then(value=>scope.postMessage({type:'result',ok:true,value}),cause=>scope.postMessage({type:'result',ok:false,error:cause instanceof Error?cause.message:'wilds_clearance_worker_failed'}));
});
