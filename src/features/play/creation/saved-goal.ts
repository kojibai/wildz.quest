import {assertCreationData,parseCreationDefinition} from './definition';
import {creationContainsParts} from './parts-basis';
import type {CreationDefinition} from './types';

export type CreationGoalScope=Readonly<{ownerId:string;spaceId:string}>;
type GoalRef=Readonly<{kind:'instance'|'definition';id:string}>;
export const creationGoalKey=(scope:CreationGoalScope,ref:GoalRef)=>`wildz:creation-goal:v1:${JSON.stringify([scope.ownerId,scope.spaceId,ref.kind,ref.id])}`;
/** Local design hints are scoped separately from proof-backed built objects. */
export function encodeCreationGoal(scope:CreationGoalScope,ref:GoalRef,definition:CreationDefinition):string {
 const raw=JSON.stringify({schema:'wildz.creation-goal.v1',...scope,ref,definition});
 if(raw.length>262144)throw Error('The complete design is too large to save locally. Save a smaller design before building it in sections.');
 return raw;
}
export function reopenCreationGoal(raw:string|null,scope:CreationGoalScope,ref:GoalRef,built:CreationDefinition):CreationDefinition|null {
 try{
  if(!raw||raw.length>262144)return null;
  const value=JSON.parse(raw);assertCreationData(value);
  if(value.schema!=='wildz.creation-goal.v1'||value.ownerId!==scope.ownerId||value.spaceId!==scope.spaceId||value.ref?.kind!==ref.kind||value.ref?.id!==ref.id)return null;
  const target=parseCreationDefinition(value.definition);
  return creationContainsParts(target,built)?target:null;
 }catch{return null;}
}
