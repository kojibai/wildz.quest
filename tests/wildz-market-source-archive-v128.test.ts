import assert from 'node:assert/strict';import {test} from 'node:test';
import type {ReceizPortableSealedArtifactV124} from '@receiz/sdk';
async function archive(){const m=await import('../src/lib/receiz/wildz-market-source-archive-v128').catch(()=>null);assert.ok(m,'bounded immutable source archive required');return m;}
const original=(n:number):ReceizPortableSealedArtifactV124=>({schema:'receiz.sealed-artifact-bytes.v124',artifactSha256:n.toString(16).padStart(64,'0'),payloadSha256:'a'.repeat(64),exactBytesB64u:'eA',filename:'diagnostic.receizbundle',mimeType:'application/vnd.receiz.bundle+json'});
test('archive pages bind exact original order and reject hash tampering or partial reads',async()=>{const m=await archive(),sources=[original(1),original(2),original(3)],page=m.createWildzMarketSourceArchivePageV128(sources),ref=m.describeWildzMarketSourceArchivePageV128(page);
 assert.deepEqual(m.readWildzMarketSourceArchivePageV128(page,ref),sources);
 assert.throws(()=>m.readWildzMarketSourceArchivePageV128({...page,sourceArtifacts:[...sources].reverse()},ref),/archive_digest/);
 assert.throws(()=>m.readWildzMarketSourceArchivePageV128({...page,sourceArtifacts:sources.slice(1)},ref),/archive_digest|archive_count/);
 assert.throws(()=>m.readWildzMarketSourceArchivePageV128({...page,sourceArtifacts:[{...sources[0],exactBytesB64u:'eQ'},...sources.slice(1)]},ref),/archive_digest/);
});
test('archive compaction keeps bounded current tail while retaining every exact predecessor page',async()=>{const m=await archive(),written:unknown[]=[],sources=Array.from({length:70},(_,n)=>original(n+1));
 const compact=await m.compactWildzMarketSourceProofV128({schema:'wildz.market-source-proof.v128',custodyArtifact:original(999),archivePages:[],sourceArtifacts:sources},async(page,ref)=>{written.push({page,ref});});
 assert.equal(compact.sourceArtifacts.length<=32,true);assert.equal(compact.archivePages.length,1);assert.equal(written.length,2);
 const reopened=[];for await(const value of m.iterateWildzMarketSourceOriginalsV128(compact,async ref=>{const found=written.find(value=>(value as {ref:{digest:string}}).ref.digest===ref.digest) as {page:unknown};return found.page;}))reopened.push(value);
 assert.deepEqual(reopened,sources);assert.equal(new TextEncoder().encode(JSON.stringify(compact)).length<20_000,true);
});
test('stream rejects substituted archive locator count before admitting any missing suffix',async()=>{const m=await archive(),page=m.createWildzMarketSourceArchivePageV128([original(1)]),ref=m.describeWildzMarketSourceArchivePageV128(page),proof={schema:'wildz.market-source-proof.v128' as const,custodyArtifact:original(2),archivePages:[{...ref,count:2}],sourceArtifacts:[original(2)]};
 await assert.rejects(async()=>{for await(const _value of m.iterateWildzMarketSourceOriginalsV128(proof,async()=>page)){void _value;}},/archive_count/);
});


test('archive capacity rejects an overlarge Original before any page publication',async()=>{const m=await archive();let writes=0;
 const source={...original(1),exactBytesB64u:'A'.repeat(m.WILDZ_MARKET_SOURCE_PAGE_BYTES_V128)};
 await assert.rejects(m.compactWildzMarketSourceProofV128({schema:'wildz.market-source-proof.v128',custodyArtifact:original(3),archivePages:[],sourceArtifacts:[original(2),source]},async()=>{writes++;}),/archive_original_too_large/);
 assert.equal(writes,0);
});
