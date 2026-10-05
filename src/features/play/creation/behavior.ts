import {sealCreationInstance,verifyCreationInstance,type CreationInstance,type CreationNodeState} from './instance';
import {assertCreationData} from './definition';
import {validConstructionId,validConstructionKai} from '../wilds-construction-project';
export type CreationBehaviorEvent=Readonly<{eventId:string;targetId:string;kind:'signal'|'activate';value:boolean;kaiUPulse:number}>;
export type CreationBehaviorProposal={status:'proposed';instance:CreationInstance;steps:number;consumedEventIds:readonly string[];physical:false;writes:0}|{status:'blocked';reason:string;instance:CreationInstance;steps:number;physical:false;writes:0};
export function stepCreationBehavior(instance:CreationInstance,events:readonly CreationBehaviorEvent[],maximumSteps:number):CreationBehaviorProposal{
 let steps=0;
 const blocked=(reason:string):CreationBehaviorProposal=>({status:'blocked',reason,instance,steps,physical:false,writes:0});
 try{
  assertCreationData(events);
  if(!verifyCreationInstance(instance)||!Number.isSafeInteger(maximumSteps)||maximumSteps<1||events.length>256)return blocked('creation_behavior_invalid');
  if(!events.length)return {status:'proposed',instance,steps:0,consumedEventIds:[],physical:false,writes:0};
  if(!['functional','finished'].includes(instance.stage))return blocked('creation_behavior_nonfunctional');
  const limit=Math.min(maximumSteps,64),states:Record<string,CreationNodeState>={...instance.nodeStates},processed=new Set<string>(),consumed=new Set<string>();let changed=false,kai=instance.kaiUPulse;
  const queue=events.map(event=>({event,path:[] as string[]}));
  while(queue.length){
   const {event,path}=queue.shift()!;
   if(!validConstructionId(event.eventId)||!validConstructionId(event.targetId)||!['signal','activate'].includes(event.kind)||typeof event.value!=='boolean'||!validConstructionKai(event.kaiUPulse)||event.kaiUPulse<instance.kaiUPulse)return blocked('creation_behavior_event_invalid');
   if(path.includes(event.targetId))return blocked('creation_behavior_cycle_budget');
   const node=states[event.targetId];if(!node||!['logic','sensor','joint','actuator'].includes(node.kind)||node.condition===0)return blocked('creation_behavior_target_forbidden');
   const key=`${event.eventId}:${event.targetId}`;if(processed.has(key)||node.kind==='logic'&&node.consumedEventIds.includes(event.eventId))continue;
   if(steps>=limit)return blocked('creation_behavior_step_budget');steps++;processed.add(key);consumed.add(event.eventId);kai=Math.max(kai,event.kaiUPulse);
   if(node.kind==='logic'){
    if(node.consumedEventIds.length>=4096)return blocked('creation_behavior_history_budget');
    states[event.targetId]={...node,counter:Math.min(node.limit,node.counter+(event.value?1:0)),consumedEventIds:[...node.consumedEventIds,event.eventId]};changed=true;
   }else if(node.kind==='sensor'){states[event.targetId]={...node,signal:event.value};changed=changed||node.signal!==event.value;
   }else if(node.kind==='joint'||node.kind==='actuator'){const position=event.value?node.maximum:node.minimum;states[event.targetId]={...node,position};changed=changed||node.position!==position;}
   if('targetIds'in node)for(const targetId of node.targetIds)queue.push({event:{...event,targetId},path:[...path,event.targetId]});
  }
  if(!changed)return {status:'proposed',instance,steps,consumedEventIds:[...consumed],physical:false,writes:0};
  const {head,...basis}=instance;
  const next=sealCreationInstance({...basis,nodeStates:states,revision:instance.revision+1,parentHead:head,kaiUPulse:kai});
  return {status:'proposed',instance:next,steps,consumedEventIds:[...consumed],physical:false,writes:0};
 }catch(error){return blocked(error instanceof Error?error.message:'creation_behavior_invalid');}
}
