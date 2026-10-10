import {canonicalizeReceizV122,type ReceizClient,type ReceizPortableSealedArtifactV124} from '@receiz/sdk';
import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';
import {WILDS_RESOURCE_NAMESPACE_V128} from './wilds-resource-journal-v128';
import type {WildsResourceSourceAuthorV128} from './wilds-resource-source-v128';
import type {WildsResourceSourceProofV128,WildsResourceSourceLocatorV128} from './wilds-resource-exchange-v128';
import type {WildzMarketSourceArchiveReferenceV128} from './wildz-market-source-types-v128';
import {locateWildzMarketSourceOriginalV128,restoreWildzMarketSourceOriginalV128,assertWildzMarketSourceOriginalReferenceV128,WILDZ_MARKET_SOURCE_ORIGINAL_TEXT_BYTES_V128,
 type WildzMarketSourceOriginalReferenceV128,type WildzMarketSourceBytesPageV128,type WildzMarketSourceBytesReferenceV128} from './wildz-market-source-original-locator-v128';

export const WILDS_RESOURCE_SOURCE_TAIL_COUNT_V128=32;
const PAGE_BYTES=192*1024,TAIL_BYTES=8*1024*1024;
export const WILDS_RESOURCE_SOURCE_URL_V128='https://wildz.quest/receiz/resource-source-v128';
export type WildsResourceSourceArchivePageV128=Readonly<{
 schema:'wildz.resource-source-page.v128';predecessorPage:WildzMarketSourceArchiveReferenceV128|null;
 sourceArtifacts:readonly WildzMarketSourceOriginalReferenceV128[];
}>;
export type WildsResourceSourceReferenceV128=Readonly<{
 schema:'wildz.resource-source-reference.v128';custodyArtifact:WildzMarketSourceOriginalReferenceV128;
 archivePages:readonly WildzMarketSourceArchiveReferenceV128[];sourceArtifacts:readonly WildzMarketSourceOriginalReferenceV128[];
}>;
const fields=(value:unknown,wanted:string)=>!!value&&typeof value==='object'&&Object.keys(value).sort().join()===wanted;
const size=(value:unknown)=>new TextEncoder().encode(canonicalizeReceizV122(value)).length;
function fail(reason:string):never{throw Error(`wilds_resource_archive_${reason}`);}
function assertReference(value:WildzMarketSourceArchiveReferenceV128){
 if(!fields(value,'count,digest')||!/^[a-f0-9]{64}$/.test(value.digest)||!Number.isSafeInteger(value.count)||value.count<1||value.count>WILDS_RESOURCE_SOURCE_TAIL_COUNT_V128)fail('reference_invalid');
}
export function assertWildsResourceSourceArchiveCapacityV128(sources:readonly ReceizPortableSealedArtifactV124[]){
 for(const source of sources)if(!source||source.schema!=='receiz.sealed-artifact-bytes.v124'||typeof source.exactBytesB64u!=='string'
  ||!source.exactBytesB64u.length||source.exactBytesB64u.length>WILDZ_MARKET_SOURCE_ORIGINAL_TEXT_BYTES_V128)fail('original_too_large');
}
/** Measure the actual same-origin JSON wrapper and native multipart carrier.
 * The measured carrier is only a byte budget; SDK custody is exported later. */
export async function assertWildsResourceSourceRequestCapacityV128(sourceRequest:Readonly<{applicationId:string;authoritySessionHandle:string;sourceArtifact:ReceizPortableSealedArtifactV124}>|null,custodyPayload:Uint8Array){
 if(sourceRequest&&new TextEncoder().encode(JSON.stringify({path:'/api/sdk/v1/sources/publish',query:`applicationId=${encodeURIComponent(sourceRequest.applicationId)}`,method:'POST',body:sourceRequest})).length>2_000_000)fail('source_request_too_large');
 const form=new FormData();form.set('file',new File([custodyPayload.slice().buffer],`wildz-resource-custody-${'0'.repeat(64)}.receizbundle`,{type:'application/vnd.receiz.portable-asset.v1+json'}));
 form.set('wildzSdkPath','/api/sdk/v1/assets/seal');form.set('wildzSdkQuery','');form.set('wildzSdkMethod','POST');
 if((await new Request('https://wildz.quest/api/wilds/wallet/source-sdk',{method:'POST',body:form}).arrayBuffer()).byteLength>2_000_000)fail('custody_request_too_large');
}
export function describeWildsResourceSourceArchivePageV128(value:unknown):WildzMarketSourceArchiveReferenceV128{
 const page=value as WildsResourceSourceArchivePageV128;
 if(!fields(page,'predecessorPage,schema,sourceArtifacts')||page.schema!=='wildz.resource-source-page.v128'||!Array.isArray(page.sourceArtifacts)
  ||!page.sourceArtifacts.length||page.sourceArtifacts.length>WILDS_RESOURCE_SOURCE_TAIL_COUNT_V128||size(page)>PAGE_BYTES
  ||page.sourceArtifacts.some(source=>!source||source.schema!=='wildz.market-source-original-reference.v128'))fail('archive_page_invalid');
 page.sourceArtifacts.forEach(assertWildzMarketSourceOriginalReferenceV128);
 if(page.predecessorPage!==null)assertReference(page.predecessorPage);
 return {digest:sha256PortableBasis(canonicalPortableCardJson(page)).slice(7),count:page.sourceArtifacts.length};
}
function readArchivePage(value:unknown,reference:WildzMarketSourceArchiveReferenceV128){
 assertReference(reference);const actual=describeWildsResourceSourceArchivePageV128(value);
 if(actual.digest!==reference.digest||actual.count!==reference.count)fail('archive_digest');return value as WildsResourceSourceArchivePageV128;
}
type PublishPage=(page:WildsResourceSourceArchivePageV128,reference:WildzMarketSourceArchiveReferenceV128)=>Promise<void>;
type PublishBytes=(page:WildzMarketSourceBytesPageV128,reference:WildzMarketSourceBytesReferenceV128)=>Promise<void>;
/** Archive references are byte transport, never checkpoints or authority. */
export async function compactWildsResourceSourceProofV128(proof:WildsResourceSourceProofV128,publishPage:PublishPage,publishBytes:PublishBytes):Promise<WildsResourceSourceProofV128>{
 const archivePages=proof.archivePages??[];if(!Array.isArray(archivePages)||archivePages.length>1)fail('reference_invalid');
 let predecessorPage=archivePages[0]??null;if(predecessorPage)assertReference(predecessorPage);
 const remaining=[...proof.sourceArtifacts];assertWildsResourceSourceArchiveCapacityV128(remaining);
 while(remaining.length>WILDS_RESOURCE_SOURCE_TAIL_COUNT_V128||remaining.reduce((total,source)=>total+source.exactBytesB64u.length,0)>TAIL_BYTES){
  const count=Math.min(WILDS_RESOURCE_SOURCE_TAIL_COUNT_V128,remaining.length-1);if(count<1)fail('original_too_large');
  const sourceArtifacts:WildzMarketSourceOriginalReferenceV128[]=[];
  for(const source of remaining.slice(0,count))sourceArtifacts.push(await locateWildzMarketSourceOriginalV128(source,publishBytes));
  const page:WildsResourceSourceArchivePageV128={schema:'wildz.resource-source-page.v128',predecessorPage,sourceArtifacts},reference=describeWildsResourceSourceArchivePageV128(page);
  await publishPage(page,reference);predecessorPage=reference;remaining.splice(0,count);
 }
 return {...proof,archivePages:predecessorPage?[predecessorPage]:[],sourceArtifacts:remaining};
}
export async function* iterateWildsResourceSourceOriginalsV128(proof:WildsResourceSourceProofV128,readPage:(reference:WildzMarketSourceArchiveReferenceV128|WildzMarketSourceBytesReferenceV128)=>Promise<unknown>){
 const ordered:WildzMarketSourceArchiveReferenceV128[]=[],seen=new Set<string>(),archivePages=proof.archivePages??[];
 if(!Array.isArray(archivePages)||archivePages.length>1||!Array.isArray(proof.sourceArtifacts)||!proof.sourceArtifacts.length)fail('source_proof_invalid');
 let reference=archivePages[0]??null;
 while(reference){assertReference(reference);if(seen.has(reference.digest))fail('reference_invalid');seen.add(reference.digest);
  const page=readArchivePage(await readPage(reference),reference);ordered.push(reference);reference=page.predecessorPage;}
 for(const locator of ordered.reverse()){
  const page=readArchivePage(await readPage(locator),locator);
  for(const source of page.sourceArtifacts)yield await restoreWildzMarketSourceOriginalV128(source,readPage);
 }
 // Historical inline proofs remain valid. Their complete input is bounded by
 // the caller before native opening; no lifetime event-count cap is imposed.
 for(const source of proof.sourceArtifacts)yield source;
}
export async function restoreWildsResourceSourceReferenceV128(sdk:ReceizClient,value:unknown,sourceUrl=WILDS_RESOURCE_SOURCE_URL_V128):Promise<WildsResourceSourceProofV128>{
 if(sourceUrl!==WILDS_RESOURCE_SOURCE_URL_V128)fail('locator_invalid');
 const proof=value as WildsResourceSourceReferenceV128;
 if(!fields(proof,'archivePages,custodyArtifact,schema,sourceArtifacts')||proof.schema!=='wildz.resource-source-reference.v128'
  ||!Array.isArray(proof.archivePages)||proof.archivePages.length>1||!Array.isArray(proof.sourceArtifacts)||!proof.sourceArtifacts.length||proof.sourceArtifacts.length>WILDS_RESOURCE_SOURCE_TAIL_COUNT_V128||size(proof)>PAGE_BYTES)fail('source_reference_invalid');
 proof.archivePages.forEach(assertReference);
 const read=async(reference:WildzMarketSourceBytesReferenceV128)=>{const located=await sdk.publicStore.restoreLatest({url:`${sourceUrl}/pages/${reference.digest}`,tenantHost:new URL(sourceUrl).host});
  const row=located.storeStateRecord;if(row?.schema!=='wildz.resource-source-page-locator.v128'||!row.page)fail('bytes_page_missing');return row.page;};
 const custodyArtifact=await restoreWildzMarketSourceOriginalV128(proof.custodyArtifact,read),sourceArtifacts:ReceizPortableSealedArtifactV124[]=[];let total=0;
 for(const reference of proof.sourceArtifacts){total+=reference.exactBytesB64uLength;if(total>TAIL_BYTES)fail('source_reference_invalid');sourceArtifacts.push(await restoreWildzMarketSourceOriginalV128(reference,read));}
 return {schema:'wildz.resource-source-proof.v128',custodyArtifact,archivePages:proof.archivePages,sourceArtifacts};
}
export async function readWildsResourceLocatedProofV128(sdk:ReceizClient,sourceUrl=WILDS_RESOURCE_SOURCE_URL_V128){
 if(sourceUrl!==WILDS_RESOURCE_SOURCE_URL_V128)fail('locator_invalid');
 const result=await sdk.publicStore.restoreLatest({url:sourceUrl,tenantHost:new URL(sourceUrl).host}),row=result.storeStateRecord;
 if(!row)return null;if(row.schema!=='wildz.resource-source-locator.v128'||!row.proof)fail('locator_invalid');
 const proof=row.proof as unknown as WildsResourceSourceProofV128;
 return proof.schema==='wildz.resource-source-proof.v128'?proof:restoreWildsResourceSourceReferenceV128(sdk,proof,sourceUrl);
}
export function createWildsResourceSourceArchiveLocatorV128(input:Readonly<{sdk:ReceizClient;authority:WildsResourceSourceAuthorV128;sourceUrl:string}>):WildsResourceSourceLocatorV128{
 const url=new URL(input.sourceUrl);if(url.toString()!==WILDS_RESOURCE_SOURCE_URL_V128)fail('locator_invalid');
 const publish=async(sourceUrl:string,storeStateRecord:Record<string,unknown>,idempotencyKey:string)=>{
  const signed=await input.sdk.publicStore.signPublish({tenantHost:url.host,merchantReceizId:input.authority.ownerReceizId,sourceUrl,namespace:WILDS_RESOURCE_NAMESPACE_V128,
   title:'Wildz resource source Originals',platform:'Wildz',projectionState:'published',storeStateRecord:JSON.parse(canonicalizeReceizV122(storeStateRecord)),keyFile:input.authority.keyFile,
   ...(input.authority.passphrase===undefined?{}:{passphrase:input.authority.passphrase})});
  if(new TextEncoder().encode(JSON.stringify({path:'/api/public-proof/registry/feed',query:'',method:'POST',body:signed})).length>2_000_000)fail('locator_request_too_large');
  await input.sdk.publicStore.publishSigned(signed,{idempotencyKey});
  const restored=await input.sdk.publicStore.restoreLatest({url:sourceUrl,tenantHost:url.host});
  if(canonicalizeReceizV122(restored.storeStateRecord)!==canonicalizeReceizV122(storeStateRecord))fail('locator_readback_unconfirmed');
 };
 const publishBytes:PublishBytes=(page,reference)=>publish(`${url.toString()}/pages/${reference.digest}`,{schema:'wildz.resource-source-page-locator.v128',page},`wildz:resource-archive:${reference.digest}`);
 const compact=(proof:WildsResourceSourceProofV128)=>compactWildsResourceSourceProofV128(proof,(page,reference)=>publish(`${url.toString()}/pages/${reference.digest}`,{schema:'wildz.resource-source-page-locator.v128',page},`wildz:resource-archive:${reference.digest}`),publishBytes);
 const reference=async(proof:WildsResourceSourceProofV128):Promise<WildsResourceSourceReferenceV128>=>{
  const tail=await compact(proof),custodyArtifact=await locateWildzMarketSourceOriginalV128(tail.custodyArtifact,publishBytes),sourceArtifacts:WildzMarketSourceOriginalReferenceV128[]=[];
  for(const source of tail.sourceArtifacts)sourceArtifacts.push(await locateWildzMarketSourceOriginalV128(source,publishBytes));
  return {schema:'wildz.resource-source-reference.v128',custodyArtifact,archivePages:tail.archivePages??[],sourceArtifacts};
 };
 return {read:()=>readWildsResourceLocatedProofV128(input.sdk,url.toString()),compact,reference,
  async publish(proof){const located=await reference(proof);await publish(url.toString(),{schema:'wildz.resource-source-locator.v128',proof:located},`wildz:resource-locator:${proof.custodyArtifact.artifactSha256}`);}};
}
