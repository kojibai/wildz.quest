import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletNativeTradeController, type WildsWalletNativeTradeAttempt, type WildsWalletNativeTradePorts } from "../src/features/play/wallet/wilds-wallet-native-trade-controller";
import { createWildsWalletTradeAgreement, createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade";
import { wildsWalletNativeTradeAgreementDigest } from "../src/features/play/wallet/wilds-wallet-native-trade-context";
const agreement=createWildsWalletTradeAgreement({senderHandle:"alice.receiz.id",draft:createWildsWalletTradeDraft({attemptId:"a",recipient:"bob",selfHandle:"alice",phiMicro:"100",requestedPhiMicro:"10",requestNote:"",selections:[]})},{senderHandle:"bob.receiz.id",draft:createWildsWalletTradeDraft({attemptId:"b",recipient:"alice",selfHandle:"bob",phiMicro:"10",requestedPhiMicro:"100",requestNote:"",selections:[]})});
function boundaryPreparation(owner:string,digest=wildsWalletNativeTradeAgreementDigest(agreement)):import("../src/features/play/wallet/wilds-wallet-native-trade-context").WildsWalletNativeTradePreparation{const h=(c:string)=>c.repeat(64);return {schema:"wildz.wallet.native-trade-preparation.v1",ownerHandle:owner,agreementDigest:digest,expiresAtKai:"9999999999",ownershipSources:[],
  identity:{artifact:{schema:"receiz.sealed-artifact-bytes.v124",exactBytesB64u:"AQ",filename:"controller-boundary.receized",mimeType:"application/octet-stream",artifactSha256:h("a"),payloadSha256:h("b")},identityProof:{schema:"receiz.identity.login_proof.v1",keyId:`key:${owner}`,alg:"Ed25519",challengeB64Url:"AQ",signatureB64Url:"AQ"}},
  valueSource:{schema:"receiz.value.owned-source.v123",rail:"settlement",userId:`user:${owner}`,source:{subjectId:`subject:${owner}`,proofObjectId:`proof:${owner}`,ownerReceizId:owner,currentHead:h(owner.startsWith("alice")?"c":"d"),admittedProofDigest:h("a"),balancePhiMicro:"1000"},sourceArtifact:{schema:"receiz.sealed-artifact-bytes.v124",exactBytesB64u:"AQ",filename:"controller-boundary.receized",mimeType:"application/octet-stream",artifactSha256:h("a"),payloadSha256:h("b")},usdPerPhiMicrocents:"1000000",priceBasis:{schema:"controller-boundary"}},
  grant:{schema:"receiz.identity.proof-authority.v123",applicationId:"wildz",keyId:`key:${owner}`,artifactDigest:h("b"),grantedScopes:["receiz:settlement.write"],issuedAtKai:1,expiresAtKai:9999999999,nonce:"controller",revocationHead:h("e"),tokenType:"Bearer",expiresIn:60,refreshable:false,authority:{grantIsIdentityAuthority:false,strongerTruth:"receiz-identity-artifact"},authorityDigest:h("f")}};}

function fixture(){let saved:WildsWalletNativeTradeAttempt|null=null,prepares=0,publishes=0,commits=0;const ports:WildsWalletNativeTradePorts={owner:()=>"alice.receiz.id",store:{load:async()=>saved,write:async(a)=>{saved=structuredClone(a);}},prepare:async()=>{prepares++;throw Error("not reached after unavailable durable checkpoint");},publish:async()=>{publishes++;return true;},freeze:async()=>{throw Error("not reached");},validateFrozen:async()=>undefined,sign:async()=>{throw Error("not reached");},assemble:async()=>{throw Error("not reached");},commit:async()=>{commits++;return {status:"unknown"};},resolve:async()=>null,adopt:async()=>undefined};return {ports,saved:()=>saved,counts:()=>({prepares,publishes,commits})};}
test("native approval fails closed before source reads or private publication on quota/write failure",async()=>{const f=fixture();const ports={...f.ports,store:{...f.ports.store,write:async()=>{throw Error("QuotaExceededError");}}};await assert.rejects(createWildsWalletNativeTradeController(ports).approveAgreement(agreement),/QuotaExceededError/);assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});});
test("native approval requires exact durable reconstruction before preparing any source",async()=>{const f=fixture();const original=f.ports.store.write;const ports={...f.ports,store:{...f.ports.store,write:async(a:WildsWalletNativeTradeAttempt)=>original({...a,agreementDigest:"0".repeat(64)})}};await assert.rejects(createWildsWalletNativeTradeController(ports).approveAgreement(agreement),/Recovery storage/);assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});});
test("checking an unapproved incoming agreement never signs, prepares, publishes or executes",async()=>{const f=fixture();assert.equal((await createWildsWalletNativeTradeController(f.ports).recoverAgreement(agreement)).status,"failed");assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});});
test("reconstructed unknown attempt remains pending when exact durable receipt cannot be resolved",async()=>{const f=fixture();await f.ports.store.write({schema:"wildz.wallet.native-trade-attempt.v1",owner:"alice.receiz.id",agreement,agreementDigest:wildsWalletNativeTradeAgreementDigest(agreement),approved:true,status:"pending"});const restored=createWildsWalletNativeTradeController({...f.ports,resolve:async()=>({status:"unknown"})});assert.equal((await restored.recoverAgreement(agreement)).status,"pending");assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});assert.equal(f.saved()?.status,"pending");});
test("an authenticated recovery outage preserves the original pending attempt and performs no new preparation",async()=>{
 const f=fixture();await f.ports.store.write({schema:"wildz.wallet.native-trade-attempt.v1",owner:"alice.receiz.id",agreement,agreementDigest:wildsWalletNativeTradeAgreementDigest(agreement),approved:true,status:"pending"});
 const controller=createWildsWalletNativeTradeController({...f.ports,resolve:async()=>{throw Error("network down");}});
 assert.equal((await controller.recoverAgreement(agreement)).status,"pending");assert.equal(f.saved()?.status,"pending");assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});
});
test("committed-looking caller JSON cannot establish an exchange receipt",async()=>{
 const f=fixture();const digest=wildsWalletNativeTradeAgreementDigest(agreement);await f.ports.store.write({schema:"wildz.wallet.native-trade-attempt.v1",owner:"alice.receiz.id",agreement,agreementDigest:digest,approved:true,status:"pending"});
 const fake={status:"committed-native-trade",committed:true,operationPlan:{semanticIdempotencyKey:`wildz:trade:${digest}`},receipt:{}} as unknown as import("@receiz/sdk").ReceizCommittedNativeTradeV128;
 const controller=createWildsWalletNativeTradeController({...f.ports,resolve:async()=>fake});await assert.rejects(controller.recoverAgreement(agreement),/complete exchange receipt/);assert.equal(f.saved()?.status,"pending");assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});
});
test("simultaneous explicit approval clicks coalesce behind one durable attempt",async()=>{
 const f=fixture();let release!:()=>void;const paused=new Promise<void>(resolve=>{release=resolve;});let preparations=0;
 const controller=createWildsWalletNativeTradeController({...f.ports,prepare:async()=>{preparations++;await paused;throw Error("source unavailable");}});
 const first=controller.approveAgreement(agreement),second=controller.approveAgreement(agreement);assert.equal(first,second);release();await assert.rejects(first,/source unavailable/);assert.equal(preparations,1);assert.equal(f.saved()?.approved,true);assert.equal(f.counts().commits,0);
});

test("two reviewed devices share one frozen plan and uncertain settlement never creates a second exchange",async()=>{
 const sdk=await import("@receiz/sdk");const digest=wildsWalletNativeTradeAgreementDigest(agreement),h=(c:string)=>c.repeat(64);
 type Preparation=import("../src/features/play/wallet/wilds-wallet-native-trade-context").WildsWalletNativeTradePreparation;
 type Frozen=import("../src/features/play/wallet/wilds-wallet-native-trade-context").WildsWalletFrozenNativeTrade;
 type Message=import("../src/features/play/wallet/wilds-wallet-native-trade-context").WildsWalletNativeTradeMessage;
 const prep=(owner:string)=>boundaryPreparation(owner,digest);
 // These ports isolate coordination. Actual source admission/signatures/SQL are covered by native SDK suites.
 const saved=new Map<string,WildsWalletNativeTradeAttempt>(),published:Array<{sender:string;message:Message}>=[];let preparations=0,freezes=0,signatures=0,assemblies=0,executions=0;
 const makePorts=(owner:string):WildsWalletNativeTradePorts=>({owner:()=>owner,store:{load:async()=>saved.get(owner),write:async a=>{saved.set(owner,structuredClone(a));}},
  prepare:async()=>{preparations++;return prep(owner);},publish:async(_,message)=>{published.push({sender:owner,message});return true;},
  freeze:async(a,preparations)=>{freezes++;const intent={sourceOwnerReceizId:a.first.senderHandle,destinationOwnerReceizId:a.second.senderHandle};const plan=await sdk.planReceizNativeTradeV128({applicationId:"wildz",commitDomain:{scheme:"receiz-commit-domain.v1",value:"world:wildz:trade"},operations:[{operationId:"value:net",kind:"value",intent}],expectedParticipantHeads:{alice:h("c"),bob:h("d")},semanticIdempotencyKey:`wildz:trade:${digest}`,attemptId:`wildz:trade-attempt:${digest}`,expiresAtKai:"9999999999"});return {schema:"wildz.wallet.native-trade-frozen.v1",agreement:a,agreementDigest:digest,preparations,plan,bases:[{kind:"value",basis:{operationPlan:plan,operationId:"value:net",intent}}]} as unknown as Frozen;},
  validateFrozen:async frozen=>{assert.equal(frozen.agreementDigest,digest);},sign:async frozen=>{signatures++;return {schema:"wildz.wallet.native-trade-approval.v1",ownerHandle:owner,agreementDigest:digest,exactPlanDigest:frozen.plan.exactPlanDigest,proofs:[{operationId:"value:net",proof:prep(owner).identity.identityProof}]};},
  assemble:async frozen=>{assemblies++;return {schema:"receiz.native-trade-transition-set.v128",operationPlan:frozen.plan,members:[]};},commit:async()=>{executions++;return {status:"unknown"};},resolve:async()=>({status:"unknown"}),adopt:async()=>{throw Error("No committed native receipt exists in this boundary fixture");}});
 const alicePorts=makePorts("alice.receiz.id"),bobPorts=makePorts("bob.receiz.id"),alice=createWildsWalletNativeTradeController(alicePorts),bob=createWildsWalletNativeTradeController(bobPorts);
 assert.equal((await alice.approveAgreement(agreement)).status,"awaiting-peer");const alicePreparation=published[0]!;
 await bob.receive(alicePreparation.message,alicePreparation.sender);assert.equal(preparations,1,"received preparation cannot implicitly review/sign on the second device");
 await bob.approveAgreement(agreement);await bob.receive(alicePreparation.message,alicePreparation.sender);
 const bobPreparation=published.find(p=>p.sender==="bob.receiz.id"&&p.message.phase==="preparation")!;await alice.receive(bobPreparation.message,bobPreparation.sender);
 const aliceApproval=published.find(p=>p.sender==="alice.receiz.id"&&p.message.phase==="approval")!;await bob.receive(aliceApproval.message,aliceApproval.sender);
 const bobApproval=published.find(p=>p.sender==="bob.receiz.id"&&p.message.phase==="approval")!;assert.equal((await alice.receive(bobApproval.message,bobApproval.sender)).status,"pending");
 assert.deepEqual({preparations,freezes,signatures,assemblies,executions},{preparations:2,freezes:1,signatures:2,assemblies:1,executions:1});
 const reconstructed=createWildsWalletNativeTradeController(alicePorts);assert.equal((await reconstructed.recoverAgreement(agreement)).status,"pending");assert.equal((await reconstructed.receive(bobApproval.message,bobApproval.sender)).status,"pending");assert.equal(executions,1);assert.equal(saved.get("alice.receiz.id")?.transitionSet?.operationPlan.semanticIdempotencyKey,`wildz:trade:${digest}`);
});


test("a delayed acceptance renews only the same reviewed sources before any submission",async()=>{
 const f=fixture(),digest=wildsWalletNativeTradeAgreementDigest(agreement),old={...boundaryPreparation("alice.receiz.id"),expiresAtKai:"1"},renewed={...old,expiresAtKai:"9999999999",grant:{...old.grant,nonce:"renewed"}};
 await f.ports.store.write({schema:"wildz.wallet.native-trade-attempt.v1",owner:"alice.receiz.id",agreement,agreementDigest:digest,approved:true,status:"awaiting-peer",ownPreparation:old,publishedPreparation:true});
 let renewals=0;const ports={...f.ports,preparationCurrent:(p:typeof old)=>p.expiresAtKai!=="1",refreshPreparation:async()=>{renewals++;return renewed;}};
 assert.equal((await createWildsWalletNativeTradeController(ports).recoverAgreement(agreement)).status,"awaiting-peer");
 assert.equal(renewals,1);assert.equal(f.saved()?.ownPreparation?.grant.nonce,"renewed");assert.equal(f.counts().prepares,0);assert.equal(f.counts().publishes,1);assert.equal(f.counts().commits,0);
});

test("an unsubmitted peer can renew a current key lease without substituting original assets or native value heads",async()=>{
 const f=fixture(),digest=wildsWalletNativeTradeAgreementDigest(agreement),peer=boundaryPreparation("alice.receiz.id"),own=boundaryPreparation("bob.receiz.id");
 await f.ports.store.write({schema:"wildz.wallet.native-trade-attempt.v1",owner:"bob.receiz.id",agreement,agreementDigest:digest,approved:true,status:"awaiting-peer",ownPreparation:own,publishedPreparation:true,peerPreparation:{...peer,expiresAtKai:"1"}});
 const controller=createWildsWalletNativeTradeController({...f.ports,owner:()=>"bob.receiz.id"});
 const renewed={...peer,grant:{...peer.grant,nonce:"renewed-peer"}};
 assert.equal((await controller.receive({kind:"trade-native",phase:"preparation",agreement,preparation:renewed},"alice.receiz.id")).status,"awaiting-peer");assert.equal(f.saved()?.peerPreparation?.grant.nonce,"renewed-peer");
 const before=structuredClone(f.saved());const substitution={...renewed,valueSource:{...renewed.valueSource,source:{...renewed.valueSource.source,currentHead:"9".repeat(64)}}};
 assert.equal((await controller.receive({kind:"trade-native",phase:"preparation",agreement,preparation:{...substitution,expiresAtKai:"99999999999"}},"alice.receiz.id")).status,"pending");assert.deepEqual(f.saved(),before);assert.equal(f.counts().commits,0);
});

test("an uncertain submitted gift or exchange never rewrites its saved sources after a newer peer preparation",async()=>{
 const f=fixture(),digest=wildsWalletNativeTradeAgreementDigest(agreement),own=boundaryPreparation("alice.receiz.id"),peer=boundaryPreparation("bob.receiz.id");
 const original:WildsWalletNativeTradeAttempt={schema:"wildz.wallet.native-trade-attempt.v1",owner:"alice.receiz.id",agreement,agreementDigest:digest,approved:true,status:"pending",ownPreparation:own,peerPreparation:peer,publishedPreparation:true};await f.ports.store.write(original);
 let refreshes=0;const ports={...f.ports,resolve:async()=>({status:"unknown" as const}),preparationCurrent:()=>false,refreshPreparation:async()=>{refreshes++;return own;}};const controller=createWildsWalletNativeTradeController(ports);
 assert.equal((await controller.receive({kind:"trade-native",phase:"preparation",agreement,preparation:{...peer,expiresAtKai:"99999999999",grant:{...peer.grant,nonce:"new"}}},"bob.receiz.id")).status,"pending");assert.deepEqual(f.saved(),original);assert.equal(refreshes,0);assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});
});


test("a known zero-write exchange cannot be restarted by an unsolicited peer message",async()=>{
 const f=fixture(),digest=wildsWalletNativeTradeAgreementDigest(agreement);await f.ports.store.write({schema:"wildz.wallet.native-trade-attempt.v1",owner:"alice.receiz.id",agreement,agreementDigest:digest,approved:true,status:"failed"});const original=structuredClone(f.saved());
 const result=await createWildsWalletNativeTradeController(f.ports).receive({kind:"trade-native",phase:"preparation",agreement,preparation:boundaryPreparation("bob.receiz.id")},"bob.receiz.id");assert.equal(result.status,"failed");assert.deepEqual(f.saved(),original);assert.deepEqual(f.counts(),{prepares:0,publishes:0,commits:0});
});
