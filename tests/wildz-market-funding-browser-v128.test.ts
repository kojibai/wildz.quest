import test from 'node:test';
import assert from 'node:assert/strict';
import {createWildzMarketFundingPortV128} from '../src/features/market/wildz-market-funding-port-v128';
import {deriveWildzMarketConnectQuoteV128} from '../src/lib/receiz/wildz-market-quote-v128';
const quote=deriveWildzMarketConnectQuoteV128({ok:true,wallet:{userId:'alice',balancePhiMicro:'0',balanceUsd:'0.00',quote:{usdPerPhiMicrocents:'250000000'}}},{ownerUserId:'alice',ownerHandle:'alice.receiz.id',priceUsdCents:'125',currentKai:100});
const purchase={purchaseId:'market:purchase:'+'a'.repeat(64),quote};
function fixture(){
 let saved:any=null,current=true,creates=0,checks=0,paid=false,lost=false,quota=false,authorized=true;
 const store={read:async()=>structuredClone(saved),write:async(_key:string,value:unknown)=>{if(quota)throw Error('quota');saved=structuredClone(value);},withLock:async<T>(_key:string,action:()=>Promise<T>)=>action()};
 const open=()=>createWildzMarketFundingPortV128({keyId:'k',ownerHandle:'alice.receiz.id',currentIdentity:()=>{if(!current)throw Error('identity changed');return {keyId:'k',ownerHandle:'alice.receiz.id'};},store,authorize:async()=>authorized,request:async(request)=>{
  if(request.action==='create'){creates++;assert.equal(saved.phase,'creating','intent must survive reload before Stripe dispatch');if(lost)throw Error('network reply lost');return {status:'checkout',sessionId:'cs_test_12345678',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_test_12345678',topupUsdCents:'125',message:'card checkout'};}
  checks++;return paid?{status:'ready',message:'wallet funded'}:{status:'checkout',sessionId:'cs_test_12345678',checkoutUrl:'https://checkout.stripe.com/c/pay/cs_test_12345678',topupUsdCents:'125',message:'original checkout'};
 }});
 return {open,store,saved:()=>saved,counts:()=>({creates,checks}),pay:()=>{paid=true;},lose:()=>{lost=true;},switch:()=>{current=false;},quota:()=>{quota=true;},deny:()=>{authorized=false;}};
}
test('card checkout survives a cold reload and unpaid retries reuse one original session',async()=>{
 const f=fixture();assert.equal((await f.open().ensure(purchase,true)).status,'checkout');assert.equal(f.saved().sessionId,'cs_test_12345678');
 assert.equal((await f.open().ensure(purchase,true)).status,'checkout');assert.deepEqual(f.counts(),{creates:1,checks:1});
 f.pay();assert.equal((await f.open().ensure(purchase,true)).status,'ready');assert.deepEqual(f.counts(),{creates:1,checks:2});
});
test('lost checkout reply and quota failure prevent duplicate card sessions',async()=>{
 const f=fixture();f.lose();assert.equal((await f.open().ensure(purchase,true)).status,'pending');assert.equal((await f.open().ensure(purchase,true)).status,'pending');assert.equal(f.counts().creates,1);
 const blocked=fixture();blocked.quota();await assert.rejects(blocked.open().ensure(purchase,true),/quota/);assert.equal(blocked.counts().creates,0);
});
test('a changed identity or refused same-device authorization cannot create card checkout',async()=>{
 const f=fixture();f.switch();await assert.rejects(f.open().ensure(purchase,true),/identity/);assert.equal(f.counts().creates,0);
 const denied=fixture();denied.deny();assert.equal((await denied.open().ensure(purchase,true)).status,'pending');assert.equal(denied.counts().creates,0);
});
