import assert from "node:assert/strict";
import test from "node:test";
import {createWildsWalletTradeAgreement,createWildsWalletTradeDraft} from "../src/features/play/wallet/wilds-wallet-trade";
import {createWildsWalletStagedTradeController} from "../src/features/play/wallet/wilds-wallet-staged-trade-controller";
import {createWildsWalletStagedTradePlan,wildsWalletStagedTradeApprovalChallenge,type WildsWalletStagedTradePorts,type WildsWalletStagedTradeBinding} from "../src/features/play/wallet/wilds-wallet-staged-trade-types";
import type {WildsWalletStagedTradeRecoveryEntry} from "../src/features/play/wallet/wilds-wallet-staged-trade-recovery";
function fixture(){
 const binding={ownerHandle:"alice.receiz.id",keyId:"key:alice",identityArtifactDigest:"a".repeat(64)};
 const agreement=(index:number)=>createWildsWalletTradeAgreement({senderHandle:"alice",draft:createWildsWalletTradeDraft({attemptId:`alice:${index}`,recipient:"bob",selfHandle:"alice",phiMicro:"10",requestedPhiMicro:"0",requestNote:"Archive fixture",selections:[]})},{senderHandle:"bob",draft:createWildsWalletTradeDraft({attemptId:`bob:${index}`,recipient:"alice",selfHandle:"bob",phiMicro:"20",requestedPhiMicro:"0",requestNote:"Archive fixture",selections:[]})});
 const approval=(plan:ReturnType<typeof createWildsWalletStagedTradePlan>,actor:WildsWalletStagedTradeBinding)=>{const challenge=wildsWalletStagedTradeApprovalChallenge(plan,actor);return {schema:"wildz.wallet.staged-trade-approval.v1" as const,tradeId:plan.tradeId,...actor,sourceHeads:[],approvalId:challenge.approvalId,evidence:challenge.exactChallenge};};
 const completed=(index:number):WildsWalletStagedTradeRecoveryEntry=>{const plan=createWildsWalletStagedTradePlan(agreement(index));return {plan,approvals:[approval(plan,binding),approval(plan,{ownerHandle:"bob.receiz.id",keyId:"key:bob",identityArtifactDigest:"b".repeat(64)})],legs:plan.legs.map(leg=>({legId:leg.legId,status:"committed",receipt:{nativeLeg:leg.legId}}))};};
 let saved={schema:"wildz.wallet.staged-trade-recovery.v1",binding,trades:Array.from({length:32},(_,index)=>completed(index))};let sends=0,signs=0,archives=0;
 const map=new Map<string,WildsWalletStagedTradeRecoveryEntry>();let disk=true;
 const archive={read:async(_binding:WildsWalletStagedTradeBinding,id:string)=>structuredClone(map.get(id)??null),retain:async(_binding:WildsWalletStagedTradeBinding,entry:WildsWalletStagedTradeRecoveryEntry)=>{if(!disk)throw Error("archive quota");archives++;map.set(entry.plan.tradeId,structuredClone(entry));}};
 const store={load:()=>structuredClone(saved),write:(_owner:string,value:unknown)=>{saved=structuredClone(value) as typeof saved;},withLock:async<T>(_owner:string,action:()=>Promise<T>)=>action()};
 const ports:WildsWalletStagedTradePorts={currentBinding:()=>binding,readApprovalSources:async()=>[],signApproval:async request=>{signs++;return approval(request.plan,binding);},verifyApproval:async(raw,challenge)=>{if(raw.evidence!==challenge.exactChallenge)throw Error("native approval");return raw;},sendAsset:async()=>{sends++;return {status:"sent",message:"unexpected"};},sendPhi:async()=>{sends++;return {status:"pending"};},observeLeg:async()=>({status:"none"}),verifyLegReceipt:async(leg,outcome)=>{if((outcome.receipt as {nativeLeg?:string})?.nativeLeg!==leg.legId)throw Error("native receipt");},publish:async()=>{}};
 return {binding,agreement,completed,archive,store,ports,map,saved:()=>saved,setSaved:(value:typeof saved)=>{saved=value;},setDisk:(value:boolean)=>{disk=value;},calls:()=>({sends,signs,archives})};
}
test("a thirty-third trade archives only reverified terminal history and explicit old check restores without sending",async()=>{
 const f=fixture(),controller=createWildsWalletStagedTradeController({recoveryStore:f.store,archiveStore:f.archive} as any),old=f.completed(0);
 assert.equal((await controller.approve(f.agreement(33),f.ports)).status,"awaiting-peer");assert.equal(f.saved().trades.length,32);assert.equal(f.calls().archives,1);assert.deepEqual(f.map.get(old.plan.tradeId),old);
 assert.equal((await controller.advance(old.plan.tradeId,f.ports)).status,"completed");assert.equal(f.saved().trades.length,32);assert.equal(f.calls().sends,0);assert.equal(f.calls().signs,1,"historical restoration never creates a new consent");
});
test("archive write failure and nonterminal capacity retain every original checkpoint and start no new consent",async()=>{
 const f=fixture(),before=f.saved();f.setDisk(false);const controller=createWildsWalletStagedTradeController({recoveryStore:f.store,archiveStore:f.archive} as any);
 assert.equal((await controller.approve(f.agreement(33),f.ports)).status,"failed");assert.deepEqual(f.saved(),before);assert.equal(f.calls().signs,0);assert.equal(f.calls().sends,0);
 const pending={...before,trades:before.trades.map(entry=>({...entry,legs:entry.legs.map((leg,index)=>index===0?{legId:leg.legId,status:"pending" as const}:{legId:leg.legId,status:"ready" as const})}))};f.setSaved(pending as typeof before);f.setDisk(true);
 assert.equal((await controller.approve(f.agreement(34),f.ports)).status,"failed");assert.deepEqual(f.saved(),pending);assert.equal(f.calls().archives,0);assert.equal(f.calls().signs,0);
});
