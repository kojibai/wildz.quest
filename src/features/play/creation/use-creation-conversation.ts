'use client';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { initialCreationConversation, reduceCreationConversation,type CreationConversationState } from './conversation';
import { planCreation, type CreationPlannerPort } from './planner';
import {compileCreationPreview,creationQuote} from './preview-budget';
import { applyCreationPatch } from './patch';
import { createCreationWorkerClient } from './worker-client';
import {creationCompileContextForConversation,restoreCreationDraft,type CreationDraftObject} from './draft';
import {creationCompileEnvironmentHead} from './compile-environment';
import {constructionProofDigest} from '../wilds-construction-project';
import {creationGoalKey,encodeCreationGoal,reopenCreationGoal} from './saved-goal';
import { combineCreationTechniques, type CreationWorker } from './capabilities';
import type { CreationCompileContext, CreationPlan } from './compiler';
import type { CreationCommitResult, CreationDefinition, CreationInstanceRef } from './types';
function rememberAdmittedGoal(state:CreationConversationState,instance:CreationInstanceRef){
 if(!state.targetDefinition||state.targetDefinition.digest===state.definition?.digest)return;
 try{const scope={ownerId:state.ownerId,spaceId:state.spaceId},ref={kind:'instance' as const,id:instance.instanceId};localStorage.setItem(creationGoalKey(scope,ref),encodeCreationGoal(scope,ref,state.targetDefinition));}catch{/* The phase-definition goal was saved before admission and remains a fallback. */}
}
export function useCreationConversation(input:{starterPrompt?:string;ownerId:string;spaceId:string;workers:readonly CreationWorker[];context:CreationCompileContext;planner:CreationPlannerPort;restoreObject?:(ref:CreationInstanceRef)=>Promise<CreationDraftObject|null>;recover?:(operationId:string,plan:CreationPlan)=>Promise<CreationCommitResult>;commit?:(plan:CreationPlan,definition:CreationDefinition,workerIds:readonly string[],selected?:CreationInstanceRef|null,context?:CreationCompileContext)=>Promise<CreationCommitResult>}) {
 const [state,dispatch]=useReducer(reduceCreationConversation,undefined,()=>initialCreationConversation(input.ownerId,input.spaceId,input.context.pose));
 const workerRef=useRef<ReturnType<typeof createCreationWorkerClient>|null>(null);
 const getClient=useCallback(()=>workerRef.current||(workerRef.current=createCreationWorkerClient()),[]);
 const environmentHead=useMemo(()=>creationCompileEnvironmentHead({worldId:input.context.worldId,spaceId:input.context.spaceId,sourceHead:input.context.sourceHead,physical:input.context.physical}),[input.context.worldId,input.context.spaceId,input.context.sourceHead,input.context.physical]);
 const compiledEnvironmentRef=useRef<string|null>(null),compiledMaterialRef=useRef<string|null>(null);
 const environmentRef=useRef({ownerId:input.ownerId,spaceId:input.spaceId,head:environmentHead,budget:JSON.stringify(input.context.budget)});environmentRef.current={ownerId:input.ownerId,spaceId:input.spaceId,head:environmentHead,budget:JSON.stringify(input.context.budget)};
 const active=useRef<{id:string;abort:AbortController}|null>(null),stateRef=useRef(state);stateRef.current=state;
 const recoveryRef=useRef(input.recover);recoveryRef.current=input.recover;
 useEffect(()=>{
  if(state.status!=='recovering'||!state.operationId||!state.plan||!input.recover)return;
  const operationId=state.operationId,plan=state.plan,ownerId=state.ownerId,spaceId=state.spaceId;
  let cancelled=false,timer:ReturnType<typeof setTimeout>|undefined;
  const check=async()=>{
   try{
    const result=await recoveryRef.current?.(operationId,plan);
    if(cancelled||environmentRef.current.ownerId!==ownerId||environmentRef.current.spaceId!==spaceId)return;
    if(result?.status==='admitted'){rememberAdmittedGoal(stateRef.current,result.instance);dispatch({type:'admitted',instance:result.instance});return;}
    if(result?.status==='rejected'){dispatch({type:'blocked',reason:result.reason});return;}
   }catch{/* Keep the same admitted operation reserved while its read-only lookup recovers. */}
   if(!cancelled)timer=setTimeout(()=>void check(),2000);
  };
  void check();return()=>{cancelled=true;if(timer)clearTimeout(timer);};
 },[state.status,state.operationId,state.plan,state.ownerId,state.spaceId,input.recover]);
 const cancel=useCallback(()=>{const r=active.current;if(r){r.abort.abort();workerRef.current?.cancel(r.id);active.current=null;}},[]);
 const materialFence=JSON.stringify(input.context.budget);
 const fence=input.workers.map(w=>`${w.assetId}:${w.head}:${w.ready}`).join('|');
 useEffect(()=>{cancel();compiledEnvironmentRef.current=null;dispatch({type:'environment',ownerId:input.ownerId,spaceId:input.spaceId});dispatch({type:'invalidate'});},[input.ownerId,input.spaceId,fence,materialFence,environmentHead,cancel]);
 useEffect(()=>()=>{cancel();workerRef.current?.close();workerRef.current=null;},[cancel]);
 const [loadedKey,setLoadedKey]=useState<string|null>(null);
 const storageKey=`wildz:creation-draft:v1:${input.ownerId}:${input.spaceId}`;
 const restoreObject=input.restoreObject;
 const restoreSetupRef=useRef({workers:input.workers,budget:input.context.budget});restoreSetupRef.current={workers:input.workers,budget:input.context.budget};
 const starterPromptRef=useRef(input.starterPrompt);starterPromptRef.current=input.starterPrompt;
 useEffect(()=>{let cancelled=false;setLoadedKey(null);void (async()=>{let raw:string|null=null;try{raw=localStorage.getItem(storageKey);if(raw===null){if(!cancelled){if(starterPromptRef.current)dispatch({type:'starter',text:starterPromptRef.current});setLoadedKey(storageKey);}return;}const restored=await restoreCreationDraft(raw,{ownerId:input.ownerId,spaceId:input.spaceId},restoreObject);if(cancelled)return;dispatch({type:'draft',text:restored.draft});if(restored.status==='ready'){const setup=restoreSetupRef.current;dispatch({type:'workers',ids:restored.workerIds.filter(id=>setup.workers.some(worker=>worker.assetId===id&&worker.ready))});dispatch({type:'budget',mode:restored.budgetMode,budget:Object.fromEntries(Object.entries(restored.budget).map(([kind,amount])=>[kind,Math.min(amount,setup.budget[kind]||0)]))});if(restored.placement)dispatch({type:'placement',pose:restored.placement});if(restored.selected){const object=restored.selected;dispatch({type:'selection',definition:object.definition,pose:object.instance.pose,instance:{instanceId:object.instance.instanceId,head:object.instance.head,definitionDigest:object.instance.definitionDigest}});}if(restored.definition){dispatch({type:'request',requestId:'restore'});dispatch({type:'proposal',requestId:'restore',definition:restored.definition,reply:'Saved creation draft restored.'});dispatch({type:'invalidate'});}if(restored.targetDefinition)dispatch({type:'target',definition:restored.targetDefinition});setLoadedKey(storageKey);}else{try{localStorage.setItem(storageKey+':recovery:'+constructionProofDigest(raw).slice(7),raw);setLoadedKey(storageKey);}catch{/* Preserve the original if recovery storage is unavailable. */}dispatch({type:'blocked',reason:restored.reason});}}catch{if(!cancelled)dispatch({type:'blocked',reason:'Saved draft could not be reopened. Its original is retained.'});}})();return()=>{cancelled=true;};},[storageKey,input.ownerId,input.spaceId,restoreObject]);
 useEffect(()=>{if(loadedKey!==storageKey||state.ownerId!==input.ownerId||state.spaceId!==input.spaceId)return;try{localStorage.setItem(storageKey,JSON.stringify({ownerId:state.ownerId,spaceId:state.spaceId,draft:state.draft,definition:state.definition,targetDefinition:state.targetDefinition,instance:state.instance,workerIds:state.workerIds,budget:state.budget,budgetMode:state.budgetMode,placement:state.placement}));}catch{}},[state.ownerId,state.spaceId,state.draft,state.definition,state.targetDefinition,state.instance,state.workerIds,state.budget,state.budgetMode,state.placement,storageKey,input.ownerId,input.spaceId,loadedKey]);
 const change=useCallback((event:Parameters<typeof dispatch>[0])=>{
  if(['workers','budget','placement','selection','phase','full-design','close'].includes(event.type))cancel();
  const before=stateRef.current;let current=reduceCreationConversation(before,event);dispatch(event);
  if(event.type==='selection'&&event.instance&&event.definition&&current!==before){
   try{const scope={ownerId:input.ownerId,spaceId:input.spaceId},refs=[{kind:'instance' as const,id:event.instance.instanceId},{kind:'definition' as const,id:event.definition.digest}];
    const goal=refs.map(ref=>reopenCreationGoal(localStorage.getItem(creationGoalKey(scope,ref)),scope,ref,event.definition!)).find(Boolean);
    if(goal&&goal.digest!==current.definition?.digest){const target={type:'target' as const,definition:goal};current=reduceCreationConversation(current,target);dispatch(target);const full={type:'full-design' as const};current=reduceCreationConversation(current,full);dispatch(full);}
   }catch{/* The proof-backed section still opens if local design hints are unavailable. */}
  }
  if(current===before||!current.definition||!['workers','budget','placement','selection','phase','full-design'].includes(event.type)||['committing','recovering'].includes(current.status))return;
  const ids=event.type==='workers'?event.ids:current.workerIds,workers=input.workers.filter(w=>ids.includes(w.assetId));
  const pose=event.type==='placement'?event.pose:current.placement,budget=event.type==='budget'?event.budget:current.budget;
  if(!workers.length||workers.some(worker=>!worker.ready)){dispatch({type:'blocked',reason:'Choose ready creatures to build this saved design.'});return;}
  const head=environmentHead,id=crypto.randomUUID(),abort=new AbortController();active.current={id,abort};dispatch({type:'compile-request',requestId:id});
  const compileContext={...creationCompileContextForConversation(current,input.context),pose,budget,techniques:combineCreationTechniques(workers)};
  const currentRequest=()=>active.current?.id===id&&!abort.signal.aborted&&environmentRef.current.head===head&&environmentRef.current.budget===JSON.stringify(input.context.budget);
  const run=()=>{
   if(event.type==='phase'||current.targetDefinition&&current.targetDefinition.digest!==current.definition!.digest){
    const budget=current.budgetMode==='automatic'?input.context.budget:Object.fromEntries(Object.entries(current.budget).map(([kind,amount])=>[kind,Math.min(amount,input.context.budget[kind]||0)]));
    void getClient().phase(id,current.targetDefinition||current.definition!,{...compileContext,budget},current.budgetMode).then(phase=>{if(!currentRequest())return;if(phase.status==='ready'){compiledEnvironmentRef.current=head;compiledMaterialRef.current=JSON.stringify(input.context.budget);dispatch({type:'phase-ready',requestId:id,phase});}else dispatch({type:'blocked',requestId:id,reason:phase.blockers.map(b=>b.message).join(' ')});}).catch(error=>{if(currentRequest())dispatch({type:'blocked',requestId:id,reason:error instanceof Error?error.message:'This section could not be prepared. The full design stays saved.'});});return;
   }
   void compileCreationPreview({definition:current.definition!,context:{...creationCompileContextForConversation(current,input.context),pose,budget,techniques:combineCreationTechniques(workers)},owned:input.context.budget,mode:current.budgetMode,current:()=>active.current?.id===id&&!abort.signal.aborted&&environmentRef.current.head===head&&environmentRef.current.budget===JSON.stringify(input.context.budget),compile:(definition,context)=>getClient().compile(id,definition,context)}).then(preview=>{if(!preview)return;const {result,budget}=preview,quote=creationQuote(result);if(quote)dispatch({type:'quote',requestId:id,quote,budget});if(result.status==='ready'){compiledEnvironmentRef.current=head;compiledMaterialRef.current=JSON.stringify(input.context.budget);dispatch({type:'compiled',requestId:id,plan:result.plan});}else dispatch({type:'blocked',requestId:id,reason:result.blockers.map(b=>b.message).join(' ')});}).catch(error=>{if(active.current?.id===id&&!abort.signal.aborted)dispatch({type:'blocked',requestId:id,reason:error instanceof Error?error.message:'This placement could not be prepared. Try moving it.'});});
  };
  if(event.type==='placement'){const timer=setTimeout(()=>{if(!abort.signal.aborted)run();},120);abort.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});}else run();
 },[cancel,getClient,input.ownerId,input.spaceId,input.context,input.workers,environmentHead]);
 const automaticCompileKey=useRef<string|null>(null);
 useEffect(()=>{
  if(loadedKey!==storageKey||state.status!=='idle'||!state.definition||!state.workerIds.length
    ||state.instance&&state.selectedDefinition?.digest===state.definition.digest)return;
  const key=constructionProofDigest({definition:state.definition.digest,placement:state.placement,budget:state.budget,workers:state.workerIds,instance:state.instance,environmentHead,fence,materialFence});
  if(automaticCompileKey.current===key)return;
  automaticCompileKey.current=key;
  change(state.targetDefinition&&state.targetDefinition.digest!==state.definition.digest?{type:'phase'}:{type:'workers',ids:state.workerIds});
 },[loadedKey,storageKey,state.status,state.definition,state.targetDefinition,state.workerIds,state.budget,state.budgetMode,state.placement,state.instance,state.selectedDefinition,environmentHead,fence,materialFence,change]);
 const ask=useCallback(async()=>{
  const current=stateRef.current;if(current.ownerId!==input.ownerId||current.spaceId!==input.spaceId||!current.draft.trim()||['planning','committing','recovering'].includes(current.status))return;
  cancel();const head=environmentHead,id=crypto.randomUUID(),abort=new AbortController();active.current={id,abort};dispatch({type:'request',requestId:id});
  const workers=input.workers.filter(w=>current.workerIds.includes(w.assetId));const context={...creationCompileContextForConversation(current,input.context),pose:current.placement,budget:current.budgetMode==='automatic'?input.context.budget:current.budget,techniques:combineCreationTechniques(workers)};
  const result=await planCreation({requestId:id,actorId:input.ownerId,message:current.draft,selected:current.targetDefinition||current.definition,workers,context},input.planner,abort.signal);
  if(active.current?.id!==id||abort.signal.aborted||environmentRef.current.head!==head)return;
  if(result.status!=='proposed'){dispatch({type:'blocked',requestId:id,reason:result.reason});return;}
  try {const definition='definition' in result.proposal?result.proposal.definition:(current.targetDefinition||current.definition)?applyCreationPatch((current.targetDefinition||current.definition)!,result.proposal.patch):null;if(!definition)throw Error('Select a creation before editing it.');dispatch({type:'proposal',requestId:id,definition,reply:result.proposal.reply});
   const preview=await compileCreationPreview({definition,context,owned:input.context.budget,mode:current.budgetMode,current:()=>active.current?.id===id&&!abort.signal.aborted&&environmentRef.current.head===head&&environmentRef.current.budget===JSON.stringify(input.context.budget),compile:(definition,context)=>getClient().compile(id,definition,context)});if(!preview)return;const compiled=preview.result,quote=creationQuote(compiled);if(quote)dispatch({type:'quote',requestId:id,quote,budget:preview.budget});
   if(compiled.status==='ready'){compiledEnvironmentRef.current=head;compiledMaterialRef.current=JSON.stringify(input.context.budget);dispatch({type:'compiled',requestId:id,plan:compiled.plan});}else dispatch({type:'blocked',requestId:id,reason:compiled.blockers.map(b=>b.message).join(' ')});
  }catch(error){dispatch({type:'blocked',requestId:id,reason:error instanceof Error?error.message:'Could not preview this draft.'});}
 },[cancel,input,getClient,environmentHead]);
 const build=useCallback(async()=>{const current=stateRef.current;if(compiledMaterialRef.current!==environmentRef.current.budget||compiledEnvironmentRef.current!==environmentRef.current.head||!current.plan||!current.definition||['committing','recovering'].includes(current.status))return;if(!input.commit){dispatch({type:'blocked',reason:'Live construction is awaiting authenticated world admission. Your preview is saved.'});return;}if(current.targetDefinition&&current.targetDefinition.digest!==current.definition.digest){
  try{const scope={ownerId:current.ownerId,spaceId:current.spaceId},refs=[{kind:'definition' as const,id:current.definition.digest},...(current.instance?[{kind:'instance' as const,id:current.instance.instanceId}]:[])];for(const ref of refs)localStorage.setItem(creationGoalKey(scope,ref),encodeCreationGoal(scope,ref,current.targetDefinition));}
  catch{dispatch({type:'blocked',reason:'The full design could not be saved locally. Free some browser storage before building a section; no materials have been spent.'});return;}
 }dispatch({type:'commit'});try{const workers=input.workers.filter(worker=>current.workerIds.includes(worker.assetId));const context={...creationCompileContextForConversation(current,input.context),pose:current.placement,budget:current.budget,techniques:combineCreationTechniques(workers)};const result=await input.commit(current.plan,current.definition,current.workerIds,current.instance,context);if(environmentRef.current.ownerId!==current.ownerId||environmentRef.current.spaceId!==current.spaceId)return;if(result.status==='admitted'){rememberAdmittedGoal(current,result.instance);dispatch({type:'admitted',instance:result.instance});}else if(result.status==='unknown')dispatch({type:'unknown',operationId:result.operationId});else dispatch({type:'blocked',reason:result.reason});}catch{if(environmentRef.current.ownerId===current.ownerId&&environmentRef.current.spaceId===current.spaceId)dispatch({type:'unknown',operationId:current.plan.digest});}},[input]);
 return {state,change,ask,build,canBuild:Boolean(input.commit)&&state.status==='preview'&&compiledEnvironmentRef.current===environmentHead&&compiledMaterialRef.current===materialFence,cancel};
}
