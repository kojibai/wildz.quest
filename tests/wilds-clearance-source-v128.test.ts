import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
 canonicalizeReceizV122, createReceizClient, createReceizCustomReducerBindingsV124,
 createReceizIdentityKeyFile, createReceizInMemoryAdmissionStore,
 deriveReceizRegisteredOperationCasV124, digestReceizCanonicalV122, planAtomicOperationV124,
 receizBase64UrlDecode, receizBase64UrlEncode, receizKaiNow, runReceizAdmissionStoreConformance,
 sha256ReceizBytes, type ReceizAdmissionUnitOfWork, type ReceizRegisteredOperationBasisV124,
} from '@receiz/sdk';
import {canonicalPortableCardJson,sha256PortableBasis} from '../src/features/play/portable-card';
import {wildsNourishmentPlantById,wildsNourishmentSourceAt} from '../src/features/play/wilds-nourishment';
import {
 CREATION_WORLD_RULE_HEAD,CREATION_WORLD_PHYSICAL_BUILD_RULE_HEAD,
 CREATION_WORLD_EVOLUTION_RULE_HEAD,CREATION_WORLD_PHYSICAL_EVOLUTION_RULE_HEAD,
} from '../src/features/play/creation/world-source';
import {replayWildsResourceGameplayV128} from '../src/lib/receiz/wilds-resource-gameplay-v128';
import {
 initialWildsResourceJournalV128,reduceWildsResourceJournalV128,wildsResourceJournalHeadV128,
 WILDS_RESOURCE_LAW_V128,WILDS_RESOURCE_REGISTRY_DIGEST_V128,WILDS_RESOURCE_REDUCER_DIGEST_V128,
 WILDS_RESOURCE_GENESIS_HEAD_V128,WILDS_RESOURCE_DOMAIN_V128,WILDS_RESOURCE_NAMESPACE_V128,
 type WildsResourceJournalEventV128,type WildsResourceJournalV128,
} from '../src/lib/receiz/wilds-resource-journal-v128';
import {prepareWildsResourceSourcePageV128,WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128} from '../src/lib/receiz/wilds-resource-source-v128';
import {verifyWildsResourceSourceProofV128,wildsResourceSourceNamespaceV128} from '../src/lib/receiz/wilds-resource-exchange-v128';

// Task 1 qualification is deliberately split: actual application replay, released
// SDK candidate/CAS mechanics, and actual root rejection. No fixture claims a
// sealed Original, admitted host head, or implemented clearance/pickup law.
const OWNER='alice.receiz.id', GAMEPLAY='explorer', KAI=100_000_000;
const HISTORICAL_LAW='{"birth":"full-genesis-command-replay","finiteSource":"global-current-head-and-exact-command","genesis":"2026-07-15T00:00:00.000Z","ownership":"sdk-opened-current-original-and-recipient-device-source-cas","repack":"source-qualified-current-keeper-unspent-members","reservation":"whole-exact-born-members","schema":"wildz.resource-law.v128","sourceNamespace":"immutable-law","unpack":"one-use-exact-member-import","version":1}';
const historicalGather={kind:'food.gather',commandId:'gather:one',sourceId:'wildz.nourishment.v1:-4:-4:berry-bush:1',expectedSourceHead:'wildz.crop.v1|wildz.nourishment.v1:-4:-4:berry-bush:1|0|0',kaiUPulse:KAI,player:{x:-42.371528,y:0.602746,z:-39.192423},spaceId:'wildz.space.outer.v1'} as const;
async function historicalFixture(){
 const replay=await replayWildsResourceGameplayV128({gameplayOwnerId:GAMEPLAY,commands:[historicalGather]});
 const event={schema:'wildz.resource-command.v128',kind:'reserve',attemptId:'package:one',ownerReceizId:OWNER,gameplayOwnerId:GAMEPLAY,createdKaiUPulse:KAI,commands:[historicalGather],memberIds:Object.keys(replay.members),recipientHandle:'bob'} as const;
 const state=await reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),event,{ownerReceizId:OWNER});
 return {event,state,replay};
}

test('resource law coordinates and historical outputs remain pinned beneath versioned construction dispatch',async()=>{
 assert.equal(canonicalPortableCardJson(WILDS_RESOURCE_LAW_V128),HISTORICAL_LAW);
 assert.equal(WILDS_RESOURCE_REGISTRY_DIGEST_V128,'70515d0b9ac87606faaf17589e1e9b51dc726d15a5d7db409cffd90ad0a0e004');
 assert.equal(WILDS_RESOURCE_REDUCER_DIGEST_V128,'45bd97d49d8431c25f8cbe891cbcbccf38393e08af1891c96a2ad20327f15a39');
 assert.equal(WILDS_RESOURCE_GENESIS_HEAD_V128,'91addd091fef47f0e9da6c5b7e46ec885d86462089ae68742f24230f05c7eff1');
 const {state,replay}=await historicalFixture();
 assert.equal(wildsResourceJournalHeadV128(state),'747ad3a2890b621a80d91d751ec88c67e54d984909dfc013627ea1ef4cb364aa');
 assert.equal(sha256PortableBasis(canonicalPortableCardJson(replay)),'sha256:46ea8f27d2e0e22e1f379fd77fb3123c113594d60455911851c4de4694be70e9');
 assert.equal(Object.keys(replay.members).join(),'wildz.food.v1|explorer|wildz.nourishment.v1:-4:-4:berry-bush:1|0|1');
 assert.deepEqual([CREATION_WORLD_RULE_HEAD,CREATION_WORLD_PHYSICAL_BUILD_RULE_HEAD,CREATION_WORLD_EVOLUTION_RULE_HEAD,CREATION_WORLD_PHYSICAL_EVOLUTION_RULE_HEAD],[
  'sha256:03e7694ff56253c9b4ff1d88177f84e301ce90ad1fa46331f6d918735f71ffa4',
  'sha256:9a70893091a7e4fdce399281e6471e6841a38f6b2715ab20da3090e5590a883d',
  'sha256:72bd7fe8ae1b11d7e20da91ad44778a2cfaa0d0a0c68a1c29406d5569431f9e3',
  'sha256:49c06c049ddcb0e3a70b9468c153f6bd5a0b7de92a6e78e807abc77c837ef4a4',
 ]);
});

test('ordinary package reservation is not permanent procedural food retirement',async()=>{
 const {state}=await historicalFixture(),plant=wildsNourishmentPlantById(historicalGather.sourceId)!;
 const nextKai=wildsNourishmentSourceAt(plant,undefined,KAI).nextRegrowthKaiUPulse;
 const next={...historicalGather,commandId:'gather:next-crop',kaiUPulse:nextKai,expectedSourceHead:wildsNourishmentSourceAt(plant,undefined,nextKai).head};
 const event={schema:'wildz.resource-command.v128',kind:'replay',attemptId:'trace:next-crop',ownerReceizId:'charlie.receiz.id',gameplayOwnerId:'charlie',commands:[next]} as const;
 // The initial RED disproved retirement through an ordinary package reserve.
 // Preserve this historical behavior: only an explicit future clearance rule
 // may retire a source across every crop, and that rule has its own gate.
 const after=await reduceWildsResourceJournalV128(state,event,{ownerReceizId:event.ownerReceizId});
 assert.equal(Object.keys(after.frontiers).length,2);
 assert.deepEqual(after.packages,state.packages);
 assert.equal(after.frontiers[`food:${plant.sourceId}:1`],`wildz.crop.v1|${plant.sourceId}|1|1`);
 assert.equal(wildsResourceJournalHeadV128(state),'747ad3a2890b621a80d91d751ec88c67e54d984909dfc013627ea1ef4cb364aa');
});

// Uses the public SDK store itself. These units are test coordination records,
// not proof objects or a replacement production source-publication adapter.
function storeUnit(event:WildsResourceJournalEventV128,state:WildsResourceJournalV128,revision=0,expectedHead:string|null=null):ReceizAdmissionUnitOfWork{
 const commandDigest=sha256PortableBasis(canonicalPortableCardJson(event));
 return {schema:'receiz.admission.unit-of-work.v1',aggregateId:WILDS_RESOURCE_DOMAIN_V128,commandDigest,idempotencyKey:event.attemptId,expectedRevision:revision,expectedHeadDigest:expectedHead,
 acceptedCommand:JSON.parse(canonicalPortableCardJson(event)),events:[{eventDigest:commandDigest}],nextHead:{revision:revision+1,digest:wildsResourceJournalHeadV128(state),state:JSON.parse(canonicalPortableCardJson(state))},resourceEffects:{},receipt:{eventDigest:commandDigest},outboxIntents:[],auditReference:{eventDigest:commandDigest}};
}

test('released SDK store CAS admits one competing exact source claim and preserves zero-write rejection',async()=>{
 const store=createReceizInMemoryAdmissionStore(),before=initialWildsResourceJournalV128();
 const event=(owner:string,attemptId:string)=>({schema:'wildz.resource-command.v128',kind:'replay',attemptId,ownerReceizId:`${owner}.receiz.id`,gameplayOwnerId:owner,commands:[historicalGather]} as const);
 const alice=event('alice','gather:alice'),bob=event('bob','gather:bob');
 const [aliceState,bobState]=await Promise.all([alice,bob].map(row=>reduceWildsResourceJournalV128(before,row,{ownerReceizId:row.ownerReceizId})));
 const units=[storeUnit(alice,aliceState),storeUnit(bob,bobState)];
 const results=await Promise.all(units.map(unit=>store.commit(unit)));
 assert.deepEqual(results.map(row=>row.status).sort(),['committed','conflict']);
 const winner=results.findIndex(row=>row.status==='committed'),accepted=await store.inspect();
 assert.equal(accepted.acceptedCommands.length,1);assert.equal(accepted.events.length,1);assert.equal(accepted.receipts.length,1);
 assert.equal((await store.commit(units[winner])).status,'idempotent');
 assert.deepEqual(await store.inspect(),accepted);
 const current=winner===0?aliceState:bobState,loser=winner===0?bob:alice;
 await assert.rejects(reduceWildsResourceJournalV128(current,loser,{ownerReceizId:loser.ownerReceizId}),/source_stale/);
 await assert.rejects(reduceWildsResourceJournalV128(before,{...alice,commands:[{...historicalGather,quantity:99}]} as unknown as WildsResourceJournalEventV128,{ownerReceizId:alice.ownerReceizId}),/command_invalid/);
 await assert.rejects(reduceWildsResourceJournalV128(before,{...alice,commands:[{...historicalGather,expectedSourceHead:'altered'}]},{ownerReceizId:alice.ownerReceizId}),/stale-source/);
 const stale=await store.commit({...units[winner],commandDigest:'changed',idempotencyKey:'stale:expected',expectedRevision:1,expectedHeadDigest:'altered',nextHead:{...units[winner].nextHead,revision:2}});
 assert.deepEqual(stale,{status:'conflict',code:'CAUSAL_PARENT_MISMATCH',expectedHead:units[winner].nextHead.digest});
 assert.deepEqual(await store.inspect(),accepted,'every rejected path leaves all SDK ledger collections unchanged');
});

test('released SDK store rollback and idempotency conformance passes without mocked CAS success',async()=>{
 const result=await runReceizAdmissionStoreConformance({create:()=>createReceizInMemoryAdmissionStore(),createLimited:()=>createReceizInMemoryAdmissionStore({maxRecordsPerTransaction:1}),createFailing:()=>createReceizInMemoryAdmissionStore({failBeforeSwap:()=>true})});
 assert.equal(result.ok,true);assert.ok(Object.values(result.checks).every(Boolean));
});

async function candidateFixture(){
 // Same synthetic authoring fixture as wilds-resource-source-v128.test.ts.
 // The signature is real; the synthetic grant is never host-admitted.
 const {keyFile}=await createReceizIdentityKeyFile({owner:{uid:'clearance-source-fixture',username:'alice'}}),now=receizKaiNow();
 const grant={schema:'receiz.identity.proof-authority.v123' as const,applicationId:'wildz',keyId:keyFile.keyId,artifactDigest:'a'.repeat(64),grantedScopes:[...WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128],issuedAtKai:now.pulse-1,expiresAtKai:now.pulse+60,nonce:'synthetic',revocationHead:'b'.repeat(64),tokenType:'Bearer' as const,expiresIn:300,refreshable:false as const,authority:{grantIsIdentityAuthority:false as const,strongerTruth:'receiz-identity-artifact' as const},authorityDigest:'c'.repeat(64),accessToken:'synthetic-never-used'};
 const authority={grant,keyFile,ownerReceizId:OWNER,actorSubjectId:`receiz:subject:${'d'.repeat(64)}`,actorSubjectHead:'e'.repeat(64)};
 const {event}=await historicalFixture();
 const page={domainId:WILDS_RESOURCE_DOMAIN_V128,registryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,reducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,genesisHead:WILDS_RESOURCE_GENESIS_HEAD_V128,appendId:'source:historical',event,...wildsResourceSourceNamespaceV128(),predecessor:null};
 return {authority,page};
}

test('real source preparation binds exact event bytes but cannot grant application semantics',async()=>{
 const input=await candidateFixture(),prepared=await prepareWildsResourceSourcePageV128(input);
 const child=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(prepared.candidate.carrier.segment.exactSegmentBytesB64u)));
 assert.equal(child.replay.additions[0].exactEventBytesB64u,receizBase64UrlEncode(new TextEncoder().encode(canonicalizeReceizV122(input.page.event))));
 assert.equal(child.replay.namespace.exactBytesB64u,receizBase64UrlEncode(new TextEncoder().encode(HISTORICAL_LAW)));
 assert.equal(child.journalAppends[0].expectedHead,WILDS_RESOURCE_GENESIS_HEAD_V128);
 assert.equal(child.journalAppends[0].expectedAbsent,true);
 assert.equal(prepared.candidate.authority.sealed,false);
 // The candidate API commits opaque event bytes. Only the real application
 // replay can validate quantities; successful candidate preparation is no grant.
 const altered={...input.page.event,commands:[{...historicalGather,quantity:99}]};
 const other=await prepareWildsResourceSourcePageV128({...input,page:{...input.page,event:altered}});
 assert.notEqual(other.replay.head,prepared.replay.head);
 assert.notEqual(other.sourceIntent.consentStatementDigest,prepared.sourceIntent.consentStatementDigest);
 await assert.rejects(reduceWildsResourceJournalV128(initialWildsResourceJournalV128(),altered as unknown as WildsResourceJournalEventV128,{ownerReceizId:OWNER}),/command_invalid/);
});

test('actual SDK root restoration and Wildz source reader reject candidate payload relabeled as a seal',async()=>{
 const input=await candidateFixture(),prepared=await prepareWildsResourceSourcePageV128(input);
 const bytes=prepared.candidate.proofObject.payload.bytes;
 const payloadOnly={schema:'receiz.sealed-artifact-bytes.v124' as const,exactBytesB64u:receizBase64UrlEncode(bytes),artifactSha256:await sha256ReceizBytes(bytes),payloadSha256:await sha256ReceizBytes(bytes),filename:'unsealed-candidate.json',mimeType:prepared.candidate.proofObject.payload.mimeType};
 let network=0;
 const sdk=createReceizClient({applicationId:'wildz',fetchImpl:async()=>{network++;throw Error('qualification_network_forbidden');}});
 await assert.rejects(sdk.domains.restoreVerifiedReplayProofObjectV124({applicationId:'wildz',domainId:WILDS_RESOURCE_DOMAIN_V128,expectedRegistryDigest:WILDS_RESOURCE_REGISTRY_DIGEST_V128,expectedReducerDigest:WILDS_RESOURCE_REDUCER_DIGEST_V128,expectedHead:prepared.replay.head,expectedCursor:1,expectedNamespace:{name:WILDS_RESOURCE_NAMESPACE_V128,head:WILDS_RESOURCE_REGISTRY_DIGEST_V128,digest:prepared.replay.namespace.digest},artifact:payloadOnly}),/ROOT|ARTIFACT|PROOF|VERIFY|VERIF/i);
 await assert.rejects(verifyWildsResourceSourceProofV128(sdk,{schema:'wildz.resource-source-proof.v128',custodyArtifact:payloadOnly,sourceArtifacts:[payloadOnly]},{applicationId:'wildz'}),/verification_failed/);
 assert.equal(network,0);
});

async function customOperation(domainId:string,namespace:string,participant:string,operationId:string){
 const registryDigest=await digestReceizCanonicalV122({schema:'wildz.clearance-qualification-rule.v1',namespace}),reducerDigest=await digestReceizCanonicalV122({schema:'wildz.clearance-qualification-reducer.v1',namespace});
 const bindings=await createReceizCustomReducerBindingsV124({namespace,registryDigest,reducerDigest});
 const basis:ReceizRegisteredOperationBasisV124={operationId,category:'custom',domainId,...bindings,payload:{schema:'receiz.custom-reducer-operation.v124',namespace,registryDigest,reducerDigest,expectedParticipantHeads:{[participant]:'1'.repeat(64)},operation:{schema:'wildz.clearance-qualification-operation.v1'}}};
 const cas=await deriveReceizRegisteredOperationCasV124(basis);
 return {...basis,participants:cas.participants};
}

test('registered custom operations bind distinct coordinates and cannot masquerade as source retirement',async()=>{
 const first=await customOperation(WILDS_RESOURCE_DOMAIN_V128,'custom:wildz-clearance-fixture-v1','fixture:original','operation:one');
 const second=await customOperation('world:wildz:other-fixture','custom:wildz-clearance-fixture-v2','fixture:successor','operation:two');
 const cas=await deriveReceizRegisteredOperationCasV124((({participants:_participants,...basis})=>basis)(first));
 const planInput={applicationId:'wildz',operations:[first],...cas,semanticIdempotencyKey:'qualification:custom-binding',attemptId:'qualification:one'};
 const plan=await planAtomicOperationV124(planInput);
 assert.equal(plan.writesOnFailure,0);assert.notEqual(first.reducerDigest,WILDS_RESOURCE_REDUCER_DIGEST_V128);
 await assert.rejects(planAtomicOperationV124({...planInput,expectedParticipantHeads:{'fixture:original':'2'.repeat(64)}}),/PARTICIPANT_HEAD_BINDING_MISMATCH/);
 await assert.rejects(planAtomicOperationV124({...planInput,operations:[first,second],participants:['fixture:original','fixture:successor'],expectedParticipantHeads:{'fixture:original':'1'.repeat(64),'fixture:successor':'1'.repeat(64)}}),/CROSS_DOMAIN_UNSUPPORTED/);
 // This is a supported zero-write planner, not a registration/retirement API.
 assert.equal(JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(plan.exactPlanBytesB64u))).operations[0].category,'custom');
});
