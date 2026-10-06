import { verifyWildsMaterialLot, type WildsMaterialLotV1 } from '../wilds-steward-construction';
import { assertCreationData } from './definition';
import type { CreationResourceBudget } from './types';
export type CreationResourceAvailability=Readonly<{actorId:string;heads:Readonly<Record<string,string>>;custody:Readonly<Record<string,string>>;reserved:ReadonlySet<string>;spent:ReadonlySet<string>;stored:ReadonlySet<string>}>;
export type CreationSelectedLot=Readonly<{id:string;head:string;kind:string;quantity:number}>;
export type CreationResourceSelection=Readonly<{lots:readonly CreationSelectedLot[];deficits:CreationResourceBudget}>;
export function validateCreationBudget(budget:CreationResourceBudget):void {assertCreationData(budget);if(Object.keys(budget).length>32||Object.values(budget).some(v=>!Number.isSafeInteger(v)||v<0))throw Error('creation_budget_invalid');}
export function selectCreationResources(lots:readonly WildsMaterialLotV1[],budget:CreationResourceBudget,required:CreationResourceBudget,availability:CreationResourceAvailability):CreationResourceSelection {
 validateCreationBudget(budget);validateCreationBudget(required);
 const selected:CreationSelectedLot[]=[],remaining={...required},spent:Record<string,number>={},seen=new Set<string>();
 for(const lot of [...lots].sort((a,b)=>a.lotId.localeCompare(b.lotId))) {
  if(!verifyWildsMaterialLot(lot)||seen.has(lot.lotId)||availability.heads[lot.lotId]!==lot.head||availability.custody[lot.lotId]!==availability.actorId||availability.spent.has(lot.lotId)||availability.reserved.has(lot.lotId)||availability.stored.has(lot.lotId))continue;
  seen.add(lot.lotId);if((remaining[lot.kind]||0)<lot.quantity||(spent[lot.kind]||0)+lot.quantity>(budget[lot.kind]||0))continue;
  selected.push({id:lot.lotId,head:lot.head,kind:lot.kind,quantity:lot.quantity});remaining[lot.kind]-=lot.quantity;spent[lot.kind]=(spent[lot.kind]||0)+lot.quantity;
 }
 return {lots:Object.freeze(selected.map(lot=>Object.freeze(lot))),deficits:Object.freeze(Object.fromEntries(Object.entries(remaining).filter(([,value])=>value>0)))};
}
