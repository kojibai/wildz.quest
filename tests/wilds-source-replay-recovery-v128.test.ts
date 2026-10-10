import assert from 'node:assert/strict';import {test} from 'node:test';
import type {ReceizClient} from '@receiz/sdk';
import {readWildsSourceReplayAfterV128} from '../src/lib/receiz/wilds-source-replay-recovery-v128';
const expected={applicationId:'wildz',domainId:'world:wildz:market:v128',afterHead:'b'.repeat(64),afterCursor:2,expectedRegistryDigest:'1'.repeat(64),expectedReducerDigest:'2'.repeat(64)};
test('cold source recovery primes each exact predecessor through native reads and never publishes',async()=>{
 const calls:Array<string|null>=[],held=new Set<string>();
 // Diagnostic SDK contract port only. Native SDK verification remains the
 // admission boundary; this does not invent production source custody.
 const sdk={domains:{verifiedReplayV124:async(value:{afterHead:string|null})=>{calls.push(value.afterHead);if(value.afterHead!==null&&!held.has(value.afterHead))throw Error('V124_DOMAINS_PREVIOUS_REPLAY_REQUIRED');
  const cursor=value.afterHead===null?1:value.afterHead==='a'.repeat(64)?2:3,head=String.fromCharCode(96+cursor).repeat(64);held.add(head);return {cursor,head,additions:[{}]};}},sources:{publishSealedSourceV124:async()=>assert.fail('read-only native recovery cannot publish')}} as unknown as ReceizClient;
 const result=await readWildsSourceReplayAfterV128(sdk,expected);assert.equal(result.head,'c'.repeat(64));assert.deepEqual(calls,['b'.repeat(64),null,'a'.repeat(64),'b'.repeat(64)]);
});
test('cold source recovery rejects a conflicting or partial actual predecessor without retrying mutation',async()=>{
 const sdk={domains:{verifiedReplayV124:async(value:{afterHead:string|null})=>{if(value.afterHead!==null)throw Error('V124_DOMAINS_PREVIOUS_REPLAY_REQUIRED');return {head:'x'.repeat(64),cursor:3,additions:[{}]};}}} as unknown as ReceizClient;
 await assert.rejects(readWildsSourceReplayAfterV128(sdk,expected),/predecessor_mismatch/);
 const unavailable={domains:{verifiedReplayV124:async()=>{throw Error('SDK_SOURCE_UNAVAILABLE');}}} as unknown as ReceizClient;
 await assert.rejects(readWildsSourceReplayAfterV128(unavailable,expected),/SDK_SOURCE_UNAVAILABLE/);
});
