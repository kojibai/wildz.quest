import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {WildzWalletPresentation} from '../src/lib/receiz/wildz-wallet-presentation';
import {projectWildsWalletSummary} from '../src/lib/receiz/wilds-wallet-projections';
import {readWildzMarketHeldDisplayRate as read} from '../src/features/market/wildz-market-held-display-rate';

const binding={keyId:'a'.repeat(64),actorId:'held-rate-owner',incarnation:'wallet-observation:one'};
const presentation:WildzWalletPresentation={...binding,resourceRows:[],observation:{...binding,
 schema:'wildz.wallet.observation.v1',origin:'live',freshness:'observed',
 summary:projectWildsWalletSummary({ok:true,wallet:{balancePhiMicro:'0',quote:{usdPerPhiMicrocents:'40750000000'}}})}};
test('Market can retain an exact observed USD rate independently of zero balance or pending freshness',()=>{
 assert.equal(read(binding,presentation),'40750000000');
 assert.equal(read(binding,{...presentation,observation:{...presentation.observation!,freshness:'pending'}}),'40750000000');
 assert.equal(read(binding,null),null);
 const unknown={...presentation,observation:{...presentation.observation!,summary:projectWildsWalletSummary({ok:true,balancePhiMicro:'0'})}};
 assert.equal(read(binding,unknown),null);
});
test('held USD conversion never crosses identity or observation incarnation bindings',()=>{
 for(const field of ['keyId','actorId','incarnation'] as const){
  assert.equal(read({...binding,[field]:'foreign'},presentation),null);
  assert.equal(read(binding,{...presentation,[field]:'foreign'}),null);
  assert.equal(read(binding,{...presentation,observation:{...presentation.observation!,[field]:'foreign'}}),null);
 }
});
test('held rate reader refuses malformed or absent conversion inputs',()=>{
 assert.equal(read(null,presentation),null);
 for(const rate of ['0','040750000000','-1','1.25','9'.repeat(31)]){
  const altered={...presentation,observation:{...presentation.observation!,summary:{...presentation.observation!.summary,displayUsdPerPhiMicrocents:rate}}};
  assert.equal(read(binding,altered),null);
 }
});
