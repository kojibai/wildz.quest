import {isQualifiedWildsApplicationResourceCustodyV128} from '../../lib/receiz/wilds-resource-gameplay-v128';
import type {WildsWorldProjection} from './wilds-world-state';
import {isWorldCreationSuccessor} from './creation/world-source';
import {verifyWildsStewardTool} from './wilds-steward-construction';

const sourceFields = ['materialLots','resourceLots','consumedMaterialLots','reservedMaterialLots','reservedResourceLots','storedMaterialLots',
 'creations','creationEvents','structures','burrows','constructionSites','constructionProjects','constructionChunks',
 'constructionComponents','constructionMaterialContributions','constructionWorkContributions','constructionCommandReceipts',
 'constructionConditions','stewardTools','equippedStewardTools'] as const;

/** Compose an explicitly SDK-replayed resource world with the existing display.
 * Keep remote ecology, bosses and player history; source results win exact
 * overlapping resource/construction IDs. Never clone qualified custody entries.
 * This presentation composition is not a new source admission or checkpoint. */
export function mergeQualifiedWildsResourceWorldV128(current:WildsWorldProjection|null,qualifiedSource:WildsWorldProjection):WildsWorldProjection {
 for(const [id,custody] of Object.entries(qualifiedSource.applicationSourceCustody??{})){
  const lot=qualifiedSource.materialLots[id]??qualifiedSource.resourceLots[id];
  if(!lot||!isQualifiedWildsApplicationResourceCustodyV128(custody,id,lot.head))throw Error('wilds_resource_application_custody_not_admitted');
 }
 if(!current)return qualifiedSource;
 if(current.worldId!==qualifiedSource.worldId||current.schema!==qualifiedSource.schema)throw Error('wilds_resource_application_world_mismatch');
 const composed={...current,revision:Math.max(current.revision,qualifiedSource.revision),applicationSourceCustody:{...qualifiedSource.applicationSourceCustody}};
 for(const field of sourceFields)Object.assign(composed,{[field]:{...current[field],...qualifiedSource[field]}});
 for(const [id,before] of Object.entries(qualifiedSource.creations??{})){
  const later=current.creations?.[id];
  if(later&&isWorldCreationSuccessor(before,later)){composed.creations![id]=later;if(current.creationEvents?.[id])composed.creationEvents![id]=current.creationEvents[id];}
 }
 for(const [id,before] of Object.entries(qualifiedSource.stewardTools)){
  const later=current.stewardTools[id];
  if(later&&verifyWildsStewardTool(later)&&later.ownerReceizId===before.ownerReceizId&&later.parentHead===before.head&&later.revision===before.revision+1)composed.stewardTools[id]=later;
 }
 // An older legacy display lock/consume flag cannot override the current
 // source-qualified keeper's exact imported unit availability.
 for(const id of Object.keys(qualifiedSource.applicationSourceCustody??{})){
  for(const field of ['consumedMaterialLots','reservedMaterialLots','reservedResourceLots','storedMaterialLots'] as const){
   const target=composed[field];if(target&&!qualifiedSource[field]?.[id])delete target[id];
  }
 }
 return composed;
}
