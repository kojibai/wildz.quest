import { NextRequest, NextResponse } from 'next/server';
import { resolveWildzCookieActor } from '@/lib/receiz/wildz-cookie-actor';
import { readWildzProofSessionCookie } from '@/lib/receiz/wildz-proof-session';
import { canCurrentWildzOwnerObserveCreature } from '@/lib/receiz/wildz-creature-observer-ownership';
import { createReceizCreationPlanner } from '@/lib/receiz/wilds-creation-planner';
import { planCreation, type CreationPlannerRequest } from '@/features/play/creation/planner';
import { projectCreationWorkers } from '@/features/play/creation/capabilities';
import { emptyAdventureCondition } from '@/features/play/adventure/card-condition';
import { verifyAnyWildsCard, type PortableCardAsset } from '@/features/play/portable-card';
import { verifyWildsMaterialLot, type WildsMaterialLotV1 } from '@/features/play/wilds-steward-construction';
import { validateCreationBudget } from '@/features/play/creation/resources';
import { assertCreationData } from '@/features/play/creation/definition';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
export async function POST(request:NextRequest){
 try {
  const text=await request.text();if(text.length>1048576)return reply({status:'blocked',reason:'Creation request too large.'},413);
  const input=JSON.parse(text) as CreationPlannerRequest & {cards:PortableCardAsset[];cardAdmissions:Record<string,unknown>;lots:WildsMaterialLotV1[]};assertCreationData(input);
  const actor=await resolveWildzCookieActor(request);if(input.actorId!==actor.actorId)return reply({status:'blocked',reason:'Creation owner changed.'},403);
  let proofSession:ReturnType<typeof readWildzProofSessionCookie>|null=null;try{proofSession=readWildzProofSessionCookie(request);}catch{}
  if(!Array.isArray(input.cards)||!input.cards.length||input.cards.length>8||input.cards.some(card=>!verifyAnyWildsCard(card).ok||!canCurrentWildzOwnerObserveCreature({actorId:actor.actorId,profileHandle:actor.profileHandle,proofSession,card,cardAdmission:input.cardAdmissions?.[card.id]})))return reply({status:'blocked',reason:'Current creature ownership could not be verified.'},403);
  // This is proposal evidence only. Execution rechecks live conditions, custody, heads, mandates, and physical chunks atomically.
  const workers=projectCreationWorkers(input.cards,Object.fromEntries(input.cards.map(card=>[card.id,emptyAdventureCondition(card.id)])));
  validateCreationBudget(input.context.budget);const carried:Record<string,number>={},seen=new Set<string>();
  if(!Array.isArray(input.lots)||input.lots.length>4096)return reply({status:'blocked',reason:'Material evidence is unavailable.'},422);
  for(const lot of input.lots)if(verifyWildsMaterialLot(lot)&&lot.ownerReceizId===actor.actorId&&!seen.has(lot.lotId)){seen.add(lot.lotId);carried[lot.kind]=(carried[lot.kind]||0)+lot.quantity;}
  const budget=Object.fromEntries(Object.entries(input.context.budget).map(([kind,ceiling])=>[kind,Math.min(ceiling,carried[kind]||0)]));
  const authenticated={requestId:input.requestId,actorId:actor.actorId,message:input.message,selected:input.selected,workers,context:{...input.context,budget,techniques:[...new Set(workers.flatMap(w=>w.techniques))]}};
  return reply(await planCreation(authenticated,createReceizCreationPlanner(actor),request.signal));
 }catch(error){return reply({status:'unavailable',reason:error instanceof Error&&error.message.startsWith('receiz_')?'Connect your authenticated Wildz account to use the creation planner.':'The creation planner could not accept this request. Your draft is saved.'},422);}
}
