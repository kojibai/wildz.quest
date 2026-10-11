import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalizeReceizV122,receizBase64UrlEncode,sha256ReceizBytes} from '@receiz/sdk';
import {paidClearanceTrace,clearanceFixtureOriginal} from './support/clearance-source-fixture';
import {createHash} from 'node:crypto';

const modulePath='../src/lib/receiz/wilds-resource-event-codec-v128.js';
const codecModule=()=>import(modulePath);
const fixture=paidClearanceTrace().then(f=>({schema:'wildz.resource-command.v128',kind:'replay',attemptId:'codec:paid-fixture',ownerReceizId:'alice.receiz.id',gameplayOwnerId:'explorer',commands:f.commands}));
const bytes=(value:unknown)=>new TextEncoder().encode(canonicalizeReceizV122(value));
async function compress(value:Uint8Array){return new Uint8Array(await new Response(new Blob([value.slice().buffer]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());}

test('versioned transport losslessly compresses a full paid trace while legacy literal bytes remain exact',async()=>{
 const m=await codecModule(),event=await fixture,encoded=await m.encodeWildsResourceEventV128(event);
 assert.equal(encoded.schema,'wildz.resource-event-bytes.v2');assert.equal(encoded.codecHead,m.WILDS_RESOURCE_EVENT_CODEC_HEAD_V128);
 assert.deepEqual(await m.decodeWildsResourceEventV128(encoded),event);
 assert.ok(bytes(encoded).length<bytes(event).length/3);
 const legacy={...event,commands:[]};assert.deepEqual(await m.encodeWildsResourceEventV128(legacy),legacy);
 assert.equal(canonicalizeReceizV122(await m.decodeWildsResourceEventV128(legacy)),canonicalizeReceizV122(legacy));
});
test('closed codec binds exact digest, length, algorithm, head and canonical raw event bytes',async()=>{
 const m=await codecModule(),event=await fixture,encoded=await m.encodeWildsResourceEventV128(event);
 for(const changed of [{...encoded,decodedSha256:'0'.repeat(64)},{...encoded,decodedByteLength:1},{...encoded,codec:'gzip'},{...encoded,codecHead:`sha256:${'a'.repeat(64)}`},{...encoded,extra:true},{...encoded,bytesB64u:'*'}])await assert.rejects(m.decodeWildsResourceEventV128(changed));
 const noncanonical=new TextEncoder().encode(JSON.stringify(event,null,2)),literal=bytes(event);
 const v1={schema:'wildz.resource-event-bytes.v1',codec:'deflate',codecHead:m.WILDS_RESOURCE_EVENT_CODEC_V1_HEAD_V128,decodedByteLength:literal.length,decodedSha256:await sha256ReceizBytes(literal),bytesB64u:receizBase64UrlEncode(await compress(literal))};
 assert.deepEqual(await m.decodeWildsResourceEventV128(v1),event,'retained v1 event remains independently readable');
 await assert.rejects(m.decodeWildsResourceEventV128({...v1,decodedByteLength:noncanonical.length,decodedSha256:await sha256ReceizBytes(noncanonical),bytesB64u:receizBase64UrlEncode(await compress(noncanonical))}),/canonical/);
});
test('declared oversize and decompression expansion cannot allocate an accepted unbounded event',async()=>{
 const m=await codecModule(),encoded=await m.encodeWildsResourceEventV128(await fixture);
 await assert.rejects(m.decodeWildsResourceEventV128({...encoded,decodedByteLength:m.WILDS_RESOURCE_EVENT_MAX_BYTES_V128+1}),/size/);
 const expansion=new Uint8Array(m.WILDS_RESOURCE_EVENT_MAX_BYTES_V128+1).fill(65),compressed=await compress(expansion);
 assert.ok(compressed.length<32*1024);
 await assert.rejects(m.decodeWildsResourceEventV128({...encoded,decodedByteLength:m.WILDS_RESOURCE_EVENT_MAX_BYTES_V128,bytesB64u:receizBase64UrlEncode(compressed)}),/size/);
});
test('codec envelope cannot opt legacy commands into changed semantics',async()=>{
 const m=await codecModule(),encoded=await m.encodeWildsResourceEventV128(await fixture),legacy={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'codec:legacy',ownerReceizId:'alice.receiz.id',gameplayOwnerId:'explorer',commands:[]},raw=bytes(legacy);
 const table=bytes({schema:'wildz.resource-event-text-table.v1',strings:[],parts:[new TextDecoder().decode(raw)]});
 await assert.rejects(m.decodeWildsResourceEventV128({...encoded,decodedByteLength:raw.length,decodedSha256:await sha256ReceizBytes(raw),tableByteLength:table.length,bytesB64u:receizBase64UrlEncode(await compress(table))}),/branch/);
});
test('string-table expansion checks indices, schema and expanded bound before joining',async()=>{
 const m=await codecModule(),encoded=await m.encodeWildsResourceEventV128(await fixture);
 for(const table of [{schema:'wildz.resource-event-text-table.v1',strings:['x'.repeat(2048)],parts:[0,0,0]},
  {schema:'wildz.resource-event-text-table.v1',strings:['x'],parts:[1]},
  {schema:'wildz.resource-event-text-table.v1',strings:['x'],parts:[-1]},
  {schema:'wildz.resource-event-text-table.v1',strings:['x'],parts:[0],extra:true}]){
  const raw=bytes(table);await assert.rejects(m.decodeWildsResourceEventV128({...encoded,decodedByteLength:2,tableByteLength:raw.length,bytesB64u:receizBase64UrlEncode(await compress(raw))}),/size|table/);
 }
});
test('unused or excessive table populations cannot allocate expansion bookkeeping',async()=>{
 const m=await codecModule(),event=await fixture,encoded=await m.encodeWildsResourceEventV128(event),literal=canonicalizeReceizV122(event);
 for(const strings of [Array.from({length:10000},()=> 'x'),['x'.repeat(1024)]]){
  const table=bytes({schema:'wildz.resource-event-text-table.v1',strings,parts:[literal]});
  await assert.rejects(m.decodeWildsResourceEventV128({...encoded,tableByteLength:table.length,bytesB64u:receizBase64UrlEncode(await compress(table))}),/table/);
 }
});
test('repeated long Original strings exceeding the DEFLATE window stay bounded and exact',async()=>{
 const original={...clearanceFixtureOriginal,exactBytesB64u:Buffer.concat(Array.from({length:1600},(_,i)=>createHash('sha256').update(`codec-long-original:${i}`).digest())).toString('base64url')};
 const f=await paidClearanceTrace({original:async()=>original}),event={...await fixture,commands:f.commands},m=await codecModule(),encoded=await m.encodeWildsResourceEventV128(event);
 assert.ok(bytes(encoded).length<100_000,`encoded repeated Original is ${bytes(encoded).length} bytes`);
 assert.deepEqual(await m.decodeWildsResourceEventV128(encoded),event);
});
