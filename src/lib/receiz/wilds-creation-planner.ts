import { createReceizClient } from '@receiz/sdk';
import { normalizeCreatureTwinReply } from '../../features/play/creature-consciousness';
import { CREATION_BEHAVIORS, CREATION_MATERIALS } from '../../features/play/creation/registry';
import type { CreationPlannerPort } from '../../features/play/creation/planner';
import { WILDZ_RECEIZ_APPLICATION_ID } from './wildz-application';
import { qualifyWildzV124Operations, WILDZ_V124_TWIN_OPERATIONS } from './v124-runtime-policy';
export function createReceizCreationPlanner(actor:{actorId:string;accessToken?:string}):CreationPlannerPort {
 return {async propose(request,signal){
  if(!actor.accessToken||actor.actorId!==request.actorId)throw Error('creation_generation_authority_unavailable');
  const client=createReceizClient({applicationId:WILDZ_RECEIZ_APPLICATION_ID,accessToken:actor.accessToken,...(process.env.RECEIZ_BASE_URL?{baseUrl:process.env.RECEIZ_BASE_URL}:{})});
  const qualification=await qualifyWildzV124Operations({qualifyRuntimeV124:input=>client.runtime.qualifyV124(input)},WILDZ_V124_TWIN_OPERATIONS);
  if(!qualification.available||signal.aborted)throw Error('creation_generator_unqualified');
  const message=[
   'Propose an original composed Wildz creation. Return only JSON: {requestId,reply,definition} or {requestId,reply,patch}. Never claim construction, payment, spending, or physical completion. The deterministic compiler sets costs and mechanics.',
   'Definition: {schema:"wildz.creation-definition.v1",grammarVersion:1,seed:string,creatorId:string,nodes:[],assets:[]}. Omit digest. Nodes: {id,parentId:null or prior node id,pose:{position:{x,y,z},yaw},shape:{kind,width,height,depth,thickness?,doorway?:{width,height},piece?,points?},material,attachments:[],supports:[],behaviors:[]}. Use positive finite dimensions. Positions are local base positions in meters. Shapes: box, shell with real doorway, arch, horizontal sweep, rectangular extrusion, catalog using existing architectural pieces. Put inhabitable space in shells with an open doorway. No arbitrary scripts.',
   'Patches: {baseDigest,operations:[{op:"add",node},{op:"update",id,changes},{op:"remove",id}]}. Resolve "it" only to selected. Keep stable node IDs. At most 128 nodes/operations per response; large projects grow via patches. Unsupported mechanics must be explained, not replaced by decorative lookalikes.',
   JSON.stringify({requestId:request.requestId,creatorId:request.selected?.creatorId||actor.actorId,message:request.message,selected:request.selected,techniques:request.workers.flatMap(w=>w.techniques),resourceCeiling:request.context.budget,materials:CREATION_MATERIALS,behaviors:CREATION_BEHAVIORS}),
  ].join('\n');
  const response=await client.world.message(WILDZ_RECEIZ_APPLICATION_ID,{action:'message',message,visitorKey:`creation:${actor.actorId}`,threadKey:`creation:${request.context.spaceId}:${request.selected?.seed||request.requestId}`,allowBrowserVoiceFallback:false,clientContext:{mode:'structured-creation-proposal',physical:false,writes:0},clientUserMessageId:request.requestId,clientOperationId:request.requestId,quoteExpiresAt:new Date(Date.now()+9*60000).toISOString()});
  if(signal.aborted||response.ok!==true)throw Error('creation_generation_unavailable');
  return normalizeCreatureTwinReply(response.reply);
 }};
}
