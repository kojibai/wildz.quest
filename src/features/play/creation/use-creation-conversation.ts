'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { initialCreationConversation, reduceCreationConversation } from './conversation';
import { planCreation, type CreationPlannerPort } from './planner';
import { applyCreationPatch } from './patch';
import { createCreationWorkerClient } from './worker-client';
import { parseCreationDefinition } from './definition';
import type { CreationWorker } from './capabilities';
import type { CreationCompileContext, CreationPlan } from './compiler';
import type { CreationCommitResult, CreationDefinition } from './types';
export function useCreationConversation(input:{ownerId:string;spaceId:string;workers:readonly CreationWorker[];context:CreationCompileContext;planner:CreationPlannerPort;commit?:(plan:CreationPlan,definition:CreationDefinition,workerIds:readonly string[])=>Promise<CreationCommitResult>}) {
 const [state,dispatch]=useReducer(reduceCreationConversation,undefined,()=>initialCreationConversation(input.ownerId,input.spaceId,input.context.pose));
 const workerRef=useRef<ReturnType<typeof createCreationWorkerClient>|null>(null);
 const getClient=useCallback(()=>workerRef.current||(workerRef.current=createCreationWorkerClient()),[]);
 const environmentRef=useRef({ownerId:input.ownerId,spaceId:input.spaceId});environmentRef.current={ownerId:input.ownerId,spaceId:input.spaceId};
 const active=useRef<{id:string;abort:AbortController}|null>(null),stateRef=useRef(state);stateRef.current=state;
 const cancel=useCallback(()=>{const r=active.current;if(r){r.abort.abort();workerRef.current?.cancel(r.id);active.current=null;}},[]);
 const fence=input.workers.map(w=>`${w.assetId}:${w.head}:${w.ready}`).join('|');
 useEffect(()=>{cancel();dispatch({type:'environment',ownerId:input.ownerId,spaceId:input.spaceId});dispatch({type:'invalidate'});},[input.ownerId,input.spaceId,fence,input.context.sourceHead,cancel]);
 useEffect(()=>()=>{cancel();workerRef.current?.close();workerRef.current=null;},[cancel]);
 const [loadedKey,setLoadedKey]=useState<string|null>(null);
 const storageKey=`wildz:creation-draft:v1:${input.ownerId}:${input.spaceId}`;
 useEffect(()=>{try {const raw=JSON.parse(localStorage.getItem(storageKey)||'null');if(raw?.ownerId===input.ownerId&&raw.spaceId===input.spaceId){dispatch({type:'draft',text:typeof raw.draft==='string'?raw.draft:''});if(raw.definition){const definition=parseCreationDefinition(raw.definition);if(definition.creatorId===input.ownerId){dispatch({type:'request',requestId:'restore'});dispatch({type:'proposal',requestId:'restore',definition,reply:'Saved creation draft restored.'});dispatch({type:'blocked',reason:'Refine your draft or preview it at a new placement.'});}}}}catch{}setLoadedKey(storageKey);},[storageKey,input.ownerId,input.spaceId]);
 useEffect(()=>{if(loadedKey!==storageKey||state.ownerId!==input.ownerId||state.spaceId!==input.spaceId)return;try{localStorage.setItem(storageKey,JSON.stringify({ownerId:state.ownerId,spaceId:state.spaceId,draft:state.draft,definition:state.definition}));}catch{}},[state.ownerId,state.spaceId,state.draft,state.definition,storageKey,input.ownerId,input.spaceId,loadedKey]);
 const change=useCallback((event:Parameters<typeof dispatch>[0])=>{
  if(['workers','budget','placement','selection','close'].includes(event.type))cancel();dispatch(event);
  const current=stateRef.current;if(!current.definition||!['workers','budget','placement'].includes(event.type)||['committing','recovering'].includes(current.status))return;
  const ids=event.type==='workers'?event.ids:current.workerIds,workers=input.workers.filter(w=>ids.includes(w.assetId));
  const pose=event.type==='placement'?event.pose:current.placement,budget=event.type==='budget'?event.budget:current.budget;
  const id=crypto.randomUUID(),abort=new AbortController();active.current={id,abort};dispatch({type:'compile-request',requestId:id});
  const run=()=>void getClient().compile(id,current.definition!,{...input.context,pose,budget,techniques:[...new Set(workers.filter(w=>w.ready).flatMap(w=>w.techniques))]}).then(result=>{if(active.current?.id!==id)return;if(result.status==='ready')dispatch({type:'compiled',requestId:id,plan:result.plan});else dispatch({type:'blocked',requestId:id,reason:result.blockers.map(b=>b.message).join(' ')});});
  if(event.type==='placement'){const timer=setTimeout(()=>{if(!abort.signal.aborted)run();},120);abort.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});}else run();
 },[cancel,getClient,input.context,input.workers]);
 const ask=useCallback(async()=>{
  const current=stateRef.current;if(current.ownerId!==input.ownerId||current.spaceId!==input.spaceId||!current.draft.trim()||['planning','committing','recovering'].includes(current.status))return;
  cancel();const id=crypto.randomUUID(),abort=new AbortController();active.current={id,abort};dispatch({type:'request',requestId:id});
  const workers=input.workers.filter(w=>current.workerIds.includes(w.assetId));const context={...input.context,pose:current.placement,budget:current.budget,techniques:[...new Set(workers.flatMap(w=>w.techniques))]};
  const result=await planCreation({requestId:id,actorId:input.ownerId,message:current.draft,selected:current.definition,workers,context},input.planner,abort.signal);
  if(active.current?.id!==id||abort.signal.aborted)return;
  if(result.status!=='proposed'){dispatch({type:'blocked',requestId:id,reason:result.reason});return;}
  try {const definition='definition' in result.proposal?result.proposal.definition:current.definition?applyCreationPatch(current.definition,result.proposal.patch):null;if(!definition)throw Error('Select a creation before editing it.');dispatch({type:'proposal',requestId:id,definition,reply:result.proposal.reply});
   const compiled=await getClient().compile(id,definition,context);if(active.current?.id!==id||abort.signal.aborted)return;
   if(compiled.status==='ready')dispatch({type:'compiled',requestId:id,plan:compiled.plan,minimize:true});else dispatch({type:'blocked',requestId:id,reason:compiled.blockers.map(b=>b.message).join(' ')});
  }catch(error){dispatch({type:'blocked',requestId:id,reason:error instanceof Error?error.message:'Could not preview this draft.'});}
 },[cancel,input,getClient]);
 const build=useCallback(async()=>{const current=stateRef.current;if(!current.plan||!current.definition||['committing','recovering'].includes(current.status))return;if(!input.commit){dispatch({type:'blocked',reason:'Live construction is awaiting authenticated world admission. Your preview is saved.'});return;}dispatch({type:'commit'});try{const result=await input.commit(current.plan,current.definition,current.workerIds);if(environmentRef.current.ownerId!==current.ownerId||environmentRef.current.spaceId!==current.spaceId)return;if(result.status==='admitted')dispatch({type:'admitted',instance:result.instance});else if(result.status==='unknown')dispatch({type:'unknown',operationId:result.operationId});else dispatch({type:'blocked',reason:result.reason});}catch{if(environmentRef.current.ownerId===current.ownerId&&environmentRef.current.spaceId===current.spaceId)dispatch({type:'unknown',operationId:current.plan.digest});}},[input]);
 return {state,change,ask,build,canBuild:Boolean(input.commit)&&state.status==='preview',cancel};
}
