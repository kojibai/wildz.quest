import { assertCreationData, createCreationDefinition, parseCreationDefinition } from './definition';
import { applyCreationPatch } from './patch';
import { validateCreationBudget } from './resources';
import { CREATION_BEHAVIORS, CREATION_MATERIALS } from './registry';
import type { CreationCompileContext } from './compiler';
import type { CreationDefinition, CreationPatch } from './types';
import type { CreationWorker } from './capabilities';
export type CreationPlannerRequest=Readonly<{requestId:string;actorId:string;message:string;selected:CreationDefinition|null;workers:readonly CreationWorker[];context:CreationCompileContext}>;
export type CreationPlannerProposal={requestId:string;reply:string;definition:CreationDefinition}|{requestId:string;reply:string;patch:CreationPatch};
export type CreationPlannerPort={propose(request:CreationPlannerRequest,signal:AbortSignal):Promise<unknown>};
export type CreationPlannerResult={status:'proposed';proposal:CreationPlannerProposal}|{status:'unavailable'|'blocked';reason:string};
/** A useful proposal refusal, distinct from an unavailable service or arbitrary provider error. */
export class CreationPlannerBlockedError extends Error {
 constructor(reason:string){super(reason.slice(0,4000));this.name='CreationPlannerBlockedError';}
}
export async function planCreation(request:CreationPlannerRequest,port:CreationPlannerPort,signal:AbortSignal):Promise<CreationPlannerResult>{
 try {assertCreationData(request);validateCreationBudget(request.context.budget);if(!request.requestId||request.requestId.length>160||!request.actorId||!request.message.trim()||request.message.length>4000||!request.workers.length||request.workers.some(w=>!w.ready))throw Error('Select ready creatures and enter a creation prompt.');if(request.selected)parseCreationDefinition(request.selected);}
 catch(error){return {status:'blocked',reason:error instanceof Error?error.message:'Invalid creation request'};}
 if(signal.aborted)return {status:'unavailable',reason:'Request cancelled. Your draft is saved.'};
 const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let rejectAbort:((reason:Error)=>void)|undefined;
 const cancelled=new Promise<never>((_,reject)=>{rejectAbort=reject;});
 const cancel=()=>{abort.abort();rejectAbort?.(Error('Request cancelled. Your draft is saved.'));};signal.addEventListener('abort',cancel,{once:true});
 timer=setTimeout(()=>{abort.abort();rejectAbort?.(Error('The planner took too long. Your draft is saved.'));},20000);
 let raw:unknown;
 try {raw=await Promise.race([port.propose(request,abort.signal),cancelled]);}
 catch(error) {return signal.aborted?{status:'unavailable',reason:'Request cancelled. Your draft is saved.'}:error instanceof CreationPlannerBlockedError?{status:'blocked',reason:error.message}:{status:'unavailable',reason:'The creation planner is unavailable. Your draft is saved.'};}
 finally {clearTimeout(timer);signal.removeEventListener('abort',cancel);}
 try {
  if(typeof raw==='string'){if(raw.length>262144)throw Error('Proposal is too large.');raw=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}
  assertCreationData(raw);if(JSON.stringify(raw).length>262144)throw Error('Proposal is too large.');
  const value=raw as {requestId:string;reply:string;definition?:CreationDefinition;patch?:CreationPatch};
  if(!value||value.requestId!==request.requestId||typeof value.reply!=='string'||value.reply.length>4000||Boolean(value.definition)===Boolean(value.patch))throw Error('The planner returned an incomplete or stale proposal.');
  const definition=value.definition?(value.definition.digest?parseCreationDefinition(value.definition):createCreationDefinition(value.definition)):request.selected&&value.patch?applyCreationPatch(request.selected,value.patch):null;
  if(!definition||definition.creatorId!==(request.selected?.creatorId||request.actorId))throw Error('creation_creator_mismatch');
  for(const node of definition.nodes){if(!CREATION_MATERIALS[node.material])throw Error(`Material ${node.material} is unavailable.`);for(const behavior of node.behaviors)if(!CREATION_BEHAVIORS[behavior.id]||CREATION_BEHAVIORS[behavior.id].version!==behavior.version)throw Error(`Behavior ${behavior.id} has no qualified law.`);}
  return {status:'proposed',proposal:value.patch?{requestId:value.requestId,reply:value.reply,patch:value.patch}:{requestId:value.requestId,reply:value.reply,definition}};
 }catch(error){return {status:'blocked',reason:error instanceof Error?error.message:'Invalid proposal'};}
}
