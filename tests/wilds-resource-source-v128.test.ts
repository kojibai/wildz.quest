import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalizeReceizV122,
  createReceizIdentityKeyFile,
  digestReceizCanonicalV122,
  receizBase64UrlDecode,
  receizKaiNow,
} from "@receiz/sdk";
import { prepareWildsResourceSourcePageV128 } from "../src/lib/receiz/wilds-resource-source-v128";

// Synthetic identity/grant coordinates exercise candidate preparation only.
// They are never accepted as a production grant or used for a live publication.
async function fixture() {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "resource_source_fixture", username: "alice", displayName: "Synthetic" } });
  const now = receizKaiNow();
  const grant = {
    schema: "receiz.identity.proof-authority.v123" as const,
    applicationId: "wildz", keyId: keyFile.keyId, artifactDigest: "a".repeat(64),
    grantedScopes: ["openid", "profile", "receiz:domains.read", "receiz:domains.write", "receiz:record", "receiz:seal", "receiz:subjects.read", "receiz:subjects.write"],
    issuedAtKai: now.pulse - 1, expiresAtKai: now.pulse + 60, nonce: "synthetic", revocationHead: "b".repeat(64),
    tokenType: "Bearer" as const, expiresIn: 300, refreshable: false as const,
    authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const },
    authorityDigest: "c".repeat(64), accessToken: "synthetic-never-used",
  };
  return {
    authority: { grant, keyFile, ownerReceizId: "alice.receiz.id", actorSubjectId: `receiz:subject:${"d".repeat(64)}`, actorSubjectHead: "e".repeat(64) },
    page: {
      domainId: "world:wildz:resources:test", registryDigest: "1".repeat(64), reducerDigest: "2".repeat(64), genesisHead: "0".repeat(64),
      appendId: "collect:hay:one", event: { schema: "wildz.resource.collection-test.v1", commandId: "collect:hay:one", memberId: "hay:one" },
      namespace: { schema: "wildz.resource.source-test.v1", members: { "hay:one": { reserved: false } } },
      namespaceName: "inventory", namespaceHead: "3".repeat(64), predecessor: null,
    },
  };
}

test("released source candidate binds exact collection bytes, author and genesis CAS without claiming admission", async () => {
  const input = await fixture();
  const prepared = await prepareWildsResourceSourcePageV128(input);
  assert.equal(prepared.candidate.authority.sealed, false);
  assert.equal(prepared.candidate.authority.candidateIsProofAuthority, false);
  assert.equal(prepared.candidate.carrier.predecessor, null);
  const child = JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(prepared.candidate.carrier.segment.exactSegmentBytesB64u)));
  assert.equal(child.sourceAuthority.actorSubjectId, input.authority.actorSubjectId);
  assert.equal(child.sourceAuthority.ownerReceizId, "alice.receiz.id");
  assert.equal(child.journalAppends.length, 1);
  assert.equal(child.journalAppends[0].expectedAbsent, true);
  assert.equal(child.journalAppends[0].expectedHead, "0".repeat(64));
  assert.equal(new TextDecoder().decode(receizBase64UrlDecode(child.replay.additions[0].exactEventBytesB64u)), canonicalizeReceizV122(input.page.event));
  assert.equal(new TextDecoder().decode(receizBase64UrlDecode(child.replay.namespace.exactBytesB64u)), canonicalizeReceizV122(input.page.namespace));
  const challenge = JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(child.authoringEvidence.signedChallenge.proof.challengeB64Url)));
  assert.equal(challenge.consentStatementDigest, prepared.sourceIntent.consentStatementDigest);
  assert.equal(child.authoringEvidence.identity.keyId, input.authority.keyFile.keyId);
  assert.equal(JSON.stringify(child).includes(input.authority.keyFile.crypto.privateKeyPkcs8B64u!), false);
  assert.equal(child.sourceAuthority.acceptedHead, prepared.replay.head);
});

test("resource source preparation rejects invented owner and insufficient grant scopes", async () => {
  const input = await fixture();
  await assert.rejects(prepareWildsResourceSourcePageV128({ ...input, authority: { ...input.authority, ownerReceizId: "bob.receiz.id" } }), /identity_mismatch/);
  await assert.rejects(prepareWildsResourceSourcePageV128({ ...input, authority: { ...input.authority, grant: { ...input.authority.grant, grantedScopes: ["openid", "profile", "receiz:wallet.read"] } } }), /write_authority_required/);
  await assert.rejects(prepareWildsResourceSourcePageV128({ ...input, authority: { ...input.authority, grant: { ...input.authority.grant, keyId: "f".repeat(64) } } }), /identity_mismatch/);
});

test("device consent changes when exact resource membership changes", async () => {
  const input = await fixture();
  const first = await prepareWildsResourceSourcePageV128(input);
  const second = await prepareWildsResourceSourcePageV128({ ...input, page: { ...input.page, event: { ...input.page.event, memberId: "hay:two" } } });
  assert.notEqual(first.sourceIntent.consentStatementDigest, second.sourceIntent.consentStatementDigest);
  assert.notEqual(first.replay.head, second.replay.head);
  assert.equal(first.replay.namespace.digest, await digestReceizCanonicalV122(input.page.namespace));
});

test('stock named-domain namespace remains immutable while two admitted resource events advance distinct heads',async()=>{
 const {wildsResourceSourceNamespaceV128}=await import('../src/lib/receiz/wilds-resource-exchange-v128');
 const first=wildsResourceSourceNamespaceV128(),second=wildsResourceSourceNamespaceV128();
 // This boundary port models the released host's exact namespace_json CAS,
 // independently from root sealing. It never claims a live accepted source.
 let namespace:unknown=null,head:string|null=null,writes=0;
 const append=(expectedHead:string|null,newHead:string,actualNamespace:unknown)=>{
  assert.equal(expectedHead,head);
  if(namespace!==null)assert.equal(canonicalizeReceizV122(actualNamespace),canonicalizeReceizV122(namespace),'released SQL requires immutable namespace_json');
  namespace=structuredClone(actualNamespace);head=newHead;writes++;
 };
 append(null,'a'.repeat(64),first);append('a'.repeat(64),'b'.repeat(64),second);
 assert.equal(writes,2);assert.equal(head,'b'.repeat(64));
 assert.throws(()=>append('b'.repeat(64),'c'.repeat(64),{...second,namespace:{members:{invented:99}}}),/immutable namespace_json/);
 const input=await fixture(),prepared=await prepareWildsResourceSourcePageV128({...input,page:{...input.page,...first}});

 assert.equal(new TextDecoder().decode(receizBase64UrlDecode(prepared.replay.namespace.exactBytesB64u)),canonicalizeReceizV122(first.namespace));
});

test('unsealed preparation stays internally consistent when Kai rolls during source-intent hashing',async t=>{
 const input=await fixture(),originalDateNow=Date.now,originalDigest=crypto.subtle.digest.bind(crypto.subtle),originalSign=crypto.subtle.sign.bind(crypto.subtle);
 let clock=originalDateNow()+60_000,rolled=false,signatures=0;
 t.mock.method(Date,'now',()=>clock);
 t.mock.method(crypto.subtle,'digest',async(algorithm:AlgorithmIdentifier,data:BufferSource)=>{
  const text=new TextDecoder().decode(data);
  if(!rolled&&text.includes('"schema":"receiz.domain-replay-source-intent.v124"')){rolled=true;clock+=6_000;}
  return originalDigest(algorithm,data);
 });
 t.mock.method(crypto.subtle,'sign',async(algorithm:AlgorithmIdentifier,key:CryptoKey,data:BufferSource)=>{signatures++;return originalSign(algorithm,key,data);});
 const prepared=await prepareWildsResourceSourcePageV128(input);
 const child=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(prepared.candidate.carrier.segment.exactSegmentBytesB64u)));
 assert.equal(rolled,true,'the actual SDK intent hashing crossed a whole Kai pulse');
 assert.ok(child.kai.pulse>=child.authoringEvidence.signedChallenge.issuedAtKai);
 assert.ok(child.kai.pulse<child.authoringEvidence.signedChallenge.expiresAtKai);
 assert.equal(child.journalAppends[0].acceptedAtKaiUPulse,child.kai.uPulse);
 assert.deepEqual(prepared.sourceIntent.sourceKai,child.kai);
 assert.equal(child.authoringEvidence.consentStatementDigest,prepared.sourceIntent.consentStatementDigest);
 assert.equal(new TextDecoder().decode(receizBase64UrlDecode(child.replay.additions[0].exactEventBytesB64u)),canonicalizeReceizV122(input.page.event));
 assert.equal(signatures,1,'discarded unsigned preparations never prompt/sign or change retained attempts');
});

test('delegated source consent uses public author only and unchanged released candidate verification',async()=>{
 const input=await fixture();
 const {wildsClearanceWorkerAuthor}=await import('../src/lib/receiz/wilds-clearance-action-worker-runtime');
 const {signReceizIdentityLoginProof}=await import('@receiz/sdk');let signatures=0;
 const author={...wildsClearanceWorkerAuthor(input.authority),signChallenge:async(challengeText:string)=>{signatures++;return signReceizIdentityLoginProof({keyFile:input.authority.keyFile,challengeText});}};
 const prepared=await prepareWildsResourceSourcePageV128({...input,authority:author});
 assert.equal(signatures,1);assert.equal(author.keyFile.crypto.privateKeyPkcs8B64u,undefined);
 const child=JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(prepared.candidate.carrier.segment.exactSegmentBytesB64u)));
 assert.equal(child.authoringEvidence.identity.keyId,input.authority.keyFile.keyId);
 assert.equal(child.replay.additions[0].exactEventBytesB64u,prepared.replay.additions[0].exactEventBytesB64u);
 await assert.rejects(prepareWildsResourceSourcePageV128({...input,authority:{...author,signChallenge:async text=>{const proof=await author.signChallenge(text);return {...proof,signatureB64Url:'invalid'};}}}),/SIGNATURE|signature|PROOF|proof/);
});
