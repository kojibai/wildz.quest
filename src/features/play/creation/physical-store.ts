import {verifyCreationAdmission,type CreationOperation,type CreationAdmissionOutcome} from './operation';
import {prepareCreationNavigation,type CreationNavigation} from './navigation';
import type {CreationPhysicalProjection} from './projection';
import type {CreationPlan} from './compiler';
import type {CreationDefinition} from './types';
import type {CreationInstance} from './instance';
export type CreationPhysicalSnapshot=Readonly<{revision:number;projections:readonly CreationPhysicalProjection[];navigation:CreationNavigation;instances:Readonly<Record<string,CreationInstance>>;definitions:Readonly<Record<string,CreationDefinition>>}>;
/** Private admission boundary. Rendering never consumes caller-authored functional flags. */
export function createCreationPhysicalStore(input:Readonly<{project:(instance:CreationInstance,definition:CreationDefinition,plan:CreationPlan)=>Promise<CreationPhysicalProjection>}>){
 let snapshot:CreationPhysicalSnapshot={revision:0,projections:[],navigation:prepareCreationNavigation([]),instances:{},definitions:{}};
 const subscribers=new Set<()=>void>(),pending=new Map<string,Promise<boolean>>();
 return {snapshot:()=>snapshot,subscribe(callback:()=>void){subscribers.add(callback);return ()=>{subscribers.delete(callback);};},
  async adopt(operation:CreationOperation,outcome:CreationAdmissionOutcome,plan:CreationPlan):Promise<boolean>{
   const verified=verifyCreationAdmission(operation,outcome);if(verified.status!=='admitted'||plan.digest!==operation.planDigest||plan.definitionDigest!==operation.definitionDigest)return false;
   const prior=snapshot.instances[operation.instanceId];if(prior)return prior.head===verified.instance.head;
   const existing=pending.get(operation.instanceId);if(existing){await existing;return snapshot.instances[operation.instanceId]?.head===verified.instance.head;}
   const task=(async()=>{try{const projection=await input.project(verified.instance,operation.definition,plan);if(verifyCreationAdmission(operation,outcome).status!=='admitted'||projection.instanceId!==operation.instanceId||projection.head!==verified.instance.head||projection.definitionDigest!==operation.definitionDigest||projection.worldId!==verified.instance.worldId||projection.spaceId!==verified.instance.spaceId)return false;const projections=[...snapshot.projections,projection];snapshot={revision:snapshot.revision+1,projections,navigation:prepareCreationNavigation(projections),instances:{...snapshot.instances,[operation.instanceId]:verified.instance},definitions:{...snapshot.definitions,[operation.definitionDigest]:operation.definition}};subscribers.forEach(callback=>callback());return true;}catch{return false;}})();pending.set(operation.instanceId,task);try{return await task;}finally{pending.delete(operation.instanceId);}
  }
 };
}
