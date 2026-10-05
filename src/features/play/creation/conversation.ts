import type { CreationDefinition, CreationInstanceRef, CreationPose, CreationResourceBudget } from './types';
import type { CreationPlan } from './compiler';
export type CreationConversationState=Readonly<{ownerId:string;spaceId:string;open:boolean;minimized:boolean;workerIds:readonly string[];budget:CreationResourceBudget;draft:string;history:readonly {role:'user'|'assistant';text:string}[];requestId:string|null;definition:CreationDefinition|null;instance:CreationInstanceRef|null;plan:CreationPlan|null;placement:CreationPose;status:'idle'|'planning'|'preview'|'committing'|'recovering'|'blocked';reason:string|null;operationId:string|null}>;
export type CreationConversationEvent={type:'environment';ownerId:string;spaceId:string}|{type:'open'|'close'|'minimize'|'invalidate'}|{type:'draft';text:string}|{type:'selection';definition:CreationDefinition|null;instance?:CreationInstanceRef|null}|{type:'workers';ids:readonly string[]}|{type:'budget';budget:CreationResourceBudget}|{type:'placement';pose:CreationPose}|{type:'request'|'compile-request';requestId:string}|{type:'proposal';requestId:string;definition:CreationDefinition;reply:string}|{type:'compiled';requestId:string;plan:CreationPlan;minimize?:boolean}|{type:'blocked';requestId?:string;reason:string}|{type:'commit'}|{type:'admitted';instance:CreationInstanceRef}|{type:'unknown';operationId:string};
export function initialCreationConversation(ownerId:string,spaceId:string,pose:CreationPose):CreationConversationState {return {ownerId,spaceId,open:false,minimized:false,workerIds:[],budget:{hay:0,timber:0,stone:0},draft:'',history:[],requestId:null,definition:null,instance:null,plan:null,placement:pose,status:'idle',reason:null,operationId:null};}
export function reduceCreationConversation(state:CreationConversationState,event:CreationConversationEvent):CreationConversationState {
 const invalidate={requestId:null,plan:null,status:'idle' as const,reason:null};
 if(event.type==='environment'){if(event.ownerId===state.ownerId&&event.spaceId===state.spaceId)return state;return {...initialCreationConversation(event.ownerId,event.spaceId,state.placement),open:state.open};}
 if(event.type==='invalidate')return ['committing','recovering'].includes(state.status)?state:{...state,...invalidate};
 if(event.type==='close')return {...state,open:false,minimized:false,...(state.status==='planning'?invalidate:{})};
 if(event.type==='open')return {...state,open:true,minimized:false};
 if(event.type==='minimize')return {...state,minimized:!state.minimized};
 if(event.type==='draft')return {...state,draft:event.text.slice(0,4000)};
 if(event.type==='unknown')return {...state,status:'recovering',operationId:event.operationId,reason:'Checking the existing build outcome. Resources remain reserved.'};
 if(state.status==='recovering'||state.status==='committing'){
  if(event.type==='admitted')return {...state,status:'idle',instance:event.instance,operationId:null,reason:null,requestId:null,plan:null};
  if(event.type==='blocked')return {...state,status:'blocked',reason:event.reason};
  return state;
 }
 if(event.type==='selection'){if(event.definition&&event.definition.creatorId!==state.ownerId)return state;return {...state,...invalidate,definition:event.definition,instance:event.instance||null,history:[]};}
 if(event.type==='workers')return {...state,...invalidate,workerIds:[...new Set(event.ids)]};
 if(event.type==='budget')return {...state,...invalidate,budget:event.budget};
 if(event.type==='placement')return {...state,...invalidate,plan:state.plan,placement:event.pose};
 if(event.type==='compile-request')return {...state,requestId:event.requestId,status:'planning',reason:null};
 if(event.type==='request')return {...state,requestId:event.requestId,status:'planning',plan:null,reason:null,history:[...state.history,{role:'user',text:state.draft}].slice(-40) as CreationConversationState['history']};
 if(event.type==='proposal'){if(event.requestId!==state.requestId||state.status!=='planning'||event.definition.creatorId!==state.ownerId)return state;return {...state,definition:event.definition,history:[...state.history,{role:'assistant',text:event.reply}].slice(-40) as CreationConversationState['history']};}
 if(event.type==='compiled'){if(event.requestId!==state.requestId||event.plan.definitionDigest!==state.definition?.digest)return state;return {...state,plan:event.plan,status:'preview',draft:'',minimized:event.minimize?true:state.minimized};}
 if(event.type==='blocked'){if(event.requestId&&event.requestId!==state.requestId)return state;return {...state,status:'blocked',reason:event.reason};}
 if(event.type==='commit')return state.plan?{...state,status:'committing',reason:null}:state;
 return state;
}
