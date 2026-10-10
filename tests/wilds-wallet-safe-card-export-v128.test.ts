import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizClient, receizBase64UrlEncode, sha256ReceizBytes, type ReceizOpenedArtifact, type ReceizSealedArtifact, type ReceizClient } from "@receiz/sdk";
import { packWildzCardSealPayload } from "../src/lib/receiz/wildz-card-seal-payload";
import { cardArtifactFingerprint } from "../src/features/play/prepared-card-artifact";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { prepareSafeWildsWalletHeldCardSourceV128 } from "../src/lib/receiz/wilds-wallet-creature-bearer-source-v128";
import { appendReceizIdentityArtifactTrailerToPng,createReceizIdentityKeyFile,readReceizIdentityArtifact } from "@receiz/sdk";
import { embedPortableVaultInPng,readPortableVaultFromPng,readWildzPlayerVaultAppendFromPng } from "../src/features/play/card-export";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { applyWildsInput,initialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault } from "../src/features/play/wilds-player-vault";
import { appendWildzIdentityBindingTrailer,createWildzIdentityBinding,requireWildzIdentityBindingFromEnvelope } from "../src/lib/receiz/wildz-identity-binding";
import { createSafeWildsWalletCardExportV128 } from "../src/features/play/wallet/wilds-wallet-safe-card-export-v128";
import { matchesWildzOwnedCardExport } from "../src/lib/receiz/wildz-owned-card-export";
import { splitWildzPngEnvelope } from "../src/lib/receiz/wildz-png-envelope";

async function safeExportFixture() {
 const identity=await createReceizIdentityKeyFile({owner:{uid:"alice-user",username:"alice",displayName:"Alice"},portableState:{snapshot:{privateSentinel:"PRIVATE_ACCOUNT_NEVER_SHARED"}}});
 assert.ok(identity.keyFile.crypto.privateKeyPkcs8B64u,"fixture uses actual fresh plaintext local SDK identity");
 const card=sealCollectedCard({formId:"mintcub-1",ownerReceizId:"alice.receiz.id",encounterId:"safe-export",capturedAt:"2026-07-15T12:00:00.000Z"});
 const player=createWildsPlayerVault({playerId:"alice.receiz.id",exportedAt:"2026-07-15T12:01:00.000Z",playState:applyWildsInput({...structuredClone(initialPlayState),inventory:[],selectedAssetId:"",selectedCardId:""},{type:"import-card",asset:card}),settings:{avatarStyle:"female",movementMode:"run",audio:{music:true}},personalEvents:[],canonicalCursor:{worldId:"wilds:global:v3",revision:0,eventId:null},receipts:[]});
 const png=Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=","base64"));
 const vault=embedPortableVaultInPng(png,[card],player),proof=readPortableVaultFromPng(vault);
 const binding=await createWildzIdentityBinding({keyFile:identity.keyFile,playerId:player.playerId,vaultDigest:proof.vaultDigest,playerPayloadDigest:player.payloadDigest});
 const original=appendWildzIdentityBindingTrailer(appendReceizIdentityArtifactTrailerToPng(vault,identity.keyFile),binding);
 const safe=await createSafeWildsWalletCardExportV128(original);
 return { identity,card,original,safe,binding };
}

test("fresh SDK identity export preserves the original signature and exact card while sharing no signing key/account archive",async()=>{
 const {identity,card,original,safe,binding}=await safeExportFixture(),opened=await readReceizIdentityArtifact(safe);
 assert.equal(opened.keyId,identity.keyFile.keyId);assert.equal(opened.crypto.publicKeyRawB64u,identity.keyFile.crypto.publicKeyRawB64u);
 assert.equal(opened.crypto.privateKeyPkcs8B64u,null);assert.ok(opened.crypto.privateKeyPkcs8CiphertextB64u);assert.equal(opened.portableState,null);
 assert.equal((await requireWildzIdentityBindingFromEnvelope(safe)).signatureB64Url,binding.signatureB64Url);
 assert.deepEqual(readPortableVaultFromPng(splitWildzPngEnvelope(safe).pngBasis).assets,readPortableVaultFromPng(splitWildzPngEnvelope(original).pngBasis).assets);
 assert.deepEqual(readWildzPlayerVaultAppendFromPng(splitWildzPngEnvelope(safe).pngBasis).player,readWildzPlayerVaultAppendFromPng(splitWildzPngEnvelope(original).pngBasis).player);
 assert.equal(await matchesWildzOwnedCardExport(safe,{asset:card,keyId:identity.keyFile.keyId,ownerReceizId:"alice.receiz.id"}),true);
 assert.equal(new TextDecoder().decode(safe).includes(identity.keyFile.crypto.privateKeyPkcs8B64u!),false);
 assert.equal(JSON.stringify(opened).includes("PRIVATE_ACCOUNT_NEVER_SHARED"),false);
});


test("cold safe source retry uses the exact signed encrypted payload and idempotency after a lost seal reply",async()=>{
 const {identity,card,safe}=await safeExportFixture(),database=createMemoryWildzContinuityDatabase(),packed=await packWildzCardSealPayload(safe);
 const ownerHandle="alice.receiz.id",keyId=identity.keyFile.keyId,fingerprint=cardArtifactFingerprint(card);
 const key=JSON.stringify(["wildz.wallet.safe-held-source.v128",ownerHandle,keyId,card.id,fingerprint]);
 // Reconstruct the actual pre-write durable checkpoint. Its signature, exact
 // card and lack of private material are independently re-verified on every retry.
 const preparation={schema:"wildz.wallet.safe-held-source.v128",ownerHandle,keyId,assetId:card.id,fingerprint,packedB64u:receizBase64UrlEncode(packed),original:null};
 await database.transaction(["meta"],"readwrite",tx=>tx.put("meta",preparation,key));
 const requests:Array<{bytes:Uint8Array;id:string}>=[],economicWrites=new Set<string>();let loseReply=true;
 const artifactBytes=new TextEncoder().encode("mock native root seal boundary"),artifactSha256=await sha256ReceizBytes(artifactBytes),payloadSha256=await sha256ReceizBytes(packed);
 const artifact={kind:"receiz.native-record-seal",artifact:new Blob([artifactBytes]),filename:"held.receizbundle",mimeType:"application/json",artifactSha256,payloadSha256,continuity:{ownerReceizId:ownerHandle}} as unknown as ReceizSealedArtifact;
 const sdk=createReceizClient({fetchImpl:async()=>{throw Error("No production calls in fixture");}});
 const assets:ReceizClient["assets"]={...sdk.assets,createProofObject:async(input,options)=>{
   const bytes=input.payload.bytes,id=options!.idempotencyKey!;requests.push({bytes:bytes.slice(),id});economicWrites.add(id);
   if(loseReply)throw Error("lost native reply");return artifact;
 }};
 const artifacts:ReceizClient["artifacts"]={...sdk.artifacts,verifyAndOpen:async()=>({legacyCompatibility:"current-native",sealedArtifact:artifact,verifiedPayload:{bytes:packed,sha256:payloadSha256}} as unknown as ReceizOpenedArtifact)};
 // Explicit native root/transport test ports; production opens remain pinned.
 Object.defineProperty(sdk,"assets",{value:assets});Object.defineProperty(sdk,"artifacts",{value:artifacts});
 await assert.rejects(prepareSafeWildsWalletHeldCardSourceV128(sdk,card,undefined,{ownerHandle,keyId,database,retainBirth:true}),/lost native reply/);
 const birth=await database.read<{card:typeof card}>("meta",JSON.stringify(["wildz.wallet.creature-birth.v128",ownerHandle,keyId,card.id]));
 assert.ok(birth);assert.equal(cardArtifactFingerprint(birth.card),fingerprint);
 loseReply=false;
 const original=await prepareSafeWildsWalletHeldCardSourceV128(sdk,birth.card,undefined,{ownerHandle,keyId,database,retainBirth:true});
 assert.equal(original.artifactSha256,artifactSha256);assert.equal(requests.length,2);assert.equal(economicWrites.size,1);
 assert.equal(requests[0]!.id,requests[1]!.id);assert.deepEqual(requests[0]!.bytes,requests[1]!.bytes);
 await prepareSafeWildsWalletHeldCardSourceV128(sdk,birth.card,undefined,{ownerHandle,keyId,database,retainBirth:true});assert.equal(requests.length,2,"confirmed native Original reopens without another seal");
 const broken={...database,read:async<T>()=>structuredClone(preparation) as T};
 await assert.rejects(prepareSafeWildsWalletHeldCardSourceV128(sdk,card,undefined,{ownerHandle,keyId,database:broken,retainBirth:true}),/birth could not be saved/);
 assert.equal(requests.length,2,"failed durable birth readback writes nothing natively");
 const invalid={...preparation,packedB64u:receizBase64UrlEncode(await packWildzCardSealPayload(await createSafeWildsWalletCardExportV128(safe)))};
 await database.transaction(["meta"],"readwrite",tx=>tx.put("meta",{...invalid,keyId:"another-key"},key));
 await assert.rejects(prepareSafeWildsWalletHeldCardSourceV128(sdk,card,undefined,{ownerHandle,keyId,database}),/preparation could not be saved/);
 assert.equal(requests.length,2);
});
