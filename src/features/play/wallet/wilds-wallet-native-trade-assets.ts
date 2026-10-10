"use client";
import {readReceizCommittedNativeTradeRecoveryV128,readReceizCommittedNativeTradeRecoveryProofV128,receizBase64UrlDecode,receizBase64UrlEncode,verifyReceizArtifact,type ReceizCommittedNativeTradeV128,type ReceizNativeOwnershipTransitionMemberV128} from "@receiz/sdk";
import {prepareWildsRoamingOwnerFile} from "@/lib/receiz/wilds-roaming-source-browser";
import {readWildsWalletNativeAcceptedSource,retainWildsWalletNativeAcceptedSources,retainWildsWalletNativeAcceptedProof} from "./wilds-wallet-native-trade-attempt-store";
import type {WildsWalletNativeTradeAttempt} from "./wilds-wallet-native-trade-controller";
import type {WildsWalletNativeOwnershipSource} from "./wilds-wallet-native-trade-context";
import type {PortableCardAsset} from "../portable-card";

/** Select the held Original, retaining its existing native ownership history. */
export async function prepareWildsWalletNativeCreatureSource(card:PortableCardAsset,owner:string):Promise<WildsWalletNativeOwnershipSource>{
 const source=await prepareWildsRoamingOwnerFile(card,owner),predecessor={schema:"receiz.sealed-artifact-bytes.v124" as const,exactBytesB64u:receizBase64UrlEncode(source.artifactBytes),artifactSha256:source.artifactSha256,payloadSha256:source.payloadSha256,filename:source.filename,mimeType:source.mimeType};
 const checked=await verifyReceizArtifact(new File([source.artifactBytes.slice().buffer],source.filename,{type:source.mimeType}));
 if(checked.status!=="verified-artifact"||checked.continuity.carrier!=="native_record_seal"||checked.continuity.ownerReceizId!==owner||!checked.continuity.artifactId||!checked.continuity.historyDigestSha256)throw Error("This creature's native ownership source is unavailable. Refresh its original card.");
 const predecessorRecovery=await readWildsWalletNativeAcceptedSource(owner,source.artifactSha256);
 return {asset:{kind:"creature",assetId:card.id},predecessor,artifactId:checked.continuity.artifactId,head:checked.continuity.historyDigestSha256,currentCard:structuredClone(card),...(predecessorRecovery?{predecessorRecovery}:{})};
}

/** Device projection follows genuine SDK committed custody; a delivered offer never reaches this path. */
export async function adoptWildsWalletNativeTradeAssets(input:Readonly<{
 committed:ReceizCommittedNativeTradeV128;attempt:WildsWalletNativeTradeAttempt;owner:string;
 currentOwner():string;
 restoreCreature(file:File,card:PortableCardAsset,committed:ReceizCommittedNativeTradeV128):Promise<void>;removeCreature(assetId:string):void;
 adoptResources(committed:ReceizCommittedNativeTradeV128):Promise<void>;
 refreshWallet():Promise<unknown>;
}>):Promise<void>{
 const current=()=>{if(input.currentOwner()!==input.owner)throw Error("The active account changed while recovering this exchange.");};current();
 const recovery=readReceizCommittedNativeTradeRecoveryV128(input.committed);
 if(!input.attempt.frozen||recovery.receipt.exactPlanDigest!==input.attempt.frozen.plan.exactPlanDigest)throw Error("The accepted exchange changed its reviewed package.");
 await retainWildsWalletNativeAcceptedProof(input.owner,readReceizCommittedNativeTradeRecoveryProofV128(input.committed));current();
 await retainWildsWalletNativeAcceptedSources(input.owner,recovery);current();
 const sources=input.attempt.frozen.preparations.flatMap(p=>p.ownershipSources);
 const {defaultWildzProofSourceRepository}=await import("@/lib/receiz/wildz-identity-adapter");
 let resources=false;
 for(const raw of recovery.transitionSet.members){
  const member=raw as ReceizNativeOwnershipTransitionMemberV128;if(member.schema!=="receiz.native-ownership-transition-member.v128")continue;
  const basis=member.signedAtomicHandoff.basis,source=sources.find(s=>s.artifactId===basis.intent.assetId);if(!source)throw Error("The accepted asset is absent from the reviewed package.");
  if(!recovery.receipt.candidateArtifactSha256s.includes(member.candidate.artifactSha256)||member.predecessor.artifactSha256!==source.predecessor.artifactSha256)throw Error("The accepted native asset changed its original source.");
  if(source.asset.kind!=="creature"){resources=true;continue;}
  const bytes=receizBase64UrlDecode(member.candidate.exactBytesB64u);
  // Preserve the true successor bytes for later device export and retransfers.
  await defaultWildzProofSourceRepository.retain({bytes,filename:member.candidate.filename,mimeType:member.candidate.mimeType,assetId:source.asset.assetId});current();
  if(basis.intent.toOwnerReceizId===input.owner){
   if(!source.currentCard)throw Error("The creature's verified gameplay projection is unavailable.");
   // The existing restore boundary checks opened payload, native custody and causal gameplay sidecar.
   await input.restoreCreature(new File([bytes.slice().buffer],member.candidate.filename,{type:member.candidate.mimeType}),source.currentCard,input.committed);current();
  }else if(basis.intent.fromOwnerReceizId===input.owner)input.removeCreature(source.asset.assetId);
 }
 if(resources){await input.adoptResources(input.committed);current();}
 await input.refreshWallet();
}
