import assert from "node:assert/strict";
import {test} from "node:test";
import {createReceizIdIdentity} from "@receiz/sdk";
import {sealCollectedCard} from "../src/features/play/portable-card";
import {parsePublicWildsCardRecord} from "../src/features/play/public-card-registry";
import {parseSignedWildzCardPublication} from "../src/lib/receiz/wildz-card-publication-envelope";
import {publishWildzCardWithIdentityProof} from "../src/lib/receiz/wildz-card-identity-publication";
import type {WildzIdentityRepository, WildzIdentitySession} from "../src/lib/receiz/wildz-identity-repository";

test("public card fallback creates a verifiable SDK signature without transmitting its private seal", async () => {
  const identity=await createReceizIdIdentity({username:"signed_card",displayName:"Signed Card"});
  const session:WildzIdentitySession={schema:"receiz.wildz.identity_session.v1",keyId:identity.keyFile.keyId,actorId:"signed_card",username:"signed_card",displayName:"Signed Card",portableStateStatus:"verified",localAuthority:"verified",remoteStatus:"connected"};
  const repository:Pick<WildzIdentityRepository,"active"|"withKeyFile">={active:async()=>session,withKeyFile:async (_id,operation)=>operation(identity.keyFile)};
  const asset=sealCollectedCard({formId:"mintcub-1",ownerReceizId:"signed_card",encounterId:"signed-card-regression",capturedAt:"2026-09-09T11:00:00.000Z"});
  let requests=0;
  const fetcher=(async (url,init)=>{
    requests++;
    assert.equal(String(url),`/api/cards/${encodeURIComponent(asset.id)}`);
    const raw=String(init?.body);
    const body=JSON.parse(raw).signedPublication;
    const admitted=parseSignedWildzCardPublication(body,asset);
    assert.equal(admitted.record.assetId,asset.id);
    const tampered=structuredClone(body);tampered.feed.records[0].namespace="unrelated";
    assert.throws(()=>parseSignedWildzCardPublication(tampered,asset),/signed_publication_invalid/);
    assert.equal(raw.includes('"keyFile"'),false);
    assert.equal(raw.includes('"privateKeyPkcs8B64u"'),false);
    assert.equal(raw.includes('"passphrase"'),false);
    assert.equal(parsePublicWildsCardRecord(body.storeStateRecord)?.asset.proof.digest,asset.proof.digest);
    assert.ok(raw.includes(`wildz-card:${asset.id}`));
    const proof=body.identityProof;
    const publicKey=await crypto.subtle.importKey("raw",Buffer.from(proof.publicKeyRawB64u,"base64url"),{name:"Ed25519"},false,["verify"]);
    assert.equal(await crypto.subtle.verify("Ed25519",publicKey,Buffer.from(proof.signatureB64Url,"base64url"),Buffer.from(proof.challengeB64Url,"base64url")),true);
    return Response.json({ok:true,record:admitted.record});
  }) as typeof fetch;
  const record=await publishWildzCardWithIdentityProof(asset,{repository,fetcher,occurredAt:"2026-09-09T11:00:00.000Z"});
  assert.equal(record.asset.proof.digest,asset.proof.digest);
  assert.equal(requests,1);
  const other=sealCollectedCard({formId:"mintcub-1",ownerReceizId:"other_owner",encounterId:"foreign-signed-card",capturedAt:"2026-09-09T11:00:00.000Z"});
  await assert.rejects(publishWildzCardWithIdentityProof(other,{repository,fetcher}),/owner_mismatch/);
  assert.equal(requests,1);
});

test("an imported seal publishes for its canonically aligned session even when embedded owner metadata is older", async () => {
  const identity = await createReceizIdIdentity({ username: "original_handle", displayName: "Original" });
  const session: WildzIdentitySession = { schema: "receiz.wildz.identity_session.v1", keyId: identity.keyFile.keyId, actorId: "canonical_handle", username: "canonical_handle", displayName: "Canonical", portableStateStatus: "verified", localAuthority: "verified", remoteStatus: "connected" };
  const repository: Pick<WildzIdentityRepository, "active" | "withKeyFile"> = { active: async () => session, withKeyFile: async (_id, op) => op(identity.keyFile) };
  const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: session.actorId, encounterId: "restored-canonical-card", capturedAt: "2026-09-09T11:00:00.000Z" });
  const fetcher = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const signed = parseSignedWildzCardPublication(body.signedPublication, asset);
    assert.equal(signed.signed.identityProof.keyId, session.keyId);
    assert.equal(signed.signed.merchantReceizId, "canonical_handle.receiz.id");
    return Response.json({ ok: true, record: signed.record });
  }) as typeof fetch;
  assert.equal((await publishWildzCardWithIdentityProof(asset, { repository, fetcher })).assetId, asset.id);
  session.remoteStatus = "unknown";
  await assert.rejects(publishWildzCardWithIdentityProof(asset, { repository, fetcher }), /owner_mismatch/);
});
