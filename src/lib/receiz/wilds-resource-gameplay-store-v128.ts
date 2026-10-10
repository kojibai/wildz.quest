import type { WildzContinuityDatabase, WildzContinuityTransaction } from '../storage/wildz-indexed-db';
import {canonicalPortableCardJson,sha256PortableBasis,type PortableCardAsset} from '../../features/play/portable-card';
import type {ReceizPortableSealedArtifactV124} from '@receiz/sdk';
import {validateWildsResourceGameplayCommandV128,wildsResourceGameplayCommandIdV128,WILDS_RESOURCE_GAMEPLAY_MAX_BYTES_V128,WILDS_RESOURCE_GAMEPLAY_MAX_COMMANDS_V128,type WildsResourceGameplayCommandV128} from './wilds-resource-gameplay-v128';

export type WildsResourceGameplayHistoryV128=Readonly<{schema:'wildz.resource-gameplay-history.v128';ownerReceizId:string;gameplayOwnerId:string;commands:readonly WildsResourceGameplayCommandV128[]}>;
type Entry=Readonly<{commandId:string;kaiUPulse:number;bytes:number;digest:string}>;
type Index=Readonly<{schema:'wildz.resource-gameplay-index.v128';ownerReceizId:string;gameplayOwnerId:string;entries:readonly Entry[];bytes:number}>;
const key=(owner:string)=>JSON.stringify(['wildz.resource-gameplay-index.v128',owner]);
const rowKey=(owner:string,id:string)=>JSON.stringify(['wildz.resource-gameplay-command.v128',owner,id]);
const legacyKey=(owner:string)=>JSON.stringify(['wildz.resource-gameplay-history.v128',owner]);
const descriptor=(command:WildsResourceGameplayCommandV128):Entry=>{const exact=canonicalPortableCardJson(command);return {commandId:wildsResourceGameplayCommandIdV128(command),kaiUPulse:command.kaiUPulse,bytes:new TextEncoder().encode(exact).length,digest:sha256PortableBasis(exact)};};
const empty=(ownerReceizId:string,gameplayOwnerId:string):Index=>({schema:'wildz.resource-gameplay-index.v128',ownerReceizId,gameplayOwnerId,entries:[],bytes:0});
function binding(index:Index,owner:string,gameplay:string){
 if(index.schema!=='wildz.resource-gameplay-index.v128'||index.ownerReceizId!==owner||index.gameplayOwnerId!==gameplay||!Array.isArray(index.entries)
  ||index.entries.length>WILDS_RESOURCE_GAMEPLAY_MAX_COMMANDS_V128||index.bytes>WILDS_RESOURCE_GAMEPLAY_MAX_BYTES_V128)throw Error('wilds_resource_history_binding_invalid');
}
async function readIndex(tx:WildzContinuityTransaction,owner:string,gameplay:string,migrate=false){
 let index=await tx.get<Index>('meta',key(owner));
 if(!index){
  const legacy=await tx.get<WildsResourceGameplayHistoryV128>('meta',legacyKey(owner));
  index=empty(owner,gameplay);
  if(legacy){if(legacy.schema!=='wildz.resource-gameplay-history.v128'||legacy.ownerReceizId!==owner||legacy.gameplayOwnerId!==gameplay||!Array.isArray(legacy.commands))throw Error('wilds_resource_history_binding_invalid');
   const entries=legacy.commands.map(command=>{validateWildsResourceGameplayCommandV128(command);return descriptor(command);});
   index={...index,entries:entries.sort((a,b)=>a.kaiUPulse-b.kaiUPulse),bytes:entries.reduce((sum,e)=>sum+e.bytes,0)};
   if(migrate){for(const command of legacy.commands)await tx.put('meta',command,rowKey(owner,wildsResourceGameplayCommandIdV128(command)));await tx.put('meta',index,key(owner));await tx.delete('meta',legacyKey(owner));}
   else return {index,legacy};
  }
 }
 binding(index,owner,gameplay);return {index,legacy:null};
}
/** Persist one immutable admitted command and a small ordered index. No full
 * history read, SDK work, signing or network occurs on the collection path. */
export async function queueWildsResourceGameplayV128(input:Readonly<{database:WildzContinuityDatabase;ownerReceizId:string;gameplayOwnerId:string;command:WildsResourceGameplayCommandV128}>){
 const command=structuredClone(input.command);validateWildsResourceGameplayCommandV128(command);
 if(!/^[a-z0-9][a-z0-9._-]{0,63}\.receiz\.id$/.test(input.ownerReceizId))throw Error('wilds_resource_history_owner_invalid');
 const entry=descriptor(command);
 return input.database.transaction(['meta'],'readwrite',async tx=>{
  const {index}=await readIndex(tx,input.ownerReceizId,input.gameplayOwnerId,true),existing=index.entries.find(e=>e.commandId===entry.commandId);
  if(existing){if(existing.digest!==entry.digest)throw Error('wilds_resource_history_command_conflict');return {commandCount:index.entries.length};}
  const next={...index,entries:[...index.entries,entry].sort((a,b)=>a.kaiUPulse-b.kaiUPulse),bytes:index.bytes+entry.bytes};
  if(next.entries.length>WILDS_RESOURCE_GAMEPLAY_MAX_COMMANDS_V128||next.bytes>WILDS_RESOURCE_GAMEPLAY_MAX_BYTES_V128)throw Error('wilds_resource_history_full');
  await tx.put('meta',command,rowKey(input.ownerReceizId,entry.commandId));await tx.put('meta',next,key(input.ownerReceizId));return {commandCount:next.entries.length};
 });
}
export async function readWildsResourceGameplayHistoryV128(database:WildzContinuityDatabase,ownerReceizId:string,gameplayOwnerId:string):Promise<WildsResourceGameplayHistoryV128>{
 return database.transaction(['meta'],'readonly',async tx=>{
  const {index,legacy}=await readIndex(tx,ownerReceizId,gameplayOwnerId);
  const commands=legacy?[...legacy.commands].sort((a,b)=>a.kaiUPulse-b.kaiUPulse):await Promise.all(index.entries.map(async entry=>{
   const command=await tx.get<WildsResourceGameplayCommandV128>('meta',rowKey(ownerReceizId,entry.commandId));
   if(!command)throw Error('wilds_resource_history_command_missing');validateWildsResourceGameplayCommandV128(command);
   if(canonicalPortableCardJson(descriptor(command))!==canonicalPortableCardJson(entry))throw Error('wilds_resource_history_command_binding_invalid');return command;
  }));
  return {schema:'wildz.resource-gameplay-history.v128',ownerReceizId,gameplayOwnerId,commands};
 });
}

/** Resolve exact held Originals only when Send requests source qualification.
 * Dependencies are retained once, so later retries cannot silently substitute
 * another sealed head. Resolution itself grants no authority; SDK opening follows. */
export async function resolveWildsResourceGameplayOriginalsV128(input:Readonly<{database:WildzContinuityDatabase;ownerReceizId:string;gameplayOwnerId:string;
 resolveOriginal?:(card:PortableCardAsset)=>Promise<ReceizPortableSealedArtifactV124|null>}>){
 type Mutable<T>=T extends object?{-readonly[K in keyof T]:T[K]}:T;
 const original=await readWildsResourceGameplayHistoryV128(input.database,input.ownerReceizId,input.gameplayOwnerId),commands=structuredClone(original.commands) as Mutable<WildsResourceGameplayCommandV128>[];
 if(!input.resolveOriginal)return original;
 for(const entry of commands){
  if(entry.kind==='world'){
   if(entry.card&&!entry.cardOriginal){const artifact=await input.resolveOriginal(entry.card);if(artifact)entry.cardOriginal=artifact;}
   if(entry.command.type==='creation.construct'||entry.command.type==='creation.evolve')for(const source of entry.command.workerSources){
    if(!entry.workerOriginals?.[source.card.id]){const artifact=await input.resolveOriginal(source.card);if(artifact)entry.workerOriginals={...entry.workerOriginals,[source.card.id]:artifact};}
   }
  }else if(entry.kind==='animal.hunt'&&entry.hunter.kind==='creature'&&!entry.cardOriginal){const artifact=await input.resolveOriginal(entry.hunter.asset);if(artifact)entry.cardOriginal=artifact;}
 }
 if(canonicalPortableCardJson(commands)===canonicalPortableCardJson(original.commands))return original;
 await input.database.transaction(['meta'],'readwrite',async tx=>{
  const {index}=await readIndex(tx,input.ownerReceizId,input.gameplayOwnerId,true);
  const entries=[...index.entries];let bytes=index.bytes;
  for(let i=0;i<commands.length;i++){
   const prior=descriptor(original.commands[i]!),resolved=commands[i]!,next=descriptor(resolved),position=entries.findIndex(e=>e.commandId===prior.commandId);
   if(position<0||entries[position]!.digest!==prior.digest)throw Error('wilds_resource_history_resolution_conflict');
   if(next.digest===prior.digest)continue;
   bytes+=next.bytes-prior.bytes;entries[position]=next;await tx.put('meta',resolved,rowKey(input.ownerReceizId,next.commandId));
  }
  if(bytes>WILDS_RESOURCE_GAMEPLAY_MAX_BYTES_V128)throw Error('wilds_resource_history_full');
  await tx.put('meta',{...index,entries,bytes},key(input.ownerReceizId));
 });
 return readWildsResourceGameplayHistoryV128(input.database,input.ownerReceizId,input.gameplayOwnerId);
}
