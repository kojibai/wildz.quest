import assert from 'node:assert/strict';
import {test} from 'node:test';
import {creatureForm} from '../src/features/play/creature-catalog';
import {deriveKaiKlokMomentFromUPulse} from '../src/features/play/kai-klok-moment';
import {discoverLivingCreature} from '../src/features/play/living-taxonomy';
import {sealCollectedCard,sealDiscoveredCard} from '../src/features/play/portable-card';
import {calculateWildzMarketLocalValueV129 as calculate} from '../src/features/market/wildz-market-value-local-v129';
import {computeIntrinsicUnsigned} from '@receiz/sdk/valuation';

// The direct SDK output for this carried origin/beat/step at pulse 14063111 is
// 23.964596153100075 Phi. This fixture catches uPulse-as-pulse inflation and
// changed/default-invented craft, creator or reputation inputs.
const owner='local-value.receiz.id',capturedAt='2026-08-23T22:45:39.818Z';
const identity=discoverLivingCreature({encounterId:'local-value:discovery',form:creatureForm('pearlbeak-1')!,
 discoveredAt:'2026-08-23T22:45:33.624Z',location:{x:0,z:0},ownerScope:owner,
 moment:deriveKaiKlokMomentFromUPulse({uPulse:13789277000570,authority:'world'})});
const card=sealDiscoveredCard({identity,formId:'pearlbeak-1',ownerReceizId:owner,capturedAt});
const evaluation={valuationKaiUPulse:'14063111123456',usdPerPhiMicrocents:'100000000'};
test('SDK local card calculation preserves exact discovery uPulse and deterministic Phi/USD',async()=>{
 const result=await calculate(card,evaluation);
 assert.equal(result.status,'ready');if(result.status!=='ready')return;
 const value=result.value;
 assert.equal(value.originKaiUPulse,'13789277000570');assert.equal(value.originKaiPulse,'13789277');
 assert.equal(value.valuationKaiUPulse,'14063111123456');assert.equal(value.proofValuePhiMicro,'23964596');
 assert.equal(value.displayUsdCents,'2396');assert.equal(value.valueSource,'local-card-model');
 assert.equal(value.proofArtifactDigest,undefined);assert.equal(value.sdkProjection,undefined);
 assert.equal(value.samples.length,32);assert.equal(value.samples.at(-1)!.kaiUPulse,evaluation.valuationKaiUPulse);
 assert.ok(value.replay);const replay=JSON.parse(value.replay.json);
 assert.equal(replay.schema,'wildz.local-card-value-replay.v129');assert.equal(replay.writesPerformed,0);
 assert.equal(replay.inputs.metadata.kaiPulse,13789277);
 for(const [field,expected] of [['seriesSize',1],['quality','med'],['creatorVerified',false],['creatorRep',0]]){
  const item=replay.inputs.appliedDefaults.find((row:{field:string})=>row.field===field);
  assert.equal(item.value,expected);assert.equal(item.authority,'reproducibility-only');
 }
 assert.match(replay.rounding.numberSemantics,/binary64/);
 // Replay the public numerical inputs directly through the installed SDK.
 // This catches interpolation or values that differ from the actual SDK law.
 for(const sample of replay.samples){
  const original=computeIntrinsicUnsigned(replay.inputs.metadata,Number(BigInt(sample.kaiUPulse)/1_000_000n));
  assert.equal(String(Math.round(original.unsigned.valuePhi*1_000_000)),sample.phiMicro);
 }
 assert.deepEqual(await calculate(card,evaluation),result);
});

test('legacy birth uses its sealed timestamp and USD absence keeps a ready Phi projection',async()=>{
 const legacy=sealCollectedCard({formId:'mintcub-1',ownerReceizId:owner,encounterId:'local-value:legacy',capturedAt});
 const result=await calculate(legacy,{valuationKaiUPulse:evaluation.valuationKaiUPulse});
 assert.equal(result.status,'ready');if(result.status!=='ready')return;
 assert.equal(result.value.originKaiUPulse,'13789278183603');assert.equal(result.value.originKaiPulse,'13789278');
 assert.equal(result.value.displayUsdCents,null);assert.notEqual(result.value.proofValuePhiMicro,'0');
 assert.ok(result.value.localModel);assert.equal(result.value.localModel.source.originKind,'sealed-birth-timestamp-projection');
 assert.ok(!result.value.localModel.appliedDefaults.some(row=>row.field==='originPulse'));
});

test('local model refuses altered card evidence, pre-origin evaluation and malformed held USD rate',async()=>{
 const altered=structuredClone(card);altered.manifest.capturedAt='2026-10-01T00:00:00.000Z';
 assert.equal((await calculate(altered,evaluation)).status,'unavailable');
 assert.equal((await calculate(card,{valuationKaiUPulse:'13789277000569'})).status,'unavailable');
 assert.equal((await calculate(card,{...evaluation,usdPerPhiMicrocents:'0'})).status,'unavailable');
});
