"use client";
import { createReceizArtifactAdmissionEngine, readReceizCommittedNativeTradeRecoveryV128, verifyReceizNativeTradeIdentitySourceV128, deriveReceizSubjectIdV122, createReceizNativeOwnershipHandoffBasisV128, createReceizProofAuthorityChallenge, digestReceizCanonicalV122, planReceizNativeTradeV128, readReceizNativeTradePlanV128, receizBase64UrlDecode, receizBase64UrlEncode, receizKaiNow, receizOidcScopesForRails, sha256ReceizBytes, signReceizIdentityLoginProof, signReceizNativeOwnershipTransitionApprovalV128, signReceizNativeValueTransitionApprovalV128, validateReceizOwnedValueSourceV123, validateReceizProofAuthorityV123, verifyReceizArtifact, type ReceizNativeTradeOperationV128, type ReceizNativeTradeTransitionSetV128, type ReceizNativeValueIntentV128, type ReceizNativeValueTransitionBasisV128, type ReceizNativeOwnershipHandoffBasisV128, type ReceizNativeOwnershipIntentV128, type ReceizPortableSealedArtifactV124, type ReceizProofAuthorityV123, type ReceizKeyFile, type ReceizNativeOwnershipIdentityV128 } from "@receiz/sdk";
import { createWildzIdentityAuthorizationArtifact } from "@/lib/receiz/wildz-identity-authorization-artifact";
import { readWildzIdentityForSigning } from "@/lib/receiz/wildz-identity-signing-read";
import { WILDZ_RECEIZ_APPLICATION_ID } from "@/lib/receiz/wildz-application";
import { canonicalPortableCardJson } from "../portable-card";
import { createWildsWalletNativeSdkClient } from "./wilds-wallet-native-sdk-client";
import { wildsWalletBrowserNativeTradeAttemptStore } from "./wilds-wallet-native-trade-attempt-store";
import { createWildsWalletNativeTradeController, type WildsWalletNativeTradeAttempt, type WildsWalletNativeTradePorts } from "./wilds-wallet-native-trade-controller";
import { wildsWalletNativeTradeAgreementDigest, type WildsWalletFrozenNativeTrade, type WildsWalletNativeOwnershipSource, type WildsWalletNativeTradeBasis, type WildsWalletNativeTradeMessage, type WildsWalletNativeTradePreparation } from "./wilds-wallet-native-trade-context";
import type { WildsWalletTradeAgreement } from "./wilds-wallet-trade";
import type { WildsWalletAssetSendAsset } from "./wilds-wallet-asset-send";
import {assertWildsWalletNativeTradeSourceSelection} from "./wilds-wallet-native-trade-source-binding";
import {initializeWildsWalletNativeSourceWithIdentity} from "./wilds-wallet-native-source-initialization";
const DOMAIN={scheme:"receiz-commit-domain.v1" as const,value:"world:wildz:trade"};
const MAX=9223372036854775807n;
const sorted=<T>(v:Record<string,T>)=>Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)));
const coordinate=(p:WildsWalletNativeTradePreparation)=>{const {balancePhiMicro:_,...source}=p.valueSource.source;return source;};
function net(a:WildsWalletTradeAgreement){const value=BigInt(a.first.draft.offered.phiMicro)-BigInt(a.second.draft.offered.phiMicro);if(value>MAX||value< -MAX)throw Error("This exchange exceeds the native PHI amount limit.");return value;}
export async function verifyWildsWalletNativeOwnershipSource(source:WildsWalletNativeOwnershipSource,owner:string){
 const p=source.predecessor,bytes=receizBase64UrlDecode(p.exactBytesB64u);if(await sha256ReceizBytes(bytes)!==p.artifactSha256)throw Error("The exact asset source changed.");
 const opened=await createWildsWalletNativeSdkClient().artifacts.verifyAndOpen(new File([bytes.slice().buffer],p.filename,{type:p.mimeType}));
 const native=opened.sealedArtifact.verification.assetContinuity;
 if(opened.legacyCompatibility!=="current-native"||opened.sealedArtifact.artifactSha256!==p.artifactSha256||opened.verifiedPayload.sha256!==p.payloadSha256||!opened.sealedArtifact.verification.bundle.nativeRecordSeal||opened.sealedArtifact.continuity.ownerReceizId!==owner||native?.state!=="verified"||native.artifactId!==source.artifactId||native.historyDigestSha256!==source.head)throw Error("The native asset source does not match the reviewed owner and head.");
 assertWildsWalletNativeTradeSourceSelection(source,opened.verifiedPayload.bytes);
 return opened;
}
export function createWildsWalletNativeTradeRuntime(input:Readonly<{
 owner():string;keyId():string;
 ownershipSource(asset:WildsWalletAssetSendAsset,agreementDigest:string,index:number,context:Readonly<{keyFile:ReceizKeyFile;authority:ReceizProofAuthorityV123;identity():Promise<ReceizNativeOwnershipIdentityV128>}>):Promise<WildsWalletNativeOwnershipSource>;
 publish(recipient:string,message:WildsWalletNativeTradeMessage):Promise<boolean>;
 adopt(committed:Parameters<WildsWalletNativeTradePorts["adopt"]>[0],attempt:Parameters<WildsWalletNativeTradePorts["adopt"]>[1],context:Readonly<{keyFile:ReceizKeyFile;authority:ReceizProofAuthorityV123;identity():Promise<ReceizNativeOwnershipIdentityV128>}>):Promise<void>;
 store?:WildsWalletNativeTradePorts["store"];
}>){
 const client=createWildsWalletNativeSdkClient();const store=input.store??wildsWalletBrowserNativeTradeAttemptStore;let held:Readonly<{keyId:string;digest:string;grant:ReceizProofAuthorityV123}>|null=null;
 async function authorize(agreement:WildsWalletTradeAgreement,minimumRemaining=2){
  const digest=wildsWalletNativeTradeAgreementDigest(agreement),keyId=input.keyId();if(held?.keyId===keyId&&held.digest===digest&&held.grant.expiresAtKai>receizKaiNow().pulse+minimumRemaining)return held.grant;
  const keyFile=await readWildzIdentityForSigning(keyId),transport=await createWildzIdentityAuthorizationArtifact(keyFile);
  const scopes=[...new Set([...receizOidcScopesForRails("settlement"),"receiz:wallet.read","receiz:subjects.read","receiz:subjects.write","receiz:record","receiz:seal"])].sort();
  const issued=createReceizProofAuthorityChallenge({applicationId:WILDZ_RECEIZ_APPLICATION_ID,artifactDigest:transport.artifactDigest,scopes,consentStatementDigest:await digestReceizCanonicalV122({schema:"wildz.native-trade-device-consent.v1",agreementDigest:digest,agreement}),ttlPulses:60});
  const proof=await signReceizIdentityLoginProof({keyFile,challengeB64Url:issued.challengeB64Url});
  const grant=await client.identity.exchangeProofAuthority({artifact:transport.artifact,challenge:{...issued.challenge,proof},applicationId:WILDZ_RECEIZ_APPLICATION_ID,scopes});
  if(input.keyId()!==keyId||grant.keyId!==keyId)throw Error("The active account changed. Reopen Trade.");held={keyId,digest,grant};return grant;
 }
 async function planFor(agreement:WildsWalletTradeAgreement,preparations:readonly [WildsWalletNativeTradePreparation,WildsWalletNativeTradePreparation]){
  const digest=wildsWalletNativeTradeAgreementDigest(agreement),heads:Record<string,string>={},operations:ReceizNativeTradeOperationV128[]=[];
  for(const [index,p]of preparations.entries()){
   const party=index===0?agreement.first:agreement.second,peer=index===0?agreement.second:agreement.first;
   if(p.ownerHandle!==party.senderHandle||p.agreementDigest!==digest||canonicalPortableCardJson(p.ownershipSources.map(s=>s.asset))!==canonicalPortableCardJson(party.draft.offered.assets))throw Error("The final plan substituted the reviewed package.");
   const source=validateReceizOwnedValueSourceV123(p.valueSource,"settlement");if(source.source.ownerReceizId!==p.ownerHandle)throw Error("The native purse belongs to another user.");
   await verifyReceizNativeTradeIdentitySourceV128({identity:p.identity,ownerReceizId:p.ownerHandle});
   const publicGrant=await validateReceizProofAuthorityV123({...p.grant,accessToken:"public-metadata-validation-only"});
   if(publicGrant.keyId!==p.identity.identityProof.keyId||publicGrant.applicationId!==WILDZ_RECEIZ_APPLICATION_ID||source.source.subjectId!==await deriveReceizSubjectIdV122(source.sourceArtifact.artifactSha256))throw Error("The native identity, grant and purse coordinate disagree.");
   const bytes=receizBase64UrlDecode(source.sourceArtifact.exactBytesB64u),verified=await verifyReceizArtifact(new File([bytes.slice().buffer],source.sourceArtifact.filename,{type:source.sourceArtifact.mimeType}));
   if(verified.status!=="verified-artifact"||!verified.verification.bundle.nativeRecordSeal||verified.artifactDigest.value!==source.source.admittedProofDigest||verified.payloadDigest.value!==source.sourceArtifact.payloadSha256)throw Error("The native purse original is not admitted.");
   const admitted=await createReceizArtifactAdmissionEngine()(verified,{profile:"document"});
   if(admitted.verdict!=="verified-document"||admitted.ownerReceizId!==p.ownerHandle||admitted.artifactId!==source.source.proofObjectId)throw Error("The native purse original belongs to another source.");
   for(const [j,s]of p.ownershipSources.entries()){
    await verifyWildsWalletNativeOwnershipSource(s,p.ownerHandle);
    const participantId=`asset:${s.artifactId}`;if(Object.hasOwn(heads,participantId))throw Error("One native asset cannot appear twice in this exchange.");heads[participantId]=s.head;
    const intent:ReceizNativeOwnershipIntentV128={assetId:s.artifactId,fromOwnerReceizId:p.ownerHandle,toOwnerReceizId:peer.senderHandle,participantId};
    operations.push({operationId:`ownership:${index}:${String(j).padStart(3,"0")}`,kind:"ownership",intent});
   }
  }
  const difference=net(agreement);
  if(difference!==0n){
   const sender=preparations[difference>0n?0:1],recipient=preparations[difference>0n?1:0],source=coordinate(sender),destination=coordinate(recipient);
   const valueIntent=await client.value.planSettlement({amountPhiMicro:(difference<0n? -difference:difference).toString(),sourceProofObjectId:source.proofObjectId,sourceValueHead:source.currentHead,destinationSubjectId:destination.subjectId,expectedDestinationHead:destination.currentHead,usdPerPhiMicrocents:sender.valueSource.usdPerPhiMicrocents,priceBasis:sender.valueSource.priceBasis,idempotencyKey:`wildz:trade-value:${digest}`});
   const sourceParticipantId=`value:${source.subjectId}`,destinationParticipantId=`value:${destination.subjectId}`;heads[sourceParticipantId]=source.currentHead;heads[destinationParticipantId]=destination.currentHead;
   const intent:ReceizNativeValueIntentV128={schema:"receiz.native-value-intent.v128",valueIntent,sourceParticipantId,destinationParticipantId,sourceOwnerReceizId:sender.ownerHandle,destinationOwnerReceizId:recipient.ownerHandle};operations.push({operationId:"value:net",kind:"value",intent});
  }
  if(!operations.length)throw Error("These packages have no ownership or net PHI to exchange.");
  const expiresAtKai=preparations.map(p=>BigInt(p.expiresAtKai)).reduce((a,b)=>a<b?a:b).toString();
  return planReceizNativeTradeV128({applicationId:WILDZ_RECEIZ_APPLICATION_ID,commitDomain:DOMAIN,operations:operations.sort((a,b)=>a.operationId.localeCompare(b.operationId)),expectedParticipantHeads:sorted(heads),semanticIdempotencyKey:`wildz:trade:${digest}`,attemptId:`wildz:trade-attempt:${digest}`,expiresAtKai});
 }
 const ports:WildsWalletNativeTradePorts={owner:input.owner,store,publish:input.publish,async adopt(committed,attempt){
   const peer=attempt.agreement.first.senderHandle===attempt.owner?attempt.agreement.second.senderHandle:attempt.agreement.first.senderHandle;
   // Notification triggers exact SDK recovery on an already approved peer device.
   if([attempt.owner,peer].sort()[0]===attempt.owner)try{await input.publish(peer,{kind:"trade-native",phase:"receipt",agreement:attempt.agreement,recovery:readReceizCommittedNativeTradeRecoveryV128(committed)});}catch{}
   const authority=await authorize(attempt.agreement),keyFile=await readWildzIdentityForSigning(input.keyId());
   let identity:Promise<ReceizNativeOwnershipIdentityV128>|null=null;
   await input.adopt(committed,attempt,{keyFile,authority,identity:()=>identity??=client.nativeTrade.identitySource({applicationId:WILDZ_RECEIZ_APPLICATION_ID,ownerReceizId:attempt.owner,keyFile,authority})});
  },
  preparationCurrent(preparation){return BigInt(preparation.expiresAtKai)>BigInt(receizKaiNow().pulse+8)&&preparation.grant.expiresAtKai>receizKaiNow().pulse+8;},
  async refreshPreparation(agreement,preparation){
   const owner=input.owner(),keyId=input.keyId();if(preparation.ownerHandle!==owner||preparation.agreementDigest!==wildsWalletNativeTradeAgreementDigest(agreement)||preparation.grant.keyId!==keyId||preparation.identity.identityProof.keyId!==keyId)throw Error("The approving identity changed. Review a new agreement.");
   const grant=await authorize(agreement,30),keyFile=await readWildzIdentityForSigning(keyId);
   const identity=await client.nativeTrade.identitySource({applicationId:WILDZ_RECEIZ_APPLICATION_ID,ownerReceizId:owner,keyFile,authority:grant});
   const {accessToken:_,...publicGrant}=grant;
   return {...preparation,identity,grant:publicGrant,expiresAtKai:String(Math.min(grant.expiresAtKai,receizKaiNow().pulse+25))};
  },
  async prepare(agreement){
   const owner=input.owner(),party=agreement.first.senderHandle===owner?agreement.first:agreement.second;if(party.senderHandle!==owner)throw Error("Review the agreement for the current account.");
   const digest=wildsWalletNativeTradeAgreementDigest(agreement),grant=await authorize(agreement,30),keyFile=await readWildzIdentityForSigning(input.keyId());
   const difference=net(agreement),paying=(difference>0n&&agreement.first.senderHandle===owner)||(difference<0n&&agreement.second.senderHandle===owner);
   let sourceIdentity:Promise<ReceizNativeOwnershipIdentityV128>|null=null;const context={keyFile,authority:grant,identity:()=>sourceIdentity??=client.nativeTrade.identitySource({applicationId:WILDZ_RECEIZ_APPLICATION_ID,ownerReceizId:owner,keyFile,authority:grant})};
   const ownershipPreparation=(async()=>{const sources:WildsWalletNativeOwnershipSource[]=[];for(const [index,asset]of party.draft.offered.assets.entries())sources.push(await input.ownershipSource(asset,digest,index,context));return sources;})();
   const valuePreparation=(async()=>{await initializeWildsWalletNativeSourceWithIdentity(keyFile.keyId);return createWildsWalletNativeSdkClient(grant.accessToken).value.ownSource({rail:"settlement",amountPhiMicro:paying?(difference<0n? -difference:difference).toString():"0"});})();
   const [valueSource,ownershipSources]=await Promise.all([valuePreparation,ownershipPreparation]);
   const readyGrant=await authorize(agreement,30),identity=await client.nativeTrade.identitySource({applicationId:WILDZ_RECEIZ_APPLICATION_ID,ownerReceizId:owner,keyFile,authority:readyGrant});
   const {accessToken:_,...publicGrant}=readyGrant;
   return {schema:"wildz.wallet.native-trade-preparation.v1",ownerHandle:owner,agreementDigest:digest,identity,valueSource,grant:publicGrant,ownershipSources,expiresAtKai:String(Math.min(readyGrant.expiresAtKai,receizKaiNow().pulse+25))};
  },
  async freeze(agreement,preparations){
   const plan=await planFor(agreement,preparations),{payload}=await readReceizNativeTradePlanV128(plan),grant=await authorize(agreement),bases:WildsWalletNativeTradeBasis[]=[];
   for(const operation of payload.operations){
    if(operation.kind==="ownership"){
     const intent=operation.intent as ReceizNativeOwnershipIntentV128,source=preparations.flatMap(p=>p.ownershipSources).find(s=>s.artifactId===intent.assetId);if(!source)throw Error("The native asset source is missing.");
     const basis=await client.nativeTrade.ownershipBasis({applicationId:WILDZ_RECEIZ_APPLICATION_ID,operationPlan:plan,operationId:operation.operationId,predecessor:source.predecessor,authority:grant,...(source.predecessorRecovery?{predecessorRecovery:source.predecessorRecovery}:{})});bases.push({kind:"ownership",basis});
    }else{
     const intent=operation.intent as ReceizNativeValueIntentV128,sender=preparations.find(p=>p.ownerHandle===intent.sourceOwnerReceizId)!,recipient=preparations.find(p=>p.ownerHandle===intent.destinationOwnerReceizId)!;
     bases.push({kind:"value",basis:{operationPlan:plan,operationId:operation.operationId,intent,source:coordinate(sender),destination:coordinate(recipient),userId:sender.valueSource.userId,grant:sender.grant}});
    }
   }
   return {schema:"wildz.wallet.native-trade-frozen.v1",agreement,agreementDigest:wildsWalletNativeTradeAgreementDigest(agreement),preparations,plan,bases};
  },
  async validateFrozen(frozen){
   if(canonicalPortableCardJson(await planFor(frozen.agreement,frozen.preparations))!==canonicalPortableCardJson(frozen.plan))throw Error("The final native plan changed the reviewed agreement.");
   const {payload}=await readReceizNativeTradePlanV128(frozen.plan);if(frozen.bases.length!==payload.operations.length||frozen.agreementDigest!==wildsWalletNativeTradeAgreementDigest(frozen.agreement))throw Error("The final plan is incomplete.");
   for(const [index,entry]of frozen.bases.entries()){
    const op=payload.operations[index]!;if(entry.basis.operationId!==op.operationId||canonicalPortableCardJson(entry.basis.operationPlan)!==canonicalPortableCardJson(frozen.plan)||canonicalPortableCardJson(entry.basis.intent)!==canonicalPortableCardJson(op.intent)||entry.kind!==op.kind)throw Error("The final native approval basis changed.");
    if(entry.kind==="ownership"){
     const source=frozen.preparations.flatMap(p=>p.ownershipSources).find(s=>s.artifactId===entry.basis.intent.assetId)!;
     const acceptedSource=source.predecessorRecovery?await client.nativeTrade.recover({recovery:source.predecessorRecovery,authority:await authorize(frozen.agreement)}):undefined;
     const actual=await createReceizNativeOwnershipHandoffBasisV128({operationPlan:frozen.plan,operationId:op.operationId,predecessor:source.predecessor,kksCoordinate:entry.basis.kksCoordinate,...(acceptedSource?{acceptedSource}:{})});if(canonicalPortableCardJson(actual)!==canonicalPortableCardJson(entry.basis))throw Error("The ownership approval source changed.");
    }else{
     const sender=frozen.preparations.find(p=>p.ownerHandle===entry.basis.intent.sourceOwnerReceizId)!,recipient=frozen.preparations.find(p=>p.ownerHandle===entry.basis.intent.destinationOwnerReceizId)!;
     if(canonicalPortableCardJson(entry.basis.source)!==canonicalPortableCardJson(coordinate(sender))||canonicalPortableCardJson(entry.basis.destination)!==canonicalPortableCardJson(coordinate(recipient))||entry.basis.userId!==sender.valueSource.userId||canonicalPortableCardJson(entry.basis.grant)!==canonicalPortableCardJson(sender.grant))throw Error("The native value approval source changed.");
    }
   }
  },
  async sign(frozen){const keyFile=await readWildzIdentityForSigning(input.keyId());const proofs=await Promise.all(frozen.bases.map(async entry=>({operationId:entry.basis.operationId,proof:entry.kind==="ownership"?await signReceizNativeOwnershipTransitionApprovalV128({basis:entry.basis,keyFile}):await signReceizNativeValueTransitionApprovalV128({basis:entry.basis,keyFile})})));return {schema:"wildz.wallet.native-trade-approval.v1",ownerHandle:input.owner(),agreementDigest:frozen.agreementDigest,exactPlanDigest:frozen.plan.exactPlanDigest,proofs};},
  async assemble(frozen,approvals){
   const grant=await authorize(frozen.agreement),members:unknown[]=[];
   for(const entry of frozen.bases){const senderHandle=entry.kind==="ownership"?entry.basis.intent.fromOwnerReceizId:entry.basis.intent.sourceOwnerReceizId,recipientHandle=entry.kind==="ownership"?entry.basis.intent.toOwnerReceizId:entry.basis.intent.destinationOwnerReceizId;
    const sender=frozen.preparations.find(p=>p.ownerHandle===senderHandle)!,recipient=frozen.preparations.find(p=>p.ownerHandle===recipientHandle)!;
    const senderProof=approvals.find(p=>p.ownerHandle===senderHandle)?.proofs.find(p=>p.operationId===entry.basis.operationId)?.proof,recipientProof=approvals.find(p=>p.ownerHandle===recipientHandle)?.proofs.find(p=>p.operationId===entry.basis.operationId)?.proof;if(!senderProof||!recipientProof)throw Error("Both exact device approvals are required.");
    if(entry.kind==="ownership"){const source=sender.ownershipSources.find(s=>s.artifactId===entry.basis.intent.assetId)!;members.push(await client.nativeTrade.prepareOwnership({applicationId:WILDZ_RECEIZ_APPLICATION_ID,operationPlan:frozen.plan,operationId:entry.basis.operationId,predecessor:source.predecessor,senderIdentity:sender.identity,recipientIdentity:recipient.identity,signedAtomicHandoff:{schema:"receiz.native-ownership-atomic-handoff.v128",basis:entry.basis,senderProof,recipientProof},authority:grant,...(source.predecessorRecovery?{predecessorRecovery:source.predecessorRecovery}:{})}));}
    else members.push({schema:"receiz.native-value-transition-member.v128",sourceArtifact:sender.valueSource.sourceArtifact,destinationArtifact:recipient.valueSource.sourceArtifact,senderIdentity:sender.identity,recipientIdentity:recipient.identity,signedValueTransition:{schema:"receiz.native-value-atomic-approval.v128",basis:entry.basis,senderProof,recipientProof}});
   }
   const predecessorRecoveries=frozen.bases.flatMap(entry=>{if(entry.kind!=="ownership")return [];const source=frozen.preparations.flatMap(p=>p.ownershipSources).find(s=>s.artifactId===entry.basis.intent.assetId);return source?.predecessorRecovery?[{operationId:entry.basis.operationId,recovery:source.predecessorRecovery}]:[];});
   return {schema:"receiz.native-trade-transition-set.v128",operationPlan:frozen.plan,members,...(predecessorRecoveries.length?{predecessorRecoveries}:{})};
  },
  async commit(transitionSet){const saved=await store.load(input.owner(),transitionSet.operationPlan.semanticIdempotencyKey.replace(/^wildz:trade:/,"")) as WildsWalletNativeTradeAttempt|undefined;const agreement=saved?.agreement;if(!agreement)throw Error("The saved exact agreement is required before committing.");return client.nativeTrade.commit({transitionSet,authority:await authorize(agreement)});},
  async resolve(agreement){return client.nativeTrade.resolve({applicationId:WILDZ_RECEIZ_APPLICATION_ID,commitDomain:DOMAIN,semanticIdempotencyKey:`wildz:trade:${wildsWalletNativeTradeAgreementDigest(agreement)}`,authority:await authorize(agreement)});}
 };
 return createWildsWalletNativeTradeController(ports);
}
