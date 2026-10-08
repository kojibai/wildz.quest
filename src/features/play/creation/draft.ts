import type {CreationCompileContext} from './compiler';
import type {CreationConversationState} from './conversation';
import type {CreationDefinition,CreationInstanceRef,CreationPose,CreationResourceBudget} from './types';
import {validateCreationBudget} from './resources';
import {verifyCreationInstance,type CreationInstance} from './instance';
import {assertCreationData,parseCreationDefinition} from './definition';
import {validConstructionHead,validConstructionId} from '../wilds-construction-project';
export type CreationDraftObject=Readonly<{definition:CreationDefinition;instance:CreationInstance;custodyOwnerId?:string}>;
export type CreationDraftResult=Readonly<{status:'ready';draft:string;definition:CreationDefinition|null;selected:CreationDraftObject|null;workerIds:readonly string[];budget:CreationResourceBudget;budgetMode:'automatic'|'manual';placement?:CreationPose}>|Readonly<{status:'recovery';draft:string;original:string;reason:string}>;
/** Draft bytes are recovery hints. An existing selection must reopen through the account's proof reader. */
export async function restoreCreationDraft(original:string,scope:{ownerId:string;spaceId:string},read?:(ref:CreationInstanceRef)=>Promise<CreationDraftObject|null>):Promise<CreationDraftResult>{
 let draft='';const recovery=(reason:string):CreationDraftResult=>({status:'recovery',draft,original,reason});
 try{
  if(original.length>262144)return recovery('Saved draft exceeds the supported size. Its original has been retained.');
  const raw=JSON.parse(original);assertCreationData(raw);if(!raw||raw.ownerId!==scope.ownerId||raw.spaceId!==scope.spaceId)return recovery('Saved draft belongs to another account or location.');
  draft=typeof raw.draft==='string'?raw.draft.slice(0,4000):'';
  const definition=raw.definition?parseCreationDefinition(raw.definition):null;
  const workerIds = Array.isArray(raw.workerIds) && raw.workerIds.length <= 32 && raw.workerIds.every(validConstructionId) ? [...new Set<string>(raw.workerIds)] : [];
  const budget = raw.budget ?? { hay: 0, timber: 0, stone: 0 };
  validateCreationBudget(budget);
  const placement = raw.placement;
  if (placement && ![placement.position?.x, placement.position?.y, placement.position?.z, placement.yaw].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9)) return recovery('Saved placement could not be reopened. Its original has been retained.');
  const setup = { workerIds, budget, budgetMode:raw.budgetMode==='automatic'?'automatic' as const:'manual' as const, ...(placement ? { placement } : {}) };
  if(!raw.instance){if(definition&&definition.creatorId!==scope.ownerId)return recovery('Reopen the owned object before restoring this draft.');return {status:'ready',draft,definition,selected:null,...setup};}
  const ref=raw.instance as CreationInstanceRef;
  if(!definition||!validConstructionId(ref.instanceId)||!validConstructionHead(ref.head)||!validConstructionHead(ref.definitionDigest)||Object.keys(ref).sort().join(',')!=='definitionDigest,head,instanceId'||!read)return recovery('Reopen the owned object before restoring this draft.');
  const selected=await read(ref);
  if(!selected||!verifyCreationInstance(selected.instance)||parseCreationDefinition(selected.definition).digest!==selected.instance.definitionDigest||(selected.custodyOwnerId||selected.instance.ownerId)!==scope.ownerId||selected.instance.spaceId!==scope.spaceId||selected.instance.instanceId!==ref.instanceId||selected.instance.head!==ref.head||selected.definition.digest!==ref.definitionDigest||definition.creatorId!==selected.definition.creatorId||definition.seed!==selected.definition.seed)return recovery('This object changed or its ownership could not be verified. The original draft is retained.');
  return {status:'ready',draft,definition,selected,...setup,placement:selected.instance.pose};
 }catch{return recovery('This saved draft could not be reopened. Its original has been retained.');}
}
/** Preview credits are bound to the original selected graph, never a preceding unbuilt refinement. */
export function creationCompileContextForConversation(state:CreationConversationState,context:CreationCompileContext):CreationCompileContext{
 const {evolution,...base}=context;void evolution;
 return {...base,physical:state.instance&&state.selectedDefinition?base.physical.filter(c=>c.instanceId!==state.instance!.instanceId||c.head!==state.instance!.head):base.physical,pose:state.placement,...(state.instance&&state.selectedDefinition?{evolution:{instanceId:state.instance.instanceId,head:state.instance.head,definition:state.selectedDefinition}}:{})};
}
