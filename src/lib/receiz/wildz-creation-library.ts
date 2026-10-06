import {receizBase64UrlDecode} from '@receiz/sdk';
import type {WildzContinuityDatabase} from '../storage/wildz-indexed-db';
import type {createWildzProofSourceRepository} from './wildz-proof-source-repository';
import {createWildzCreationArtifactReader,readWildzCreationArtifactCustody,readWildzCreationArtifactVerification,type WildzCreationArtifact} from './wildz-creation-artifact';
import {parseWildzPlayerCoordinate,sameWildzPlayerCoordinate} from './wildz-player-coordinate';
export type CreationLibraryScope=Readonly<{keyId:string;actorId:string}>;
export type CreationLibraryEntry=Readonly<{instanceId:string;status:'owned'|'recovery'|'conflict'|'transferred'|'unavailable';artifactSha256?:string;artifact?:WildzCreationArtifact;reason?:string}>;
type SourceRecord=Readonly<{schema:'wildz.creation-library-source.v1';instanceId:string;bytes:Uint8Array;filename:string;mimeType:string}>;
type Member=Readonly<{instanceId:string;previous:string|null}>;
type SourceLink=Readonly<{artifactSha256:string;previous:string|null}>;
const MAX_BYTES=36*1024*1024,MAX_HISTORY_BYTES=64*1024*1024,MAX_HISTORY=256;
const validDigest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const validId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=512&&v.trim()===v;
const key=(...parts:string[])=>JSON.stringify(['wildz.creation-library.v1',...parts]);
const recordKey=(sha:string)=>key('source',sha);
function coordinate(scope:CreationLibraryScope){
 if(!scope||!validId(scope.keyId))throw Error('creation_library_scope_invalid');
 const actor=parseWildzPlayerCoordinate(scope.actorId);if(!actor)throw Error('creation_library_scope_invalid');
 return key('account',scope.keyId,actor.actorId);
}
function equalBytes(a:Uint8Array,b:Uint8Array){return a.length===b.length&&a.every((v,i)=>v===b[i]);}
/** Append-only exact source custody. Account/index rows are retrieval hints, never currentness or world admission. */
export function createWildzCreationLibrary(dependencies:Readonly<{database:WildzContinuityDatabase;sources:Pick<ReturnType<typeof createWildzProofSourceRepository>,'retain'|'read'>;readArtifact?:ReturnType<typeof createWildzCreationArtifactReader>}>){
 const {database,sources}=dependencies,readArtifact=dependencies.readArtifact||createWildzCreationArtifactReader();
 async function open(record:SourceRecord,sha?:string){
  if(!record||record.schema!=='wildz.creation-library-source.v1'||!validId(record.instanceId)||!(record.bytes instanceof Uint8Array)||record.bytes.length>MAX_BYTES||record.bytes.length<1)throw Error('creation_library_source_invalid');
  const artifact=await readArtifact({bytes:record.bytes.slice(),mimeType:record.mimeType,name:record.filename});
  if(!readWildzCreationArtifactVerification(artifact)||artifact.payload.instanceId!==record.instanceId||sha&&artifact.artifactSha256!==sha)throw Error('creation_library_source_unverified');
  return artifact;
 }
 async function resolve(scope:CreationLibraryScope,id:string):Promise<CreationLibraryEntry>{
  const account=coordinate(scope);if(!validId(id))throw Error('creation_library_instance_invalid');
  let cursor=await database.read<string>('meta',key(account,'sources',id)),bytes=0;
  const seen=new Set<string>(),native:Array<{artifact:WildzCreationArtifact;ancestors:Set<string>}>=[],backups:WildzCreationArtifact[]=[];
  while(cursor!==null){
   if(!validDigest(cursor)||seen.has(cursor)||seen.size>=MAX_HISTORY)throw Error('creation_library_index_invalid');seen.add(cursor);
   const link=await database.read<SourceLink>('meta',key(account,'source-entry',id,cursor));
   if(!link||link.artifactSha256!==cursor||link.previous!==null&&!validDigest(link.previous))throw Error('creation_library_index_invalid');
   const record=await database.read<SourceRecord>('artifacts',recordKey(cursor));
   if(!record||!(record.bytes instanceof Uint8Array)||(bytes+=record.bytes.length)>MAX_HISTORY_BYTES)throw Error('creation_library_source_budget');
   const artifact=await open(record,cursor);
   if(readWildzCreationArtifactVerification(artifact)==='current-native'){
    const source=await sources.read(cursor);
    if(!source||source.artifact.artifactSha256!==cursor||!equalBytes(receizBase64UrlDecode(source.artifact.exactBytesB64u),artifact.artifactBytes)||!Array.isArray(source.predecessors)||!source.predecessors.every(validDigest))throw Error('creation_library_source_unverified');
    native.push({artifact,ancestors:new Set(source.predecessors)});
   }else backups.push(artifact);
   cursor=link.previous;
   if(seen.size%8===0)await new Promise<void>(done=>setTimeout(done,0));
  }
  if(native.length){
   const bySha=new Map(native.map(n=>[n.artifact.artifactSha256,n]));
   function reaches(candidate:typeof native[number],target:string,visited=new Set<string>()):boolean{
    if(candidate.ancestors.has(target))return true;
    if(visited.has(candidate.artifact.artifactSha256))return false;visited.add(candidate.artifact.artifactSha256);
    return [...candidate.ancestors].some(sha=>{const parent=bySha.get(sha);return !!parent&&reaches(parent,target,visited);});
   }
   const heads=native.filter(candidate=>native.every(other=>candidate===other||reaches(candidate,other.artifact.artifactSha256)));
   if(heads.length!==1)return {instanceId:id,status:'conflict',reason:'creation_library_history_conflict'};
   const artifact=heads[0].artifact,status=readWildzCreationArtifactCustody(artifact,scope.actorId)?'owned' as const:'transferred' as const;
   return {instanceId:id,status,artifactSha256:artifact.artifactSha256,artifact};
  }
  if(backups.length){
   const artifact=backups[0];
   return {instanceId:id,status:sameWildzPlayerCoordinate(artifact.payload.checkpoint.instances[0].ownerId,scope.actorId)?'recovery':'transferred',artifactSha256:artifact.artifactSha256,artifact};
  }
  return {instanceId:id,status:'unavailable',reason:'creation_library_source_missing'};
 }
 return Object.freeze({
  async retain(scope:CreationLibraryScope,input:Readonly<{bytes:Uint8Array;mimeType:string;name?:string}>){
   scope={...scope};const account=coordinate(scope),captured={bytes:input.bytes.slice(),mimeType:input.mimeType,name:input.name};
   if(captured.bytes.length<1||captured.bytes.length>MAX_BYTES)throw Error('creation_library_source_capacity');
   const artifact=await readArtifact(captured),verification=readWildzCreationArtifactVerification(artifact);
   if(!verification)throw Error('creation_library_source_unverified');
   const id=artifact.payload.instanceId,sha=artifact.artifactSha256;
   if(!validDigest(sha)||!validId(id))throw Error('creation_library_source_invalid');
   const owns=verification==='current-native'?!!readWildzCreationArtifactCustody(artifact,scope.actorId):sameWildzPlayerCoordinate(artifact.payload.checkpoint.instances[0].ownerId,scope.actorId);
   if(!owns)throw Error('creation_library_owner_mismatch');
   if(verification==='current-native'){
    const retained=await sources.retain({bytes:artifact.artifactBytes,filename:artifact.filename,mimeType:artifact.mimeType,assetId:'creation:'+id});
    if(retained.artifactSha256!==sha)throw Error('creation_library_source_unverified');
   }
   const record:SourceRecord={schema:'wildz.creation-library-source.v1',instanceId:id,bytes:artifact.artifactBytes,filename:artifact.filename,mimeType:artifact.mimeType};
   await database.transaction(['artifacts','meta'],'readwrite',async tx=>{
    const previous=await tx.get<SourceRecord>('artifacts',recordKey(sha));
    if(previous&&(!equalBytes(previous.bytes,record.bytes)||previous.instanceId!==id||previous.schema!==record.schema))throw Error('creation_library_source_conflict');
    if(!previous)await tx.put('artifacts',record,recordKey(sha));
    const entryKey=key(account,'source-entry',id,sha);
    if(!await tx.get<SourceLink>('meta',entryKey)){
     const previous=await tx.get<string>('meta',key(account,'sources',id));
     if(previous!==null&&!validDigest(previous))throw Error('creation_library_index_invalid');
     await tx.put('meta',{artifactSha256:sha,previous} satisfies SourceLink,entryKey);
     await tx.put('meta',sha,key(account,'sources',id));
    }
    const memberKey=key(account,'member',id);
    if(!await tx.get<Member>('meta',memberKey)){
     const previous=await tx.get<string>('meta',key(account,'members'));
     if(previous!==null&&!validId(previous))throw Error('creation_library_index_invalid');
     await tx.put('meta',{instanceId:id,previous} satisfies Member,memberKey);
     await tx.put('meta',id,key(account,'members'));
    }
   });
   return {instanceId:id,artifactSha256:sha,verification};
  },
  async page(scope:CreationLibraryScope,cursor:string|null=null,limit=24){
   scope={...scope};const account=coordinate(scope);
   if(!Number.isInteger(limit)||limit<1||limit>64||cursor!==null&&!validId(cursor))throw Error('creation_library_page_invalid');
   const page=await database.transaction(['meta'],'readonly',async tx=>{
    let next=cursor??await tx.get<string>('meta',key(account,'members'));const ids:string[]=[],seen=new Set<string>();
    while(next!==null&&ids.length<limit){
     if(!validId(next)||seen.has(next))throw Error('creation_library_index_invalid');seen.add(next);
     const member=await tx.get<Member>('meta',key(account,'member',next));
     if(!member||member.instanceId!==next||member.previous!==null&&!validId(member.previous))throw Error('creation_library_index_invalid');
     ids.push(next);next=member.previous;
    }
    if(next!==null&&seen.has(next))throw Error('creation_library_index_invalid');
    return {ids,nextCursor:next};
   });
   const entries:CreationLibraryEntry[]=[];
   for(const id of page.ids){try{entries.push(await resolve(scope,id));}catch(error){entries.push({instanceId:id,status:'unavailable',reason:error instanceof Error?error.message:'creation_library_read_failed'});}}
   return {entries,nextCursor:page.nextCursor};
  },
  read:resolve,
  async export(scope:CreationLibraryScope,id:string){
   const entry=await resolve({...scope},id);
   if(entry.status==='conflict')throw Error('creation_library_history_conflict');
   if(entry.status==='transferred')throw Error('creation_library_owner_mismatch');
   if(!entry.artifact||!['owned','recovery'].includes(entry.status))throw Error('creation_library_source_unavailable');
   return {bytes:entry.artifact.artifactBytes,filename:entry.artifact.filename,mimeType:entry.artifact.mimeType};
  }
 });
}
