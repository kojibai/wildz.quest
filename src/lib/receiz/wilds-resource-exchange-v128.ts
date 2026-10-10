import {createWildsResourceSourceArchiveLocatorV128,iterateWildsResourceSourceOriginalsV128,readWildsResourceLocatedProofV128,restoreWildsResourceSourceReferenceV128,assertWildsResourceSourceArchiveCapacityV128,assertWildsResourceSourceRequestCapacityV128,type WildsResourceSourceReferenceV128} from './wilds-resource-source-archive-v128';
import type {WildzMarketSourceArchiveReferenceV128} from './wildz-market-source-types-v128';
import {readWildsSourceReplayAfterV128} from './wilds-source-replay-recovery-v128';
import {
 createReceizClient,canonicalizeReceizV122,receizKaiNow,parseReceizPortableAssetDocument,prepareReceizDomainReplaySegmentProofObjectCandidateV124,
 receizBase64UrlDecode,receizBase64UrlEncode,serializeReceizPortableAssetDocument,sha256ReceizBytes,transportReceizSealedArtifactV124,
 type ReceizAuthoritySessionV124,type ReceizClient,type ReceizDomainReplayProofHeadV124,type ReceizPortableSealedArtifactV124,type ReceizDomainReplayAppendIndexValueV124,
 type ReceizDomainReplaySegmentProofCarrierV124,type ReceizDomainReplayProofSegmentChildV124,
} from '@receiz/sdk';
import type {WildsWalletStagedTradeResourceSourceHead} from '../../features/play/wallet/wilds-wallet-staged-trade-types';
import type {WildzContinuityDatabase} from '../storage/wildz-indexed-db';
import {canonicalPortableCardJson,sha256PortableBasis,type PortableCardAsset} from '../../features/play/portable-card';
import {verifyWildsResourcePackage,type WildsResourcePackageV1} from '../../features/play/wilds-resource-package';
import {openWildzArtifactEvidence} from './wildz-artifact-custody';
import {validateWildsRoamingHandoffCard} from './wilds-roaming-handoff';
import {unpackWildzCardSealPayload} from './wildz-card-seal-payload';
import {matchesWildzOwnedCardExport} from './wildz-owned-card-export';
import {prepareWildsPortableDocumentV128} from './wilds-portable-document-v128';
import {createWildsResourceSourceClientV128,createWildsResourceSourceRecoveryStoreV128} from './wilds-resource-source-client-v128';
import type {WildsResourceSourceAuthorV128,WildsResourceSourcePredecessorV128} from './wilds-resource-source-v128';
import {resolveWildsResourceGameplayOriginalsV128,queueWildsResourceGameplayV128} from './wilds-resource-gameplay-store-v128';
import {wildsResourceGameplayCommandIdV128,type WildsResourceGameplayCommandV128} from './wilds-resource-gameplay-v128';
import {replayWildsResourceJournalOwnerV128,initialWildsResourceJournalV128,reduceWildsResourceJournalV128,
 WILDS_RESOURCE_LAW_V128,WILDS_RESOURCE_DOMAIN_V128,WILDS_RESOURCE_GENESIS_HEAD_V128,WILDS_RESOURCE_NAMESPACE_V128,WILDS_RESOURCE_REDUCER_DIGEST_V128,WILDS_RESOURCE_REGISTRY_DIGEST_V128,
 type WildsResourceJournalV128,type WildsResourceJournalEventV128,type WildsResourceJournalPackageV128,type WildsResourceCardOriginV128} from './wilds-resource-journal-v128';
import {wildsResourceUseSpentMemberIdsV128,wildsResourceUseEffectMemberIdsV128} from './wilds-resource-journal-v128';

export type WildsResourceSourceProofV128=Readonly<{schema:'wildz.resource-source-proof.v128';custodyArtifact:ReceizPortableSealedArtifactV124;sourceArtifacts:readonly ReceizPortableSealedArtifactV124[];archivePages?:readonly WildzMarketSourceArchiveReferenceV128[]}>;
export type WildsResourceSourceReceiptV128=Readonly<{schema:'wildz.resource-source-receipt.v128';packageId:string;sourceArtifactSha256:string;sourcePayloadSha256:string;acceptedAppendId:string;acceptedHead:string;acceptedKaiUPulse:number;acceptedSealKai:string;ownerReceizId:string;authorizationDigest?:string;proof:WildsResourceSourceProofV128}>;
export type WildsResourceSourcePackageV128=Readonly<{schema:'wildz.resource-source-package.v128';package:WildsResourcePackageV1;reservationAppendId:string;sourceProof:WildsResourceSourceProofV128}>;
/** A locator carries exact Originals only. A mutable feed or cached success flag
 * never admits a source. Every read goes through SDK root admission and replay. */
export type WildsResourceSourceLocatorV128=Readonly<{read():Promise<WildsResourceSourceProofV128|null>;publish(proof:WildsResourceSourceProofV128):Promise<void>;compact?(proof:WildsResourceSourceProofV128):Promise<WildsResourceSourceProofV128>;reference?(proof:WildsResourceSourceProofV128):Promise<WildsResourceSourceReferenceV128>}>;
const MAX_PROOF_BYTES=32*1024*1024;
const isAncestryPrefix=(historical:readonly string[],current:readonly string[])=>historical.length<=current.length&&historical.every((sha,index)=>sha===current[index]);
const encoded=(value:unknown)=>new TextEncoder().encode(canonicalizeReceizV122(value));
const same=(a:unknown,b:unknown)=>canonicalizeReceizV122(a)===canonicalizeReceizV122(b);
function fail(reason:string):never{throw Error(`wilds_resource_exchange_${reason}`);}
const portableFor=(owner:string,custody='current')=>({ownership:{ownerReceizId:owner,custody,proofRef:'genesis'},provenance:{root:`profile:${owner.replace(/\.receiz\.id$/,'')}`,appends:[]},settlement:{state:'none'}});

async function openOriginal(sdk:ReceizClient,source:ReceizPortableSealedArtifactV124){
 if(source.schema!=='receiz.sealed-artifact-bytes.v124'||!source.exactBytesB64u)fail('original_invalid');
 const bytes=receizBase64UrlDecode(source.exactBytesB64u);
 if(bytes.length>MAX_PROOF_BYTES||await sha256ReceizBytes(bytes)!==source.artifactSha256)fail('original_binding_invalid');
 const file=new Blob([bytes.slice().buffer],{type:source.mimeType});
 const opened=await openWildzArtifactEvidence(file,source.filename,sdk.artifacts);
 if(opened.admitted.compatibility!=='current-native'||opened.admitted.payloadSha256!==source.payloadSha256)fail('original_binding_invalid');
 return opened;
}
async function readPortablePayload(sdk:ReceizClient,source:ReceizPortableSealedArtifactV124){
 const opened=await openOriginal(sdk,source);
 const portable=await parseReceizPortableAssetDocument(JSON.parse(new TextDecoder().decode(opened.admitted.payloadBytes)));
 return {opened,portable,body:JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(portable.payload.bytesBase64Url))) as Record<string,unknown>};
}
export async function verifyWildsResourceGameplayCardV128(sdk:ReceizClient,ownerReceizId:string,keyId:string,card:PortableCardAsset,original:ReceizPortableSealedArtifactV124){
 const opened=await openOriginal(sdk,original);
 if(opened.admitted.ownerReceizId!==ownerReceizId)fail('card_owner_mismatch');
 let document:Record<string,unknown>|null=null;
 try{document=JSON.parse(new TextDecoder().decode(opened.admitted.payloadBytes)) as Record<string,unknown>;}catch{/* Native PNG card payload. */}
 if(document?.schema==='receiz.portable_asset.v1'){
  const portable=await parseReceizPortableAssetDocument(document);
  if(portable.ownership.custody==='bearer')fail('private_card_original_required');
 }
 const payload=await unpackWildzCardSealPayload(opened.admitted.payloadBytes);
 if(await matchesWildzOwnedCardExport(payload,{asset:card,keyId,ownerReceizId}))return;
 validateWildsRoamingHandoffCard(payload,card);
}
/** First-owner origin requires the exact identity-signed single-card export.
 * The expected key comes from admitted source authorship, never its own trailer. */
export async function verifyWildsResourceCardOriginSourceV128(sdk:ReceizClient,ownerReceizId:string,keyId:string,card:PortableCardAsset,original:ReceizPortableSealedArtifactV124){
 const opened=await openOriginal(sdk,original);
 if(opened.admitted.ownerReceizId!==ownerReceizId||!await matchesWildzOwnedCardExport(await unpackWildzCardSealPayload(opened.admitted.payloadBytes),{asset:card,keyId,ownerReceizId}))fail('card_origin_source_invalid');
}
export async function readWildsResourceSourcePackageV128(sdk:ReceizClient,artifact:ReceizPortableSealedArtifactV124){
 const {opened,portable,body}=await readPortablePayload(sdk,artifact);
 if(body.schema!=='wildz.resource-source-package.v128'||Object.keys(body).sort().join()!=='package,reservationAppendId,schema,sourceProof'
  ||!verifyWildsResourcePackage(body.package)||typeof body.reservationAppendId!=='string'||portable.assetType!=='proof_object'
  ||portable.ownership.custody!=='current')fail('package_carrier_invalid');
 const sourceProof=body.sourceProof as WildsResourceSourceProofV128|WildsResourceSourceReferenceV128;
 const restored=sourceProof?.schema==='wildz.resource-source-reference.v128'?await restoreWildsResourceSourceReferenceV128(sdk,sourceProof):sourceProof;
 return {bearer:{...body,sourceProof:restored} as unknown as WildsResourceSourcePackageV128,opened};
}
async function nativePackageWitness(sdk:ReceizClient,artifact:ReceizPortableSealedArtifactV124,record:WildsResourceJournalPackageV128){
 const {bearer,opened}=await readWildsResourceSourcePackageV128(sdk,artifact);
 if(!same(bearer.package,record.package)||opened.admitted.ownerReceizId!==record.package.ownerReceizId)fail('package_original_mismatch');
 return {genesisOwnerReceizId:opened.admitted.ownerReceizId,artifactSha256:artifact.artifactSha256};
}

/** SDK root-admit every exact source and independently execute the declared
 * resource law. The final custody wrapper is restored by the released SDK;
 * authenticated current-domain reading is a separate required live check. */
export async function verifyWildsResourceSourceProofV128(sdk:ReceizClient,proof:WildsResourceSourceProofV128,expected:Readonly<{applicationId:string;historical?:boolean}>){
 if(proof.schema!=='wildz.resource-source-proof.v128'||!Array.isArray(proof.sourceArtifacts)||!proof.sourceArtifacts.length
  ||encoded(proof).length>MAX_PROOF_BYTES)fail('source_proof_invalid');
 let state=initialWildsResourceJournalV128();
 const held:{current:WildsResourceSourcePredecessorV128|null}={current:null};
 const events:Array<{event:WildsResourceJournalEventV128;appendId:string;head:string;kaiUPulse:number;sealKai:string}>=[];
 const applicationId=expected.applicationId;if(!applicationId)fail('application_required');
 for await(const source of iterateWildsResourceSourceOriginalsV128(proof,async reference=>{
  const located=await sdk.publicStore.restoreLatest({url:`https://wildz.quest/receiz/resource-source-v128/pages/${reference.digest}`,tenantHost:'wildz.quest'});
  const row=located.storeStateRecord;if(row?.schema!=='wildz.resource-source-page-locator.v128'||!row.page)fail('source_page_missing');return row.page;
 })){
  const {opened,portable,body}=await readPortablePayload(sdk,source);
  if(body.schema!=='receiz.domain-replay-segment-proof.v124')fail('source_carrier_invalid');
  const carrier=body as unknown as ReceizDomainReplaySegmentProofCarrierV124;
  const child=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(carrier.segment.exactSegmentBytesB64u))) as ReceizDomainReplayProofSegmentChildV124;
  const previous=held.current;
  const replay=child.replay;
  if(replay.applicationId!==applicationId||replay.domainId!==WILDS_RESOURCE_DOMAIN_V128||replay.registryDigest!==WILDS_RESOURCE_REGISTRY_DIGEST_V128
   ||replay.reducerDigest!==WILDS_RESOURCE_REDUCER_DIGEST_V128||carrier.head.genesisHead!==WILDS_RESOURCE_GENESIS_HEAD_V128
   ||replay.afterHead!==(previous?.head.head??null)||replay.afterCursor!==(previous?.head.cursor??0)||replay.additions.length!==1
   ||child.sourceAuthority.ownerReceizId!==opened.admitted.ownerReceizId)fail('source_coordinates_invalid');
  const candidate=await prepareReceizDomainReplaySegmentProofObjectCandidateV124({replay,replayReceipt:child.replayReceipt,journalAppends:child.journalAppends,
   sourceAuthority:child.sourceAuthority,authoringEvidence:child.authoringEvidence,kai:child.kai,predecessorArtifact:previous?.artifact??null,
   insertionWitnesses:child.insertionWitnesses,causalParentWitnesses:child.causalParentWitnesses,fibonacci:carrier.head.fibonacci,
   fibonacciWitnesses:carrier.fibonacciWitnesses,portable:{ownership:portable.ownership,provenance:portable.provenance,settlement:portable.settlement}});
  if(await sha256ReceizBytes(candidate.proofObject.payload.bytes)!==source.payloadSha256||!same(candidate.carrier,carrier))fail('source_candidate_binding_invalid');
  const addition=replay.additions[0],event=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(addition.exactEventBytesB64u))) as WildsResourceJournalEventV128;
  const sealKai=opened.sealedArtifact.verification.bundle.kaiPulseEternal;
  if(typeof sealKai!=='string'||!/^(?:0|[1-9][0-9]*)$/.test(sealKai))fail('source_seal_kai_required');
  const sealExclusiveUPulse=(BigInt(sealKai)+1n)*1_000_000n;
  if((event.kind==='reserve'||event.kind==='replay'||event.kind==='use')&&event.commands.some(command=>BigInt(command.kaiUPulse)>=sealExclusiveUPulse)
   ||event.kind==='reserve'&&BigInt(event.createdKaiUPulse)>=sealExclusiveUPulse)fail('source_future_command');
  if(event.kind==='unpack'){
   const claim=events.find(item=>item.appendId===state.packages[event.packageId]?.claimAppendId);
   if(!claim||BigInt(event.kaiUPulse)<BigInt(claim.sealKai)*1_000_000n||BigInt(event.kaiUPulse)>=sealExclusiveUPulse)fail('unpack_causal_time_invalid');
  }
  state=await reduceWildsResourceJournalV128(state,event,{ownerReceizId:child.sourceAuthority.ownerReceizId,
   verifyCard:(card,original)=>verifyWildsResourceGameplayCardV128(sdk,event.ownerReceizId,child.authoringEvidence.identity.keyId,card,original),
   verifyCardOrigin:(card,original)=>verifyWildsResourceCardOriginSourceV128(sdk,event.ownerReceizId,child.authoringEvidence.identity.keyId,card,original),
   verifyPackage:(artifact,record)=>nativePackageWitness(sdk,artifact,record)});
  if(replay.namespace.name!==WILDS_RESOURCE_NAMESPACE_V128||replay.namespace.head!==WILDS_RESOURCE_REGISTRY_DIGEST_V128
    ||replay.namespace.exactBytesB64u!==receizBase64UrlEncode(encoded(WILDS_RESOURCE_LAW_V128)))fail('source_reducer_mismatch');
  const appendIndex:Map<string,ReceizDomainReplayAppendIndexValueV124>=new Map(previous?.appendIndex??[]);
  appendIndex.set(addition.appendId,{eventDigest:addition.eventDigest,cursor:addition.cursor,newHead:addition.newHead});
  held.current={artifact:source,head:carrier.head as ReceizDomainReplayProofHeadV124,appendIndex,
    segmentIds:[...(previous?.segmentIds??[]),carrier.head.currentSegment.segmentId],sourceArtifactShas:[...(previous?.sourceArtifactShas??[]),source.artifactSha256]};
  events.push({event,appendId:addition.appendId,head:addition.newHead,kaiUPulse:child.journalAppends[0]!.acceptedAtKaiUPulse,sealKai});
 }
 const predecessor=held.current;if(!predecessor)fail('source_proof_invalid');
 const restorer=expected.historical?createReceizClient({applicationId:expected.applicationId,fetchImpl:async()=>{throw Error('Historical source proof verification cannot request network authority.');}}):sdk;
 const restored=await restorer.domains.restoreVerifiedReplayProofObjectV124({applicationId,domainId:WILDS_RESOURCE_DOMAIN_V128,
  expectedRegistryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,expectedReducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,
  expectedHead:predecessor.head.head,expectedCursor:predecessor.head.cursor,
  expectedNamespace:{name:WILDS_RESOURCE_NAMESPACE_V128,head:WILDS_RESOURCE_REGISTRY_DIGEST_V128,digest:await sha256ReceizBytes(encoded(WILDS_RESOURCE_LAW_V128))},artifact:proof.custodyArtifact});
 if(restored.sourceArtifactSha256!==predecessor.artifact.artifactSha256)fail('source_custody_mismatch');
 return {state,predecessor,events,proof};
}
/** Proof must come from actual SDK-restored Originals and the exact shared
 * resource law. A caller's JSON origin row or title assertion is rejected. */
export async function verifyWildsResourceCardOriginProofV128(sdk:ReceizClient,transport:WildsResourceSourceProofV128|WildsResourceSourceReferenceV128,expected:Readonly<{applicationId:string;assetId:string;payloadSha256:string;provenanceRoot:string}>){
 const proof=transport.schema==='wildz.resource-source-reference.v128'?await restoreWildsResourceSourceReferenceV128(sdk,transport):transport;
 const admitted=await verifyWildsResourceSourceProofV128(sdk,proof,{applicationId:expected.applicationId,historical:true}),origin=admitted.state.cardOrigins[expected.assetId];
 if(!origin||origin.payloadSha256!==expected.payloadSha256||origin.provenanceRoot!==expected.provenanceRoot)fail('card_origin_mismatch');
 const current=await readWildsSourceReplayAfterV128(sdk,{...replayInput(expected.applicationId,admitted.predecessor.head.head),afterCursor:admitted.predecessor.head.cursor});
 if(current.head!==admitted.predecessor.head.head||current.additions.length){
  const url='https://wildz.quest/receiz/resource-source-v128';
  const located=await readWildsResourceLocatedProofV128(sdk,url);
  if(!located)fail('source_locator_outdated');
  const latest=await verifyWildsResourceSourceProofV128(sdk,located,{applicationId:expected.applicationId});
  if(!isAncestryPrefix(admitted.predecessor.sourceArtifactShas,latest.predecessor.sourceArtifactShas)||!same(origin,latest.state.cardOrigins[expected.assetId]))fail('card_origin_mismatch');
  const actual=await sdk.domains.verifiedReplayV124(replayInput(expected.applicationId,latest.predecessor.head.head));
  if(actual.head!==latest.predecessor.head.head||actual.additions.length)fail('source_locator_outdated');
 }
 return origin;
}
/** Stock v128 keeps namespace_json invariant under named-domain CAS. The
 * immutable law is carried here; holdings come only from complete event replay. */
export function wildsResourceSourceNamespaceV128(){return {namespace:WILDS_RESOURCE_LAW_V128,namespaceName:WILDS_RESOURCE_NAMESPACE_V128,namespaceHead:WILDS_RESOURCE_REGISTRY_DIGEST_V128};}
const replayInput=(applicationId:string,afterHead:string|null)=>({applicationId,domainId:WILDS_RESOURCE_DOMAIN_V128,afterHead,
 expectedRegistryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,expectedReducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128});

export function createWildsResourcePackageExchangeV128(input:Readonly<{
 sdk:ReceizClient;database:WildzContinuityDatabase;authority:WildsResourceSourceAuthorV128;session:ReceizAuthoritySessionV124;
 gameplayOwnerId:string;locator:WildsResourceSourceLocatorV128;
 resolveOriginal?:(card:PortableCardAsset)=>Promise<ReceizPortableSealedArtifactV124|null>;
}>){
 const applicationId=input.authority.grant.applicationId;
 const owner=input.authority.ownerReceizId,publisher=createWildsResourceSourceClientV128({...input,recoveryStore:createWildsResourceSourceRecoveryStoreV128(input.database)});
 const key=(attempt:string)=>JSON.stringify(['wildz.resource-exchange-attempt.v128',owner,attempt]);
 async function current(proof:WildsResourceSourceProofV128|null){
  const verified=proof?await verifyWildsResourceSourceProofV128(input.sdk,proof,{applicationId}):null;
  if(verified){const latest=await input.sdk.domains.verifiedReplayV124(replayInput(applicationId,verified.predecessor.head.head));
   if(latest.head!==verified.predecessor.head.head||latest.additions.length)fail('source_locator_outdated');}
  return verified;
 }
 async function append(event:WildsResourceJournalEventV128,beforeCommit?:()=>Promise<void>){
  const retentionKey=key(event.attemptId),eventBytes=canonicalPortableCardJson(event);
  type Attempt={schema:'wildz.resource-exchange-attempt.v128';event:WildsResourceJournalEventV128;before:WildsResourceSourceProofV128|null;after?:WildsResourceSourceProofV128};
  let retained=await input.database.read<Attempt>('meta',retentionKey);
  if(retained&&(retained.schema!=='wildz.resource-exchange-attempt.v128'||canonicalPortableCardJson(retained.event)!==eventBytes))fail('attempt_conflict');
  if(!retained){const before=await input.locator.read();await current(before);
   retained=await input.database.transaction(['meta'],'readwrite',async tx=>{const existing=await tx.get<Attempt>('meta',retentionKey);
    if(existing){if(canonicalPortableCardJson(existing.event)!==eventBytes)fail('attempt_conflict');return existing;}
    const value:Attempt={schema:'wildz.resource-exchange-attempt.v128',event,before};await tx.put('meta',value,retentionKey);return value;});}
  if(retained.after){
   const verified=await verifyWildsResourceSourceProofV128(input.sdk,retained.after,{applicationId,historical:true}),located=await input.locator.read();
   if(located&&located.custodyArtifact.artifactSha256!==retained.after.custodyArtifact.artifactSha256){
    const latest=await current(located);
    if(!latest||!latest.events.some(item=>same(item.event,event))
      ||!isAncestryPrefix(verified.predecessor.sourceArtifactShas,latest.predecessor.sourceArtifactShas))fail('source_locator_conflict');
    return {...latest,proof:verified.proof};
   }
   const compact=input.locator.compact?await input.locator.compact(retained.after):retained.after;
   await input.database.transaction(['meta'],'readwrite',tx=>tx.put('meta',{...retained,after:compact},retentionKey));
   await input.locator.publish(compact);return current(compact).then(value=>value!);
  }
  // A reply may have been lost after accepted publication and before the local
  // custody export was retained. Another lawful publisher can carry that exact
  // source onward; recover the existing event, never reserve its units again.
  const located=await input.locator.read();
  if(located&&!same(located,retained.before)){const latest=await current(located);if(latest?.events.some(item=>same(item.event,event)))return latest;}
  const previous=retained.before?await verifyWildsResourceSourceProofV128(input.sdk,retained.before,{applicationId,historical:true}):null;
  const state=await reduceWildsResourceJournalV128(previous?.state??initialWildsResourceJournalV128(),event,{ownerReceizId:owner,
    verifyCard:(card,original)=>verifyWildsResourceGameplayCardV128(input.sdk,owner,input.authority.keyFile.keyId,card,original),
    verifyCardOrigin:(card,original)=>verifyWildsResourceCardOriginSourceV128(input.sdk,owner,input.authority.keyFile.keyId,card,original),
    verifyPackage:(artifact,record)=>nativePackageWitness(input.sdk,artifact,record)});
  const appendId=`wildz:resource:${owner}:${event.attemptId}`;
  const published=await publisher.publish({attemptId:event.attemptId,beforeCommit:async sourceArtifact=>{
   assertWildsResourceSourceArchiveCapacityV128([sourceArtifact]);
   const {body}=await readPortablePayload(input.sdk,sourceArtifact),head=(body as unknown as ReceizDomainReplaySegmentProofCarrierV124).head;
   // Measurement only: these bytes are never offered as SDK custody. The
   // SDK exports and seals its own held replay after the accepted CAS.
   const measurement={schema:'receiz.domain-replay-proof-custody.v124',proofObjectId:head.proofObjectId,applicationId,domainId:WILDS_RESOURCE_DOMAIN_V128,registryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,reducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,head:head.head,cursor:head.cursor,namespace:head.namespace,predecessorSourceArtifact:previous?.predecessor.artifact??null,replaySourceArtifact:sourceArtifact,checkpointSourceArtifact:null,authority:{custodyIsProofAuthority:false,projectionIsProofAuthority:false,strongerTruth:'sealed-receiz-proof-object'}};
   const measuredPortable=await prepareWildsPortableDocumentV128({assetType:'proof_object',payload:{bytes:encoded(measurement),mimeType:'application/vnd.receiz.domain-replay-proof-carrier.v124+json'},...portableFor(owner)});
   await assertWildsResourceSourceRequestCapacityV128({applicationId,authoritySessionHandle:input.session.authoritySessionHandle,sourceArtifact},serializeReceizPortableAssetDocument(measuredPortable));
   await beforeCommit?.();
  },page:{domainId:WILDS_RESOURCE_DOMAIN_V128,registryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,
   reducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,genesisHead:WILDS_RESOURCE_GENESIS_HEAD_V128,appendId,event,...wildsResourceSourceNamespaceV128(),predecessor:previous?.predecessor??null}});
  if(published.status!=='published')fail(`publication_pending:${published.message}`);
  const admitted=await readWildsSourceReplayAfterV128(input.sdk,{...replayInput(applicationId,previous?.predecessor.head.head??null),afterCursor:previous?.predecessor.head.cursor??0});
  if(admitted.head!==published.preparation.replay.head||admitted.namespace.exactBytesB64u!==receizBase64UrlEncode(encoded(WILDS_RESOURCE_LAW_V128)))fail('published_replay_mismatch');
  const exported=await input.sdk.domains.exportVerifiedReplayProofObjectV124({applicationId,domainId:WILDS_RESOURCE_DOMAIN_V128,
   expectedRegistryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,expectedReducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,throughHead:admitted.head,
   ...portableFor(owner)});
  await assertWildsResourceSourceRequestCapacityV128(null,exported.proofObject.payload.bytes);
  const custody=await input.sdk.assets.createProofObject(exported.proofObject,{idempotencyKey:`wildz:resource-custody:${published.sourceArtifact.artifactSha256}`,filename:`wildz-resource-custody-${admitted.head}.receizbundle`});
  const proof:WildsResourceSourceProofV128={schema:'wildz.resource-source-proof.v128',custodyArtifact:await transportReceizSealedArtifactV124(custody),...(retained.before?.archivePages?{archivePages:retained.before.archivePages}:{}),sourceArtifacts:[...(retained.before?.sourceArtifacts??[]),published.sourceArtifact]};
  // Retain before publishing the weaker locator. A missed reply can recover the
  // same sealed source and custody Original without reserving another package.
  await input.database.transaction(['meta'],'readwrite',async tx=>{const old=await tx.get<Attempt>('meta',retentionKey);
   if(!old||canonicalPortableCardJson(old.event)!==eventBytes)fail('attempt_conflict');await tx.put('meta',{...old,after:proof},retentionKey);});
  const compact=input.locator.compact?await input.locator.compact(proof):proof;
  await input.database.transaction(['meta'],'readwrite',tx=>tx.put('meta',{...retained,after:compact},retentionKey));
  await input.locator.publish(compact);return current(compact).then(value=>value!);
 }

 async function readUseOutcome(accepted:NonNullable<Awaited<ReturnType<typeof current>>>,event:Extract<WildsResourceJournalEventV128,{kind:'use'}>){
   const replay=await replayWildsResourceJournalOwnerV128(accepted.state,owner,input.gameplayOwnerId,(accepted.state.traces[owner]?.commands??event.commands),(card,original)=>verifyWildsResourceGameplayCardV128(input.sdk,owner,input.authority.keyFile.keyId,card,original));
   const entry=accepted.events.find(item=>item.event.attemptId===event.attemptId&&item.event.ownerReceizId===owner);if(!entry)fail('use_missing');
   if(!same(entry.event,event))fail('attempt_conflict');
   const last=event.commands.at(-1)!;
   return {command:last,events:replay.eventsByCommand[wildsResourceGameplayCommandIdV128(last)]??[],consumedFuelMicroBreaths:last.kind==='food.consume'?replay.nourishment.items[last.itemId]?.consumedFuelMicroBreaths??0:0,projection:replay.world,nourishment:replay.nourishment,proof:accepted.proof,state:accepted.state,usedMemberIds:wildsResourceUseSpentMemberIdsV128(accepted.state,event),effectMemberIds:wildsResourceUseEffectMemberIdsV128(accepted.state,event),receipt:{schema:'wildz.resource-use-receipt.v128' as const,appendId:entry.appendId,head:entry.head,sealKai:entry.sealKai}};
 }
 async function completeUse(event:Extract<WildsResourceJournalEventV128,{kind:'use'}>,beforeCommit?:()=>Promise<void>){
   const accepted=await append(event,beforeCommit),outcome=await readUseOutcome(accepted,event);
   await queueWildsResourceGameplayV128({...input,ownerReceizId:owner,command:event.commands.at(-1)!});return outcome;
 }

 return {
  async readCurrent(){return current(await input.locator.read());},
  async verifyProjection(proof:WildsResourceSourceProofV128){
   const historical=await verifyWildsResourceSourceProofV128(input.sdk,proof,{applicationId,historical:true}),latest=await current(await input.locator.read());
   if(!latest||!isAncestryPrefix(historical.predecessor.sourceArtifactShas,latest.predecessor.sourceArtifactShas))fail('source_not_accepted');
   return {...latest,historical};
  },
  async verifyCardOriginProof(proof:WildsResourceSourceProofV128|WildsResourceSourceReferenceV128,expected:Readonly<{assetId:string;payloadSha256:string;provenanceRoot:string}>){return verifyWildsResourceCardOriginProofV128(input.sdk,proof,{applicationId,...expected});},
  async reserveCardOrigin(request:Readonly<Omit<WildsResourceCardOriginV128,'ownerReceizId'>&{attemptId:string}>){
   const accepted=await append({schema:'wildz.resource-command.v128',kind:'card-origin',ownerReceizId:owner,...request});
   const origin=accepted.state.cardOrigins[request.assetId];if(!origin)fail('card_origin_missing');
   return {origin,originProof:input.locator.reference?await input.locator.reference(accepted.proof):accepted.proof};
  },
  async qualifyGameplay(request:Readonly<{attemptId:string}>){
   // A stable selection intent can outlive later gather/consume actions. Bind
   // each accepted replay to the exact live retained trace, rather than reuse
   // an older attempt and silently omit newly spent units.
   const history=await resolveWildsResourceGameplayOriginalsV128({...input,ownerReceizId:owner});
   const traceDigest=sha256PortableBasis(canonicalPortableCardJson({owner:input.gameplayOwnerId,commands:history.commands})).slice(7);
   const attemptId=`${request.attemptId}:trace:${traceDigest}`;
   const retained=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(attemptId));
   if(retained&&(retained.event.kind!=='replay'||!same(retained.event.commands,history.commands)))fail('attempt_conflict');
   const accepted=await append(retained?.event??{schema:'wildz.resource-command.v128',kind:'replay',attemptId,ownerReceizId:owner,gameplayOwnerId:input.gameplayOwnerId,commands:history.commands});
   const trace=accepted.state.traces[owner];if(!trace)fail('trace_missing');
   const replay=await replayWildsResourceJournalOwnerV128(accepted.state,owner,trace.gameplayOwnerId,trace.commands,(card,original)=>verifyWildsResourceGameplayCardV128(input.sdk,owner,input.authority.keyFile.keyId,card,original));
   return {...accepted,replay};
  },
  async previewGameplay(){
   const latest=await current(await input.locator.read()),history=await resolveWildsResourceGameplayOriginalsV128({...input,ownerReceizId:owner});
   const state=latest?.state??initialWildsResourceJournalV128(),commands=history.commands;
   const replay=await replayWildsResourceJournalOwnerV128(state,owner,input.gameplayOwnerId,commands,(card,original)=>verifyWildsResourceGameplayCardV128(input.sdk,owner,input.authority.keyFile.keyId,card,original));
   return {replay,proof:latest?.proof??null,state};
  },
  async use(request:Readonly<{attemptId:string;command:WildsResourceGameplayCommandV128}>,beforeCommit?:()=>Promise<void>){
   const retained=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(request.attemptId));
   const id=wildsResourceGameplayCommandIdV128(request.command);
   const savedCommand=retained?.event.kind==='use'?retained.event.commands.at(-1):null;
   const enrichCompared=savedCommand&&request.command.kind==='world'&&savedCommand.kind==='world'?{...request.command,...(!request.command.cardOriginal&&savedCommand.cardOriginal?{cardOriginal:savedCommand.cardOriginal}:{}),...(!request.command.workerOriginals&&savedCommand.workerOriginals?{workerOriginals:savedCommand.workerOriginals}:{})}:request.command;
   if(retained&&(retained.event.kind!=='use'||retained.event.useCommandId!==id||!same(savedCommand,enrichCompared)))fail('attempt_conflict');
   const history=retained?null:await resolveWildsResourceGameplayOriginalsV128({...input,ownerReceizId:owner});
   const prior=history?.commands.find(entry=>wildsResourceGameplayCommandIdV128(entry)===id);
   if(prior&&!same(prior,request.command))fail('attempt_conflict');
   let enriched=structuredClone(request.command);
   if(!retained&&enriched.kind==='world'&&input.resolveOriginal){
    if(enriched.card&&!enriched.cardOriginal){const original=await input.resolveOriginal(enriched.card);if(original)enriched={...enriched,cardOriginal:original};}
    if(enriched.command.type==='creation.construct'||enriched.command.type==='creation.evolve')for(const source of enriched.command.workerSources){if(!enriched.workerOriginals?.[source.card.id]){const original=await input.resolveOriginal(source.card);if(original)enriched={...enriched,workerOriginals:{...enriched.workerOriginals,[source.card.id]:original}};}}
   }
   const commands=history?[...history.commands.filter(entry=>wildsResourceGameplayCommandIdV128(entry)!==id),enriched]:null;
   const event=retained?.event??{schema:'wildz.resource-command.v128' as const,kind:'use' as const,attemptId:request.attemptId,ownerReceizId:owner,gameplayOwnerId:input.gameplayOwnerId,commands:commands!,useCommandId:id};
   if(event.kind!=='use')fail('attempt_conflict');return completeUse(event,beforeCommit);
  },
  async recoverUse(attemptId:string,beforeCommit?:()=>Promise<void>){
   const retained=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(attemptId));
   if(!retained)return null;if(retained.event.kind!=='use')fail('attempt_conflict');
   return completeUse(retained.event,beforeCommit);
  },
  async observeUse(attemptId:string){
   const retained=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(attemptId));
   if(!retained)return null;if(retained.event.kind!=='use')fail('attempt_conflict');
   const accepted=await current(await input.locator.read());
   if(!accepted?.events.some(item=>item.event.attemptId===attemptId&&item.event.ownerReceizId===owner))return null;
   return readUseOutcome(accepted,retained.event);
  },
  async pendingExactUse(attemptId:string){
   const retained=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(attemptId));
   if(!retained)return null;if(retained.event.kind!=='use')fail('attempt_conflict');
   return structuredClone(retained.event.commands.at(-1)!);
  },
  async prepare(request:Readonly<{attemptId:string;memberIds:readonly string[];recipientHandle:string;createdKaiUPulse:number}>){
   const recipientHandle=request.recipientHandle.trim().replace(/^@/,'').replace(/\.receiz\.id$/,'').toLowerCase();
   const previous=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(request.attemptId));
   if(previous&&(previous.event.kind!=='reserve'||!same(previous.event.memberIds,[...request.memberIds].sort())||previous.event.recipientHandle!==recipientHandle))fail('attempt_conflict');
   const retainedTrace=previous?null:await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(`${request.attemptId}:trace`));
   if(retainedTrace&&retainedTrace.event.kind!=='replay')fail('attempt_conflict');
   const history=previous||retainedTrace?null:await resolveWildsResourceGameplayOriginalsV128({...input,ownerReceizId:owner});
   const commands=retainedTrace?.event.kind==='replay'?retainedTrace.event.commands:history?.commands;
   if(!previous)await append(retainedTrace?.event??{schema:'wildz.resource-command.v128',kind:'replay',attemptId:`${request.attemptId}:trace`,ownerReceizId:owner,gameplayOwnerId:input.gameplayOwnerId,commands:commands!});
   const event:WildsResourceJournalEventV128=previous?.event??{schema:'wildz.resource-command.v128',kind:'reserve',attemptId:request.attemptId,ownerReceizId:owner,gameplayOwnerId:input.gameplayOwnerId,
    createdKaiUPulse:Math.max(request.createdKaiUPulse,...commands!.map(entry=>entry.kaiUPulse)),commands:commands!,memberIds:[...request.memberIds].sort(),recipientHandle};
   const accepted=await append(event),record=Object.values(accepted.state.packages).find(item=>item.package.commandId===request.attemptId&&item.package.ownerReceizId===owner);
   if(!record||record.status!=='reserved')fail('package_unavailable');
   const proposed={schema:'wildz.resource-source-package.v128' as const,package:record.package,
    reservationAppendId:accepted.events.find(item=>item.event.attemptId===request.attemptId)?.appendId??fail('reservation_missing'),sourceProof:input.locator.reference?await input.locator.reference(accepted.proof):accepted.proof};
   const packageKey=JSON.stringify(['wildz.resource-package-seal.v128',owner,record.package.packageId]);
   type PackageSeal={schema:'wildz.resource-package-seal.v128';bearer:Omit<WildsResourceSourcePackageV128,'sourceProof'>&{sourceProof:WildsResourceSourceProofV128|WildsResourceSourceReferenceV128};source:ReceizPortableSealedArtifactV124|null};
   const retained=await input.database.transaction(['meta'],'readwrite',async tx=>{const existing=await tx.get<PackageSeal>('meta',packageKey);
    if(existing){if(existing.schema!=='wildz.resource-package-seal.v128'||!same(existing.bearer.package,proposed.package))fail('attempt_conflict');return existing;}
    const value:PackageSeal={schema:'wildz.resource-package-seal.v128',bearer:proposed,source:null};await tx.put('meta',value,packageKey);return value;});
   const bearer=retained.bearer;
   const portable=await prepareWildsPortableDocumentV128({assetType:'proof_object',payload:{bytes:encoded(bearer),mimeType:'application/vnd.wildz.resource-source-package.v128+json'},...portableFor(owner,'current')});
   const bytes=serializeReceizPortableAssetDocument(portable);
   if(retained.source){if(retained.source.payloadSha256!==await sha256ReceizBytes(bytes))fail('package_seal_binding_invalid');await openOriginal(input.sdk,retained.source);return {package:record.package,source:retained.source,sourceProof:accepted.proof};}
   const sealed=await input.sdk.assets.createProofObject({assetType:'proof_object',payload:{bytes,mimeType:'application/vnd.receiz.portable-asset.v1+json'}},
    {idempotencyKey:`wildz:resource-package:${record.package.head}`,filename:`wildz-resource-${record.package.packageId.slice(-64)}.receizbundle`});
   const source=await transportReceizSealedArtifactV124(sealed);
   if(source.payloadSha256!==await sha256ReceizBytes(bytes))fail('package_seal_binding_invalid');
   await input.database.transaction(['artifacts'],'readwrite',async tx=>{await tx.put('artifacts',{schema:'wildz.resource-package-original.v128',packageId:record.package.packageId,source},JSON.stringify(['wildz.resource-package-original.v128',owner,record.package.packageId]));});
   await input.database.transaction(['meta'],'readwrite',tx=>tx.put('meta',{...retained,source},packageKey));
   return {package:record.package,source,sourceProof:accepted.proof};
  },
  async verifyOffer(source:ReceizPortableSealedArtifactV124,expected?:WildsWalletStagedTradeResourceSourceHead){
   const {bearer,opened}=await readWildsResourceSourcePackageV128(input.sdk,source);
   const reservation=await verifyWildsResourceSourceProofV128(input.sdk,bearer.sourceProof,{applicationId,historical:true});
   const latest=await current(await input.locator.read());if(!latest)fail('source_missing');
   if(!isAncestryPrefix(reservation.predecessor.sourceArtifactShas,latest.predecessor.sourceArtifactShas))fail('source_not_accepted');
   const record=latest.state.packages[bearer.package.packageId];
   if(!record||record.status!=='reserved'||!same(record.package,bearer.package)||opened.admitted.ownerReceizId!==bearer.package.ownerReceizId
     ||!reservation.events.some(item=>item.appendId===bearer.reservationAppendId&&item.event.kind==='reserve'))fail('offer_unavailable');
   const custody=latest.events.find(item=>item.appendId===record.custodyAppendId);if(!custody)fail('custody_missing');
   const descriptor=(legId:string):WildsWalletStagedTradeResourceSourceHead=>({protocol:'wildz.resource-source.v128',legId,
    sourceArtifactSha256:source.artifactSha256,sourcePayloadSha256:source.payloadSha256,packageId:record.package.packageId,packageHead:record.package.head,
    memberIds:record.package.members.map(member=>member.id).sort(),domainId:WILDS_RESOURCE_DOMAIN_V128,custodyAppendId:custody.appendId,custodyHead:custody.head,
    ownerHandle:record.ownerReceizId});
   if(expected&&!same(expected,descriptor(expected.legId)))fail('offer_descriptor_mismatch');
   return {bearer,record,descriptor,proof:latest.proof};
  },
  async describeOffer(source:ReceizPortableSealedArtifactV124,legId:string){
   const offered=await this.verifyOffer(source);if(offered.record.ownerReceizId!==owner)fail('owner_mismatch');return offered.descriptor(legId);
  },
  async accept(request:Readonly<{attemptId:string;source:ReceizPortableSealedArtifactV124;expectedDescriptor?:WildsWalletStagedTradeResourceSourceHead;authorizationDigest?:string}>){
   const known=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(request.attemptId));
   const packageProof=known?(await readWildsResourceSourcePackageV128(input.sdk,request.source)).bearer.package:(await this.verifyOffer(request.source,request.expectedDescriptor)).bearer.package;
   if(!known){const offered=await this.verifyOffer(request.source,request.expectedDescriptor);if(offered.record.recipientHandle!==owner.replace(/\.receiz\.id$/,''))fail('recipient_mismatch');}
   const accepted=await append({schema:'wildz.resource-command.v128',kind:'claim',attemptId:request.attemptId,ownerReceizId:owner,packageId:packageProof.packageId,artifact:request.source,...(request.authorizationDigest?{authorizationDigest:request.authorizationDigest}:{})});
   const claim=accepted.events.find(item=>item.appendId===`wildz:resource:${owner}:${request.attemptId}`);if(!claim)fail('claim_missing');
   return {package:packageProof,source:request.source,proof:accepted.proof,receipt:{schema:'wildz.resource-source-receipt.v128' as const,packageId:packageProof.packageId,
    sourceArtifactSha256:request.source.artifactSha256,sourcePayloadSha256:request.source.payloadSha256,acceptedAppendId:claim.appendId,acceptedHead:claim.head,acceptedKaiUPulse:claim.kaiUPulse,acceptedSealKai:claim.sealKai,ownerReceizId:owner,...(claim.event.kind==='claim'&&claim.event.authorizationDigest?{authorizationDigest:claim.event.authorizationDigest}:{}),proof:accepted.proof}};
  },
  async reoffer(request:Readonly<{attemptId:string;packageId:string;recipientHandle:string;source:ReceizPortableSealedArtifactV124}>){
   const accepted=await append({schema:'wildz.resource-command.v128',kind:'offer',attemptId:request.attemptId,ownerReceizId:owner,packageId:request.packageId,recipientHandle:request.recipientHandle,artifact:request.source});
   return {package:accepted.state.packages[request.packageId]!.package,source:request.source,sourceProof:accepted.proof};
  },
  async unpack(request:Readonly<{attemptId:string;packageId:string;source:ReceizPortableSealedArtifactV124}>){
   const previous=await input.database.read<{event:WildsResourceJournalEventV128}>('meta',key(request.attemptId));
   if(previous&&(previous.event.kind!=='unpack'||previous.event.packageId!==request.packageId||previous.event.artifact.artifactSha256!==request.source.artifactSha256))fail('attempt_conflict');
   const accepted=await append(previous?.event??{schema:'wildz.resource-command.v128',kind:'unpack',attemptId:request.attemptId,ownerReceizId:owner,packageId:request.packageId,artifact:request.source,kaiUPulse:receizKaiNow().uPulse});
   const unpack=accepted.events.find(item=>item.event.attemptId===request.attemptId&&item.event.ownerReceizId===owner&&item.event.kind==='unpack');if(!unpack)fail('unpack_missing');
   return {package:accepted.state.packages[request.packageId]!.package,proof:accepted.proof,receipt:{schema:'wildz.resource-unpack-receipt.v128' as const,packageId:request.packageId,ownerReceizId:owner,unpackedAppendId:unpack.appendId,unpackedHead:unpack.head,unpackedSealKai:unpack.sealKai}};
  },
  async observe(packageId:string,descriptor:WildsWalletStagedTradeResourceSourceHead){
   const latest=await current(await input.locator.read());if(!latest)fail('source_missing');
   const record=latest.state.packages[packageId],offered=latest.events.find(item=>item.appendId===descriptor.custodyAppendId);
   if(!record||descriptor.packageId!==packageId||!offered||offered.head!==descriptor.custodyHead||record.package.head!==descriptor.packageHead
     ||!same(record.package.members.map(member=>member.id).sort(),descriptor.memberIds))fail('receipt_binding_invalid');
   if(!['reserve','offer'].includes(offered.event.kind)||offered.event.ownerReceizId!==descriptor.ownerHandle
    ||(offered.event.kind==='reserve'?Object.values(latest.state.packages).find(item=>item.package.commandId===offered.event.attemptId&&item.package.ownerReceizId===offered.event.ownerReceizId)?.package.packageId:offered.event.kind==='offer'?offered.event.packageId:null)!==packageId)fail('receipt_binding_invalid');
   const offerIndex=latest.events.indexOf(offered),claim=latest.events.slice(offerIndex+1).find(item=>item.event.kind==='claim'&&item.event.packageId===packageId);
   if(!claim||claim.event.kind!=='claim')return {status:'offered' as const,package:record.package,record,proof:latest.proof};
   if(claim.event.artifact.artifactSha256!==descriptor.sourceArtifactSha256||claim.event.artifact.payloadSha256!==descriptor.sourcePayloadSha256)fail('receipt_binding_invalid');
   return {status:'accepted' as const,package:record.package,record,proof:latest.proof,receipt:{schema:'wildz.resource-source-receipt.v128' as const,packageId,sourceArtifactSha256:descriptor.sourceArtifactSha256,
    sourcePayloadSha256:descriptor.sourcePayloadSha256,acceptedAppendId:claim.appendId,acceptedHead:claim.head,acceptedKaiUPulse:claim.kaiUPulse,acceptedSealKai:claim.sealKai,ownerReceizId:claim.event.ownerReceizId,...(claim.event.authorizationDigest?{authorizationDigest:claim.event.authorizationDigest}:{}),proof:latest.proof}};
  },
 };
}

/** Published state is only an Original locator. Root sealing/source CAS occurs
 * first, and restoring/verifying that Original is mandatory on every use. */
export function createWildsResourcePublicStoreLocatorV128(input:Readonly<{sdk:ReceizClient;authority:WildsResourceSourceAuthorV128;sourceUrl:string}>):WildsResourceSourceLocatorV128{
 return createWildsResourceSourceArchiveLocatorV128(input);
}
