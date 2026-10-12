import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {calculateReceizLocalDisplayRateV129 as calculate} from '../src/features/market/receiz-local-display-rate-v129';

// Independent vectors evaluated with Receiz's original valuation.ts and
// phi-issuance.ts, then rounded by its Wallet amounts.ts integer bridge.
const upstream=[
 ['0','4429539340'],['1000000','4739393994'],['484000000','4139439846'],
 ['13789277000570','10361318876'],['14063111123456','9158758842'],
 ['14603187000000','10423198538'],['20000000000000','12634914033']
] as const;
test('local USD rate matches Receiz Wallet exactly without any identity, account, clock or fetch',async()=>{
 for(const [coordinate,rate] of upstream){
  const result=await calculate(coordinate);
  assert.equal(result.usdPerPhiMicrocents,rate);
  assert.equal(result.valuationKaiUPulse,coordinate);
  assert.equal(result.writesPerformed,0);
  assert.equal(result.authority,'display-conversion-only');
 }
 // A warm cache and out-of-order history replay cannot alter the result.
 assert.deepEqual(await calculate(upstream[4][0]),await calculate(upstream[4][0]));
 const exact=await calculate('14063111999999');
 assert.equal(exact.usdPerPhiMicrocents,upstream[4][1]);
 assert.equal(exact.valuationKaiUPulse,'14063111999999');
 await calculate(upstream[0][0]);
 assert.equal((await calculate(upstream[4][0])).usdPerPhiMicrocents,upstream[4][1]);
});
test('the vendored display policy retains the exact Receiz source, with only the public SDK import bridge',async()=>{
 const source=await readFile('src/features/market/receiz-display-issuance-v129.ts','utf8');
 const upstreamSource=source.slice(source.indexOf('// phi-issuance.ts')).replaceAll('from "@receiz/sdk/valuation"','from "./valuation"');
 assert.equal(createHash('sha256').update(upstreamSource).digest('hex'),'69622c017e955734525e121a7b27bdaa42066932657b145e02be493792de9c74');
});
test('the local rate rejects non-canonical or unsafe coordinates and protects the shared rule from mutation',async()=>{
 for(const coordinate of ['','-1','01','1.5','9007199254740992'])await assert.rejects(calculate(coordinate),/LOCAL_VALUE_COORDINATE_INVALID/);
 const result=await calculate(upstream[4][0]);
 assert.throws(()=>{result.policy.basePhiPerUsd=1;},TypeError);
 assert.equal((await calculate(upstream[4][0])).usdPerPhiMicrocents,upstream[4][1]);
});
