import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mock} from 'node:test';
// Only issuer trust roots and the clock are test fixtures. Native verification,
// bilateral signatures, accepted receipt proof and SDK custody issuance are real.
const fixture=JSON.parse(await readFile(new URL('./fixtures/wilds-native-trade-accepted.json',import.meta.url),'utf8'));
const sdkUrl=import.meta.resolve('@receiz/sdk'),roots=new Map(fixture.roots);
mock.module(new URL('./verifier/roots.js',sdkUrl).href,{exports:{receizCurrentPinnedSignatureV4Roots:()=>roots,receizV109PinnedSignatureV4Roots:()=>roots}});
const kai=await import(new URL('./v124Kai.js',sdkUrl).href);
mock.module(new URL('./v124Kai.js',sdkUrl).href,{exports:{...kai,receizKaiNow:()=>({pulse:1200,uPulse:1200000000})}});
const sdk=await import('@receiz/sdk');
const custody=await import(process.argv[2]);
const durable=fixture.durable,plan=durable.recovery.transitionSet.operationPlan;
let writes=0;
const store={commitDomain:durable.receipt.commitDomain,async commitSet(){writes++;throw Error('Recovery must never execute a transfer');},async resolve(identity){return identity===durable.receipt.idempotencyIdentityDigest?durable:null;}};
const committed=await sdk.resolveReceizNativeTradeV128({applicationId:plan.applicationId,commitDomain:durable.receipt.commitDomain,semanticIdempotencyKey:plan.semanticIdempotencyKey,store});
assert.ok(sdk.isReceizCommittedNativeTradeV128(committed));
const portable=sdk.readReceizCommittedNativeTradeRecoveryProofV128(committed);
const retained=JSON.parse(JSON.stringify(portable));
assert.equal(retained.schema,'receiz.native-trade-recovery-proof.v128');assert.ok(retained.acceptanceEvidence);assert.ok(Array.isArray(retained.predecessorProofs));
assert.doesNotMatch(JSON.stringify(retained),/"(?:accessToken|privateKeyPkcs8B64u|keyFile|passphrase)"\s*:/);
const restarted=await sdk.verifyReceizNativeTradeRecoveryProofV128(retained,{audience:'wildz'});
assert.ok(sdk.isReceizCommittedNativeTradeV128(restarted));
const member=durable.recovery.transitionSet.members[0],bytes=sdk.receizBase64UrlDecode(member.candidate.exactBytesB64u);
const admitted=await custody.qualifyWildzNativeTradeArtifactProof({proof:retained,bytes,ownerReceizId:'bob.receiz.id'});
assert.equal(admitted.artifactSha256,member.candidate.artifactSha256);
assert.equal(admitted.historyDigestSha256,durable.receipt.acceptedParticipantHeads[member.signedAtomicHandoff.basis.intent.participantId]);
assert.equal(admitted.assetId,member.signedAtomicHandoff.basis.intent.assetId);
assert.equal(custody.readWildzNativeTradeCustody(admitted.artifactSha256),admitted);
const wrongAudience=structuredClone(retained);wrongAudience.recovery.transitionSet.operationPlan.applicationId='foreign';
await assert.rejects(custody.qualifyWildzNativeTradeArtifactProof({proof:wrongAudience,bytes,ownerReceizId:'bob.receiz.id'}));
const forgedProof=structuredClone(retained);forgedProof.acceptanceEvidence.signature.sig='A'.repeat(86);
await assert.rejects(custody.qualifyWildzNativeTradeArtifactProof({proof:forgedProof,bytes,ownerReceizId:'bob.receiz.id'}),/ACCEPTANCE_SIGNATURE_INVALID/);
const changed=bytes.slice();changed[changed.length-1]^=1;
await assert.rejects(custody.qualifyWildzNativeTradeArtifact({committed,bytes:changed,ownerReceizId:'bob.receiz.id'}),/candidate_missing/);
await assert.rejects(custody.qualifyWildzNativeTradeArtifact({committed,bytes,ownerReceizId:'alice.receiz.id'}),/candidate_mismatch/);
await assert.rejects(custody.qualifyWildzNativeTradeArtifact({committed:structuredClone(committed),bytes,ownerReceizId:'bob.receiz.id'}),/COMMITTED_CUSTODY_REQUIRED/);
const forged=structuredClone(durable);forged.acceptanceEvidence.signature.sig='A'.repeat(86);
await assert.rejects(sdk.resolveReceizNativeTradeV128({applicationId:plan.applicationId,commitDomain:durable.receipt.commitDomain,semanticIdempotencyKey:plan.semanticIdempotencyKey,store:{...store,async resolve(){return forged;}}}),/ACCEPTANCE_SIGNATURE_INVALID/);
assert.equal(writes,0);
const {createWildsWalletNativeTradeController}=await import(process.argv[3]);
const agreement=fixture.agreement,digest=plan.semanticIdempotencyKey.replace(/^wildz:trade:/,'');
let saved={schema:'wildz.wallet.native-trade-attempt.v1',owner:'bob.receiz.id',agreement,agreementDigest:digest,approved:true,status:'pending'},quota=true,restoreFailure=true,adoptCalls=0,restored=0,commitCalls=0;
const forbidden=async()=>{throw Error('Receipt recovery must never prepare or sign another exchange');};
const controller=createWildsWalletNativeTradeController({owner:()=>saved.owner,store:{async load(){return structuredClone(saved);},async write(attempt){if(quota)throw Error('QuotaExceededError');saved=structuredClone(attempt);}},prepare:forbidden,freeze:forbidden,validateFrozen:forbidden,sign:forbidden,assemble:forbidden,publish:forbidden,
 async commit(){commitCalls++;throw Error('Receipt recovery must never commit another exchange');},async resolve(){return committed;},async adopt(actual){assert.ok(sdk.isReceizCommittedNativeTradeV128(actual));adoptCalls++;if(restoreFailure){restoreFailure=false;throw Error('Local Vault restore unavailable');}restored++;}});
let outcome=await controller.recoverAgreement(agreement);
assert.equal(outcome.status,'committed');assert.equal(outcome.assetRecoveryRequired,true);assert.equal(adoptCalls,0);
quota=false;outcome=await controller.recoverAgreement(agreement);
assert.equal(outcome.status,'committed');assert.equal(outcome.assetRecoveryRequired,true);assert.equal(saved.assetProjectionStatus,'pending');
outcome=await controller.recoverAgreement(agreement);assert.equal(outcome.status,'committed');assert.notEqual(outcome.assetRecoveryRequired,true);assert.equal(saved.assetProjectionStatus,'restored');
await controller.recoverAgreement(agreement);assert.equal(adoptCalls,2);assert.equal(restored,1);assert.equal(commitCalls,0);assert.equal(writes,0);
process.stdout.write('Genuine installed SDK historical receipt qualifies exact candidate only; substitutions, wrong keeper and forged custody rejected; zero executions.\n');

// SDK proof worker pools are process scoped. Every assertion above must finish before this isolated fixture exits.
process.exit(0);
