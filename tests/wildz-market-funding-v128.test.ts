import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveWildzMarketConnectQuoteV128} from '../src/lib/receiz/wildz-market-quote-v128';
import {prepareWildzMarketFundingV128,wildzMarketFundingReferenceV128,validateWildzCardCheckoutUrlV128} from '../src/lib/receiz/wildz-market-funding-v128';

const owner={ownerReceizId:'buyer-uuid',profileHandle:'alice.receiz.id'};
const wallet=(balance='0')=>({ok:true,wallet:{userId:owner.ownerReceizId,balancePhiMicro:balance,balanceUsd:(Number(balance)/400000).toFixed(2),quote:{usdPerPhiMicrocents:'250000000'}}});
const quote=deriveWildzMarketConnectQuoteV128(wallet(),{ownerUserId:owner.ownerReceizId,ownerHandle:owner.profileHandle,priceUsdCents:'125',currentKai:100});
const purchaseId='market:purchase:'+'a'.repeat(64);
function fixture(balance='0'){
 let funds=balance,created=0,session:any;
 const calls:any[]=[];
 const deps={currentKai:()=>101,origin:'https://wildz.quest',walletSummary:async()=>wallet(funds),checkout:async(input:any)=>{created++;calls.push(input);return {ok:true,checkout:{mode:'hosted',sessionId:'cs_test_12345678',url:'https://checkout.stripe.com/c/pay/cs_test_12345678',amountUsdCents:'125',currency:'usd',referenceId:input.referenceId}};},checkoutSession:async()=>session};
 return {deps,calls,count:()=>created,funds:(value:string)=>{funds=value;},session:(value:any)=>{session=value;}};
}
test('short buyer balance opens the actual nested hosted checkout response for only the missing funds',async()=>{
 const f=fixture('100000');f.deps.checkout=async(input:any)=>{f.calls.push(input);return {ok:true,checkout:{mode:'hosted',sessionId:'cs_test_12345678',url:'https://checkout.stripe.com/c/pay/cs_test_12345678',amountUsdCents:'100',currency:'usd',referenceId:input.referenceId}};};
 const result=await prepareWildzMarketFundingV128({action:'create',purchaseId,quote},owner,f.deps);
 assert.equal(result.status,'checkout');assert.equal(result.topupUsdCents,'100');assert.equal(f.calls[0].amountUsd,'1.00');assert.equal(f.calls[0].uiMode,'hosted');
 assert.equal(f.calls[0].successUrl,'https://wildz.quest/?marketPurchase='+encodeURIComponent(purchaseId)+'&cardCheckout=returned');assert.equal(f.calls[0].referenceId,wildzMarketFundingReferenceV128(owner.profileHandle,purchaseId,quote));
});
test('funded wallet bypasses card checkout and expired or changed quotes cannot open a new charge',async()=>{
 const f=fixture('500000');assert.equal((await prepareWildzMarketFundingV128({action:'create',purchaseId,quote},owner,f.deps)).status,'ready');assert.equal(f.count(),0);
 f.funds('0');f.deps.currentKai=()=>220;assert.equal((await prepareWildzMarketFundingV128({action:'create',purchaseId,quote},owner,f.deps)).status,'review-required');assert.equal(f.count(),0);
});
test('card payment must bind the saved session, buyer, amount and reference, then show actual wallet funds',async()=>{
 const f=fixture();const request={action:'check' as const,purchaseId,quote,sessionId:'cs_test_12345678',topupUsdCents:'125'};
 const paid={ok:true,session:{sessionId:request.sessionId,state:'paid',isPaid:true,currency:'usd',amountUsdCents:'125',referenceId:wildzMarketFundingReferenceV128(owner.profileHandle,purchaseId,quote)},settlement:{userId:owner.ownerReceizId,amountUsdCents:'125',amountPhiMicro:'500000'}};
 f.session(paid);assert.equal((await prepareWildzMarketFundingV128(request,owner,f.deps)).status,'pending','a paid card is not an asset receipt or proof of spendable balance');
 f.funds('500000');assert.equal((await prepareWildzMarketFundingV128(request,owner,f.deps)).status,'ready');
 for(const change of [{session:{...paid.session,referenceId:'other'}},{session:{...paid.session,sessionId:'cs_test_other123'}},{session:{...paid.session,amountUsdCents:'126'}},{settlement:{...paid.settlement,userId:'another-user'}}]){f.session({...paid,...change});await assert.rejects(prepareWildzMarketFundingV128(request,owner,f.deps),/checkout/);}
});
test('cancelled and expired checkout does not send value; minimum card amount is explicit and provider maximum fails before creation',async()=>{
 const f=fixture();const request={action:'check' as const,purchaseId,quote,sessionId:'cs_test_12345678',topupUsdCents:'125'};
 f.session({ok:true,session:{sessionId:request.sessionId,state:'expired',isPaid:false,currency:'usd',amountUsdCents:'125',referenceId:wildzMarketFundingReferenceV128(owner.profileHandle,purchaseId,quote)},settlement:null});
 assert.equal((await prepareWildzMarketFundingV128(request,owner,f.deps)).status,'expired');assert.equal(f.count(),0);
 const small=deriveWildzMarketConnectQuoteV128(wallet(),{ownerUserId:owner.ownerReceizId,ownerHandle:owner.profileHandle,priceUsdCents:'1',currentKai:100});
 f.deps.checkout=async(input:any)=>{f.calls.push(input);return {ok:true,checkout:{mode:'hosted',sessionId:'cs_test_12345678',url:'https://checkout.stripe.com/c/pay/cs_test_12345678',amountUsdCents:'50',currency:'usd',referenceId:input.referenceId}};};
 assert.equal((await prepareWildzMarketFundingV128({action:'create',purchaseId,quote:small},owner,f.deps)).topupUsdCents,'50');assert.equal(f.calls[0].amountUsd,'0.50');
 const huge=deriveWildzMarketConnectQuoteV128(wallet(),{ownerUserId:owner.ownerReceizId,ownerHandle:owner.profileHandle,priceUsdCents:'10000001',currentKai:100});await assert.rejects(prepareWildzMarketFundingV128({action:'create',purchaseId,quote:huge},owner,f.deps),/maximum/);
});
test('checkout cannot redirect to an arbitrary destination or change the current buyer',async()=>{
 for(const url of ['https://evil.test/pay','javascript:alert(1)','https://checkout.stripe.com.evil.test','https://user@checkout.stripe.com/c/pay','http://checkout.stripe.com/c/pay'])assert.throws(()=>validateWildzCardCheckoutUrlV128(url));
 const f=fixture();await assert.rejects(prepareWildzMarketFundingV128({action:'create',purchaseId,quote},{...owner,profileHandle:'bob.receiz.id'},f.deps));assert.equal(f.count(),0);
});
