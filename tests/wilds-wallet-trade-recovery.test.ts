import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade";
import { admitWildsWalletTradeReview, sendSavedWildsWalletTradeReview, type WildsWalletTradeRecoveryStore, type WildsWalletTradeReview } from "../src/features/play/wallet/wilds-wallet-trade-recovery";

function fixture() {
  const draft = createWildsWalletTradeDraft({attemptId:"wallet:trade:fixed",recipient:"bob",selfHandle:"alice",phiMicro:"1",requestedPhiMicro:"2",requestNote:"Living Honey",selections:[]});
  const review: WildsWalletTradeReview = {schema:"wildz.wallet.trade-review.v1",owner:"alice",draft,labels:[],status:"reviewed"};
  let saved: unknown = review;
  const store: WildsWalletTradeRecoveryStore = {load:()=>saved,write:(_owner,value)=>{saved=structuredClone(value);},clear:()=>{saved=null;}};
  return {review,store};
}

test("trade recovery saves exact recipient, units and attempt before invoking transport", async () => {
  const {review,store}=fixture();
  const result=await sendSavedWildsWalletTradeReview({review,store,propose:async draft=>{
    const saved=admitWildsWalletTradeReview(store.load("alice"),"alice")!;
    assert.equal(saved.status,"pending");assert.deepEqual(saved.draft,draft);
    return {status:"offered",message:"Offer delivered",tradeId:draft.attemptId};
  }});
  assert.equal(result.status,"offered");
  assert.equal(admitWildsWalletTradeReview(store.load("alice"),"alice")?.draft.attemptId,review.draft.attemptId);
  assert.throws(()=>admitWildsWalletTradeReview(store.load("alice"),"bob"));
});

test("unavailable or changed recovery readback permits zero proposal calls", async () => {
  const {review,store}=fixture();let calls=0;
  const propose=async()=>{calls++;return {status:"offered" as const,message:"Delivered"};};
  await assert.rejects(sendSavedWildsWalletTradeReview({review,store:{...store,write:()=>{throw Error("quota");}},propose}));
  await assert.rejects(sendSavedWildsWalletTradeReview({review,store:{...store,load:()=>null},propose}));
  assert.equal(calls,0);
});

test("lost acknowledgement and reload retry preserve the exact same attempt", async () => {
  const {review,store}=fixture();const attempts:string[]=[];
  const first=await sendSavedWildsWalletTradeReview({review,store,propose:async draft=>{attempts.push(draft.attemptId);throw Error("response lost");}});
  assert.equal(first.status,"pending");
  const restored=admitWildsWalletTradeReview(store.load("alice"),"alice")!;
  const recovered=await sendSavedWildsWalletTradeReview({review:restored,store,propose:async draft=>{attempts.push(draft.attemptId);return {status:"offered",message:"Original offer recovered"};}});
  assert.equal(recovered.status,"offered");assert.deepEqual(attempts,[review.draft.attemptId,review.draft.attemptId]);
});

test("storage failure after delivery retains a pending attempt instead of allowing a new offer", async () => {
  const {review,store}=fixture();let writes=0;
  const result=await sendSavedWildsWalletTradeReview({review,store:{...store,write:(owner,value)=>{if(++writes>1)throw Error("quota");store.write(owner,value);}},propose:async()=>({status:"offered",message:"Delivered"})});
  assert.equal(result.status,"pending");assert.equal(admitWildsWalletTradeReview(store.load("alice"),"alice")?.status,"pending");
});
