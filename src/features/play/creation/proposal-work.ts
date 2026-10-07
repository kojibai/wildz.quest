import { compactCreationPlannerRequest, CreationPlannerBlockedError, planCreation, type CreationPlannerRequest, type CreationPlannerResult } from './planner';
import { LocalCreationPlannerError, proposeLocalCreation } from '../../../lib/receiz/wilds-local-creation-planner';
import type { PortableCardAsset } from '../portable-card';
import type { WildsMaterialLotV1 } from '../wilds-steward-construction';

/** Same bound as the HTTP endpoint. Oversized evidence remains on this device. */
export const CREATION_PROPOSAL_BODY_LIMIT=1048576;
export type CreationProposalEvidence={cards:readonly PortableCardAsset[];cardAdmissions:Readonly<Record<string,unknown>>;lots:readonly WildsMaterialLotV1[];localOnly?:boolean};

/** Select references only: never clone/serialize world geometry or the account's
 * full admission map on the rendering thread. These are proposal hints, never
 * material selection or a build receipt; the endpoint still verifies evidence. */
export function selectCreationProposalEvidence(request:CreationPlannerRequest,input:CreationProposalEvidence):CreationProposalEvidence {
 const ids=new Set(request.workers.map(worker=>worker.assetId));
 const cards=input.cards.filter(card=>ids.has(card.id));
 const cardAdmissions:Record<string,unknown>={};
 for(const card of cards)if(Object.hasOwn(input.cardAdmissions,card.id))cardAdmissions[card.id]=input.cardAdmissions[card.id];
 const remaining={...request.context.budget},seen=new Set<string>(),lots:WildsMaterialLotV1[]=[];
 for(const lot of input.lots){
  if(!lot||lot.ownerReceizId!==request.actorId||seen.has(lot.lotId)||!(remaining[lot.kind]>0)||!Number.isSafeInteger(lot.quantity)||lot.quantity<=0)continue;
  if(lots.length===4096)return {cards:[],cardAdmissions:{},lots:[],localOnly:true};
  seen.add(lot.lotId);lots.push(lot);remaining[lot.kind]=Math.max(0,remaining[lot.kind]-lot.quantity);
 }
 return {cards,cardAdmissions,lots};
}

/** Runs only in the proposal worker. JSON encoding, byte counting, optional
 * HTTP and deterministic fallback never perform construction or spend lots. */
export async function runCreationProposal(raw:CreationPlannerRequest,evidence:CreationProposalEvidence,signal:AbortSignal,fetcher:typeof fetch=fetch):Promise<CreationPlannerResult> {
 const request=compactCreationPlannerRequest(raw);
 const local=()=>planCreation(request,{async propose(input,abort){
  try{return proposeLocalCreation(input,abort);}catch(error){if(error instanceof LocalCreationPlannerError)throw new CreationPlannerBlockedError(error.message);throw error;}
 }},signal);
 if(signal.aborted)return {status:'unavailable',reason:'Request cancelled. Your draft is saved.'};
 // Account history may make even one selected proof exceed the transport cap.
 // The grammar needs the small request, not custody/history evidence.
 if(evidence.localOnly)return local();
 const body=JSON.stringify({...request,cards:evidence.cards,cardAdmissions:evidence.cardAdmissions,lots:evidence.lots});
 if(new TextEncoder().encode(body).byteLength>CREATION_PROPOSAL_BODY_LIMIT||evidence.lots.length>4096)return local();
 try {
  const response=await fetcher('/api/wilds/creation/propose',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body,signal});
  if(signal.aborted)return {status:'unavailable',reason:'Request cancelled. Your draft is saved.'};
  if(response.status===413)return local();
  const result=await response.json() as CreationPlannerResult;
  if(signal.aborted)return {status:'unavailable',reason:'Request cancelled. Your draft is saved.'};
  if(result.status==='blocked')return {status:'blocked',reason:typeof result.reason==='string'?result.reason.slice(0,4000):'The creation planner refused this request.'};
  if(!response.ok||result.status!=='proposed')return {status:'unavailable',reason:'The creation planner is unavailable. Your draft is saved.'};
  return planCreation(request,{async propose(){return result.proposal;}},signal);
 }catch{return {status:'unavailable',reason:signal.aborted?'Request cancelled. Your draft is saved.':'The creation planner is unavailable. Your draft is saved.'};}
}
