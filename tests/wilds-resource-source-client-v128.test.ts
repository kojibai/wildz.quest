import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdentityKeyFile, createReceizProofAuthorityChallenge, receizBase64UrlDecode, receizKaiNow, serializeReceizIdentityArtifact, sha256ReceizBytes, signReceizIdentityLoginProof, type ReceizClient } from "@receiz/sdk";
import { createWildsResourceSourceClientV128, createWildsResourceSourceRecoveryStoreV128, openWildsResourceSourceAuthorityV128 } from "../src/lib/receiz/wilds-resource-source-client-v128";
import type { WildzContinuityDatabase } from "../src/lib/storage/wildz-indexed-db";
import { prepareWildsResourceSourcePageV128 } from "../src/lib/receiz/wilds-resource-source-v128";
import {createWildsResourcePackageExchangeV128} from '../src/lib/receiz/wilds-resource-exchange-v128';

function database(fail = false): WildzContinuityDatabase {
  const records = new Map<string, unknown>();
  return { read: async (_store, key) => structuredClone(records.get(String(key)) ?? null) as never,
    transaction: async (_stores, _mode, operation) => {
      if (fail) throw Error("synthetic storage unavailable");
      return operation({ get: async (_store, key) => structuredClone(records.get(String(key)) ?? null) as never,
        put: async (_store, value, key) => { records.set(String(key), structuredClone(value)); },
        delete: async (_store, key) => { records.delete(String(key)); }, getAll: async () => [] });
    } };
}

async function createFixture(storage = database()) {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "resource_client_fixture", username: "alice", displayName: "Synthetic" } });
  const now = receizKaiNow();
  const grant = { schema: "receiz.identity.proof-authority.v123" as const, applicationId: "wildz", keyId: keyFile.keyId, artifactDigest: "a".repeat(64),
    grantedScopes: ["openid", "profile", "receiz:domains.read", "receiz:domains.write", "receiz:record", "receiz:seal", "receiz:subjects.read", "receiz:subjects.write"],
    issuedAtKai: now.pulse - 1, expiresAtKai: now.pulse + 60, nonce: "synthetic", revocationHead: "b".repeat(64), tokenType: "Bearer" as const, expiresIn: 300,
    refreshable: false as const, authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const }, authorityDigest: "c".repeat(64), accessToken: "never-used" };
  const authority = { grant, keyFile, ownerReceizId: "alice.receiz.id", actorSubjectId: `receiz:subject:${"d".repeat(64)}`, actorSubjectHead: "e".repeat(64) };
  const session = { authoritySessionHandle: "synthetic-only", applicationId: "wildz", audience: "wildz", actorSubjectId: authority.actorSubjectId,
    identityKeyId: keyFile.keyId, identityArtifactSha256: grant.artifactDigest, expiresAtKaiUPulse: now.uPulse + 60_000_000 };
  const sealedInputs: { bytes: Uint8Array; idempotencyKey: string }[] = [];
  const sdk = { assets: { createProofObject: async (input: { payload: { bytes: Uint8Array } }, options: { idempotencyKey: string }) => {
    sealedInputs.push({ bytes: new Uint8Array(input.payload.bytes), idempotencyKey: options.idempotencyKey });
    throw Error("synthetic lost seal response");
  } } } as unknown as ReceizClient;
  const store = createWildsResourceSourceRecoveryStoreV128(storage);
  const create = () => createWildsResourceSourceClientV128({ sdk, authority, session: session as never, recoveryStore: store });
  const page = { domainId: "world:wildz:resources:test", registryDigest: "1".repeat(64), reducerDigest: "2".repeat(64), genesisHead: "0".repeat(64), appendId: "collect:one",
    event: { commandId: "collect:one", birth: "hay:one" }, namespace: { members: { "hay:one": true } }, namespaceName: "inventory", namespaceHead: "3".repeat(64), predecessor: null };
  return { create, page, sealedInputs, authority, sdk, session, store, storage };
}

test("lost seal response retries frozen exact source bytes and the same native idempotency key across client recreation", async () => {
  const fixture = await createFixture();
  assert.equal((await fixture.create().publish({ attemptId: "collect:one", page: fixture.page })).status, "pending");
  assert.equal((await fixture.create().publish({ attemptId: "collect:one", page: fixture.page })).status, "pending");
  assert.equal(fixture.sealedInputs.length, 2);
  assert.equal(fixture.sealedInputs[0]!.idempotencyKey, fixture.sealedInputs[1]!.idempotencyKey);
  assert.deepEqual(fixture.sealedInputs[0]!.bytes, fixture.sealedInputs[1]!.bytes);
  assert.equal(new TextDecoder().decode(fixture.sealedInputs[0]!.bytes).includes(fixture.authority.keyFile.crypto.privateKeyPkcs8B64u!), false);
});

test("resource source storage failure prevents all seal and publication writes", async () => {
  const fixture = await createFixture(database(true));
  await assert.rejects(fixture.create().publish({ attemptId: "collect:one", page: fixture.page }), /storage unavailable/);
  assert.equal(fixture.sealedInputs.length, 0);
});

test("changing members on a retained source attempt fails before a second seal", async () => {
  const fixture = await createFixture();
  await fixture.create().publish({ attemptId: "collect:one", page: fixture.page });
  await assert.rejects(fixture.create().publish({ attemptId: "collect:one", page: { ...fixture.page, namespace: { members: { "hay:two": true } } } }), /attempt_conflict/);
  assert.equal(fixture.sealedInputs.length, 1);
});

test('the final gameplay fence runs after durable exact preparation and immediately before source CAS',async()=>{
 const fixture=await createFixture();
 await fixture.create().publish({attemptId:'collect:fenced',page:fixture.page});
 const retained=await fixture.store.read(fixture.authority.ownerReceizId,'collect:fenced');assert.ok(retained);
 // Diagnostic transport fixture only: the published SDK itself owns root
 // admission. This test exercises final fence ordering, never native trust.
 const source={schema:'receiz.sealed-artifact-bytes.v124' as const,exactBytesB64u:'eA',artifactSha256:'1'.repeat(64),payloadSha256:'2'.repeat(64),filename:'fixture.receizbundle',mimeType:'application/vnd.receiz.bundle+json'};
 await fixture.store.retainSource(retained,source);
 const order:string[]=[];
 const sdk={sources:{publishSealedSourceV124:async(request:{sourceArtifact:typeof source})=>{order.push('publish');assert.deepEqual(request.sourceArtifact,source);return {artifactSha256:source.artifactSha256,sourceKind:'replay-segment',status:'published'};}}} as unknown as ReceizClient;
 const create=()=>createWildsResourceSourceClientV128({sdk,authority:fixture.authority,session:fixture.session as never,recoveryStore:fixture.store});
 const rejected=await create().publish({attemptId:'collect:fenced',page:fixture.page,beforeCommit:async()=>{
  order.push('fence');assert.deepEqual((await fixture.store.read(fixture.authority.ownerReceizId,'collect:fenced'))?.sourceArtifact,source);throw Error('player_moved_before_cas');
 }});
 assert.equal(rejected.status,'pending');assert.deepEqual(order,['fence']);
 const accepted=await create().publish({attemptId:'collect:fenced',page:fixture.page,beforeCommit:async()=>{order.push('fence:retry');}});
 assert.equal(accepted.status,'published');assert.deepEqual(order,['fence','fence:retry','publish']);
 assert.equal(fixture.sealedInputs.length,1,'the retained exact Original is reused after the rejected fence');
});

test('observing an unknown or not-yet-published use never starts preparation, storage writes or publication',async()=>{
 const fixture=await createFixture(),owner=fixture.authority.ownerReceizId,attemptId='use:pending';let reads=0;
 await fixture.storage.transaction(['meta'],'readwrite',tx=>tx.put('meta',{event:{schema:'wildz.resource-command.v128',kind:'use',attemptId,ownerReceizId:owner,gameplayOwnerId:'explorer',commands:[{kind:'food.consume',commandId:'eat:pending',itemId:'portion:one',kaiUPulse:1,reserveMicroBreaths:0}],useCommandId:'eat:pending'}},JSON.stringify(['wildz.resource-exchange-attempt.v128',owner,attemptId])));
 const database={...fixture.storage,transaction:async()=>assert.fail('read-only observation cannot persist')} as WildzContinuityDatabase;
 const exchange=createWildsResourcePackageExchangeV128({sdk:fixture.sdk,database,authority:fixture.authority,session:fixture.session as never,gameplayOwnerId:'explorer',locator:{read:async()=>{reads++;return null;},publish:async()=>assert.fail('read-only observation cannot publish')}});
 assert.equal(await exchange.observeUse('use:unknown'),null);assert.equal(reads,0);
 assert.equal(await exchange.observeUse(attemptId),null);assert.equal(reads,1);
 assert.equal(fixture.sealedInputs.length,0);
});

test("a valid different retained candidate cannot be relabeled as the frozen resource request", async () => {
  const fixture = await createFixture();
  await fixture.create().publish({ attemptId: "collect:one", page: fixture.page });
  const altered = await prepareWildsResourceSourcePageV128({ authority: fixture.authority, page: { ...fixture.page, event: { commandId: "collect:one", birth: "hay:other" }, namespace: { members: { "hay:other": true } } } });
  const store = { ...fixture.store, read: async (owner: string, attempt: string) => {
    const retained = await fixture.store.read(owner, attempt);
    return retained && { ...retained, preparation: { ...altered, appendIndex: [...altered.appendIndex] } };
  } };
  const client = createWildsResourceSourceClientV128({ sdk: fixture.sdk, authority: fixture.authority, session: fixture.session as never, recoveryStore: store });
  await assert.rejects(client.publish({ attemptId: "collect:one", page: fixture.page }), /recovery_request_mismatch/);
  assert.equal(fixture.sealedInputs.length, 1);
});

test("matching public identity and device consent reach the genuine SDK actor seal boundary", async () => {
  const fixture = await bootstrapFixture();
  await assert.rejects(openWildsResourceSourceAuthorityV128(fixture.input), /bootstrap seal sentinel/);
  assert.equal(fixture.writes(), 1);
});

async function bootstrapFixture() {
  const fixture = await createFixture();
  const passphrase = "synthetic-test-only";
  const { keyFile: safe } = await createReceizIdentityKeyFile({ owner: fixture.authority.keyFile.owner, passphrase });
  const identityArtifact = serializeReceizIdentityArtifact(safe);
  const artifactDigest = await sha256ReceizBytes(new TextEncoder().encode(identityArtifact));
  const challenge = createReceizProofAuthorityChallenge({ applicationId: "wildz", artifactDigest, scopes: fixture.authority.grant.grantedScopes, consentStatementDigest: "1".repeat(64), ttlPulses: 60 });
  const proof = await signReceizIdentityLoginProof({ keyFile: safe, passphrase, challengeText: new TextDecoder().decode(receizBase64UrlDecode(challenge.challengeB64Url)) });
  const grant = { ...fixture.authority.grant, keyId: safe.keyId, artifactDigest, nonce: challenge.challenge.nonce };
  let writes = 0;
  const sdk = { assets: { createProofObject: async () => { writes++; throw Error("bootstrap seal sentinel"); } } } as unknown as ReceizClient;
  return { input: { sdk, keyFile: safe, passphrase, grant, identityArtifact, signedGrantChallenge: { ...challenge.challenge, proof } }, plaintextKey: fixture.authority.keyFile, writes: () => writes };
}

test("resource actor bootstrap rejects a substituted identity Original before any source writes", async () => {
  const fixture = await bootstrapFixture();
  await assert.rejects(openWildsResourceSourceAuthorityV128({ ...fixture.input, identityArtifact: fixture.input.identityArtifact + " " }), /identity_artifact_binding_invalid/);
  assert.equal(fixture.writes(), 0);
});

test("resource actor bootstrap rejects invalid device grant signature before any source writes", async () => {
  const fixture = await bootstrapFixture();
  const challenge = structuredClone(fixture.input.signedGrantChallenge);
  challenge.proof.signatureB64Url = (challenge.proof.signatureB64Url[0]==='A'?'B':'A')+challenge.proof.signatureB64Url.slice(1);
  await assert.rejects(openWildsResourceSourceAuthorityV128({ ...fixture.input, signedGrantChallenge: challenge }), /identity_challenge_invalid/);
  assert.equal(fixture.writes(), 0);
});

test("resource actor bootstrap never transports a plaintext private recovery key", async () => {
  const fixture = await bootstrapFixture();
  const identityArtifact = serializeReceizIdentityArtifact(fixture.plaintextKey);
  const grant = { ...fixture.input.grant, keyId: fixture.plaintextKey.keyId, artifactDigest: await sha256ReceizBytes(new TextEncoder().encode(identityArtifact)) };
  const signedGrantChallenge = { ...fixture.input.signedGrantChallenge, proof: { ...fixture.input.signedGrantChallenge.proof, keyId: fixture.plaintextKey.keyId } };
  await assert.rejects(openWildsResourceSourceAuthorityV128({ ...fixture.input, keyFile: fixture.plaintextKey, identityArtifact, grant, signedGrantChallenge }), /identity_private_key_forbidden/);
  assert.equal(fixture.writes(), 0);
});
