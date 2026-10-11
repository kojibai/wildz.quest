import type {WildzContinuityDatabase} from '../../lib/storage/wildz-indexed-db';
import {planWildsClearancePickupV128,type WildsClearancePickupProposalV128,type WildsClearanceAdmittedGameplayV128,type WildsClearanceAdmissionFailureV128} from '../../lib/receiz/wilds-clearance-admission-v128';
import type {createWildsResourcePackageExchangeV128} from '../../lib/receiz/wilds-resource-exchange-v128';
import type {WildsClearancePile} from './wilds-building-clearance';
import {canonicalPortableCardJson,sha256PortableBasis} from './portable-card';
import {WILDS_NOURISHMENT_GATHER_REACH,WILDS_NOURISHMENT_VERTICAL_REACH} from './wilds-nourishment';

type Binding=Readonly<{keyId:string;ownerHandle:string;gameplayOwnerId:string}>;
export type WildsClearanceLiveAction=Binding&Readonly<{player:{x:number;y:number;z:number};spaceId:string;kaiUPulse:number;foodRoom:boolean}>;
type NativeExchange=ReturnType<typeof createWildsResourcePackageExchangeV128>;
type ActionOutcome=WildsClearanceAdmittedGameplayV128|WildsClearanceAdmissionFailureV128;
export type WildsClearanceInteractionExchange={
 readCurrent:()=>Promise<Parameters<typeof planWildsClearancePickupV128>[0]['source']|null>;
 deriveClearance:(...args:Parameters<NativeExchange['deriveClearance']>)=>Promise<ActionOutcome>;
 admitClearancePickup:(...args:Parameters<NativeExchange['admitClearancePickup']>)=>Promise<ActionOutcome>;
 recoverClearance:(...args:Parameters<NativeExchange['recoverClearance']>)=>Promise<ActionOutcome|null>;
};
type Exchange=WildsClearanceInteractionExchange;
type DeriveRequest=Parameters<Exchange['deriveClearance']>[0];
type Attempt=Readonly<{binding:Binding;settled?:boolean;request:{kind:'pickup';proposal:WildsClearancePickupProposalV128}|{kind:'derive';value:DeriveRequest}}>;
export type WildsClearanceInteractionResult=WildsClearanceAdmittedGameplayV128|WildsClearanceAdmissionFailureV128|Readonly<{status:'retained';attemptId:string}>;
const operations=new WeakMap<WildzContinuityDatabase,Map<string,Promise<WildsClearanceInteractionResult|null>>>();
export function canReachWildsClearancePile(pile:WildsClearancePile,player:{x:number;y:number;z:number},spaceId:string){
 return spaceId==='wildz.space.outer.v1'&&Math.hypot(player.x-pile.position.x,player.z-pile.position.z)<=WILDS_NOURISHMENT_GATHER_REACH
  &&Math.abs(player.y-pile.position.y)<=WILDS_NOURISHMENT_VERTICAL_REACH;
}
/** Explicit actions only. This small continuity record locates an exact native
 * attempt; it never establishes source currentness or inventory authority. */
export function createWildsClearanceInteraction(input:{database:WildzContinuityDatabase;binding:Binding;live:()=>WildsClearanceLiveAction;
 openRuntime:()=>Promise<{exchange:Exchange}>;flush:()=>Promise<void>;apply:(result:WildsClearanceAdmittedGameplayV128)=>Promise<boolean>}){
 let applied:string|null=null;
 const key=`wildz:clearance-interaction:v1:${input.binding.ownerHandle}:${input.binding.gameplayOwnerId}:${input.binding.keyId}`;
 const assertOwner=()=>{const live=input.live();if(live.keyId!==input.binding.keyId||live.ownerHandle!==input.binding.ownerHandle||live.gameplayOwnerId!==input.binding.gameplayOwnerId)throw Error('The Explorer changed. Return to the same owner to recover this collection.');return live;};
 const save=(attempt:Attempt)=>input.database.transaction(['meta'],'readwrite',tx=>tx.put('meta',attempt,key));
 const read=()=>input.database.read<Attempt>('meta',key);
 const queueKey=`${key}:construction`;
 const queue=()=>input.database.read<readonly DeriveRequest[]>('meta',queueKey);
 const enqueue=(request:DeriveRequest)=>input.database.transaction(['meta'],'readwrite',async tx=>{const requests=await tx.get<readonly DeriveRequest[]>('meta',queueKey)??[];if(requests.some(row=>row.attemptId===request.attemptId))return;if(requests.length>=128)throw Error('Finish the pending building clearances before placing more.');await tx.put('meta',[...requests,request],queueKey);});
 const id=(attempt:Attempt)=>attempt.request.kind==='pickup'?attempt.request.proposal.command.commandId:attempt.request.value.attemptId;
 const fence=async(attempt:Attempt)=>{
  const live=assertOwner();if(attempt.request.kind!=='pickup')return;
  const command=attempt.request.proposal.command;
  // The proposal contains the actual pose at planning. A moved explorer must
  // return to that pose before an as-yet-uncommitted attempt can be resumed.
  if(live.spaceId!==command.spaceId||Math.hypot(live.player.x-command.player.x,live.player.z-command.player.z)>.25||Math.abs(live.player.y-command.player.y)>.25)throw Error('Return within reach of your saved collection position.');
 };
 const complete=async(attempt:Attempt,exchange:Exchange):Promise<WildsClearanceInteractionResult>=>{
  assertOwner();
  const recovered=await exchange.recoverClearance(id(attempt),()=>fence(attempt));
  if(!recovered&&attempt.request.kind==='derive'){attempt={...attempt,request:{kind:'derive',value:{...attempt.request.value,kaiUPulse:assertOwner().kaiUPulse}}};await save(attempt);}
  const outcome=recovered??(attempt.request.kind==='pickup'
   ?await exchange.admitClearancePickup(attempt.request.proposal,()=>fence(attempt))
   :await exchange.deriveClearance(attempt.request.value,()=>fence(attempt)));
  if(outcome.status==='rejected'){await input.database.transaction(['meta'],'readwrite',tx=>tx.delete('meta',key));return outcome;}
  if(outcome.status!=='admitted')return outcome;
  // Native admission may finish after owner/pack changes. Keep its exact ID;
  // recovery independently reopens that result before any later local credit.
  try{assertOwner();}catch{return {status:'retained',attemptId:id(attempt)};}
  if(!await input.apply(outcome))return {status:'retained',attemptId:id(attempt)};
  assertOwner();await save({...attempt,settled:true});applied=id(attempt);return outcome;
 };
 const serialized=(run:()=>Promise<WildsClearanceInteractionResult|null>)=>{
  let map=operations.get(input.database);if(!map){map=new Map();operations.set(input.database,map);}
  const active=map.get(key);if(active)return active;
  const operation=run();map.set(key,operation);void operation.finally(()=>{if(map!.get(key)===operation)map!.delete(key);}).catch(()=>undefined);return operation;
 };
 const drain=async(exchange:Exchange)=>{
  let outcome:WildsClearanceInteractionResult|null=null;
  for(;;){const request=(await queue())?.[0];if(!request)return outcome;
   const attempt:Attempt={binding:input.binding,request:{kind:'derive',value:request}};await save(attempt);outcome=await complete(attempt,exchange);
   if(outcome.status!=='admitted'&&outcome.status!=='rejected')return outcome;
   if(outcome.status==='rejected'){
    const current=await exchange.readCurrent();if(!current)return outcome;
    const replacement={...request,attemptId:`clearance-retry:${sha256PortableBasis(canonicalPortableCardJson({buildingId:request.buildingId,buildingHead:request.buildingHead,head:current.predecessor.head.head})).slice(7)}`};
    await input.database.transaction(['meta'],'readwrite',async tx=>{const rows=await tx.get<readonly DeriveRequest[]>('meta',queueKey)??[];await tx.put('meta',rows.map(row=>row.attemptId===request.attemptId?replacement:row),queueKey);});
    return outcome;
   }
   await input.database.transaction(['meta'],'readwrite',async tx=>{const rows=await tx.get<readonly DeriveRequest[]>('meta',queueKey)??[];await tx.put('meta',rows.filter(row=>row.attemptId!==request.attemptId),queueKey);});
  }
 };
 return {
  pending:async()=>{const attempt=await read();return Boolean(attempt&&(!attempt.settled||applied!==id(attempt))||(await queue())?.length);},
  resume:()=>serialized(async()=>{assertOwner();const attempt=await read();if(!attempt&&!(await queue())?.length)return null;await input.flush();const {exchange}=await input.openRuntime();
   const outcome=attempt?await complete(attempt,exchange):null;if(outcome&&outcome.status!=='admitted'&&outcome.status!=='rejected')return outcome;
   return await drain(exchange)??outcome;
  }),
  pickup:(pile:WildsClearancePile)=>serialized(async()=>{
   let live=assertOwner();const old=await read();
   if(old&&(!old.settled||applied!==id(old))){await input.flush();return complete(old,(await input.openRuntime()).exchange);}
   if(!canReachWildsClearancePile(pile,live.player,live.spaceId))throw Error('Move within reach of this pile.');
   if(pile.kind==='food'&&!live.foodRoom)throw Error('Your food pack is full. Eat a portion before gathering more.');
   await input.flush();const {exchange}=await input.openRuntime(),source=await exchange.readCurrent();live=assertOwner();
   if(!source)throw Error('This shared pile is still being saved. Try again shortly.');
   if(!canReachWildsClearancePile(pile,live.player,live.spaceId))throw Error('Move within reach of this pile.');
   const commandId=`clearance-pickup:${sha256PortableBasis(canonicalPortableCardJson({owner:input.binding,pileId:pile.pileId,head:source.predecessor.head.head,kaiUPulse:live.kaiUPulse})).slice(7)}`;
   const proposal=planWildsClearancePickupV128({source,clearanceId:pile.clearanceId,pileId:pile.pileId,expectedHead:source.predecessor.head.head,ownerReceizId:input.binding.ownerHandle,gameplayOwnerId:input.binding.gameplayOwnerId,player:live.player,spaceId:live.spaceId,kaiUPulse:live.kaiUPulse,commandId});
   const attempt:Attempt={binding:input.binding,request:{kind:'pickup',proposal}};await save(attempt);return complete(attempt,exchange);
  }),
  derive:async(request:DeriveRequest)=>{assertOwner();await enqueue(request);return serialized(async()=>{
   await input.flush();const {exchange}=await input.openRuntime(),old=await read();
   if(old&&!old.settled){const outcome=await complete(old,exchange);if(outcome.status!=='admitted'&&outcome.status!=='rejected')return outcome;}
   return drain(exchange);
  });}
 };
}
