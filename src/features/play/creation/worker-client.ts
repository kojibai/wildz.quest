import type { CreationCompileContext, CreationCompileResult } from './compiler';
import type { CreationDefinition } from './types';
export type CreationWorkerPort={onmessage:((event:{data:{requestId:string;result:CreationCompileResult}})=>void)|null;onerror:((event:{preventDefault?():void})=>void)|null;postMessage(message:unknown):void;terminate():void};
const blocked=(message:string):CreationCompileResult=>({status:'blocked',blockers:[{code:'worker',nodeId:null,message}]});
export function createCreationWorkerClient(factory?:()=>CreationWorkerPort) {
 let worker:CreationWorkerPort|null=null,closed=false,failed=false;
 const pending=new Map<string,{resolve:(r:CreationCompileResult)=>void;timer:ReturnType<typeof setTimeout>}>();
 const settle=(id:string,result:CreationCompileResult)=>{const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);p.resolve(result);};
 const stop=(message:string)=>{worker?.terminate();worker=null;for(const id of pending.keys())settle(id,blocked(message));};
 return {
  compile(requestId:string,definition:CreationDefinition,context:CreationCompileContext):Promise<CreationCompileResult>{
   if(closed||failed)return Promise.resolve(blocked('Creation worker unavailable. Your draft is saved.'));
   if(pending.has(requestId))return Promise.resolve(blocked('Duplicate compile request.'));
   try {if(!worker){worker=factory?factory():typeof Worker!=='undefined'?new Worker(new URL('./worker.ts',import.meta.url),{type:'module'}) as unknown as CreationWorkerPort:null;if(!worker)throw Error('Worker unavailable');worker.onmessage=({data})=>settle(data.requestId,data.result);worker.onerror=(event)=>{event.preventDefault?.();failed=true;stop('Creation worker failed. Your draft is saved.');};}}
   catch {failed=true;stop('Creation worker unavailable. Your draft is saved.');return Promise.resolve(blocked('Creation worker unavailable. Your draft is saved.'));}
   return new Promise(resolve=>{const timer=setTimeout(()=>{failed=true;stop('Creation took too long. Try a smaller page.');},15000);pending.set(requestId,{resolve,timer});try {worker!.postMessage({requestId,definition,context});}catch{failed=true;stop('Creation worker could not accept this draft.');}});
  },
  cancel(requestId:string){settle(requestId,blocked('Creation request cancelled.'));if(!pending.size){worker?.terminate();worker=null;}},
  close(){closed=true;stop('Creation worker closed.');},
 };
}
