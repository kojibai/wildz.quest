import {isReceizCommittedNativeTradeV128,type ReceizCommittedNativeTradeV128,type ReceizNativeTradeTransitionSetV128} from "@receiz/sdk";
import { canonicalPortableCardJson } from "../portable-card";
import { createWildsWalletTradeAgreement, type WildsWalletTradeAgreement, type WildsWalletTradeExchangeResult } from "./wilds-wallet-trade";
import { validateWildsWalletNativeTradeMessage, wildsWalletNativeTradeMessageId, wildsWalletNativeTradeAgreementDigest, wildsWalletNativeTradePreparationSourcesDigest, type WildsWalletFrozenNativeTrade, type WildsWalletNativeTradeApproval, type WildsWalletNativeTradeMessage, type WildsWalletNativeTradePreparation } from "./wilds-wallet-native-trade-context";
export type WildsWalletNativeTradeAttempt=Readonly<{schema:"wildz.wallet.native-trade-attempt.v1";owner:string;agreement:WildsWalletTradeAgreement;agreementDigest:string;approved:true;status:"awaiting-peer"|"pending"|"committed"|"failed";assetProjectionStatus?:"pending"|"restored";ownPreparation?:WildsWalletNativeTradePreparation;peerPreparation?:WildsWalletNativeTradePreparation;publishedPreparation?:boolean;frozen?:WildsWalletFrozenNativeTrade;ownApproval?:WildsWalletNativeTradeApproval;peerApproval?:WildsWalletNativeTradeApproval;publishedApproval?:boolean;transitionSet?:ReceizNativeTradeTransitionSetV128}>;
export type WildsWalletNativeTradeAttemptStore=Readonly<{load(owner:string,digest:string):Promise<unknown>;write(attempt:WildsWalletNativeTradeAttempt):Promise<void>}>;
export type WildsWalletNativeTradePorts=Readonly<{
 owner():string;store:WildsWalletNativeTradeAttemptStore;
 prepare(agreement:WildsWalletTradeAgreement):Promise<WildsWalletNativeTradePreparation>;
 preparationCurrent?(preparation:WildsWalletNativeTradePreparation):boolean;
 refreshPreparation?(agreement:WildsWalletTradeAgreement,preparation:WildsWalletNativeTradePreparation):Promise<WildsWalletNativeTradePreparation>;
 freeze(agreement:WildsWalletTradeAgreement,preparations:readonly [WildsWalletNativeTradePreparation,WildsWalletNativeTradePreparation]):Promise<WildsWalletFrozenNativeTrade>;
 validateFrozen(frozen:WildsWalletFrozenNativeTrade):Promise<void>;
 sign(frozen:WildsWalletFrozenNativeTrade):Promise<WildsWalletNativeTradeApproval>;
 assemble(frozen:WildsWalletFrozenNativeTrade,approvals:readonly [WildsWalletNativeTradeApproval,WildsWalletNativeTradeApproval]):Promise<ReceizNativeTradeTransitionSetV128>;
 commit(set:ReceizNativeTradeTransitionSetV128):Promise<ReceizCommittedNativeTradeV128|Readonly<{status:"unknown"|"conflict"|"rejected"}>>;
 resolve(agreement:WildsWalletTradeAgreement):Promise<ReceizCommittedNativeTradeV128|null|Readonly<{status:"unknown"}>>;
 publish(recipient:string,message:WildsWalletNativeTradeMessage):Promise<boolean>;
 adopt(committed:ReceizCommittedNativeTradeV128,attempt:WildsWalletNativeTradeAttempt):Promise<void>;
}>;
const storageFailure=()=>Error("Save this exact exchange on this device before approving. Recovery storage is unavailable.");
function admitAttempt(v:unknown,owner:string,digest:string):WildsWalletNativeTradeAttempt|null{
 if(v===null||v===undefined)return null;if(!v||typeof v!=="object"||Array.isArray(v))throw storageFailure();
 const a=v as WildsWalletNativeTradeAttempt;
 if(a.schema!=="wildz.wallet.native-trade-attempt.v1"||a.owner!==owner||a.approved!==true||a.agreementDigest!==digest||wildsWalletNativeTradeAgreementDigest(a.agreement)!==digest||![a.agreement.first.senderHandle,a.agreement.second.senderHandle].includes(owner)||!["awaiting-peer","pending","committed","failed"].includes(a.status)||a.assetProjectionStatus!==undefined&&(a.status!=="committed"||!["pending","restored"].includes(a.assetProjectionStatus))||Object.keys(a).some(k=>!["schema","owner","agreement","agreementDigest","approved","status","assetProjectionStatus","ownPreparation","peerPreparation","publishedPreparation","frozen","ownApproval","peerApproval","publishedApproval","transitionSet"].includes(k)))throw storageFailure();
 const peer=owner===a.agreement.first.senderHandle?a.agreement.second.senderHandle:a.agreement.first.senderHandle;
 if(a.ownPreparation)validateWildsWalletNativeTradeMessage({kind:"trade-native",phase:"preparation",agreement:a.agreement,preparation:a.ownPreparation},owner,peer);
 if(a.peerPreparation)validateWildsWalletNativeTradeMessage({kind:"trade-native",phase:"preparation",agreement:a.agreement,preparation:a.peerPreparation},peer,owner);
 if(a.ownApproval){if(!a.frozen)throw storageFailure();validateWildsWalletNativeTradeMessage({kind:"trade-native",phase:"approval",agreement:a.agreement,frozen:a.frozen,approval:a.ownApproval},owner,peer);}
 if(a.peerApproval){if(!a.frozen)throw storageFailure();validateWildsWalletNativeTradeMessage({kind:"trade-native",phase:"approval",agreement:a.agreement,frozen:a.frozen,approval:a.peerApproval},peer,owner);}
 if(a.transitionSet&&(!a.frozen||a.transitionSet.operationPlan.exactPlanDigest!==a.frozen.plan.exactPlanDigest))throw storageFailure();
 return Object.freeze(structuredClone(a));
}
/** Only an explicitly approved, durably checkpointed agreement may progress after a peer message. */
export function createWildsWalletNativeTradeController(ports:WildsWalletNativeTradePorts){
 let serial:Promise<unknown>=Promise.resolve();
 const inflight=new Map<string,Promise<WildsWalletTradeExchangeResult>>();
 const pending=(id:string,message="Checking this same exchange. Your exact approval and sources are saved."):WildsWalletTradeExchangeResult=>({status:"pending",message,tradeId:id});
 async function save(a:WildsWalletNativeTradeAttempt){admitAttempt(a,a.owner,a.agreementDigest);await ports.store.write(a);const saved=admitAttempt(await ports.store.load(a.owner,a.agreementDigest),a.owner,a.agreementDigest);if(!saved||canonicalPortableCardJson(saved)!==canonicalPortableCardJson(a))throw storageFailure();return saved;}
 const current=(a:WildsWalletNativeTradeAttempt)=>{if(ports.owner()!==a.owner)throw Error("The active account changed. Reopen Trade.");};
 async function committed(result:ReceizCommittedNativeTradeV128,a:WildsWalletNativeTradeAttempt):Promise<WildsWalletTradeExchangeResult>{
  current(a);if(!isReceizCommittedNativeTradeV128(result)||result.operationPlan.semanticIdempotencyKey!==`wildz:trade:${a.agreementDigest}`||a.frozen&&result.receipt.exactPlanDigest!==a.frozen.plan.exactPlanDigest)throw Error("The complete exchange receipt does not match this review.");
  const complete:WildsWalletTradeExchangeResult={status:"committed",message:"Exchange complete. Both packages settled together.",tradeId:a.agreementDigest};
  const repair:WildsWalletTradeExchangeResult={status:"committed",message:"Exchange complete. Refresh received assets to restore them in this wallet.",tradeId:a.agreementDigest,assetRecoveryRequired:true};
  if(a.assetProjectionStatus==="restored")return complete;
  const done={...a,status:"committed" as const,assetProjectionStatus:"pending" as const};try{await save(done);}catch{return repair;}
  try{await ports.adopt(result,done);current(done);await save({...done,assetProjectionStatus:"restored"});return complete;}
  catch{return repair;}
 }
 function withoutUnsignedPlan(a:WildsWalletNativeTradeAttempt){const {frozen:_,ownApproval:__,peerApproval:___,publishedApproval:____,transitionSet:_____,...rest}=a;return rest;}
 async function progress(initial:WildsWalletNativeTradeAttempt):Promise<WildsWalletTradeExchangeResult>{
  let a=initial;current(a);
  if(a.status==="failed")return {status:"failed",message:"This exchange wrote nothing. Review a new agreement.",tradeId:a.agreementDigest};
  if(a.status==="pending"||a.status==="committed"){
   let recovered:Awaited<ReturnType<WildsWalletNativeTradePorts["resolve"]>>;try{recovered=await ports.resolve(a.agreement);}catch{return pending(a.agreementDigest);}current(a);if(recovered&&recovered.status==="committed-native-trade")return committed(recovered,a);
   if(recovered?.status==="unknown"||a.status==="committed")return pending(a.agreementDigest);
  }
  if(a.status==="awaiting-peer"&&a.ownPreparation&&ports.preparationCurrent&&!ports.preparationCurrent(a.ownPreparation)){
   if(!ports.refreshPreparation)return {status:"awaiting-peer",message:"Reopen this same gift or exchange to renew your device confirmation.",tradeId:a.agreementDigest};
   const renewed=await ports.refreshPreparation(a.agreement,a.ownPreparation);current(a);
   if(wildsWalletNativeTradePreparationSourcesDigest(renewed)!==wildsWalletNativeTradePreparationSourcesDigest(a.ownPreparation))throw Error("Your reviewed originals, native heads or identity key changed. Review a new agreement.");
   a=await save({...withoutUnsignedPlan(a),ownPreparation:renewed,publishedPreparation:false});
  }
  if(!a.ownPreparation){const prepared=await ports.prepare(a.agreement);current(a);a=await save({...a,ownPreparation:prepared});}
  const peer=a.owner===a.agreement.first.senderHandle?a.agreement.second.senderHandle:a.agreement.first.senderHandle;
  if(!a.publishedPreparation){const delivered=await ports.publish(peer,{kind:"trade-native",phase:"preparation",agreement:a.agreement,preparation:a.ownPreparation!});current(a);if(!delivered)return pending(a.agreementDigest,"Your approval is saved. Delivering the same private preparation to your peer.");a=await save({...a,publishedPreparation:true});}
  if(!a.peerPreparation)return {status:"awaiting-peer",message:"Your approval is saved. Waiting for your peer to approve this exact agreement.",tradeId:a.agreementDigest};
  if(a.status==="awaiting-peer"&&ports.preparationCurrent&&!ports.preparationCurrent(a.peerPreparation))return {status:"awaiting-peer",message:"Waiting for your peer's current device confirmation on these same assets.",tradeId:a.agreementDigest};
  const coordinator=[a.owner,peer].sort()[0]===a.owner;
  if(!a.frozen){if(!coordinator)return {status:"awaiting-peer",message:"Waiting for the shared final plan from your peer.",tradeId:a.agreementDigest};
   const preparations=[a.agreement.first.senderHandle===a.owner?a.ownPreparation:a.peerPreparation,a.agreement.second.senderHandle===a.owner?a.ownPreparation:a.peerPreparation] as const;
   const frozen=await ports.freeze(a.agreement,preparations as readonly [WildsWalletNativeTradePreparation,WildsWalletNativeTradePreparation]);current(a);await ports.validateFrozen(frozen);a=await save({...a,frozen});}
  await ports.validateFrozen(a.frozen!);current(a);
  if(!a.ownApproval){const approval=await ports.sign(a.frozen!);current(a);a=await save({...a,ownApproval:approval});}
  if(!a.publishedApproval){const delivered=await ports.publish(peer,{kind:"trade-native",phase:"approval",agreement:a.agreement,frozen:a.frozen!,approval:a.ownApproval!});current(a);if(!delivered)return pending(a.agreementDigest,"Your device approval is saved. Delivering the same signed approval to your peer.");a=await save({...a,publishedApproval:true});}
  if(!a.peerApproval)return {status:"awaiting-peer",message:"Waiting for your peer's signature on the same final plan.",tradeId:a.agreementDigest};
  if(!coordinator){const result=await ports.resolve(a.agreement);current(a);return result?.status==="committed-native-trade"?committed(result,a):pending(a.agreementDigest,"Both approvals are saved. Waiting for the atomic exchange receipt.");}
  if(!a.transitionSet){const approvals=[a.agreement.first.senderHandle===a.owner?a.ownApproval:a.peerApproval,a.agreement.second.senderHandle===a.owner?a.ownApproval:a.peerApproval] as const;const set=await ports.assemble(a.frozen!,approvals as readonly [WildsWalletNativeTradeApproval,WildsWalletNativeTradeApproval]);current(a);a=await save({...a,transitionSet:set});}
  a=await save({...a,status:"pending"});current(a);
  try{const result=await ports.commit(a.transitionSet!);current(a);if(result.status==="committed-native-trade")return committed(result,a);if(result.status==="unknown")return pending(a.agreementDigest);await save({...a,status:"failed"});return {status:"failed",message:"This exchange wrote nothing. Refresh your sources and review a new agreement.",tradeId:a.agreementDigest};}
  catch{try{const recovered=await ports.resolve(a.agreement);current(a);if(recovered?.status==="committed-native-trade")return committed(recovered,a);}catch{}return pending(a.agreementDigest);}
 }
 function run(key:string,operation:()=>Promise<WildsWalletTradeExchangeResult>){const prior=inflight.get(key);if(prior)return prior;const promise=serial.then(operation);serial=promise.catch(()=>undefined);inflight.set(key,promise);void promise.finally(()=>{if(inflight.get(key)===promise)inflight.delete(key);}).catch(()=>undefined);return promise;}
 async function load(agreement:WildsWalletTradeAgreement){const owner=ports.owner(),canonical=createWildsWalletTradeAgreement(agreement.first,agreement.second,agreement.purpose),digest=wildsWalletNativeTradeAgreementDigest(canonical);return {owner,agreement:canonical,digest,attempt:admitAttempt(await ports.store.load(owner,digest),owner,digest)};}
 return Object.freeze({
  approveAgreement(agreement:WildsWalletTradeAgreement){return run(`agreement:${wildsWalletNativeTradeAgreementDigest(agreement)}`,async()=>{const item=await load(agreement);if(item.attempt?.status==="failed")return {status:"failed",message:"This exchange wrote nothing. Review a new agreement.",tradeId:item.digest};const a=item.attempt??await save({schema:"wildz.wallet.native-trade-attempt.v1",owner:item.owner,agreement:item.agreement,agreementDigest:item.digest,approved:true,status:"awaiting-peer"});return progress(a);});},
  recoverAgreement(agreement:WildsWalletTradeAgreement){return run(`agreement:${wildsWalletNativeTradeAgreementDigest(agreement)}`,async()=>{const item=await load(agreement);if(!item.attempt)return {status:"failed",message:"Review and approve this exact agreement on this device first.",tradeId:item.digest};return progress(item.attempt);});},
  receive(value:unknown,senderHandle:string){const admitted=validateWildsWalletNativeTradeMessage(value,senderHandle,ports.owner());return run(wildsWalletNativeTradeMessageId(senderHandle,admitted),async()=>{const message=admitted,item=await load(message.agreement);if(!item.attempt)return {status:"awaiting-peer",message:"Review this agreement before sharing your own sources or signing.",tradeId:item.digest};let a=item.attempt;
   if(a.status==="pending"||a.status==="committed"||a.status==="failed")return progress(a);
   if(message.phase==="receipt"){try{const result=await ports.resolve(a.agreement);current(a);return result?.status==="committed-native-trade"?committed(result,a):pending(a.agreementDigest);}catch{return pending(a.agreementDigest);}}
   if(message.phase==="preparation"){
    if(a.peerPreparation&&canonicalPortableCardJson(a.peerPreparation)!==canonicalPortableCardJson(message.preparation)){
     if(wildsWalletNativeTradePreparationSourcesDigest(a.peerPreparation)!==wildsWalletNativeTradePreparationSourcesDigest(message.preparation))return pending(item.digest,"Your peer's sources changed. Review a new agreement before approving them.");
     if(BigInt(message.preparation.expiresAtKai)<=BigInt(a.peerPreparation.expiresAtKai))return progress(a);
     a=withoutUnsignedPlan(a);
    }
    a=await save({...a,peerPreparation:message.preparation});
   }
   else{
    const own=message.frozen.preparations.find(p=>p.ownerHandle===a.owner),peerPreparation=message.frozen.preparations.find(p=>p.ownerHandle!==a.owner)!;
    if(!a.ownPreparation||!own||wildsWalletNativeTradePreparationSourcesDigest(own)!==wildsWalletNativeTradePreparationSourcesDigest(a.ownPreparation)||a.peerPreparation&&wildsWalletNativeTradePreparationSourcesDigest(peerPreparation)!==wildsWalletNativeTradePreparationSourcesDigest(a.peerPreparation))throw Error("The peer approval substituted this device's reviewed sources.");
    if(canonicalPortableCardJson(own)!==canonicalPortableCardJson(a.ownPreparation)||a.peerPreparation&&BigInt(peerPreparation.expiresAtKai)<BigInt(a.peerPreparation.expiresAtKai))return progress(a);
    await ports.validateFrozen(message.frozen);
    if(a.frozen&&canonicalPortableCardJson(a.frozen)!==canonicalPortableCardJson(message.frozen))a=withoutUnsignedPlan(a);
    a=await save({...a,frozen:message.frozen,peerPreparation,peerApproval:message.approval});
   }
   return progress(a);
  });}
 });
}
