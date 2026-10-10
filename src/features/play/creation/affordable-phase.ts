import {compileCreation,type CreationCompileContext,type CreationBlocker,type CreationPlan,type CreationResourceQuote} from './compiler';
import {createCreationDefinition,parseCreationDefinition} from './definition';
import {creationContainsParts} from './parts-basis';
import type {CreationDefinition,CreationNode,CreationResourceBudget} from './types';
import {groundCreationCompileContext} from './ground-placement';

export type CreationPhaseResult={status:'ready';definition:CreationDefinition;plan:CreationPlan;budget:CreationResourceBudget;targetQuote:CreationResourceQuote|null}|{status:'blocked';blockers:readonly CreationBlocker[];quote?:CreationResourceQuote};

/** Runs in the creation worker. Preserve exact parts and supports, compile each
 * candidate through the ordinary laws, and transfer only the selected plan. */
export function prepareAffordableCreation(input:CreationDefinition,context:CreationCompileContext,mode:'automatic'|'manual'):CreationPhaseResult {
 const reject=(message:string):CreationPhaseResult=>({status:'blocked',blockers:[{code:'phase',nodeId:null,message}]});
 try{
  const target=parseCreationDefinition(input),previous=context.evolution?parseCreationDefinition(context.evolution.definition):null;
  context=groundCreationCompileContext(target,context);
  if(previous&&!creationContainsParts(target,previous))return reject('The saved design no longer contains every built part unchanged. Prepare your changes through the normal construction flow.');
  const full=compileCreation(target,context),targetQuote=full.status==='ready'?{definitionDigest:target.digest,requiredResources:full.plan.requiredResources,requiredWork:full.plan.requiredWork}:full.quote||null;
  if(full.status==='ready')return ready(target,full.plan);
  const byId=new Map(target.nodes.map(node=>[node.id,node])),indices=new Map(target.nodes.map((node,i)=>[node.id,i])),selected=new Set(previous?.nodes.map(node=>node.id)||[]);
  const descendants=(id:string):string[]=>target.nodes.filter(node=>node.parentId===id).flatMap(node=>[node.id,...descendants(node.id)]);
  const dependencies=(id:string,set:Set<string>)=>{if(set.has(id))return;set.add(id);const node=byId.get(id)!;for(const ref of [...(node.parentId?[node.parentId]:[]),...node.supports,...node.attachments])dependencies(ref,set);};
  const path=(node:CreationNode):number[]=>[...(node.parentId?path(byId.get(node.parentId)!):[]),indices.get(node.id)!];
  const anchors=target.nodes.filter(node=>node.behaviors.length).sort((a,b)=>{const x=path(a),y=path(b);for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length;});
  let chosen:CreationPlan|null=null,definition:CreationDefinition|null=null,minimum:CreationResourceQuote|undefined;
  const tryPart=(node:CreationNode)=>{
   const ids=new Set(selected);dependencies(node.id,ids);
   // A bed, chest or tool includes its parent assembly (frame, grip, guard).
   if(node.parentId&&node.behaviors.some(b=>['bed','storage','tool','weapon'].includes(b.id)))for(const id of descendants(node.parentId))dependencies(id,ids);
   // Elevated independent rooms need the preceding galleries and stairs, with
   // all their supports. A supported room alone is not an accessible first phase.
   if(!node.parentId&&node.pose.position.y>.25&&node.behaviors.some(b=>b.id==='habitat'))for(const before of target.nodes.slice(0,indices.get(node.id)))if(!before.behaviors.length)dependencies(before.id,ids);
   if(ids.size===selected.size)return;
   const {digest,...basis}=target;void digest;
   const candidate=createCreationDefinition({...basis,nodes:target.nodes.filter(part=>ids.has(part.id))});
   const compiled=compileCreation(candidate,context);
   if(compiled.status==='ready'){selected.clear();ids.forEach(id=>selected.add(id));chosen=compiled.plan;definition=candidate;}
   else if(compiled.quote&&(!minimum||Object.values(compiled.quote.requiredResources).reduce((a,b)=>a+b,0)<Object.values(minimum.requiredResources).reduce((a,b)=>a+b,0)))minimum=compiled.quote;
  };
  for(const anchor of anchors)tryPart(anchor);
  // Once useful functionality exists, add affordable structural details. For
  // a sculpture without behaviors, a complete supported shape is itself a part.
  if(chosen||previous||!anchors.length)for(const node of target.nodes)if(!node.behaviors.length&&!descendants(node.id).some(id=>byId.get(id)!.behaviors.length))tryPart(node);
  if(!chosen||!definition)return minimum?{status:'blocked',quote:minimum,blockers:[{code:'resources',nodeId:null,message:`A usable section needs ${Object.entries(minimum.requiredResources).map(([kind,n])=>`${n} ${kind}`).join(' and ')}. Increase the allocation or gather the missing materials. The full design stays saved.`}]}:reject('No usable section fits this placement and your creatures’ current techniques. The full design stays saved.');
  return ready(definition,chosen);
  function ready(definition:CreationDefinition,plan:CreationPlan):CreationPhaseResult {
   const budget=mode==='automatic'?plan.requiredResources:context.budget;
   const exact=mode==='automatic'?compileCreation(definition,{...context,budget}):{status:'ready' as const,plan};
   return exact.status==='ready'?{status:'ready',definition,plan:exact.plan,budget,targetQuote}:{status:'blocked',blockers:exact.blockers};
  }
 }catch(error){return reject(error instanceof Error?error.message:'This section could not be prepared. The full design stays saved.');}
}
