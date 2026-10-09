'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { createFarmLayoutDefinition, type FarmLayoutOptions } from './farm-layout';
import { creationShelterStarterPrompt } from './starter-prompt';
import { CreationPlacementControls } from './CreationPlacementControls';
import type { PortableCardAsset } from '../portable-card';
import type { WildsInput, PlayState } from '../game-state';
import type { WildsMaterialLotV1 } from '../wilds-steward-construction';
import { projectCreationWorkers } from './capabilities';
import { useCreationConversation } from './use-creation-conversation';
import type { CreationPose } from './types';
import type { CreationCommitResult, CreationDefinition, CreationInstanceRef } from './types';
import type { CreationCompileContext, CreationPlan } from './compiler';
import type { CreationPlannerPort } from './planner';
import { createCreationProposalClient } from './proposal-worker-client';
import { createCreationPreview, type CreationPreview } from './preview';
import { WildsCreationPanel,type CreationPanelObject } from './WildsCreationPanel';
import styles from './creation.module.css';
import type {CreationObjectLibraryInput} from './library-session';
export type CreationSessionProps={onGatherHay?:()=>void;validatePlacement?:(plan:CreationPlan)=>string|null;newPlacementPose?:()=>CreationPose;onSaveObject?:(instanceId:string)=>Promise<void>;displayName?:string;objectLibrary?:CreationObjectLibraryInput;classes?:Record<string,string>;objects?:readonly CreationPanelObject[];ownerId:string;spaceId:string;cards:readonly PortableCardAsset[];conditions:PlayState['adventureConditions'];lots:readonly WildsMaterialLotV1[];context:CreationCompileContext;cardAdmissions:Readonly<Record<string,unknown>>;onPreview:(preview:CreationPreview|null)=>void;onClose:()=>void;onManualBuild:()=>void;planner?:CreationPlannerPort;recover?:(operationId:string,plan:CreationPlan)=>Promise<CreationCommitResult>;commit?:(definition:CreationDefinition,plan:CreationPlan,workerIds:readonly string[],selected?:CreationInstanceRef|null,context?:CreationCompileContext)=>Promise<CreationCommitResult>;placementRef?:MutableRefObject<((pose:CreationPose)=>void)|null>;headingRef?:RefObject<number>;onPlacementModeChange?:(active:boolean)=>void;onMovementInput?:(input:WildsInput)=>void};
const subscribeToClient=()=>()=>{};
const clientSnapshot=()=>true;
const serverSnapshot=()=>false;
function CreationSession(input:CreationSessionProps){
 const mounted=useSyncExternalStore(subscribeToClient,clientSnapshot,serverSnapshot);
 const defaultHeading=useRef(0);
 const [gathering,setGathering]=useState(false);
 const workers=useMemo(()=>projectCreationWorkers(input.cards,input.conditions),[input.cards,input.conditions]);
 const proposalClient=useRef<ReturnType<typeof createCreationProposalClient>|null>(null);
 const planner=useMemo<CreationPlannerPort>(()=>input.planner||{propose(request,signal){const client=proposalClient.current||(proposalClient.current=createCreationProposalClient());return client.propose(request,{cards:input.cards,cardAdmissions:input.cardAdmissions,lots:input.lots},signal);}},[input.planner,input.cards,input.cardAdmissions,input.lots]);
 useEffect(()=>()=>{proposalClient.current?.close();proposalClient.current=null;},[]);
 const library=input.objectLibrary;
 const restoreObject=useCallback(async (ref:CreationInstanceRef)=>{if(!library||library.scope.actorId!==input.ownerId)return null;const entry=await library.port.read(library.scope,ref.instanceId);if(!entry||entry.status!=='owned'||!entry.artifact)return null;const instance=entry.artifact.payload.checkpoint.instances[0],definition=entry.artifact.payload.checkpoint.definitions.find(d=>d.digest===instance.definitionDigest);return definition?{definition,instance,custodyOwnerId:library.scope.actorId}:null;},[library,input.ownerId]);
 const starterPrompt=useMemo(()=>creationShelterStarterPrompt({displayName:input.displayName,pose:input.context.pose}),[input.displayName,input.context.pose]);
 const conversation=useCreationConversation({validatePlacement:input.validatePlacement,starterPrompt,ownerId:input.ownerId,spaceId:input.spaceId,workers,context:input.context,planner,restoreObject,recover:input.recover,commit:input.commit?async (plan,definition,workerIds,selected,context)=>input.commit!(definition,plan,workerIds,selected,context):undefined});
 const place=conversation.change;
 useEffect(()=>{if(!input.placementRef)return;input.placementRef.current=pose=>place({type:'placement',pose});return ()=>{if(input.placementRef)input.placementRef.current=null;};},[input.placementRef,place]);
 const counts=useMemo(()=>input.lots.reduce<Record<string,number>>((counts,lot)=>({...counts,[lot.kind]:(counts[lot.kind]||0)+lot.quantity}),{hay:0,timber:0,stone:0}),[input.lots]);
 const prepareFarm=(options:FarmLayoutOptions)=>{
  try {
   const definition=createFarmLayoutDefinition({creatorId:input.ownerId,seed:`farm:${crypto.randomUUID()}`,options});
   const selected=conversation.state.workerIds.filter(id=>workers.some(worker=>worker.assetId===id&&worker.ready));
   conversation.change({type:'selection',definition,pose:input.newPlacementPose?.()??input.context.pose,workerIds:selected.length?selected:workers.filter(worker=>worker.ready).map(worker=>worker.assetId).slice(0,32),budget:counts});
  }catch(error){conversation.change({type:'blocked',reason:error instanceof Error?error.message:'This farm layout could not be prepared.'});}
 };
 const change=conversation.change,onPreview=input.onPreview,opened=useRef(false);
 useEffect(()=>{if(!opened.current){opened.current=true;change({type:'open'});}},[change]);
 useEffect(()=>{onPreview(conversation.state.plan?createCreationPreview(conversation.state.plan,conversation.state.placement):null);},[conversation.state.plan,conversation.state.placement,onPreview]);
 useEffect(()=>()=>onPreview(null),[onPreview]);
 const placementActive=conversation.state.minimized&&!gathering;
 const onPlacementModeChange=input.onPlacementModeChange;
 useEffect(()=>{onPlacementModeChange?.(placementActive);return ()=>onPlacementModeChange?.(false);},[placementActive,onPlacementModeChange]);
 return mounted?createPortal(<><WildsCreationPanel onGatherHay={input.onGatherHay?()=>{setGathering(true);input.onGatherHay?.();}:undefined} onCreateFarm={prepareFarm} onSaveObject={input.onSaveObject} objectLibrary={input.objectLibrary} objects={input.objects} state={conversation.state} workers={workers} cards={input.cards} materialCounts={counts} onChange={event=>{if(event.type==='minimize')setGathering(false);change(event);}} onAsk={()=>void conversation.ask()} onBuild={()=>void conversation.build()} onClose={()=>{change({type:'close'});input.onClose();}} onManualBuild={input.onManualBuild} canBuild={conversation.canBuild} classes={input.classes||styles}/>{placementActive?<CreationPlacementControls pose={conversation.state.placement} headingRef={input.headingRef||defaultHeading} onMovementInput={input.onMovementInput} onPlace={()=>void conversation.build()} onMove={pose=>change({type:'placement',pose})} canBuild={conversation.canBuild}/>:null}</>,document.body):null;
}

export default memo(CreationSession);
