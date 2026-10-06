import { createReceizClient } from '@receiz/sdk';
import { normalizeCreatureTwinReply } from '../../features/play/creature-consciousness';
import { CREATION_BEHAVIORS, CREATION_MATERIALS } from '../../features/play/creation/registry';
import { planCreation, type CreationPlannerPort, type CreationPlannerRequest, type CreationPlannerResult } from '../../features/play/creation/planner';
import { applyCreationPatch } from '../../features/play/creation/patch';
import { initializeCreationComponents } from '../../features/play/creation/components';
import { LocalCreationPlannerError, proposeLocalCreation } from './wilds-local-creation-planner';
import { WILDZ_RECEIZ_APPLICATION_ID } from './wildz-application';
import { qualifyWildzV124Operations, WILDZ_V124_TWIN_OPERATIONS } from './v124-runtime-policy';
function createQualifiedReceizCreationPlanner(actor:{actorId:string;accessToken?:string}):CreationPlannerPort {
 return {async propose(request,signal){
  if(!actor.accessToken||actor.actorId!==request.actorId)throw Error('creation_generation_authority_unavailable');
  const client=createReceizClient({applicationId:WILDZ_RECEIZ_APPLICATION_ID,accessToken:actor.accessToken,...(process.env.RECEIZ_BASE_URL?{baseUrl:process.env.RECEIZ_BASE_URL}:{})});
  const qualification=await qualifyWildzV124Operations({qualifyRuntimeV124:input=>client.runtime.qualifyV124(input)},WILDZ_V124_TWIN_OPERATIONS);
  if(!qualification.available||signal.aborted)throw Error('creation_generator_unqualified');
  const message=[
   'Propose an original composed Wildz creation. Return only JSON: {requestId,reply,definition} or {requestId,reply,patch}. Never claim construction, payment, spending, or physical completion. The deterministic compiler sets costs and mechanics.',
   'Definition: {schema:"wildz.creation-definition.v1",grammarVersion:1,seed:string,creatorId:string,nodes:[],assets:[]}. Omit digest. Nodes: {id,parentId:null or prior node id,pose:{position:{x,y,z},yaw},shape:{kind,width,height,depth,thickness?,doorway?:{width,height},piece?,points?},material,attachments:[],supports:[],behaviors:[]}. Use positive finite dimensions. Positions are local base positions in meters. Shapes: box, vertical elliptical cylinder, ellipsoid (rounded volume), shell with real doorway, arch, horizontal sweep, rectangular extrusion, catalog using existing architectural pieces. Put inhabitable space in shells with an open doorway. Curved cylinders and ellipsoids have conservative bounding-box colliders; keep player paths clear of those bounds. Use these for rounded handles, vessels, cushions and natural silhouettes. No arbitrary scripts.',
   'Model real construction: human-scale clearances, readable doorway, habitable interior, protective roof, and properly supported parts. When a home or shelter is requested, include a physically separate usable bed node (bed behavior v1) and a habitat behavior on its room; keep the doorway and circulation path clear. Beds require at least 0.7m by 1.9m footprint and height 0.1m to 1m. Compose a mattress and pillow only from selected finite resources. Tools and weapons must be composed from a recognizable grip and working part with their real registered behavior, not a decorative box. Use supporting beams, trim and material changes where resources permit; no floating ornaments or fake mechanics. Material textures are provided by the renderer.',
   'Patches: {baseDigest,operations:[{op:"add",node},{op:"update",id,changes},{op:"remove",id}]}. Resolve "it" only to selected. Keep stable node IDs. At most 128 nodes/operations per response; large projects grow via patches. Unsupported mechanics must be explained, not replaced by decorative lookalikes.',
   JSON.stringify({requestId:request.requestId,creatorId:request.selected?.creatorId||actor.actorId,message:request.message,selected:request.selected,techniques:request.workers.flatMap(w=>w.techniques),resourceCeiling:request.context.budget,materials:CREATION_MATERIALS,behaviors:CREATION_BEHAVIORS}),
  ].join('\n');
  const response=await client.world.message(WILDZ_RECEIZ_APPLICATION_ID,{action:'message',message,visitorKey:`creation:${actor.actorId}`,threadKey:`creation:${request.context.spaceId}:${request.selected?.seed||request.requestId}`,allowBrowserVoiceFallback:false,clientContext:{mode:'structured-creation-proposal',physical:false,writes:0},clientUserMessageId:request.requestId,clientOperationId:request.requestId,quoteExpiresAt:new Date(Date.now()+9*60000).toISOString()});
  if(signal.aborted||response.ok!==true)throw Error('creation_generation_unavailable');
  return normalizeCreatureTwinReply(response.reply);
 }};
}

/** Local proposals require verified ownership, never delegated write authority.
 * Receiz enhancement is explicitly opt-in and must qualify; failure keeps the local draft.
 */
export function createReceizCreationPlanner(actor:{actorId:string;accessToken?:string}):CreationPlannerPort {
 return {async propose(request,signal){
  if(actor.actorId!==request.actorId)throw new LocalCreationPlannerError('Creation owner changed. Your draft is saved.');
  const local=proposeLocalCreation(request,signal);
  if(!actor.accessToken||process.env.RECEIZ_CREATION_REMOTE_ENHANCEMENT!=='true')return local;
  const remoteAbort=new AbortController(),cancel=()=>remoteAbort.abort();
  signal.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(cancel,4000);
  try {
   const remote=await planCreation(request,createQualifiedReceizCreationPlanner(actor),remoteAbort.signal);
   if(remote.status==='proposed'){
    const definition='definition'in remote.proposal?remote.proposal.definition:request.selected?applyCreationPatch(request.selected,remote.proposal.patch):null;
    if(definition){
     if(request.selected&&(definition.seed!==request.selected.seed||request.selected.nodes.some(n=>!definition.nodes.some(next=>next.id===n.id))))return local;
     initializeCreationComponents(definition,0);
     return remote.proposal;
    }
   }
  }catch{ /* A qualified remote enhancement is optional; the deterministic proposal remains usable. */ }
  finally{clearTimeout(timer);signal.removeEventListener('abort',cancel);}
  if(signal.aborted)throw Error('creation_generation_cancelled');
  return local;
 }};
}

/** Preserve a local grammar explanation through the shared provider boundary. */
export async function planWildsCreation(request:CreationPlannerRequest,actor:{actorId:string;accessToken?:string},signal:AbortSignal):Promise<CreationPlannerResult>{
 const planner=createReceizCreationPlanner(actor);let reason:string|undefined;
 const result=await planCreation(request,{async propose(input,abort){try{return await planner.propose(input,abort);}catch(error){if(error instanceof LocalCreationPlannerError)reason=error.message;throw error;}}},signal);
 return reason&&result.status==='unavailable'&&!signal.aborted?{status:'blocked',reason}:result;
}
