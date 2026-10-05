import { verifyAnyWildsCard, sha256PortableBasis, type PortableCardAsset } from '../portable-card';
import { validateAdventureCondition } from '../adventure/card-condition';
import { projectCreatureCreationTechniquesV1 } from '../creature-capability-identity';
import { constructionProofDigest, freezeConstructionProof } from '../wilds-construction-project';
import type { PlayState } from '../game-state';
export type CreationWorker=Readonly<{assetId:string;subjectId:string;head:string;proofDigest:string;techniques:readonly string[];ready:boolean;reasons:readonly string[]}>;
const cache=new Map<string,CreationWorker>();
export function projectCreationWorkers(cards:readonly PortableCardAsset[],conditions:PlayState['adventureConditions']):readonly CreationWorker[]{
 return Object.freeze(cards.map(card=>{const condition=conditions[card.id],key=`${card.id}:${card.proof.digest}:${card.status}:${condition?constructionProofDigest(condition):'missing'}`;
  const reasons:string[]=[];let techniques:readonly string[]=[];
  try {if(!verifyAnyWildsCard(card).ok)throw Error('The creature proof is invalid.');if(!condition)throw Error('Current creature condition is unavailable.');validateAdventureCondition(condition);const cached=cache.get(key);if(cached)return cached;techniques=projectCreatureCreationTechniquesV1(card,condition);if(!techniques.length)reasons.push('This creature needs to be alive, available, and rested.');}catch(error){reasons.push(error instanceof Error?error.message:'Creature unavailable');}
  const result=freezeConstructionProof({assetId:card.id,subjectId:`creature:${sha256PortableBasis(card.id).slice(0,32)}`,head:sha256PortableBasis(card.proof.digest),proofDigest:card.proof.digest,techniques,ready:!reasons.length,reasons});if(!reasons.length)cache.set(key,result);if(cache.size>128)cache.delete(cache.keys().next().value!);return result;
 }));
}
export function combineCreationTechniques(workers:readonly CreationWorker[]):readonly string[]{return Object.freeze([...new Set(workers.filter(w=>w.ready).flatMap(w=>w.techniques))].sort());}
