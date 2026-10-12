import assert from 'node:assert/strict';
import {test} from 'node:test';
import {creatureForm} from '../src/features/play/creature-catalog';
import {deriveKaiKlokMomentFromUPulse} from '../src/features/play/kai-klok-moment';
import {discoverLivingCreature} from '../src/features/play/living-taxonomy';
import {sealCollectedCard,sealDiscoveredCard} from '../src/features/play/portable-card';
import {calculateWildzMarketLocalValueV129 as calculate} from '../src/features/market/wildz-market-value-local-v129';
import {computeIntrinsicUnsigned,SIGIL_VALUATION_ALGORITHM,SIGIL_VALUATION_POLICY_CHECKSUM} from '@receiz/sdk/valuation';
import {digestReceizCanonicalV122,quoteReceizDisplayUsdV122} from '@receiz/sdk';

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
 assert.equal(replay.modelAlgorithm,'wildz.local-card-value.sdk129-rarity.v1');
 assert.equal(replay.sdkProofValuePhiMicro,'23964596');
 assert.equal(replay.rarityAdjustment.rarity,'trail');
 assert.equal(replay.rarityAdjustment.rarityMultiplierBps,'10000');
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

const rarityCases=[
 {rarity:'trail',formId:'mintcub-1',bps:'10000',amount:'23964596',usd:'2396'},
 {rarity:'uncommon',formId:'voltray-1',bps:'12500',amount:'29955745',usd:'2996'},
 {rarity:'rare',formId:'aerobeak-1',bps:'15000',amount:'35946894',usd:'3595'},
 {rarity:'mythic',formId:'ledgerfox-1',bps:'20000',amount:'47929192',usd:'4793'},
 {rarity:'eternal',formId:'echobeak-1',bps:'30000',amount:'71893788',usd:'7189'}
] as const;
function rarityCard(formId:string){
 const discovered=discoverLivingCreature({encounterId:`local-value:rarity:${formId}`,form:creatureForm(formId)!,
  discoveredAt:'2026-08-23T22:45:33.624Z',location:{x:0,z:0},ownerScope:owner,
  moment:deriveKaiKlokMomentFromUPulse({uPulse:13789277000570,authority:'world'})});
 return sealDiscoveredCard({identity:discovered,formId,ownerReceizId:owner,capturedAt});
}

test('sealed rarity monotonically boosts the Wildz value and every SDK-based replay sample',async()=>{
 let previous=0n;
 for(const expected of rarityCases){
  const selected=rarityCard(expected.formId);
  assert.equal(selected.manifest.rarity,expected.rarity);
  const result=await calculate(selected,evaluation);
  assert.equal(result.status,'ready');if(result.status!=='ready')continue;
  const value=result.value,replay=JSON.parse(value.replay!.json);
  assert.equal(value.proofValuePhiMicro,expected.amount);assert.equal(value.displayUsdCents,expected.usd);
  assert.ok(BigInt(value.proofValuePhiMicro)>previous);previous=BigInt(value.proofValuePhiMicro);
  assert.equal(value.valueSource,'local-card-model');assert.equal(value.sdkProjection,undefined);
  assert.equal(value.algorithm,SIGIL_VALUATION_ALGORITHM);assert.equal(value.policyChecksum,SIGIL_VALUATION_POLICY_CHECKSUM);
  assert.equal(replay.algorithm,SIGIL_VALUATION_ALGORITHM);assert.equal(replay.policyChecksum,SIGIL_VALUATION_POLICY_CHECKSUM);
  assert.equal(replay.sdkProofValuePhiMicro,'23964596');
  assert.equal(replay.unsigned.valuePhi,23.964596153100075);
  assert.equal(replay.rarityAdjustment.sourceReference,'manifest.rarity');
  assert.equal(replay.rarityAdjustment.rarity,expected.rarity);
  assert.equal(replay.rarityAdjustment.rarityMultiplierBps,expected.bps);
  assert.equal(replay.modelPolicy.schema,'wildz.local-card-rarity-policy.v1');
  assert.equal(replay.modelPolicy.version,'1');
  assert.equal(replay.modelPolicy.authority,'wildz-display-model-only');
  assert.deepEqual(replay.modelPolicy.multipliersBps,{trail:'10000',uncommon:'12500',rare:'15000',mythic:'20000',eternal:'30000'});
  assert.match(replay.modelPolicyChecksum,/^[0-9a-f]{64}$/);
  assert.equal(replay.modelPolicyChecksum,await digestReceizCanonicalV122(replay.modelPolicy));
  assert.equal(replay.rarityAdjustment.policyChecksum,replay.modelPolicyChecksum);
  assert.deepEqual(replay.rarityAdjustment.policy,replay.modelPolicy);
  assert.equal(replay.modelPolicy.rounding.formula,'floor((sdkProofValuePhiMicro * rarityMultiplierBps + 5000) / 10000)');
  for(const sample of replay.samples){
   const sdk=computeIntrinsicUnsigned(replay.inputs.metadata,Number(BigInt(sample.kaiUPulse)/1_000_000n));
   const baseline=BigInt(Math.round(sdk.unsigned.valuePhi*1_000_000));
   const adjusted=((baseline*BigInt(expected.bps)+5000n)/10000n).toString();
   assert.equal(sample.phiMicro,adjusted);
   assert.equal(sample.usdCents,quoteReceizDisplayUsdV122(adjusted,evaluation.usdPerPhiMicrocents));
  }
  const baselineTerm=value.calculation.find(term=>term.id==='sdkProofValuePhiMicro')!;
  assert.equal(baselineTerm.result,'23964596');
  const rarityTerm=value.calculation.find(term=>term.id==='rarityMultiplierBps')!;
  assert.equal(rarityTerm.result,expected.bps);
  assert.equal(rarityTerm.operands.rarity,expected.rarity);
  const finalTerm=value.calculation.find(term=>term.id==='proofValuePhiMicro')!;
  assert.equal(finalTerm.result,expected.amount);
  assert.equal(finalTerm.operands.sdkProofValuePhiMicro,'23964596');
  assert.equal(finalTerm.operands.rarityMultiplierBps,expected.bps);
  assert.ok(finalTerm.sourceReferences.includes(replay.modelPolicyChecksum));
  assert.equal(value.samples.at(-1)!.phiMicro,value.proofValuePhiMicro);
  assert.deepEqual(await calculate(selected,evaluation),result);
 }
});

test('rarity uses integer half-up on SDK-rounded microPhi before USD conversion',async()=>{
 const rare=await calculate(rarityCard('aerobeak-1'),{...evaluation,valuationKaiUPulse:'14063113000000'});
 assert.equal(rare.status,'ready');if(rare.status!=='ready')return;
 // SDK 23.927515227506518 Phi -> 23927515 microPhi; 1.5x has an exact .5 remainder.
 assert.equal(rare.value.proofValuePhiMicro,'35891273');
 const eternal=await calculate(rarityCard('echobeak-1'),{...evaluation,valuationKaiUPulse:'14063112000000'});
 assert.equal(eternal.status,'ready');if(eternal.status!=='ready')return;
 // Rounding 3x the SDK float would be 71423563; the published rounded input gives 71423562.
 assert.equal(eternal.value.proofValuePhiMicro,'71423562');
 assert.equal(eternal.value.displayUsdCents,'7142');
});

test('a fresh identity needs no held Wallet rate to get deterministic USD from its sealed card',async()=>{
 const legacy=sealCollectedCard({formId:'mintcub-1',ownerReceizId:owner,encounterId:'local-value:legacy',capturedAt});
 const result=await calculate(legacy,{valuationKaiUPulse:evaluation.valuationKaiUPulse});
 assert.equal(result.status,'ready');if(result.status!=='ready')return;
 assert.equal(result.value.originKaiUPulse,'13789278183603');assert.equal(result.value.originKaiPulse,'13789278');
 assert.notEqual(result.value.displayUsdCents,null);assert.notEqual(result.value.proofValuePhiMicro,'0');
 // Receiz Wallet's original policy produces this rate at pulse 14063111;
 // this is an independent upstream vector, not a fixed app conversion.
 const rate='9158758842';
 assert.equal(result.value.displayUsdCents,quoteReceizDisplayUsdV122(result.value.proofValuePhiMicro,rate));
 const replay=JSON.parse(result.value.replay!.json);
 assert.equal(replay.inputs.usdBasis.usdPerPhiMicrocents,rate);
 assert.equal(replay.inputs.usdBasis.source,'receiz-local-wallet-display-policy');
 assert.equal(replay.inputs.usdBasis.rateProjection.valuationKaiPulse,'14063111');
 assert.equal(replay.inputs.usdBasis.rateProjection.valuationKaiUPulse,evaluation.valuationKaiUPulse);
 assert.equal(replay.inputs.usdBasis.rateProjection.context.usd,100);
 assert.equal(replay.inputs.usdBasis.rateProjection.context.currentStreakDays,0);
 assert.equal(replay.inputs.usdBasis.rateProjection.context.lifetimeUsdSoFar,0);
 assert.equal(replay.inputs.usdBasis.rateProjection.context.plannedHoldBeats,0);
 assert.equal(replay.inputs.usdBasis.rateProjection.policy.basePhiPerUsd,0.1);
 assert.match(replay.inputs.usdBasis.rateProjection.policySourceSha256,/^[0-9a-f]{64}$/);
 assert.equal(replay.inputs.usdBasis.rateProjection.policyChecksum,await digestReceizCanonicalV122(replay.inputs.usdBasis.rateProjection.policy));
 assert.equal(result.value.priceBasisDigest,await digestReceizCanonicalV122(replay.inputs.usdBasis));
 assert.equal(replay.writesPerformed,0);
 for(const point of result.value.samples)assert.equal(point.usdCents,quoteReceizDisplayUsdV122(point.phiMicro,rate));
 assert.deepEqual(await calculate(legacy,{valuationKaiUPulse:evaluation.valuationKaiUPulse}),result);
 assert.ok(result.value.localModel);assert.equal(result.value.localModel.source.originKind,'sealed-birth-timestamp-projection');
 assert.ok(!result.value.localModel.appliedDefaults.some(row=>row.field==='originPulse'));
});

test('local model refuses altered card evidence, pre-origin evaluation and malformed held USD rate',async()=>{
 const altered=structuredClone(card);altered.manifest.capturedAt='2026-10-01T00:00:00.000Z';
 assert.equal((await calculate(altered,evaluation)).status,'unavailable');
 const alteredRarity=structuredClone(card);alteredRarity.manifest.rarity='eternal';
 assert.equal((await calculate(alteredRarity,evaluation)).status,'unavailable');
 assert.equal((await calculate(card,{valuationKaiUPulse:'13789277000569'})).status,'unavailable');
 assert.equal((await calculate(card,{...evaluation,usdPerPhiMicrocents:'0'})).status,'unavailable');
});
