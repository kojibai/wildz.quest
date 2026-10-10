import {readWildsSourceReplayAfterV128} from './wilds-source-replay-recovery-v128';
import {createReceizClient,canonicalizeReceizV122,parseReceizPortableAssetDocument,prepareReceizDomainReplaySegmentProofObjectCandidateV124,receizBase64UrlDecode,receizBase64UrlEncode,sha256ReceizBytes,transportReceizSealedArtifactV124,
 type ReceizClient,type ReceizAuthoritySessionV124,type ReceizPortableSealedArtifactV124,type ReceizDomainReplaySegmentProofCarrierV124,type ReceizDomainReplayProofSegmentChildV124,type ReceizDomainReplayAppendIndexValueV124} from '@receiz/sdk';
import {openWildzArtifactEvidence} from './wildz-artifact-custody';
import {createWildsResourceSourceClientV128,createWildsResourceSourceRecoveryStoreV128} from './wilds-resource-source-client-v128';
import type {WildsResourceSourceAuthorV128,WildsResourceSourcePredecessorV128} from './wilds-resource-source-v128';
import type {WildzContinuityDatabase} from '../storage/wildz-indexed-db';
import {initialWildzMarketSourceV128,reduceWildzMarketSourceV128,WILDZ_MARKET_SOURCE_DOMAIN_V128,WILDZ_MARKET_SOURCE_NAMESPACE_V128,WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128,WILDZ_MARKET_SOURCE_REDUCER_DIGEST_V128,WILDZ_MARKET_SOURCE_GENESIS_HEAD_V128,WILDZ_MARKET_SOURCE_LAW_V128} from './wildz-market-source-journal-v128';
import type {WildzMarketSourceProofV128,WildzMarketSourceEventV128,WildzMarketSourceSnapshotV128,WildzMarketSourceResultV128,WildzMarketSourceRepositoryV128,WildzMarketSelectionV128,WildzMarketListingV128} from './wildz-market-source-types-v128';
import {assertWildzMarketSourceArchiveCapacityV128,createWildzMarketSourceArchivePageV128,compactWildzMarketSourceProofV128,iterateWildzMarketSourceOriginalsV128,type WildzMarketSourceArchivePageV128} from './wildz-market-source-archive-v128';
import {locateWildzMarketSourceOriginalV128,restoreWildzMarketSourceOriginalV128} from './wildz-market-source-original-locator-v128';
export type WildzMarketSourceLocatorV128=Readonly<{read():Promise<WildzMarketSourceProofV128|null>;publish(proof:WildzMarketSourceProofV128):Promise<void>;compact?(proof:WildzMarketSourceProofV128):Promise<WildzMarketSourceProofV128>}>;
const encoded=(value:unknown)=>new TextEncoder().encode(canonicalizeReceizV122(value));
const same=(a:unknown,b:unknown)=>canonicalizeReceizV122(a)===canonicalizeReceizV122(b);
function fail(reason:string):never{throw Error(`wildz_market_source_${reason}`);}
const replayInput=(applicationId:string,afterHead:string|null)=>({applicationId,domainId:WILDZ_MARKET_SOURCE_DOMAIN_V128,afterHead,expectedRegistryDigest:WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128,expectedReducerDigest:WILDZ_MARKET_SOURCE_REDUCER_DIGEST_V128});
const portableFor=(owner:string)=>({ownership:{ownerReceizId:owner,custody:'current' as const,proofRef:'genesis'},provenance:{root:`profile:${owner.replace(/\.receiz\.id$/,'')}`,appends:[]},settlement:{state:'none'}});
/** Open every exact native Original, rebuild SDK source candidates and replay
 * the market law. Public discovery JSON and cached success never admit state. */
export async function verifyWildzMarketSourceProofV128(sdk:ReceizClient,proof:WildzMarketSourceProofV128,expected:Readonly<{applicationId:string;historical?:boolean}>){
 if(!proof||proof.schema!=='wildz.market-source-proof.v128'||!same(Object.keys(proof).sort(),['archivePages','custodyArtifact','schema','sourceArtifacts'])
  ||!Array.isArray(proof.sourceArtifacts)||!proof.sourceArtifacts.length||encoded(proof).length>8*1024*1024||!expected.applicationId)fail('source_proof_invalid');
 let state=initialWildzMarketSourceV128();let previous:WildsResourceSourcePredecessorV128|null=null;
 const historicalListings=new Map<string,WildzMarketListingV128>();
 const segmentIds:string[]=[],sourceArtifactShas:string[]=[];
 const events:Array<{event:WildzMarketSourceEventV128;appendId:string;head:string;sealKai:string}>=[];
 for await(const source of iterateWildzMarketSourceOriginalsV128(proof,async reference=>{
  const located=await sdk.publicStore.restoreLatest({url:`https://wildz.quest/receiz/market-source-v128/pages/${reference.digest}`,tenantHost:'wildz.quest'});
  const record=located.storeStateRecord;if(!record||record.schema!=='wildz.market-source-page-locator.v128'||!record.page)fail('archive_page_missing');return record.page;
 })){
  if(!source||source.schema!=='receiz.sealed-artifact-bytes.v124'||!source.exactBytesB64u)fail('source_original_invalid');
  const bytes=receizBase64UrlDecode(source.exactBytesB64u);
  if(await sha256ReceizBytes(bytes)!==source.artifactSha256)fail('source_original_mismatch');
  const opened=await openWildzArtifactEvidence(new Blob([bytes.slice().buffer],{type:source.mimeType}),source.filename,sdk.artifacts);
  if(opened.admitted.compatibility!=='current-native'||opened.admitted.payloadSha256!==source.payloadSha256)fail('source_original_mismatch');
  const portable=await parseReceizPortableAssetDocument(JSON.parse(new TextDecoder().decode(opened.admitted.payloadBytes)));
  const carrier=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(portable.payload.bytesBase64Url))) as ReceizDomainReplaySegmentProofCarrierV124;
  if(carrier.schema!=='receiz.domain-replay-segment-proof.v124'||portable.ownership.custody!=='current')fail('source_carrier_invalid');
  const child=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(carrier.segment.exactSegmentBytesB64u))) as ReceizDomainReplayProofSegmentChildV124;
  const replay=child.replay;
  if(replay.applicationId!==expected.applicationId||replay.domainId!==WILDZ_MARKET_SOURCE_DOMAIN_V128||replay.registryDigest!==WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128
   ||replay.reducerDigest!==WILDZ_MARKET_SOURCE_REDUCER_DIGEST_V128||carrier.head.genesisHead!==WILDZ_MARKET_SOURCE_GENESIS_HEAD_V128
   ||replay.afterHead!==(previous?.head.head??null)||replay.afterCursor!==(previous?.head.cursor??0)||replay.additions.length!==1
   ||child.sourceAuthority.ownerReceizId!==opened.admitted.ownerReceizId)fail('source_coordinates_invalid');
  const candidate=await prepareReceizDomainReplaySegmentProofObjectCandidateV124({replay,replayReceipt:child.replayReceipt,journalAppends:child.journalAppends,sourceAuthority:child.sourceAuthority,authoringEvidence:child.authoringEvidence,kai:child.kai,predecessorArtifact:previous?.artifact??null,insertionWitnesses:child.insertionWitnesses,causalParentWitnesses:child.causalParentWitnesses,fibonacci:carrier.head.fibonacci,fibonacciWitnesses:carrier.fibonacciWitnesses,portable:{ownership:portable.ownership,provenance:portable.provenance,settlement:portable.settlement}});
  if(await sha256ReceizBytes(candidate.proofObject.payload.bytes)!==source.payloadSha256||!same(candidate.carrier,carrier))fail('source_candidate_binding_invalid');
  const addition=replay.additions[0]!,event=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(addition.exactEventBytesB64u))) as WildzMarketSourceEventV128;
  const sealKai=opened.sealedArtifact.verification.bundle.kaiPulseEternal;
  if(typeof sealKai!=='string'||!/^(?:0|[1-9][0-9]*)$/.test(sealKai))fail('source_seal_kai_required');
  if(event.kind==='terminal-consent'){
   const approved=events.find(item=>item.event.kind==='approved'&&item.event.listingId===event.listingId&&item.event.reservationId===event.reservationId);
   if(!approved||BigInt(sealKai)<BigInt(approved.sealKai))fail('terminal_consent_causal_time');
  }
  if(event.kind==='list'&&historicalListings.has(event.listingId))fail('listing_id_reused');
  state=reduceWildzMarketSourceV128(state,event,child.sourceAuthority.ownerReceizId);
  const changed=state.listings[event.listingId];if(changed)historicalListings.set(event.listingId,changed);
  if(replay.namespace.name!==WILDZ_MARKET_SOURCE_NAMESPACE_V128||replay.namespace.head!==WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128||replay.namespace.exactBytesB64u!==receizBase64UrlEncode(encoded(WILDZ_MARKET_SOURCE_LAW_V128)))fail('source_reducer_mismatch');
  const appendIndex:Map<string,ReceizDomainReplayAppendIndexValueV124>=new Map(previous?.appendIndex??[]);
  appendIndex.set(addition.appendId,{eventDigest:addition.eventDigest,cursor:addition.cursor,newHead:addition.newHead});
  segmentIds.push(carrier.head.currentSegment.segmentId);sourceArtifactShas.push(source.artifactSha256);
  previous={artifact:source,head:carrier.head,appendIndex,segmentIds:[...segmentIds],sourceArtifactShas:[...sourceArtifactShas]};
  events.push({event,appendId:addition.appendId,head:addition.newHead,sealKai});
 }
 if(!previous)fail('source_proof_invalid');
 const restorer=expected.historical?createReceizClient({applicationId:expected.applicationId,fetchImpl:async()=>{throw Error('Historical source proof verification cannot request network authority.');}}):sdk;
 const restored=await restorer.domains.restoreVerifiedReplayProofObjectV124({applicationId:expected.applicationId,domainId:WILDZ_MARKET_SOURCE_DOMAIN_V128,expectedRegistryDigest:WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128,expectedReducerDigest:WILDZ_MARKET_SOURCE_REDUCER_DIGEST_V128,expectedHead:previous.head.head,expectedCursor:previous.head.cursor,expectedNamespace:{name:WILDZ_MARKET_SOURCE_NAMESPACE_V128,head:WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128,digest:await sha256ReceizBytes(encoded(WILDZ_MARKET_SOURCE_LAW_V128))},artifact:proof.custodyArtifact});
 if(restored.sourceArtifactSha256!==previous.artifact.artifactSha256)fail('source_custody_mismatch');
 return {state,predecessor:previous,events,proof,historicalListings};
}
export function createWildzMarketSourceRepositoryV128(input:Readonly<{
 sdk:ReceizClient;database:WildzContinuityDatabase;authority:WildsResourceSourceAuthorV128;session:ReceizAuthoritySessionV124;locator:WildzMarketSourceLocatorV128;
 /** SDK-open exact current custody privately; return canonical selected semantic IDs/digest. */
 qualifySelection(selection:WildzMarketSelectionV128):Promise<WildzMarketSelectionV128>;
 /** Real two device/root approvals or canonical receipt qualification, owned by the purchase adapter. */
 verifyTransition(event:Extract<WildzMarketSourceEventV128,{kind:'approved'|'progress'|'terminal-consent'}>,listing:WildzMarketListingV128):Promise<void>;
}>):WildzMarketSourceRepositoryV128{
 const applicationId=input.authority.grant.applicationId,owner=input.authority.ownerReceizId;
 const publisher=createWildsResourceSourceClientV128({...input,recoveryStore:createWildsResourceSourceRecoveryStoreV128(input.database)});
 const key=(attempt:string)=>JSON.stringify(['wildz.market-source-attempt.v128',owner,attempt]);
 type Attempt={schema:'wildz.market-source-attempt.v128';event:WildzMarketSourceEventV128;before:WildzMarketSourceProofV128|null;after?:WildzMarketSourceProofV128};
 async function current(proof:WildzMarketSourceProofV128|null){
  if(!proof)return null;
  const verified=await verifyWildzMarketSourceProofV128(input.sdk,proof,{applicationId});
  const actual=await input.sdk.domains.verifiedReplayV124(replayInput(applicationId,verified.predecessor.head.head));
  if(actual.head!==verified.predecessor.head.head||actual.additions.length)fail('source_locator_outdated');
  return verified;
 }
 const snapshot=(verified:Awaited<ReturnType<typeof current>>):WildzMarketSourceSnapshotV128=>({state:verified?.state??initialWildzMarketSourceV128(),head:verified?.predecessor.head.head??null,proof:verified?.proof??null});
 function result(verified:NonNullable<Awaited<ReturnType<typeof current>>>,listingId:string,attemptId?:string):WildzMarketSourceResultV128{
  const listing=verified.state.listings[listingId]??verified.historicalListings.get(listingId);if(!listing)fail('listing_missing');
  const admitted=attemptId?verified.events.find(item=>item.event.actorHandle===owner&&item.event.attemptId===attemptId):verified.events.at(-1);
  if(!admitted)fail('source_receipt_missing');
  return {snapshot:snapshot(verified),listing,receiptLocator:{schema:'wildz.market-source-locator.v128',domainId:WILDZ_MARKET_SOURCE_DOMAIN_V128,head:admitted.head,sourceArtifactSha256:verified.predecessor.artifact.artifactSha256,appendId:admitted.appendId}};
 }
 async function append(event:WildzMarketSourceEventV128){
  if(event.actorHandle!==owner)fail('actor_mismatch');
  const retentionKey=key(event.attemptId);let retained=await input.database.read<Attempt>('meta',retentionKey);
  if(retained&&(retained.schema!=='wildz.market-source-attempt.v128'||!same(retained.event,event)))fail('attempt_conflict');
  if(retained?.after){
   const past=await verifyWildzMarketSourceProofV128(input.sdk,retained.after,{applicationId,historical:true});
   const located=await input.locator.read();
   if(located&&located.custodyArtifact.artifactSha256!==retained.after.custodyArtifact.artifactSha256){const latest=await current(located);
    if(!latest||!latest.events.some(item=>same(item.event,event))||!past.predecessor.sourceArtifactShas.every((sha,index)=>sha===latest.predecessor.sourceArtifactShas[index]))fail('source_locator_conflict');return result(latest,event.listingId,event.attemptId);}
   await input.locator.publish(past.proof);return result((await current(past.proof))!,event.listingId,event.attemptId);
  }
  const located=await input.locator.read();
  const unchangedRetained=retained&&same(located,retained.before);
  const latest=unchangedRetained?null:await current(located);
  if(latest?.events.some(item=>same(item.event,event)))return result(latest,event.listingId,event.attemptId);
  const previous=retained?(retained.before?await verifyWildzMarketSourceProofV128(input.sdk,retained.before,{applicationId,historical:true}):null):latest;
  if(event.kind==='list'&&previous?.historicalListings.has(event.listingId))fail('listing_id_reused');
  const state=reduceWildzMarketSourceV128(previous?.state??initialWildzMarketSourceV128(),event,owner);
  if(event.kind==='list'&&!same(await input.qualifySelection(event.selection),event.selection))fail('selection_custody_changed');
  if(event.kind==='approved'||event.kind==='progress'||event.kind==='terminal-consent')await input.verifyTransition(event,previous!.state.listings[event.listingId]!);
  if(!retained){retained=await input.database.transaction(['meta'],'readwrite',async tx=>{const prior=await tx.get<Attempt>('meta',retentionKey);
   if(prior){if(!same(prior.event,event))fail('attempt_conflict');return prior;}
   const value:Attempt={schema:'wildz.market-source-attempt.v128',event:structuredClone(event),before:previous?.proof??null};await tx.put('meta',value,retentionKey);return value;});}
  const appendId=`wildz:market:${owner}:${event.attemptId}`;
  const published=await publisher.publish({attemptId:`market:${event.attemptId}`,beforeCommit:async source=>{assertWildzMarketSourceArchiveCapacityV128([source]);},page:{domainId:WILDZ_MARKET_SOURCE_DOMAIN_V128,registryDigest:WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128,reducerDigest:WILDZ_MARKET_SOURCE_REDUCER_DIGEST_V128,genesisHead:WILDZ_MARKET_SOURCE_GENESIS_HEAD_V128,appendId,event,namespace:WILDZ_MARKET_SOURCE_LAW_V128,namespaceName:WILDZ_MARKET_SOURCE_NAMESPACE_V128,namespaceHead:WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128,predecessor:previous?.predecessor??null}});
  if(published.status!=='published')fail(`publication_pending:${published.message}`);
  const admitted=await readWildsSourceReplayAfterV128(input.sdk,{...replayInput(applicationId,previous?.predecessor.head.head??null),afterCursor:previous?.predecessor.head.cursor??0});
  if(admitted.head!==published.preparation.replay.head||admitted.namespace.exactBytesB64u!==receizBase64UrlEncode(encoded(WILDZ_MARKET_SOURCE_LAW_V128)))fail('published_replay_mismatch');
  const exported=await input.sdk.domains.exportVerifiedReplayProofObjectV124({applicationId,domainId:WILDZ_MARKET_SOURCE_DOMAIN_V128,expectedRegistryDigest:WILDZ_MARKET_SOURCE_REGISTRY_DIGEST_V128,expectedReducerDigest:WILDZ_MARKET_SOURCE_REDUCER_DIGEST_V128,throughHead:admitted.head,...portableFor(owner)});
  const custody=await input.sdk.assets.createProofObject(exported.proofObject,{idempotencyKey:`wildz:market-custody:${published.sourceArtifact.artifactSha256}`,filename:`wildz-market-custody-${admitted.head}.receizbundle`});
  let proof:WildzMarketSourceProofV128={schema:'wildz.market-source-proof.v128',custodyArtifact:await transportReceizSealedArtifactV124(custody),archivePages:retained.before?.archivePages??[],sourceArtifacts:[...(retained.before?.sourceArtifacts??[]),published.sourceArtifact]};
  if(input.locator.compact)proof=await input.locator.compact(proof);
  await input.database.transaction(['meta'],'readwrite',async tx=>{const old=await tx.get<Attempt>('meta',retentionKey);if(!old||!same(old.event,event))fail('attempt_conflict');await tx.put('meta',{...old,after:proof},retentionKey);});
  await input.locator.publish(proof);return result((await current(proof))!,event.listingId,event.attemptId);
 }
 return {async load(){return snapshot(await current(await input.locator.read()));},
  list:request=>append({schema:'wildz.market-source-command.v128',kind:'list',actorHandle:owner,...request}),
  cancel:request=>append({schema:'wildz.market-source-command.v128',kind:'cancel',actorHandle:owner,...request}),
  reserve:request=>append({schema:'wildz.market-source-command.v128',kind:'reserve',actorHandle:owner,...request}),transition:append,
  async observe(request){const actual=await current(await input.locator.read());if(!actual)fail('listing_missing');const value=result(actual,request.listingId);
   if(request.reservationId&&value.listing.reservation?.reservationId!==request.reservationId)fail('reservation_mismatch');return value;},
  async verifyReservation(request){const actual=await current(await input.locator.read());if(!actual)fail('listing_missing');const value=result(actual,request.listingId),r=value.listing.reservation;
   if(!r||r.reservationId!==request.reservationId||r.buyerHandle!==request.buyerHandle||r.sellerHandle!==request.sellerHandle||r.priceUsdCents!==request.priceUsdCents||r.listingHead!==request.listingHead||r.phase==='cancelled')fail('reservation_mismatch');return value;}
 };
}
export function createWildzMarketPublicStoreLocatorV128(input:Readonly<{sdk:ReceizClient;authority:WildsResourceSourceAuthorV128;sourceUrl:string}>):WildzMarketSourceLocatorV128{
 const url=new URL(input.sourceUrl);if(url.toString()!=='https://wildz.quest/receiz/market-source-v128')fail('locator_invalid');
 const publish=async(sourceUrl:string,storeStateRecord:Record<string,unknown>,idempotencyKey:string)=>{
  const signed=await input.sdk.publicStore.signPublish({tenantHost:url.host,merchantReceizId:input.authority.ownerReceizId,sourceUrl,namespace:WILDZ_MARKET_SOURCE_NAMESPACE_V128,title:'Wildz Player Market source Originals',platform:'Wildz',projectionState:'published',storeStateRecord:JSON.parse(canonicalizeReceizV122(storeStateRecord)),keyFile:input.authority.keyFile,...(input.authority.passphrase===undefined?{}:{passphrase:input.authority.passphrase})});
  // The published host bounds the complete signed request, which repeats the
  // feed inside its identity challenge. Measure those actual SDK bytes.
  if(new TextEncoder().encode(JSON.stringify(signed)).length>2*1024*1024)fail('locator_request_too_large');
  await input.sdk.publicStore.publishSigned(signed,{idempotencyKey});
 };
 return {async read(){const result=await input.sdk.publicStore.restoreLatest({url:url.toString(),tenantHost:url.host});const row=result.storeStateRecord;
  if(!row)return null;if(row.schema!=='wildz.market-source-locator.v128'||!row.proof)fail('locator_invalid');
  const value=row.proof as unknown as WildzMarketSourceProofV128;
  if(value.schema==='wildz.market-source-proof.v128')return value;
  if((value.schema as string)!=='wildz.market-source-reference.v128'||!same(Object.keys(value).sort(),['archivePages','custodyArtifact','schema','sourceArtifacts'])
   ||!Array.isArray(value.archivePages)||value.archivePages.length>1)fail('locator_invalid');
  createWildzMarketSourceArchivePageV128(value.sourceArtifacts,value.archivePages[0]??null);
  const custodyArtifact=await restoreWildzMarketSourceOriginalV128(value.custodyArtifact,async reference=>{
   const located=await input.sdk.publicStore.restoreLatest({url:`${url.toString()}/pages/${reference.digest}`,tenantHost:url.host});
   const record=located.storeStateRecord;if(!record||record.schema!=='wildz.market-source-page-locator.v128'||!record.page)fail('bytes_page_missing');return record.page;
  });
  return {schema:'wildz.market-source-proof.v128',custodyArtifact,archivePages:value.archivePages,sourceArtifacts:value.sourceArtifacts};},
  async compact(proof){return compactWildzMarketSourceProofV128(proof,async(page:WildzMarketSourceArchivePageV128,reference)=>{await publish(`${url.toString()}/pages/${reference.digest}`,{schema:'wildz.market-source-page-locator.v128',page},`wildz:market-archive:${reference.digest}`);});},
  async publish(proof){
   if(proof.schema!=='wildz.market-source-proof.v128'||proof.archivePages.length>1||encoded(proof).length>8*1024*1024)fail('source_proof_invalid');
   createWildzMarketSourceArchivePageV128(proof.sourceArtifacts,proof.archivePages[0]??null);
   const custodyArtifact=await locateWildzMarketSourceOriginalV128(proof.custodyArtifact,async(page,reference)=>{await publish(`${url.toString()}/pages/${reference.digest}`,{schema:'wildz.market-source-page-locator.v128',page},`wildz:market-archive:${reference.digest}`);});
   await publish(url.toString(),{schema:'wildz.market-source-locator.v128',proof:{...proof,schema:'wildz.market-source-reference.v128',custodyArtifact}},`wildz:market-locator:${proof.custodyArtifact.artifactSha256}`);
  }};
}
