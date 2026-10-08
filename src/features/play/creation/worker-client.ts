import type { CreationCompileContext, CreationCompileResult } from './compiler';
import type { CreationDefinition } from './types';
import type {CreationPhaseResult} from './affordable-phase';
type WorkerResult=CreationCompileResult|CreationPhaseResult;
export type CreationWorkerPort={onmessage:((event:{data:{requestId:string;result:WorkerResult}})=>void)|null;onerror:((event:{preventDefault?():void})=>void)|null;postMessage(message:unknown):void;terminate():void};
const blocked=(message:string):CreationCompileResult=>({status:'blocked',blockers:[{code:'worker',nodeId:null,message}]});
export function createCreationWorkerClient(factory?:()=>CreationWorkerPort) {
 let worker:CreationWorkerPort|null=null,closed=false,failed=false;
 const pending=new Map<string,{resolve:(r:WorkerResult)=>void;timer:ReturnType<typeof setTimeout>}>();
 const settle=(id:string,result:WorkerResult)=>{const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);p.resolve(result);};
 const stop=(message:string)=>{worker?.terminate();worker=null;for(const id of pending.keys())settle(id,blocked(message));};
 const request=<T extends WorkerResult>(requestId:string,message:unknown):Promise<T>=>{
   if(closed||failed)return Promise.resolve(blocked('Creation worker unavailable. Your draft is saved.') as T);
   if(pending.has(requestId))return Promise.resolve(blocked('Duplicate compile request.') as T);
   try {if(!worker){worker=factory?factory():typeof Worker!=='undefined'?new Worker(new URL('./worker.ts',import.meta.url),{type:'module'}) as unknown as CreationWorkerPort:null;if(!worker)throw Error('Worker unavailable');worker.onmessage=({data})=>settle(data.requestId,data.result);worker.onerror=(event)=>{event.preventDefault?.();failed=true;stop('Creation worker failed. Your draft is saved.');};}}
   catch {failed=true;stop('Creation worker unavailable. Your draft is saved.');return Promise.resolve(blocked('Creation worker unavailable. Your draft is saved.') as T);}
   return new Promise(resolve=>{const timer=setTimeout(()=>{failed=true;stop('Creation took too long. Try a smaller page.');},15000);pending.set(requestId,{resolve:result=>resolve(result as T),timer});try {worker!.postMessage(message);}catch{failed=true;stop('Creation worker could not accept this draft.');}});
 };
 return {
  compile(requestId:string,definition:CreationDefinition,context:CreationCompileContext){return request<CreationCompileResult>(requestId,{requestId,definition,context});},
  phase(requestId:string,definition:CreationDefinition,context:CreationCompileContext,mode:'automatic'|'manual'){return request<CreationPhaseResult>(requestId,{requestId,definition,context,kind:'phase',mode});},
  cancel(requestId:string){settle(requestId,blocked('Creation request cancelled.'));if(!pending.size){worker?.terminate();worker=null;}},
  close(){closed=true;stop('Creation worker closed.');},
 };
}
