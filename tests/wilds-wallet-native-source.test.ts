import assert from "node:assert/strict";
import test from "node:test";
import { createReceizIdentityKeyFile, createReceizProofAuthorityChallenge, deriveReceizSubjectIdV122, digestReceizCanonicalV122, sha256ReceizBytes, signReceizIdentityLoginProof, serializeReceizIdentityArtifact, type ReceizProofAuthorityChallengeV123 } from "@receiz/sdk";
import { createWildzIdentityAuthorizationArtifact } from "../src/lib/receiz/wildz-identity-authorization-artifact";
import { initializeWildsWalletNativeSource, WILDS_NATIVE_SOURCE_SCOPES, wildsWalletNativeSourceStatementDigest } from "../src/lib/receiz/wilds-wallet-native-source";
const authority = { accessToken: "read-only", ownerReceizId: "alice-user", actorId: "alice", profileHandle: "alice.receiz.id" };
const h=(c:string)=>c.repeat(64);
async function fixture() {
  const {keyFile}=await createReceizIdentityKeyFile({owner:{uid:"alice.receiz.id",username:"alice"}});
  const safe=await createWildzIdentityAuthorizationArtifact(keyFile);
  const created=createReceizProofAuthorityChallenge({applicationId:"wildz",artifactDigest:safe.artifactDigest,scopes:WILDS_NATIVE_SOURCE_SCOPES,consentStatementDigest:await wildsWalletNativeSourceStatementDigest(keyFile.keyId,safe.artifactDigest),ttlPulses:60});
  const proof=await signReceizIdentityLoginProof({keyFile,challengeB64Url:created.challengeB64Url});
  const body={artifact:safe.artifact,challenge:{...created.challenge,proof}};
  let ready=false, seals=0, admits=0, exchanges=0;
  const bytes=new TextEncoder().encode("test sealer boundary exact bytes"); const proofDigest=await sha256ReceizBytes(bytes);
  const rail={nativeValueTransferCapabilitiesV123:async()=>({schema:"receiz.value.transfer-capabilities.v123",userId:authority.ownerReceizId,sourceAvailable:ready,registeredScopes:WILDS_NATIVE_SOURCE_SCOPES,deviceEdgeAuthorizationRequired:true}),
    exchangeProofAuthorityV123:async(input:unknown)=>{exchanges++;assert.equal(JSON.stringify(input).includes(keyFile.crypto.privateKeyPkcs8B64u!),false);return {accessToken:"device-approved"};},
    client:{assets:{createProofObject:async(input: {payload:{bytes:Uint8Array}},options:{idempotencyKey:string})=>{seals++; assert.equal(new TextDecoder().decode(input.payload.bytes),safe.artifact); assert.match(options.idempotencyKey,/wildz:native-wallet-source:/);return {artifact:new File([bytes],"wallet.png",{type:"image/png"}),filename:"wallet.png",mimeType:"image/png",artifactSha256:proofDigest,payloadSha256:safe.artifactDigest};}}},
    admitSubjectV122:async(input:{ownerReceizId:string;expectedAbsent:boolean})=>{admits++;assert.equal(input.ownerReceizId,authority.profileHandle);assert.equal(input.expectedAbsent,true); const subjectId=await deriveReceizSubjectIdV122(proofDigest);const basis={schema:"receiz.subject.admission-receipt.v122",subjectId,proofObjectId:"artifact:actual-sealer-boundary",admittedProofDigest:proofDigest,immutableProofVersion:proofDigest,ownerReceizId:authority.profileHandle,ownerProofDigest:h("1"),genesisHead:h("2"),registryDigest:h("3"),reducerDigest:h("4"),kai:1000,idempotencyIdentityDigest:h("5"),authority:{receiptIsProofAuthority:false,strongerTruth:"sealed-receiz-proof-object"}};ready=true;return {ok:true,subjectId,head:basis.genesisHead,proofDigest,registryDigest:basis.registryDigest,reducerDigest:basis.reducerDigest,receipt:{...basis,receiptDigest:await digestReceizCanonicalV122(basis)}};}
  };
  return {keyFile,body,rail,ready:()=>{ready=true;},counts:()=>({seals,admits,exchanges}),run:(b:unknown=body)=>initializeWildsWalletNativeSource(authority,b,{keyId:keyFile.keyId,createAdapter:()=>rail as never})};
}
test("wallet initialization seals only safe same-identity bytes and admits the SDK-derived owned coordinate once",async()=>{const f=await fixture();assert.deepEqual(await f.run(),{status:"ready"});assert.deepEqual(await f.run(),{status:"ready"});assert.deepEqual(f.counts(),{seals:1,admits:1,exchanges:1});});
test("already initialized wallet requires no signing preparation, seal or admission",async()=>{const f=await fixture();f.ready();assert.deepEqual(await f.run(null),{status:"ready"});assert.deepEqual(f.counts(),{seals:0,admits:0,exchanges:0});});
test("plaintext private-key transport and crossed consent fail before proof exchange or seal",async()=>{
 const f=await fixture();await assert.rejects(f.run({...f.body,artifact:serializeReceizIdentityArtifact(f.keyFile)}),/identity_mismatch/);
 await assert.rejects(f.run({...f.body,challenge:{...f.body.challenge,consent:{approved:true,statementDigest:h("9")}}}),/consent_invalid/);
 assert.deepEqual(f.counts(),{seals:0,admits:0,exchanges:0});
});
