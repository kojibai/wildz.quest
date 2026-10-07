import {readBoundedRequestText,RequestBodyTooLargeError} from '@/lib/http/read-bounded-body';
import { NextRequest, NextResponse } from 'next/server';
import { resolveWildzGameplayCookieActor } from '@/lib/receiz/wildz-cookie-actor';
import { readWildzProofSessionCookie } from '@/lib/receiz/wildz-proof-session';
import { canCurrentWildzOwnerObserveCreature } from '@/lib/receiz/wildz-creature-observer-ownership';
import { planWildsCreation } from '@/lib/receiz/wilds-creation-planner';
import type { CreationPlannerRequest } from '@/features/play/creation/planner';
import { projectCreationWorkers } from '@/features/play/creation/capabilities';
import { emptyAdventureCondition } from '@/features/play/adventure/card-condition';
import { verifyAnyWildsCard, type PortableCardAsset } from '@/features/play/portable-card';
import { verifyWildsMaterialLot, type WildsMaterialLotV1 } from '@/features/play/wilds-steward-construction';
import { validateCreationBudget } from '@/features/play/creation/resources';
import { assertCreationData } from '@/features/play/creation/definition';
import { CREATION_WORLD_RULE } from '@/features/play/creation/world-source';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
export async function POST(request:NextRequest){
 try {
  const text=await readBoundedRequestText(request,1048576);
  const input=JSON.parse(text) as CreationPlannerRequest & {cards:PortableCardAsset[];cardAdmissions:Record<string,unknown>;lots:WildsMaterialLotV1[]};assertCreationData(input);
  const actor=await resolveWildzGameplayCookieActor(request);if(input.actorId!==actor.actorId)return reply({status:'blocked',reason:'Creation owner changed.'},403);
  let proofSession:ReturnType<typeof readWildzProofSessionCookie>|null=null;try{proofSession=readWildzProofSessionCookie(request);}catch{}
  if(!Array.isArray(input.cards))return reply({status:'blocked',reason:'Creature evidence is unavailable. Select your crew again.'},422);
  if(!input.cards.length)return reply({status:'blocked',reason:'Select at least one ready creature.'},422);
  if(input.cards.length>CREATION_WORLD_RULE.maximumWorkers)return reply({status:'blocked',reason:`Choose up to ${CREATION_WORLD_RULE.maximumWorkers} creatures for one creation.`},422);
  for(const card of input.cards){
   let verified=false;try{verified=verifyAnyWildsCard(card).ok;}catch{}
   if(!verified)return reply({status:'blocked',reason:'A creature proof could not be verified. Select your crew again.'},403);
   if(!canCurrentWildzOwnerObserveCreature({actorId:actor.actorId,profileHandle:actor.profileHandle,proofSession,card,cardAdmission:input.cardAdmissions?.[card.id]}))return reply({status:'blocked',reason:`Current creature ownership could not be verified for ${card.manifest.name}.`},403);
  }
  const cardIds=new Set(input.cards.map(card=>card.id));
  if(cardIds.size!==input.cards.length)return reply({status:'blocked',reason:'Selected creature evidence contains duplicates. Select your crew again.'},422);
  if(!Array.isArray(input.workers)||input.workers.length!==input.cards.length||new Set(input.workers.map(worker=>worker?.assetId)).size!==cardIds.size||input.workers.some(worker=>!cardIds.has(worker?.assetId)))return reply({status:'blocked',reason:'Selected creatures changed. Select your crew again.'},422);
  // This is proposal evidence only. Execution rechecks live conditions, custody, heads, mandates, and physical chunks atomically.
  const workers=projectCreationWorkers(input.cards,Object.fromEntries(input.cards.map(card=>[card.id,emptyAdventureCondition(card.id)])));
  validateCreationBudget(input.context.budget);const carried:Record<string,number>={},seen=new Set<string>();
  if(!Array.isArray(input.lots)||input.lots.length>4096)return reply({status:'blocked',reason:'Material evidence is unavailable.'},422);
  for(const lot of input.lots)if(verifyWildsMaterialLot(lot)&&lot.ownerReceizId===actor.actorId&&!seen.has(lot.lotId)){seen.add(lot.lotId);carried[lot.kind]=(carried[lot.kind]||0)+lot.quantity;}
  const budget=Object.fromEntries(Object.entries(input.context.budget).map(([kind,ceiling])=>[kind,Math.min(ceiling,carried[kind]||0)]));
  const authenticated={requestId:input.requestId,actorId:actor.actorId,message:input.message,selected:input.selected,workers,context:{...input.context,budget,techniques:[...new Set(workers.flatMap(w=>w.techniques))]}};
  return reply(await planWildsCreation(authenticated,actor,request.signal));
 }catch(error){if(error instanceof RequestBodyTooLargeError)return reply({status:'blocked',reason:'Creation request too large.'},413);return reply({status:'unavailable',reason:error instanceof Error&&error.message.startsWith('receiz_')?'Connect your authenticated Wildz account to use the creation planner.':'The creation planner could not accept this request. Your draft is saved.'},422);}
}
