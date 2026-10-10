import assert from 'node:assert/strict';
import {test} from 'node:test';
import {receizBase64UrlEncode,sha256ReceizBytes,type ReceizPortableSealedArtifactV124} from '@receiz/sdk';
async function locator(){const m=await import('../src/lib/receiz/wildz-market-source-original-locator-v128').catch(()=>null);assert.ok(m,'bounded lossless native Original locator required');return m;}
async function original(size=500_000):Promise<ReceizPortableSealedArtifactV124>{const bytes=new Uint8Array(size).map((_,i)=>i%251);return {schema:'receiz.sealed-artifact-bytes.v124',artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:'a'.repeat(64),filename:'diagnostic.receizbundle',mimeType:'application/vnd.receiz.bundle+json',exactBytesB64u:receizBase64UrlEncode(bytes)};}
test('byte pages reconstruct the exact native Original without relabeling any bytes',async()=>{
 const m=await locator(),source=await original(),pages=new Map<string,unknown>();
 const reference=await m.locateWildzMarketSourceOriginalV128(source,async(page,ref)=>{pages.set(ref.digest,page);});
 assert.ok(pages.size>2);assert.equal('exactBytesB64u' in reference,false);
 assert.deepEqual(await m.restoreWildzMarketSourceOriginalV128(reference,async ref=>pages.get(ref.digest)),source);
});
test('byte locator rejects substituted, missing, reordered and extra Original parts',async()=>{
 const m=await locator(),source=await original(),pages=new Map<string,unknown>();
 const reference=await m.locateWildzMarketSourceOriginalV128(source,async(page,ref)=>{pages.set(ref.digest,page);});
 await assert.rejects(m.restoreWildzMarketSourceOriginalV128(reference,async()=>({schema:'wildz.market-source-bytes-page.v128',part:'eA'})),/bytes_page_digest/);
 await assert.rejects(m.restoreWildzMarketSourceOriginalV128(reference,async()=>null),/bytes_page_invalid/);
 await assert.rejects(m.restoreWildzMarketSourceOriginalV128({...reference,chunks:[reference.chunks[1]!,reference.chunks[0]!,...reference.chunks.slice(2)]},async ref=>pages.get(ref.digest)),/original_digest/);
 await assert.rejects(m.restoreWildzMarketSourceOriginalV128({...reference,chunks:[...reference.chunks,reference.chunks[0]!]},async ref=>pages.get(ref.digest)),/original_reference_invalid|original_length/);
});
test('Original capacity and content are checked before any public page write',async()=>{
 const m=await locator(),source=await original(1);let writes=0;
 await assert.rejects(m.locateWildzMarketSourceOriginalV128({...source,exactBytesB64u:'A'.repeat(m.WILDZ_MARKET_SOURCE_ORIGINAL_TEXT_BYTES_V128+1)},async()=>{writes++;}),/original_invalid/);
 await assert.rejects(m.locateWildzMarketSourceOriginalV128({...source,artifactSha256:'f'.repeat(64)},async()=>{writes++;}),/original_digest/);
 assert.equal(writes,0);
});
