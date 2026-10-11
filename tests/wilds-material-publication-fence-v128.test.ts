import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMemoryWildzContinuityDatabase} from './support/memory-wildz-continuity-database';
import {createWildsResourceSourceRecoveryStoreV128} from '../src/lib/receiz/wilds-resource-source-client-v128';
import {rejectUnpreparedWildsMaterialV128} from '../src/lib/receiz/wilds-material-publication-fence-v128';
import type {WildsResourceGameplayCommandV128} from '../src/lib/receiz/wilds-resource-gameplay-v128';
const owner='alice.receiz.id';
// Store-boundary data only: no claim of native acceptance or artifact validation.
const command={kind:'world',command:{type:'material.cache.take',commandId:'material:test-one'},kaiUPulse:1} as unknown as Extract<WildsResourceGameplayCommandV128,{kind:'world'}>;
const preparation=(attemptId:string)=>({schema:'wildz.resource-source-attempt.v128',ownerReceizId:owner,attemptId,requestDigest:'immutable-request',idempotencyKey:'fixed',preparation:{},predecessorArtifact:null,sourceArtifact:null}) as Parameters<ReturnType<typeof createWildsResourceSourceRecoveryStoreV128>['reserve']>[0];
for(const route of ['material-replay:','material-use:']){
 test(`${route} two stores: rejection wins transaction before concurrent reserve`,async()=>{
  const db=createMemoryWildzContinuityDatabase(),tabA=createWildsResourceSourceRecoveryStoreV128(db),tabB=createWildsResourceSourceRecoveryStoreV128(db);
  const [rejection,reserve]=await Promise.allSettled([rejectUnpreparedWildsMaterialV128(db,owner,command),tabB.reserve(preparation(route+command.command.commandId))]);
  assert.deepEqual(rejection,{status:'fulfilled',value:true});assert.equal(reserve.status,'rejected');
  assert.equal(await tabA.read(owner,route+command.command.commandId),null);
  assert.equal(await rejectUnpreparedWildsMaterialV128(db,owner,command),true);
  await assert.rejects(tabA.reserve(preparation(route+command.command.commandId)),/cancelled/);
  await tabB.reserve(preparation(route+'material:valid-next'));
 });
 test(`${route} two stores: concurrent preparation wins and can never be abandoned`,async()=>{
  const db=createMemoryWildzContinuityDatabase(),tabA=createWildsResourceSourceRecoveryStoreV128(db),tabB=createWildsResourceSourceRecoveryStoreV128(db),value=preparation(route+command.command.commandId);
  const [reserve,rejected]=await Promise.all([tabA.reserve(value),rejectUnpreparedWildsMaterialV128(db,owner,command)]);
  assert.equal(rejected,false);assert.deepEqual(await tabB.reserve(value),reserve);
  assert.equal(await rejectUnpreparedWildsMaterialV128(db,owner,command),false);
 });
}
test('durable accepted result independently prevents rejection; exact fence mismatch fails closed',async()=>{
 const db=createMemoryWildzContinuityDatabase();
 await db.transaction(['meta'],'readwrite',tx=>tx.put('meta',{after:{proof:'retained'}},JSON.stringify(['wildz.resource-exchange-attempt.v128',owner,'material-replay:'+command.command.commandId])));
 assert.equal(await rejectUnpreparedWildsMaterialV128(db,owner,command),false);
 const fresh=createMemoryWildzContinuityDatabase();assert.equal(await rejectUnpreparedWildsMaterialV128(fresh,owner,command),true);
 await assert.rejects(rejectUnpreparedWildsMaterialV128(fresh,owner,{...command,kaiUPulse:2}),/conflict/);
});
test('nonmaterial source reservations retain existing semantics',async()=>{
 const db=createMemoryWildzContinuityDatabase(),store=createWildsResourceSourceRecoveryStoreV128(db),value=preparation('ordinary:source-attempt');
 await rejectUnpreparedWildsMaterialV128(db,owner,command);assert.deepEqual(await store.reserve(value),value);assert.deepEqual(await store.reserve(value),value);
});
