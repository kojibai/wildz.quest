import type {WildzContinuityDatabase,WildzContinuityTransaction} from '../storage/wildz-indexed-db';
import {canonicalPortableCardJson} from '../../features/play/portable-card';
import type {WildsResourceGameplayCommandV128} from './wilds-resource-gameplay-v128';
const fenceKey=(owner:string,id:string)=>JSON.stringify(['wildz.material-publication-fence.v128',owner,id]);
const commandId=(attempt:string)=>/^(?:material-replay|material-use):(.+)$/.exec(attempt)?.[1];
/** This fence cancels local publication only; it never establishes custody. */
export async function assertWildsMaterialPublicationOpenV128(tx:WildzContinuityTransaction,owner:string,attempt:string){
 const id=commandId(attempt);
 if(id&&await tx.get('meta',fenceKey(owner,id)))throw Error('wilds_material_publication_cancelled');
}
/** The source store reserves preparation in this same transaction before any
 * seal/publish. Its reserve guard closes the competing-tab check/prepare race.
 * Preparation records are retained, including after accepted publication. */
export async function rejectUnpreparedWildsMaterialV128(database:WildzContinuityDatabase,owner:string,raw:Extract<WildsResourceGameplayCommandV128,{kind:'world'}>){
 const id=raw.command.commandId;
 return database.transaction(['meta'],'readwrite',async tx=>{
  for(const attempt of [`material-replay:${id}`,`material-use:${id}`]){
   if(await tx.get('meta',JSON.stringify(['wildz.resource-source-attempt.v128',owner,attempt])))return false;
   const exchange=await tx.get<{after?:unknown;event?:{commands?:WildsResourceGameplayCommandV128[]}}>('meta',JSON.stringify(['wildz.resource-exchange-attempt.v128',owner,attempt]));
   if(exchange?.after)return false;
   const saved=exchange?.event?.commands?.at(-1);
   if(exchange&&(!saved||saved.kind!=='world'||canonicalPortableCardJson(saved.command)!==canonicalPortableCardJson(raw.command)))throw Error('wilds_material_attempt_conflict');
  }
  const key=fenceKey(owner,id),prior=await tx.get<{command:typeof raw}>('meta',key);
  if(prior&&canonicalPortableCardJson(prior.command)!==canonicalPortableCardJson(raw))throw Error('wilds_material_attempt_conflict');
  if(!prior)await tx.put('meta',{command:raw},key);
  return true;
 });
}
