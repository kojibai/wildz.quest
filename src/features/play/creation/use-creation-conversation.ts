'use client';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { initialCreationConversation, reduceCreationConversation } from './conversation';
import { planCreation, type CreationPlannerPort } from './planner';
import { applyCreationPatch } from './patch';
import { createCreationWorkerClient } from './worker-client';
import {creationCompileContextForConversation,restoreCreationDraft,type CreationDraftObject} from './draft';
import {creationCompileEnvironmentHead} from './compile-environment';
import {constructionProofDigest} from '../wilds-construction-project';
import type { CreationWorker } from './capabilities';
import type { CreationCompileContext, CreationPlan } from './compiler';
import type { CreationCommitResult, CreationDefinition, CreationInstanceRef } from './types';
export function useCreationConversation(input:{ownerId:string;spaceId:string;workers:readonly CreationWorker[];context:CreationCompileContext;planner:CreationPlannerPort;restoreObject?:(ref:CreationInstanceRef)=>Promise<CreationDraftObject|null>;commit?:(plan:CreationPlan,definition:CreationDefinition,workerIds:readonly string[],selected?:CreationInstanceRef|null)=>Promise<CreationCommitResult>}) {
 const [state,dispatch]=useReducer(reduceCreationConversation,undefined,()=>initialCreationConversation(input.ownerId,input.spaceId,input.context.pose));
 const workerRef=useRef<ReturnType<typeof createCreationWorkerClient>|null>(null);
 const getClient=useCallback(()=>workerRef.current||(workerRef.current=createCreationWorkerClient()),[]);
 const environmentHead=useMemo(()=>creationCompileEnvironmentHead({worldId:input.context.worldId,spaceId:input.context.spaceId,sourceHead:input.context.sourceHead,physical:input.context.physical}),[input.context.worldId,input.context.spaceId,input.context.sourceHead,input.context.physical]);
 const compiledEnvironmentRef=useRef<string|null>(null);
 const environmentRef=useRef({ownerId:input.ownerId,spaceId:input.spaceId,head:environmentHead});environmentRef.current={ownerId:input.ownerId,spaceId:input.spaceId,head:environmentHead};
 const active=useRef<{id:string;abort:AbortController}|null>(null),stateRef=useRef(state);stateRef.current=state;
 const cancel=useCallback(()=>{const r=active.current;if(r){r.abort.abort();workerRef.current?.cancel(r.id);active.current=null;}},[]);
 const fence=input.workers.map(w=>`${w.assetId}:${w.head}:${w.ready}`).join('|');
 useEffect(()=>{cancel();compiledEnvironmentRef.current=null;dispatch({type:'environment',ownerId:input.ownerId,spaceId:input.spaceId});dispatch({type:'invalidate'});},[input.ownerId,input.spaceId,fence,environmentHead,cancel]);
 useEffect(()=>()=>{cancel();workerRef.current?.close();workerRef.current=null;},[cancel]);
 const [loadedKey,setLoadedKey]=useState<string|null>(null);
 const storageKey=`wildz:creation-draft:v1:${input.ownerId}:${input.spaceId}`;
 const restoreObject=input.restoreObject;
 useEffect(()=>{let cancelled=false;setLoadedKey(null);void (async()=>{let raw:string|null=null;try{raw=localStorage.getItem(storageKey);if(raw===null){if(!cancelled)setLoadedKey(storageKey);return;}const restored=await restoreCreationDraft(raw,{ownerId:input.ownerId,spaceId:input.spaceId},restoreObject);if(cancelled)return;dispatch({type:'draft',text:restored.draft});if(restored.status==='ready'){if(restored.selected){const object=restored.selected;dispatch({type:'selection',definition:object.definition,pose:object.instance.pose,instance:{instanceId:object.instance.instanceId,head:object.instance.head,definitionDigest:object.instance.definitionDigest}});}if(restored.definition){dispatch({type:'request',requestId:'restore'});dispatch({type:'proposal',requestId:'restore',definition:restored.definition,reply:'Saved creation draft restored.'});dispatch({type:'blocked',reason:'Refine your draft or preview it at a new placement.'});}setLoadedKey(storageKey);}else{try{localStorage.setItem(storageKey+':recovery:'+constructionProofDigest(raw).slice(7),raw);setLoadedKey(storageKey);}catch{/* Preserve the original if recovery storage is unavailable. */}dispatch({type:'blocked',reason:restored.reason});}}catch{if(!cancelled)dispatch({type:'blocked',reason:'Saved draft could not be reopened. Its original is retained.'});}})();return()=>{cancelled=true;};},[storageKey,input.ownerId,input.spaceId,restoreObject]);
 useEffect(()=>{if(loadedKey!==storageKey||state.ownerId!==input.ownerId||state.spaceId!==input.spaceId)return;try{localStorage.setItem(storageKey,JSON.stringify({ownerId:state.ownerId,spaceId:state.spaceId,draft:state.draft,definition:state.definition,instance:state.instance}));}catch{}},[state.ownerId,state.spaceId,state.draft,state.definition,state.instance,storageKey,input.ownerId,input.spaceId,loadedKey]);
 const change=useCallback((event:Parameters<typeof dispatch>[0])=>{
  if(['workers','budget','placement','selection','close'].includes(event.type))cancel();dispatch(event);
  const current=stateRef.current;if(!current.definition||!['workers','budget','placement'].includes(event.type)||['committing','recovering'].includes(current.status))return;
  const ids=event.type==='workers'?event.ids:current.workerIds,workers=input.workers.filter(w=>ids.includes(w.assetId));
  const pose=event.type==='placement'?event.pose:current.placement,budget=event.type==='budget'?event.budget:current.budget;
  const head=environmentHead,id=crypto.randomUUID(),abort=new AbortController();active.current={id,abort};dispatch({type:'compile-request',requestId:id});
  const run=()=>void getClient().compile(id,current.definition!,{...creationCompileContextForConversation(current,input.context),pose,budget,techniques:[...new Set(workers.filter(w=>w.ready).flatMap(w=>w.techniques))]}).then(result=>{if(active.current?.id!==id||environmentRef.current.head!==head)return;if(result.status==='ready'){compiledEnvironmentRef.current=head;dispatch({type:'compiled',requestId:id,plan:result.plan});}else dispatch({type:'blocked',requestId:id,reason:result.blockers.map(b=>b.message).join(' ')});});
  if(event.type==='placement'){const timer=setTimeout(()=>{if(!abort.signal.aborted)run();},120);abort.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});}else run();
 },[cancel,getClient,input.context,input.workers,environmentHead]);
 const ask=useCallback(async()=>{
  const current=stateRef.current;if(current.ownerId!==input.ownerId||current.spaceId!==input.spaceId||!current.draft.trim()||['planning','committing','recovering'].includes(current.status))return;
  cancel();const head=environmentHead,id=crypto.randomUUID(),abort=new AbortController();active.current={id,abort};dispatch({type:'request',requestId:id});
  const workers=input.workers.filter(w=>current.workerIds.includes(w.assetId));const context={...creationCompileContextForConversation(current,input.context),pose:current.placement,budget:current.budget,techniques:[...new Set(workers.flatMap(w=>w.techniques))]};
  const result=await planCreation({requestId:id,actorId:input.ownerId,message:current.draft,selected:current.definition,workers,context},input.planner,abort.signal);
  if(active.current?.id!==id||abort.signal.aborted||environmentRef.current.head!==head)return;
  if(result.status!=='proposed'){dispatch({type:'blocked',requestId:id,reason:result.reason});return;}
  try {const definition='definition' in result.proposal?result.proposal.definition:current.definition?applyCreationPatch(current.definition,result.proposal.patch):null;if(!definition)throw Error('Select a creation before editing it.');dispatch({type:'proposal',requestId:id,definition,reply:result.proposal.reply});
   const compiled=await getClient().compile(id,definition,context);if(active.current?.id!==id||abort.signal.aborted||environmentRef.current.head!==head)return;
   if(compiled.status==='ready'){compiledEnvironmentRef.current=head;dispatch({type:'compiled',requestId:id,plan:compiled.plan,minimize:true});}else dispatch({type:'blocked',requestId:id,reason:compiled.blockers.map(b=>b.message).join(' ')});
  }catch(error){dispatch({type:'blocked',requestId:id,reason:error instanceof Error?error.message:'Could not preview this draft.'});}
 },[cancel,input,getClient,environmentHead]);
 const build=useCallback(async()=>{const current=stateRef.current;if(compiledEnvironmentRef.current!==environmentRef.current.head||!current.plan||!current.definition||['committing','recovering'].includes(current.status))return;if(!input.commit){dispatch({type:'blocked',reason:'Live construction is awaiting authenticated world admission. Your preview is saved.'});return;}dispatch({type:'commit'});try{const result=await input.commit(current.plan,current.definition,current.workerIds,current.instance);if(environmentRef.current.ownerId!==current.ownerId||environmentRef.current.spaceId!==current.spaceId)return;if(result.status==='admitted')dispatch({type:'admitted',instance:result.instance});else if(result.status==='unknown')dispatch({type:'unknown',operationId:result.operationId});else dispatch({type:'blocked',reason:result.reason});}catch{if(environmentRef.current.ownerId===current.ownerId&&environmentRef.current.spaceId===current.spaceId)dispatch({type:'unknown',operationId:current.plan.digest});}},[input]);
 return {state,change,ask,build,canBuild:Boolean(input.commit)&&state.status==='preview'&&compiledEnvironmentRef.current===environmentHead,cancel};
}
