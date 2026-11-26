import {receizBase64UrlDecode,receizBase64UrlEncode,sha256ReceizBytes,type ReceizPortableSealedArtifactV124} from '@receiz/sdk';
import {canonicalPortableCardJson,sha256PortableBasis} from '../../features/play/portable-card';

export const WILDZ_MARKET_SOURCE_BYTES_PART_V128=192*1024;
export const WILDZ_MARKET_SOURCE_ORIGINAL_TEXT_BYTES_V128=8*1024*1024;
const CONCURRENT_PARTS=4;
export type WildzMarketSourceBytesPageV128=Readonly<{schema:'wildz.market-source-bytes-page.v128';part:string}>;
export type WildzMarketSourceBytesReferenceV128=Readonly<{digest:string}>;
export type WildzMarketSourceOriginalReferenceV128=Readonly<{
 schema:'wildz.market-source-original-reference.v128';artifactSha256:string;payloadSha256:string;
 filename:string;mimeType:string;exactBytesB64uLength:number;chunks:readonly WildzMarketSourceBytesReferenceV128[];
}>;
const sha=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fields=(value:unknown,wanted:string)=>!!value&&typeof value==='object'&&Object.keys(value).sort().join()===wanted;
function fail(reason:string):never{throw Error(`wildz_market_source_${reason}`);}
function metadata(value:{artifactSha256:string;payloadSha256:string;filename:string;mimeType:string}){
 if(!sha(value.artifactSha256)||!sha(value.payloadSha256)||typeof value.filename!=='string'||!value.filename||value.filename.length>240
  ||typeof value.mimeType!=='string'||!value.mimeType||value.mimeType.length>120||/[\u0000-\u001f\u007f]/.test(value.filename+value.mimeType))fail('original_invalid');
}
export function describeWildzMarketSourceBytesPageV128(value:unknown):WildzMarketSourceBytesReferenceV128{
 const page=value as WildzMarketSourceBytesPageV128;
 if(!fields(page,'part,schema')||page.schema!=='wildz.market-source-bytes-page.v128'||typeof page.part!=='string'||!page.part.length
  ||page.part.length>WILDZ_MARKET_SOURCE_BYTES_PART_V128||!/^[A-Za-z0-9_-]+$/.test(page.part))fail('bytes_page_invalid');
 return {digest:sha256PortableBasis(canonicalPortableCardJson(page)).slice(7)};
}
export function assertWildzMarketSourceOriginalReferenceV128(input:unknown){
 const value=input as WildzMarketSourceOriginalReferenceV128;
 if(!fields(value,'artifactSha256,chunks,exactBytesB64uLength,filename,mimeType,payloadSha256,schema')
  ||value.schema!=='wildz.market-source-original-reference.v128')fail('original_reference_invalid');
 metadata(value);
 if(!Number.isSafeInteger(value.exactBytesB64uLength)||value.exactBytesB64uLength<2||value.exactBytesB64uLength>WILDZ_MARKET_SOURCE_ORIGINAL_TEXT_BYTES_V128
  ||value.exactBytesB64uLength%4===1||!Array.isArray(value.chunks)||value.chunks.length!==Math.ceil(value.exactBytesB64uLength/WILDZ_MARKET_SOURCE_BYTES_PART_V128)
  ||value.chunks.some(chunk=>!fields(chunk,'digest')||!sha(chunk.digest)))fail('original_reference_invalid');
}
async function assertOriginal(source:ReceizPortableSealedArtifactV124){
 if(!fields(source,'artifactSha256,exactBytesB64u,filename,mimeType,payloadSha256,schema')||source.schema!=='receiz.sealed-artifact-bytes.v124'
  ||typeof source.exactBytesB64u!=='string'||source.exactBytesB64u.length<2||source.exactBytesB64u.length>WILDZ_MARKET_SOURCE_ORIGINAL_TEXT_BYTES_V128
  ||source.exactBytesB64u.length%4===1||!/^[A-Za-z0-9_-]+$/.test(source.exactBytesB64u))fail('original_invalid');
 metadata(source);const bytes=receizBase64UrlDecode(source.exactBytesB64u);
 if(receizBase64UrlEncode(bytes)!==source.exactBytesB64u||await sha256ReceizBytes(bytes)!==source.artifactSha256)fail('original_digest');
}
async function transferParts<Part,Result>(parts:readonly Part[],transfer:(part:Part,index:number)=>Promise<Result>){
 const result:Result[]=[];
 for(let start=0;start<parts.length;start+=CONCURRENT_PARTS){
  result.push(...await Promise.all(parts.slice(start,start+CONCURRENT_PARTS).map((part,index)=>transfer(part,start+index))));
 }
 return result;
}
/** Content locators carry no authority. Reconstruct the exact native Original,
 * then its consumer must independently SDK-open it and replay all predecessors. */
export async function locateWildzMarketSourceOriginalV128(source:ReceizPortableSealedArtifactV124,publish:(page:WildzMarketSourceBytesPageV128,reference:WildzMarketSourceBytesReferenceV128)=>Promise<void>):Promise<WildzMarketSourceOriginalReferenceV128>{
 await assertOriginal(source);
 const pages=Array.from({length:Math.ceil(source.exactBytesB64u.length/WILDZ_MARKET_SOURCE_BYTES_PART_V128)},(_,index):WildzMarketSourceBytesPageV128=>{
  const offset=index*WILDZ_MARKET_SOURCE_BYTES_PART_V128;
  return {schema:'wildz.market-source-bytes-page.v128',part:source.exactBytesB64u.slice(offset,offset+WILDZ_MARKET_SOURCE_BYTES_PART_V128)};
 });
 const chunks=await transferParts(pages,async page=>{
  const reference=describeWildzMarketSourceBytesPageV128(page);await publish(page,reference);return reference;
 });
 return {schema:'wildz.market-source-original-reference.v128',artifactSha256:source.artifactSha256,payloadSha256:source.payloadSha256,filename:source.filename,mimeType:source.mimeType,exactBytesB64uLength:source.exactBytesB64u.length,chunks};
}
export async function restoreWildzMarketSourceOriginalV128(value:unknown,read:(reference:WildzMarketSourceBytesReferenceV128)=>Promise<unknown>):Promise<ReceizPortableSealedArtifactV124>{
 const reference=value as WildzMarketSourceOriginalReferenceV128;assertWildzMarketSourceOriginalReferenceV128(reference);
 const parts=await transferParts(reference.chunks,async (chunk,index)=>{
  const page=await read(chunk) as WildzMarketSourceBytesPageV128;
  if(describeWildzMarketSourceBytesPageV128(page).digest!==chunk.digest)fail('bytes_page_digest');
  if(page.part.length!==Math.min(WILDZ_MARKET_SOURCE_BYTES_PART_V128,reference.exactBytesB64uLength-index*WILDZ_MARKET_SOURCE_BYTES_PART_V128))fail('original_length');
  return page.part;
 });
 const source:ReceizPortableSealedArtifactV124={schema:'receiz.sealed-artifact-bytes.v124',artifactSha256:reference.artifactSha256,payloadSha256:reference.payloadSha256,filename:reference.filename,mimeType:reference.mimeType,exactBytesB64u:parts.join('')};
 await assertOriginal(source);return source;
}
