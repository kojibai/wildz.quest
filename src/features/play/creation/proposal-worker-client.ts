import { compactCreationPlannerRequest, CreationPlannerBlockedError, type CreationPlannerRequest, type CreationPlannerResult } from './planner';
import { selectCreationProposalEvidence, type CreationProposalEvidence } from './proposal-work';
export type CreationProposalWorkerPort={onmessage:((event:{data:{requestId:string;result:CreationPlannerResult}})=>void)|null;onerror:((event:{preventDefault?():void})=>void)|null;postMessage(message:unknown):void;terminate():void};
const cancelled=()=>Object.assign(Error('Creation proposal cancelled. Your draft is saved.'),{name:'AbortError'});

/** A worker per in-flight proposal lets cancellation terminate synchronous JSON
 * preparation too. Workers are lazy and never start just by opening the panel. */
export function createCreationProposalClient(factory?:()=>CreationProposalWorkerPort){
 let closed=false;
 const pending=new Map<string,{worker:CreationProposalWorkerPort;reject(error:Error):void;cleanup():void}>();
 return {
  propose(request:CreationPlannerRequest,evidence:CreationProposalEvidence,signal:AbortSignal):Promise<unknown>{
   if(closed||signal.aborted)return Promise.reject(cancelled());
   if(pending.has(request.requestId))return Promise.reject(Error('Duplicate creation proposal request.'));
   const compact=compactCreationPlannerRequest(request),selected=selectCreationProposalEvidence(compact,evidence);
   return new Promise((resolve,reject)=>{
    let worker:CreationProposalWorkerPort;
    try{worker=factory?factory():new Worker(new URL('./proposal-worker.ts',import.meta.url),{type:'module'}) as unknown as CreationProposalWorkerPort;}
    catch{reject(Error('Creation worker unavailable. Your draft is saved.'));return;}
    const finish=(error?:Error,result?:unknown)=>{
     if(pending.get(request.requestId)?.worker!==worker)return;
     pending.get(request.requestId)!.cleanup();
     if(error)reject(error);else resolve(result);
    };
    const abort=()=>finish(cancelled());
    const timer=setTimeout(()=>finish(Error('Creation proposal took too long. Your draft is saved.')),20000);
    const cleanup=()=>{pending.delete(request.requestId);clearTimeout(timer);signal.removeEventListener('abort',abort);worker.onmessage=null;worker.onerror=null;worker.terminate();};
    pending.set(request.requestId,{worker,reject,cleanup});
    worker.onmessage=({data})=>{
     if(!data||data.requestId!==request.requestId)return;
     if(signal.aborted){finish(cancelled());return;}
     const result=data.result;
     if(result?.status==='proposed')finish(undefined,result.proposal);
     else finish(result?.status==='blocked'?new CreationPlannerBlockedError(result.reason):Error(result?.reason||'Creation proposal unavailable.'));
    };
    worker.onerror=event=>{event.preventDefault?.();finish(Error('Creation worker failed. Your draft is saved.'));};
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){abort();return;}
    try{worker.postMessage({requestId:compact.requestId,request:compact,evidence:selected});}catch{finish(Error('Creation worker could not accept this draft.'));}
   });
  },
  close(){closed=true;for(const task of [...pending.values()]){task.cleanup();task.reject(cancelled());}}
 };
}
