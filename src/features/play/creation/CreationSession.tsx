'use client';
import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { PortableCardAsset } from '../portable-card';
import type { PlayState } from '../game-state';
import type { WildsMaterialLotV1 } from '../wilds-steward-construction';
import { projectCreationWorkers } from './capabilities';
import { useCreationConversation } from './use-creation-conversation';
import type { CreationPose } from './types';
import type { CreationCompileContext } from './compiler';
import type { CreationPlannerPort, CreationPlannerResult } from './planner';
import { createCreationPreview, type CreationPreview } from './preview';
import { WildsCreationPanel } from './WildsCreationPanel';
import styles from './creation.module.css';
export type CreationSessionProps={ownerId:string;spaceId:string;cards:readonly PortableCardAsset[];conditions:PlayState['adventureConditions'];lots:readonly WildsMaterialLotV1[];context:CreationCompileContext;cardAdmissions:Readonly<Record<string,unknown>>;onPreview:(preview:CreationPreview|null)=>void;onClose:()=>void;onManualBuild:()=>void;planner?:CreationPlannerPort;placementRef?:MutableRefObject<((pose:CreationPose)=>void)|null>};
function CreationSession(input:CreationSessionProps){
 const workers=useMemo(()=>projectCreationWorkers(input.cards,input.conditions),[input.cards,input.conditions]);
 const planner=useMemo<CreationPlannerPort>(()=>input.planner||{async propose(request,signal){const selectedCards=input.cards.filter(card=>request.workers.some(w=>w.assetId===card.id));const response=await fetch('/api/wilds/creation/propose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...request,cards:selectedCards,cardAdmissions:input.cardAdmissions,lots:input.lots}),signal});const result=await response.json() as CreationPlannerResult;if(result.status!=='proposed')throw Error(result.reason);return result.proposal;}},[input.planner,input.cards,input.cardAdmissions,input.lots]);
 const conversation=useCreationConversation({ownerId:input.ownerId,spaceId:input.spaceId,workers,context:input.context,planner});
 const place=conversation.change;
 useEffect(()=>{if(!input.placementRef)return;input.placementRef.current=pose=>place({type:'placement',pose});return ()=>{if(input.placementRef)input.placementRef.current=null;};},[input.placementRef,place]);
 const counts=useMemo(()=>input.lots.reduce<Record<string,number>>((counts,lot)=>({...counts,[lot.kind]:(counts[lot.kind]||0)+lot.quantity}),{hay:0,timber:0,stone:0}),[input.lots]);
 const change=conversation.change,onPreview=input.onPreview,opened=useRef(false);
 useEffect(()=>{if(!opened.current){opened.current=true;change({type:'open'});}},[change]);
 useEffect(()=>{onPreview(conversation.state.plan?createCreationPreview(conversation.state.plan):null);},[conversation.state.plan,onPreview]);
 useEffect(()=>()=>onPreview(null),[onPreview]);
 return <WildsCreationPanel state={conversation.state} workers={workers} cards={input.cards} materialCounts={counts} onChange={change} onAsk={()=>void conversation.ask()} onBuild={()=>void conversation.build()} onClose={()=>{change({type:'close'});input.onClose();}} onManualBuild={input.onManualBuild} canBuild={conversation.canBuild} classes={styles}/>;
}

export default memo(CreationSession);
