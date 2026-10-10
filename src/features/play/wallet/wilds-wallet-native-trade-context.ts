import {validateReceizOwnedValueSourceV123} from "@receiz/sdk";
import type { ReceizIdentityLoginProof, ReceizNativeTradeRecoveryV128, ReceizNativeOwnershipHandoffBasisV128, ReceizNativeOwnershipIdentityV128, ReceizNativeValueTransitionBasisV128, ReceizOperationPlanV124, ReceizOwnedValueSourceV123, ReceizPortableSealedArtifactV124, ReceizProofAuthorityV123 } from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { parseWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { createWildsWalletTradeAgreement, type WildsWalletTradeAgreement } from "./wilds-wallet-trade";
import type { WildsWalletAssetSendAsset } from "./wilds-wallet-asset-send";
import type {PortableCardAsset} from "../portable-card";
export type WildsWalletNativeOwnershipSource = Readonly<{asset:WildsWalletAssetSendAsset; predecessor:ReceizPortableSealedArtifactV124; artifactId:string; head:string;predecessorRecovery?:ReceizNativeTradeRecoveryV128;currentCard?:PortableCardAsset}>;
export type WildsWalletNativeTradePreparation = Readonly<{
 schema:"wildz.wallet.native-trade-preparation.v1"; ownerHandle:string; agreementDigest:string;
 identity:ReceizNativeOwnershipIdentityV128; valueSource:ReceizOwnedValueSourceV123;
 grant:Omit<ReceizProofAuthorityV123,"accessToken">;
 ownershipSources:readonly WildsWalletNativeOwnershipSource[]; expiresAtKai:string;
}>;
export type WildsWalletNativeTradeBasis =
 | Readonly<{kind:"ownership";basis:ReceizNativeOwnershipHandoffBasisV128}>
 | Readonly<{kind:"value";basis:ReceizNativeValueTransitionBasisV128}>;
export type WildsWalletFrozenNativeTrade = Readonly<{schema:"wildz.wallet.native-trade-frozen.v1";agreement:WildsWalletTradeAgreement;agreementDigest:string;preparations:readonly [WildsWalletNativeTradePreparation,WildsWalletNativeTradePreparation];plan:ReceizOperationPlanV124;bases:readonly WildsWalletNativeTradeBasis[]}>;
export type WildsWalletNativeTradeApproval = Readonly<{schema:"wildz.wallet.native-trade-approval.v1";ownerHandle:string;agreementDigest:string;exactPlanDigest:string;proofs:readonly Readonly<{operationId:string;proof:ReceizIdentityLoginProof}>[]}>;
export type WildsWalletNativeTradeMessage = Readonly<{kind:"trade-native";phase:"preparation";agreement:WildsWalletTradeAgreement;preparation:WildsWalletNativeTradePreparation}>
 | Readonly<{kind:"trade-native";phase:"approval";agreement:WildsWalletTradeAgreement;frozen:WildsWalletFrozenNativeTrade;approval:WildsWalletNativeTradeApproval}>
 | Readonly<{kind:"trade-native";phase:"receipt";agreement:WildsWalletTradeAgreement;recovery:ReceizNativeTradeRecoveryV128}>;
const HEX=/^[0-9a-f]{64}$/;
export const WILDS_NATIVE_TRADE_CONTEXT_MAX_BYTES=16_000_000;
const bad=():never=>{throw Error("wilds_wallet_native_trade_message_invalid");};
function object(v:unknown,keys:readonly string[]):Record<string,unknown>{if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))bad();return v as Record<string,unknown>;}
function noSecrets(v:unknown):void{if(!v||typeof v!=="object")return;for(const [key,value]of Object.entries(v)){if(["accessToken","refreshToken","privateKeyPkcs8B64u","privateKeyPkcs8CiphertextB64u","keyFile","passphrase"].includes(key))bad();noSecrets(value);}}
export function wildsWalletNativeTradeAgreementDigest(agreement:WildsWalletTradeAgreement):string{return sha256PortableBasis(canonicalPortableCardJson(createWildsWalletTradeAgreement(agreement.first,agreement.second,agreement.purpose))).replace(/^sha256:/,"");}
/** Transport admission only. SDK sealed-source, current-key and whole-plan verification authorize settlement. */
export function validateWildsWalletNativeTradeMessage(value:unknown,senderHandle:string,recipientHandle:string):WildsWalletNativeTradeMessage{
 const serialized=JSON.stringify(value);if(!serialized||serialized.length>WILDS_NATIVE_TRADE_CONTEXT_MAX_BYTES)bad();noSecrets(value);
 const v=value as WildsWalletNativeTradeMessage;if(v?.kind!=="trade-native"||!["preparation","approval","receipt"].includes(v.phase))bad();
 object(v,v.phase==="preparation"?["kind","phase","agreement","preparation"]:v.phase==="receipt"?["kind","phase","agreement","recovery"]:["kind","phase","agreement","frozen","approval"]);
 const a=object(v.agreement,["schema","first","second",...(v.agreement.purpose?["purpose"]:[])]);if(a.schema!=="wildz.wallet.trade-agreement.v1"||a.purpose!==undefined&&a.purpose!=="gift")bad();
 const agreement=createWildsWalletTradeAgreement(v.agreement.first,v.agreement.second,v.agreement.purpose);
 if(canonicalPortableCardJson(agreement)!==canonicalPortableCardJson(v.agreement))bad();
 const sender=parseWildzPlayerCoordinate(senderHandle)??bad(),recipient=parseWildzPlayerCoordinate(recipientHandle)??bad();if(sender.profileHandle===recipient.profileHandle)bad();
 if(![agreement.first.senderHandle,agreement.second.senderHandle].includes(sender.profileHandle)||![agreement.first.senderHandle,agreement.second.senderHandle].includes(recipient.profileHandle))bad();
 const digest=wildsWalletNativeTradeAgreementDigest(agreement);
 if(v.phase==="receipt"){
  object(v.recovery,["schema","transitionSet","verificationKai","receipt"]);
  if(v.recovery.schema!=="receiz.native-trade-recovery.v128"||v.recovery.receipt?.semanticIdempotencyKey!==`wildz:trade:${digest}`||v.recovery.transitionSet?.operationPlan?.semanticIdempotencyKey!==`wildz:trade:${digest}`||v.recovery.receipt.exactPlanDigest!==v.recovery.transitionSet.operationPlan.exactPlanDigest)bad();
  return Object.freeze(structuredClone(v));
 }
 const preparation=(p:WildsWalletNativeTradePreparation)=>{
  object(p,["schema","ownerHandle","agreementDigest","identity","valueSource","grant","ownershipSources","expiresAtKai"]);
  if(p.schema!=="wildz.wallet.native-trade-preparation.v1"||p.agreementDigest!==digest||!HEX.test(p.agreementDigest)||!/^\d{1,20}$/.test(p.expiresAtKai)||!Array.isArray(p.ownershipSources)||p.ownershipSources.length>64||![agreement.first.senderHandle,agreement.second.senderHandle].includes(p.ownerHandle))bad();
  object(p.identity,["artifact","identityProof"]);object(p.grant,["schema","applicationId","keyId","artifactDigest","grantedScopes","issuedAtKai","expiresAtKai","nonce","revocationHead","tokenType","expiresIn","refreshable","authority","authorityDigest"]);
  validateReceizOwnedValueSourceV123(p.valueSource,"settlement");
  if(p.valueSource?.schema!=="receiz.value.owned-source.v123"||p.valueSource.source?.ownerReceizId!==p.ownerHandle||p.grant.schema!=="receiz.identity.proof-authority.v123"||p.identity.identityProof?.keyId!==p.grant.keyId||!HEX.test(p.grant.authorityDigest))bad();
  for(const source of p.ownershipSources){object(source,["asset","predecessor","artifactId","head",...(source.predecessorRecovery?["predecessorRecovery"]:[]),...(source.currentCard?["currentCard"]:[])]);if(!HEX.test(source.artifactId)||!HEX.test(source.head)||source.predecessor?.schema!=="receiz.sealed-artifact-bytes.v124"||source.currentCard&&(source.asset.kind!=="creature"||source.currentCard.id!==source.asset.assetId)||source.predecessorRecovery&&source.predecessorRecovery.schema!=="receiz.native-trade-recovery.v128")bad();}
 };
 if(v.phase==="preparation"){preparation(v.preparation);if(v.preparation.ownerHandle!==sender.profileHandle)bad();}
 else{
  const f=object(v.frozen,["schema","agreement","agreementDigest","preparations","plan","bases"]);
  if(f.schema!=="wildz.wallet.native-trade-frozen.v1"||f.agreementDigest!==digest||canonicalPortableCardJson(f.agreement)!==canonicalPortableCardJson(agreement)||!Array.isArray(f.preparations)||f.preparations.length!==2||!Array.isArray(f.bases)||!f.bases.length||f.bases.length>65)bad();
  for(const p of v.frozen.preparations)preparation(p);
  if(v.frozen.preparations[0].ownerHandle!==agreement.first.senderHandle||v.frozen.preparations[1].ownerHandle!==agreement.second.senderHandle)bad();
  const p=v.frozen.plan;if(p?.schema!=="receiz.operation_plan.v124"||p.applicationId!=="wildz"||p.operationKind!=="receiz.native-trade.v128"||!HEX.test(p.exactPlanDigest)||p.semanticIdempotencyKey!==`wildz:trade:${digest}`)bad();
  object(v.approval,["schema","ownerHandle","agreementDigest","exactPlanDigest","proofs"]);
  if(v.approval.schema!=="wildz.wallet.native-trade-approval.v1"||v.approval.ownerHandle!==sender.profileHandle||v.approval.agreementDigest!==digest||v.approval.exactPlanDigest!==p.exactPlanDigest||!Array.isArray(v.approval.proofs)||v.approval.proofs.length!==v.frozen.bases.length)bad();
  const ids=new Set<string>();for(const proof of v.approval.proofs){object(proof,["operationId","proof"]);object(proof.proof,["schema","keyId","alg","challengeB64Url","signatureB64Url"]);if(ids.has(proof.operationId)||!v.frozen.bases.some(b=>b.basis.operationId===proof.operationId)||proof.proof.schema!=="receiz.identity.login_proof.v1"||proof.proof.keyId!==v.frozen.preparations.find(p=>p.ownerHandle===sender.profileHandle)?.identity.identityProof.keyId)bad();ids.add(proof.operationId);}
 }
 return Object.freeze(structuredClone(v));
}
export function wildsWalletNativeTradeMessageId(senderHandle:string,message:WildsWalletNativeTradeMessage):string{
 const sender=parseWildzPlayerCoordinate(senderHandle)??bad();const digest=sha256PortableBasis(canonicalPortableCardJson({schema:"wildz.wallet.native-trade-message-id.v1",sender:sender.profileHandle,phase:message.phase,agreementDigest:wildsWalletNativeTradeAgreementDigest(message.agreement),content:message})).replace(/^sha256:/,"");return `wilds-native-trade:${digest}`;
}

/** Only the issuer lease and transport grant may renew after the same explicit review. */
export function wildsWalletNativeTradePreparationSourcesDigest(p:WildsWalletNativeTradePreparation):string{
 return sha256PortableBasis(canonicalPortableCardJson({schema:"wildz.wallet.native-trade-reviewed-sources.v1",ownerHandle:p.ownerHandle,agreementDigest:p.agreementDigest,identityKeyId:p.identity.identityProof.keyId,grantKeyId:p.grant.keyId,applicationId:p.grant.applicationId,grantedScopes:[...p.grant.grantedScopes].sort(),valueSource:p.valueSource,ownershipSources:p.ownershipSources}));
}
