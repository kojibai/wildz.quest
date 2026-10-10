import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import {createWildsResourcePackage,type WildsResourcePackageV1,type WildsResourcePackageMember} from '../../features/play/wilds-resource-package';
import {replayWildsResourceGameplayV128,type WildsResourceGameplayCommandV128} from './wilds-resource-gameplay-v128';
import type {ReceizPortableSealedArtifactV124} from '@receiz/sdk';
import type {PortableCardAsset} from '../../features/play/portable-card';
import {isWorldCreationSuccessor} from '../../features/play/creation/world-source';

export const WILDS_RESOURCE_DOMAIN_V128='world:wildz:resource-custody:v128';
export const WILDS_RESOURCE_NAMESPACE_V128='wildz.resources.v128';
/** Law coordinates identify this exact application protocol. Native Record/Seal
 * and source CAS stay with the released SDK; this reducer admits game resources. */
export const WILDS_RESOURCE_LAW_V128=Object.freeze({schema:'wildz.resource-law.v128',version:1,
 genesis:'2026-07-15T00:00:00.000Z',birth:'full-genesis-command-replay',finiteSource:'global-current-head-and-exact-command',
 reservation:'whole-exact-born-members',ownership:'sdk-opened-current-original-and-recipient-device-source-cas',unpack:'one-use-exact-member-import',repack:'source-qualified-current-keeper-unspent-members'});
export const WILDS_RESOURCE_REGISTRY_DIGEST_V128=sha256PortableBasis(canonicalPortableCardJson(WILDS_RESOURCE_LAW_V128)).slice(7);
export const WILDS_RESOURCE_REDUCER_DIGEST_V128=sha256PortableBasis(canonicalPortableCardJson({...WILDS_RESOURCE_LAW_V128,reducer:'wilds-resource-journal-v128:3'})).slice(7);
export const WILDS_RESOURCE_GENESIS_HEAD_V128=sha256PortableBasis(canonicalPortableCardJson({schema:'wildz.resource-genesis.v128',law:WILDS_RESOURCE_LAW_V128})).slice(7);
export type WildsResourceJournalPackageV128=Readonly<{package:WildsResourcePackageV1;ownerReceizId:string;recipientHandle:string;
 status:'reserved'|'claimed'|'unpacked';custodyAppendId:string;claimAppendId?:string;artifactSha256?:string}>;
export type WildsResourceJournalImportV128=Readonly<{ownerReceizId:string;package:WildsResourcePackageV1;kaiUPulse:number;unpackAppendId:string;sourceArtifactSha256:string}>;
export type WildsResourceJournalLooseMemberV128=Readonly<{ownerReceizId:string;packageId:string;member:WildsResourcePackageMember}>;
export type WildsResourceJournalV128=Readonly<{schema:'wildz.resource-journal.v128';
 traces:Readonly<Record<string,Readonly<{gameplayOwnerId:string;commands:readonly WildsResourceGameplayCommandV128[]}>>>;
 frontiers:Readonly<Record<string,string>>;admittedCommands:Readonly<Record<string,true>>;
 reservations:Readonly<Record<string,string>>;packages:Readonly<Record<string,WildsResourceJournalPackageV128>>;
 imports:Readonly<Record<string,WildsResourceJournalImportV128>>;looseMembers:Readonly<Record<string,WildsResourceJournalLooseMemberV128>>;spentMembers:Readonly<Record<string,string>>;
 cardOrigins:Readonly<Record<string,WildsResourceCardOriginV128>>}>;
export type WildsResourceCardOriginV128=Readonly<{ownerReceizId:string;assetId:string;sourceOriginal:ReceizPortableSealedArtifactV124;card:PortableCardAsset;payloadSha256:string;provenanceRoot:string}>;
export type WildsResourceJournalEventV128=
 | Readonly<{schema:'wildz.resource-command.v128';kind:'reserve';attemptId:string;ownerReceizId:string;gameplayOwnerId:string;
  createdKaiUPulse:number;commands:readonly WildsResourceGameplayCommandV128[];memberIds:readonly string[];recipientHandle:string}>
 | Readonly<{schema:'wildz.resource-command.v128';kind:'replay';attemptId:string;ownerReceizId:string;gameplayOwnerId:string;commands:readonly WildsResourceGameplayCommandV128[]}>
 | Readonly<{schema:'wildz.resource-command.v128';kind:'use';attemptId:string;ownerReceizId:string;gameplayOwnerId:string;commands:readonly WildsResourceGameplayCommandV128[];useCommandId:string}>
 | Readonly<{schema:'wildz.resource-command.v128';kind:'claim';attemptId:string;ownerReceizId:string;packageId:string;artifact:ReceizPortableSealedArtifactV124;authorizationDigest?:string}>
 | Readonly<{schema:'wildz.resource-command.v128';kind:'unpack';attemptId:string;ownerReceizId:string;packageId:string;artifact:ReceizPortableSealedArtifactV124;kaiUPulse:number}>
 | Readonly<{schema:'wildz.resource-command.v128';kind:'offer';attemptId:string;ownerReceizId:string;packageId:string;recipientHandle:string;artifact:ReceizPortableSealedArtifactV124}>
 | Readonly<WildsResourceCardOriginV128&{schema:'wildz.resource-command.v128';kind:'card-origin';attemptId:string}>;
export function initialWildsResourceJournalV128():WildsResourceJournalV128{return {schema:'wildz.resource-journal.v128',traces:{},frontiers:{},admittedCommands:{},reservations:{},packages:{},imports:{},looseMembers:{},spentMembers:{},cardOrigins:{}};}
type CardVerifier=NonNullable<Parameters<typeof replayWildsResourceGameplayV128>[0]['verifyCard']>;
export type WildsResourceJournalAdmissionV128=Readonly<{
 ownerReceizId:string;
 verifyCard?:CardVerifier;
 verifyCardOrigin?:CardVerifier;
 verifyPackage?:(artifact:ReceizPortableSealedArtifactV124,record:WildsResourceJournalPackageV128)=>Promise<Readonly<{genesisOwnerReceizId:string;artifactSha256:string}>>;
}>;
function fail(reason:string):never{throw Error(`wilds_resource_journal_${reason}`);}
const same=(a:unknown,b:unknown)=>canonicalPortableCardJson(a)===canonicalPortableCardJson(b);
export function wildsResourceJournalHeadV128(state:WildsResourceJournalV128){return sha256PortableBasis(canonicalPortableCardJson(state)).slice(7);}
/** Spent coordinates belong to the original admitted use, even after the
 * same owner extends their trace. Current trace digests cannot recover it. */
export function wildsResourceUseSpentMemberIdsV128(state:WildsResourceJournalV128,event:Extract<WildsResourceJournalEventV128,{kind:'use'}>){
 const digest=sha256PortableBasis(canonicalPortableCardJson({owner:event.gameplayOwnerId,commands:event.commands}));
 return Object.keys(state.spentMembers).filter(id=>state.spentMembers[id]===digest).sort();
}
export function wildsResourceUseEffectMemberIdsV128(state:WildsResourceJournalV128,event:Extract<WildsResourceJournalEventV128,{kind:'use'}>){
 const ids=wildsResourceUseSpentMemberIdsV128(state,event),last=event.commands.at(-1);
 if(last?.kind==='world'&&last.command.type==='storage.material.move'){
  const id=last.command.lotId;
  if(Object.values(state.imports).some(item=>item.ownerReceizId===event.ownerReceizId&&item.package.members.some(member=>member.id===id&&member.kind==='material')))ids.push(id);
 }
 return [...new Set(ids)].sort();
}
/** Input state is independently root/source-admitted before production use.
 * Imports come exclusively from prior actual recipient-authored unpack CAS. */
export async function replayWildsResourceJournalOwnerV128(before:WildsResourceJournalV128,ownerReceizId:string,gameplayOwnerId:string,commands:readonly WildsResourceGameplayCommandV128[],verifyCard?:CardVerifier){
 // The exact previously admitted card/Original pair remains historical truth
 // when the source author rotates keys. New or altered evidence still goes
 // through the current independent SDK verifier.
 const witnessed=new Set<string>();
 const remember=(card:PortableCardAsset|undefined,original:ReceizPortableSealedArtifactV124|undefined)=>{if(card&&original)witnessed.add(canonicalPortableCardJson({card,original}));};
 for(const entry of before.traces[ownerReceizId]?.commands??[]){
  if(entry.kind==='world'){remember(entry.card,entry.cardOriginal);if(entry.command.type==='creation.construct'||entry.command.type==='creation.evolve')for(const source of entry.command.workerSources)remember(source.card,entry.workerOriginals?.[source.card.id]);}
  else if(entry.kind==='animal.hunt'&&entry.hunter.kind==='creature')remember(entry.hunter.asset,entry.cardOriginal);
 }
 const admitCard:CardVerifier=async(card,original)=>{if(witnessed.has(canonicalPortableCardJson({card,original})))return;if(!verifyCard)fail('card_original_required');await verifyCard(card,original);};
 return replayWildsResourceGameplayV128({gameplayOwnerId,commands,
  imports:Object.values(before.imports).filter(item=>item.ownerReceizId===ownerReceizId).map(item=>({packageId:item.package.packageId,receiptId:item.unpackAppendId,kaiUPulse:item.kaiUPulse,sourceArtifactSha256:item.sourceArtifactSha256,members:item.package.members})),
  excludedFood:Object.values(before.packages).filter(item=>item.ownerReceizId!==ownerReceizId||item.status!=='unpacked').flatMap(item=>item.package.members.filter(member=>member.kind==='food').map(member=>({itemId:member.id,fromKaiUPulse:item.package.createdKaiUPulse}))),
  excludedMembers:Object.values(before.packages).filter(item=>item.ownerReceizId!==ownerReceizId||item.status!=='unpacked').flatMap(item=>item.package.members.filter(member=>member.kind!=='food').map(member=>({memberId:member.id,packageId:item.package.packageId,fromKaiUPulse:item.package.createdKaiUPulse}))),verifyCard:admitCard});
}
export async function reduceWildsResourceJournalV128(before:WildsResourceJournalV128,raw:WildsResourceJournalEventV128,admission:WildsResourceJournalAdmissionV128):Promise<WildsResourceJournalV128>{
 const event=structuredClone(raw);
 if(before.schema!=='wildz.resource-journal.v128'||event.schema!=='wildz.resource-command.v128'||event.ownerReceizId!==admission.ownerReceizId
  ||!/^[a-z0-9][a-z0-9._-]{0,63}\.receiz\.id$/.test(event.ownerReceizId)||!/^[a-z0-9][a-z0-9:._-]{5,179}$/i.test(event.attemptId))fail('event_invalid');
 const allowed=event.kind==='card-origin'?['schema','kind','attemptId','ownerReceizId','assetId','sourceOriginal','card','payloadSha256','provenanceRoot']:
 event.kind==='replay'||event.kind==='use'?['schema','kind','attemptId','ownerReceizId','gameplayOwnerId','commands',...(event.kind==='use'?['useCommandId']:[])]:
 event.kind==='reserve'?['schema','kind','attemptId','ownerReceizId','gameplayOwnerId','createdKaiUPulse','commands','memberIds','recipientHandle']:
 event.kind==='offer'?['schema','kind','attemptId','ownerReceizId','packageId','recipientHandle','artifact']:['schema','kind','attemptId','ownerReceizId','packageId','artifact',...(event.kind==='claim'?['authorizationDigest']:event.kind==='unpack'?['kaiUPulse']:[])];
 if(Object.keys(event).some(key=>!allowed.includes(key)))fail('event_invalid');
 if(event.kind==='card-origin'){
  if(event.assetId!==event.card.id||!/^[a-f0-9]{64}$/.test(event.payloadSha256)||event.provenanceRoot!==`wildz:creature:${event.assetId}`||!admission.verifyCardOrigin)fail('card_origin_invalid');
  await admission.verifyCardOrigin(event.card,event.sourceOriginal);
  const bytes=new TextEncoder().encode(canonicalPortableCardJson({schema:'wildz.creature-bearer.v128',card:event.card,sourceOriginal:event.sourceOriginal}));
  // The producer and every consumer use this same immutable payload schema.
  // This public row freezes digests/source only; no claimable bearer is exposed.
  if(sha256PortableBasis(new TextDecoder().decode(bytes)).slice(7)!==event.payloadSha256)fail('card_payload_mismatch');
  const origin:WildsResourceCardOriginV128={ownerReceizId:event.ownerReceizId,assetId:event.assetId,sourceOriginal:event.sourceOriginal,card:event.card,payloadSha256:event.payloadSha256,provenanceRoot:event.provenanceRoot};
  const previous=before.cardOrigins[event.assetId];if(previous){if(!same(previous,origin))fail('card_origin_conflict');return before;}
  return {...before,cardOrigins:{...before.cardOrigins,[event.assetId]:origin}};
 }
 if(event.kind==='reserve'||event.kind==='replay'||event.kind==='use'){
  if(event.kind==='reserve'&&(!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(event.recipientHandle)||event.recipientHandle===event.ownerReceizId.replace(/\.receiz\.id$/,'')))fail('recipient_invalid');
  const previous=before.traces[event.ownerReceizId];
  if(previous&&(previous.gameplayOwnerId!==event.gameplayOwnerId||event.commands.length<previous.commands.length
    ||!same(previous.commands,event.commands.slice(0,previous.commands.length))))fail('trace_changed');
  if(event.kind==='reserve'){
  const existingId=`wildz:package:${sha256PortableBasis(canonicalPortableCardJson({ownerReceizId:event.ownerReceizId,commandId:event.attemptId})).slice(7)}`,existingRecord=before.packages[existingId];
  if(existingRecord){if(existingRecord.package.createdKaiUPulse!==event.createdKaiUPulse||existingRecord.recipientHandle!==event.recipientHandle||!same(existingRecord.package.members.map(member=>member.id).sort(),[...event.memberIds].sort())||!same(previous?.commands??[],event.commands))fail('attempt_conflict');return before;}
  }
  const replay=await replayWildsResourceJournalOwnerV128(before,event.ownerReceizId,event.gameplayOwnerId,event.commands,admission.verifyCard);
  const frontiers={...before.frontiers},admittedCommands={...before.admittedCommands};
  for(const advance of replay.advances){
   if(admittedCommands[advance.commandDigest])continue;
   if(frontiers[advance.sourceId]&&frontiers[advance.sourceId]!==advance.priorHead)fail('source_stale');
   frontiers[advance.sourceId]=advance.nextHead;admittedCommands[advance.commandDigest]=true;
  }
  const reservations={...before.reservations},looseMembers={...before.looseMembers},spentMembers={...before.spentMembers};
  for(const loose of Object.values(before.looseMembers))if(loose.ownerReceizId===event.ownerReceizId&&(loose.member.kind==='food'?replay.nourishment.items[loose.member.id]?.consumedKaiUPulse!==undefined:loose.member.kind==='material'?Boolean(replay.world.consumedMaterialLots[loose.member.id]||replay.world.reservedMaterialLots?.[loose.member.id]):false)){spentMembers[loose.member.id]=replay.traceDigest;delete looseMembers[loose.member.id];}
  const advanced={...before,traces:{...before.traces,[event.ownerReceizId]:{gameplayOwnerId:event.gameplayOwnerId,commands:event.commands}},frontiers,admittedCommands,reservations,looseMembers,spentMembers};
  if(event.kind!=='reserve'){
   if(event.kind==='use'){
    const last=event.commands.at(-1),lastId=last?.kind==='world'?last.command.commandId:last?.commandId;
    const spent=Object.keys(spentMembers).some(id=>!before.spentMembers[id]&&before.looseMembers[id]?.ownerReceizId===event.ownerReceizId);
    let continuation=false;
    if(last?.kind==='world'){
     const command=last.command;
     if(command.type==='storage.material.move'){
      const loose=before.looseMembers[command.lotId];
      continuation=loose?.ownerReceizId===event.ownerReceizId&&loose.member.kind==='material'
       &&(command.direction==='deposit'?replay.world.storedMaterialLots[command.lotId]===command.cacheId:!replay.world.storedMaterialLots[command.lotId]);
     }else if(previous&&(command.type==='creation.evolve'||command.type==='creation.action'||command.type==='tool.steward.equip')){
      const prior=await replayWildsResourceJournalOwnerV128(before,event.ownerReceizId,event.gameplayOwnerId,previous.commands,admission.verifyCard);
      if(command.type==='tool.steward.equip')continuation=Boolean(prior.world.stewardTools[command.toolId]?.ownerReceizId===event.gameplayOwnerId&&replay.world.equippedStewardTools[event.gameplayOwnerId]===command.toolId&&prior.world.equippedStewardTools[event.gameplayOwnerId]!==command.toolId);
      else{
       const request=command.type==='creation.action'?command.actionRequest:null;
       const ids=command.type==='creation.evolve'?[command.instanceId]:[request!.instanceId,...(request!.action==='damage'&&'equipmentId' in request!&&request!.equipmentId?[request!.equipmentId]:[])];
       continuation=ids.every(id=>{const source=prior.world.creations?.[id],successor=replay.world.creations?.[id];return Boolean(source&&successor&&(command.type==='creation.evolve'?source.instance.head===command.expectedHead:request!.expectedHeads[id]===source.instance.head)&&isWorldCreationSuccessor(source,successor));});
      }
     }
    }
    if(!event.useCommandId||lastId!==event.useCommandId||!replay.eventsByCommand[event.useCommandId]?.length&&last?.kind==='world'||!spent&&!continuation)fail('use_effect_required');
   }
   return advanced;
  }
  if(!Number.isSafeInteger(event.createdKaiUPulse)||event.createdKaiUPulse<Math.max(0,...event.commands.map(command=>command.kaiUPulse))
    ||!Array.isArray(event.memberIds)||!event.memberIds.length||event.memberIds.length>64||new Set(event.memberIds).size!==event.memberIds.length)fail('selection_invalid');
  const packageProof=createWildsResourcePackage({ownerReceizId:event.ownerReceizId,createdKaiUPulse:event.createdKaiUPulse,commandId:event.attemptId,
    members:event.memberIds.map(id=>{const loose=before.looseMembers[id];
     if(loose?.ownerReceizId===event.ownerReceizId&&!before.spentMembers[id]){if(loose.member.kind==='material'?!replay.world.consumedMaterialLots[id]&&!replay.world.reservedMaterialLots?.[id]&&!replay.world.storedMaterialLots[id]&&Boolean(replay.world.materialLots[id]):loose.member.kind==='resource'?Boolean(replay.world.resourceLots[id]):Boolean(replay.members[id]))return loose.member;}
     return replay.members[id]??fail('member_source_missing');})});
  const existing=before.packages[packageProof.packageId];
  if(existing){if(!same(existing.package,packageProof)||existing.recipientHandle!==event.recipientHandle)fail('attempt_conflict');return before;}
  for(const id of event.memberIds){if(spentMembers[id])fail('member_spent');if(reservations[id]&&looseMembers[id]?.ownerReceizId!==event.ownerReceizId)fail('member_reserved');reservations[id]=packageProof.packageId;delete looseMembers[id];}
  return {...advanced,reservations,looseMembers,spentMembers,
   packages:{...before.packages,[packageProof.packageId]:{package:packageProof,ownerReceizId:event.ownerReceizId,recipientHandle:event.recipientHandle,status:'reserved',custodyAppendId:`wildz:resource:${event.ownerReceizId}:${event.attemptId}`}}};
 }
 if(!['claim','unpack','offer'].includes(event.kind))fail('event_invalid');
 const record=before.packages[event.packageId];if(!record||record.status==='unpacked'||!admission.verifyPackage)fail('package_unavailable');
 const appendId=`wildz:resource:${event.ownerReceizId}:${event.attemptId}`;
 if(event.kind==='claim'){
  if(event.authorizationDigest!==undefined&&!/^[a-f0-9]{64}$/.test(event.authorizationDigest))fail('authorization_invalid');
  if(record.status==='claimed'&&record.claimAppendId===appendId&&record.ownerReceizId===event.ownerReceizId)return before;
  if(record.status!=='reserved'||record.recipientHandle!==event.ownerReceizId.replace(/\.receiz\.id$/,''))fail('recipient_mismatch');
 }else if(record.ownerReceizId!==event.ownerReceizId||record.status!=='claimed')fail('package_unavailable');
 if(event.kind==='offer'&&(!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(event.recipientHandle)||event.recipientHandle===event.ownerReceizId.replace(/\.receiz\.id$/,'')))fail('recipient_invalid');
 const actual=await admission.verifyPackage(event.artifact,record);
 if(actual.genesisOwnerReceizId!==record.package.ownerReceizId||actual.artifactSha256!==event.artifact.artifactSha256
   ||(record.artifactSha256&&record.artifactSha256!==actual.artifactSha256))fail('original_mismatch');
 // Native root ownership is immutable genesis custody. Only this independently
 // authenticated source author and shared CAS change the application custodian.
 if(event.kind==='unpack'&&(!Number.isSafeInteger(event.kaiUPulse)||event.kaiUPulse<record.package.createdKaiUPulse))fail('unpack_time_invalid');
 const imports={...before.imports},looseMembers={...before.looseMembers};
 if(event.kind==='unpack'){
  imports[record.package.packageId]={ownerReceizId:event.ownerReceizId,package:record.package,kaiUPulse:event.kaiUPulse,unpackAppendId:appendId,sourceArtifactSha256:event.artifact.artifactSha256};
  for(const member of record.package.members){if(before.spentMembers[member.id]||looseMembers[member.id])fail('member_import_conflict');looseMembers[member.id]={ownerReceizId:event.ownerReceizId,packageId:record.package.packageId,member};}
 }
 const status=event.kind==='claim'?'claimed':event.kind==='offer'?'reserved':'unpacked';
 return {...before,imports,looseMembers,packages:{...before.packages,[event.packageId]:{...record,ownerReceizId:event.ownerReceizId,status,
  custodyAppendId:appendId,...(event.kind==='claim'?{claimAppendId:appendId}:{}),
  ...(event.kind==='offer'?{recipientHandle:event.recipientHandle}:{}),artifactSha256:actual.artifactSha256}}};
}
