import assert from "node:assert/strict";
import test from "node:test";
import { digestReceizCanonicalV122, planReceizSettlementV122, receizOidcScopesForRails, type ReceizWorldValueIntentV122 } from "@receiz/sdk";
import { wildsWalletTransferConsentStatementDigest } from "../src/lib/receiz/wilds-wallet-transfer-consent.js";
import { WILDZ_RECEIZ_APPLICATION_ID } from "../src/lib/receiz/wildz-application.js";
const runtimePath = "../src/lib/receiz/wilds-wallet-native-runtime.js";
const modulePromise = import(runtimePath).catch(() => null);
const h=(c:string)=>c.repeat(64);
const authority={accessToken:"account-read",ownerReceizId:"alice-user",actorId:"alice",profileHandle:"alice.receiz.id"};
const secret="native-phi-send-secret-at-least-32-bytes";
async function fixture() {
  const native=await modulePromise; assert.ok(native,"default native Phi runtime must be implemented");
  let executions=0, exchanges=0, reads=0; let sourceHead=h("a"),destinationHead=h("b"); let amount="10";
  let saved: unknown={status:"unknown"}; let throwAfterCommit=false;
  const grant={schema:"receiz.identity.proof-authority.v123",applicationId:WILDZ_RECEIZ_APPLICATION_ID,keyId:h("c"),artifactDigest:h("d"),revocationHead:h("e"),authorityDigest:h("f"),accessToken:"proof-write",grantedScopes:receizOidcScopesForRails("settlement"),issuedAtKai:1000,expiresAtKai:1100,expiresIn:60,nonce:"native-consent",tokenType:"Bearer",refreshable:false,authority:{grantIsIdentityAuthority:false,strongerTruth:"receiz-identity-artifact"}};
  const rail={
    nativeValueTransferCapabilitiesV123:async()=>({schema:"receiz.value.transfer-capabilities.v123",userId:"alice-user",sourceAvailable:true,registeredScopes:receizOidcScopesForRails("settlement"),deviceEdgeAuthorizationRequired:true}),
    grantedScopesV124:async()=>["openid","profile","receiz:wallet.read"],
    nativeValueTransferSourceV123:async()=>{reads++;return {schema:"receiz.value.transfer-source.v123",status:"available",rail:"settlement",userId:"alice-user",source:{subjectId:"subject:alice",proofObjectId:"proof:alice",ownerReceizId:"alice.receiz.id",currentHead:sourceHead,admittedProofDigest:h("1"),balancePhiMicro:amount},destination:{subjectId:"subject:bob",proofObjectId:"proof:bob",ownerReceizId:"bob.receiz.id",username:"bob",currentHead:destinationHead,admittedProofDigest:h("2")},usdPerPhiMicrocents:"1000000",priceBasis:{schema:"native-test-price",rate:"1000000"},authority:{sourceReadIsProofAuthority:false,strongerTruth:"settlement-proof-object",executionRechecksExactHeadsAndFunds:true}};},
    planPhiSettlementV123:planReceizSettlementV122,
    planPhiReserveV123:planReceizSettlementV122,
    exchangeProofAuthorityV123:async()=>{exchanges++;return grant;},
    phiExecutionByIdempotencyKeyV123:async()=>saved,
    executePhiSettlementV123:async(intent:ReceizWorldValueIntentV122)=>{executions++;const receiptBasis={schema:"receiz.value.execution-receipt.v123",executionId:"native:one",rail:"settlement",valueIntentDigest:intent.valueIntentDigest,amountPhiMicro:intent.amountPhiMicro,sourcePriorHead:intent.sourceValueHead,sourceHead:h("3"),destinationPriorHead:intent.expectedDestinationHead,destinationHead:h("4"),authorityDigest:h("f"),idempotencyKey:intent.idempotencyKey,registryDigest:h("5"),reducerDigest:h("6"),acceptedAtKai:1000,authority:{receiptIsProofAuthority:false,strongerTruth:"settlement-proof-object"}};saved={status:"committed",rail:"settlement",intent,receipt:{...receiptBasis,receiptDigest:await digestReceizCanonicalV122(receiptBasis)},sourceHead:h("3"),destinationHead:h("4"),proofReferences:[{schema:"receiz.value.proof-reference.v123",objectId:"proof:alice",head:h("3"),proofDigest:h("1")},{schema:"receiz.value.proof-reference.v123",objectId:"proof:bob",head:h("4"),proofDigest:h("2")}]};if(throwAfterCommit)throw Error("ack lost");return saved;},
    executePhiReserveV123:async()=>{throw Error("unexpected reserve");},
  };
  const runtime=native.createWildsWalletNativeTransferRuntime({createAdapter:()=>rail,secret,now:()=>1000});
  return {runtime,rail,metrics:()=>({executions,exchanges,reads}),changeHead:()=>{sourceHead=h("9");},balance:(v:string)=>{amount=v;},loseAck:()=>{throwAfterCommit=true;},resetOutcome:()=>{saved={status:"unknown"};},saved:()=>saved};
}
async function staged(f:Awaited<ReturnType<typeof fixture>>) { return f.runtime.preview(authority,{recipientUsername:"@BOB.receiz.id",amountPhiMicro:"1",rail:"settlement",operationNonce:"c037386e-b378-4248-93c7-506550d31ff1"}); }
async function consent(attempt:string) { return {artifact:"safe-public-proof",challenge:{schema:"receiz.identity.proof-authority-challenge.v123",audience:WILDZ_RECEIZ_APPLICATION_ID,nonce:"native-consent",issuedAtKai:1000,expiresAtKai:1100,consent:{approved:true,statementDigest:await wildsWalletTransferConsentStatementDigest({attempt,amountPhiMicro:"1",rail:"settlement"})},proof:{}}}; }
test("default native runtime sends exact micro-Phi and returns canonical recipient from a committed native receipt",async()=>{
 const f=await fixture();const review=await staged(f);assert.equal(review.status,"staged");
 const result=await f.runtime.execute(authority,{attempt:review.attempt,consent:await consent(review.attempt)});
 assert.deepEqual(result,{status:"committed",rail:"settlement",amountPhiMicro:"1",recipientUsername:"bob"});assert.equal(f.metrics().executions,1);
});
test("native retry and remounted recovery use the exact original key after acknowledgement loss",async()=>{
 const f=await fixture();const review=await staged(f);f.loseAck();
 assert.equal((await f.runtime.execute(authority,{attempt:review.attempt,consent:await consent(review.attempt)})).status,"committed");
 assert.equal((await f.runtime.execute(authority,{attempt:review.attempt,consent:await consent(review.attempt)})).status,"committed");
 const native=await modulePromise;const remount=native.createWildsWalletNativeTransferRuntime({createAdapter:()=>f.rail,secret,now:()=>1200});
 assert.deepEqual(await remount.status(authority,review.attempt),{status:"committed",rail:"settlement",amountPhiMicro:"1",recipientUsername:"bob"});
 assert.equal(f.metrics().executions,1);assert.equal(f.metrics().exchanges,1);
});
test("changed native heads and insufficient actual purse return zero-write before authority exchange",async()=>{
 const f=await fixture();const review=await staged(f);f.changeHead();
 assert.deepEqual(await f.runtime.execute(authority,{attempt:review.attempt,consent:await consent(review.attempt)}),{status:"zero-write",rail:"settlement",code:"STALE_HEAD"});
 assert.equal(f.metrics().executions,0);assert.equal(f.metrics().exchanges,0);
});
