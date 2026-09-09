import assert from "node:assert/strict";
import {test} from "node:test";
import {createReceizIdIdentity} from "@receiz/sdk";
import {sanitizePublicWildzProfile} from "../src/features/profile/public-profile";
import {parseSignedWildzProfilePublication} from "../src/lib/receiz/wildz-profile-publication-envelope";
import {publishWildzProfileWithIdentityProof} from "../src/lib/receiz/wildz-profile-identity-publication";
import type {WildzIdentityRepository, WildzIdentitySession} from "../src/lib/receiz/wildz-identity-repository";

test("profile relay carries a valid local signature constrained to the exact public profile", async () => {
  const identity = await createReceizIdIdentity({username:"signed_profile",displayName:"Signed Profile"});
  const session: WildzIdentitySession = {schema:"receiz.wildz.identity_session.v1",keyId:identity.keyFile.keyId,actorId:"signed_profile",username:"signed_profile",displayName:"Signed Profile",portableStateStatus:"verified",localAuthority:"verified",remoteStatus:"connected"};
  const repository: Pick<WildzIdentityRepository,"active"|"withKeyFile"> = {active:async()=>session,withKeyFile:async(_id,op)=>op(identity.keyFile)};
  const profile = sanitizePublicWildzProfile({username:"@signed_profile",displayName:"Signed Profile",vault:[{id:"wilds:123e00f59899025a366d578f",name:"Companion",proofDigest:"proof",visibility:"public"}]});
  let requests = 0;
  const fetcher = (async (url, init) => {
    requests++;
    assert.equal(url,"/api/profiles/signed_profile");
    const raw = String(init?.body);
    assert.doesNotMatch(raw, /"keyFile"|"privateKeyPkcs8B64u"|"passphrase"/);
    const body = JSON.parse(raw);
    const admitted = parseSignedWildzProfilePublication(body.signedPublication, profile);
    const proof = body.signedPublication.identityProof;
    const publicKey = await crypto.subtle.importKey("raw",Buffer.from(proof.publicKeyRawB64u,"base64url"),{name:"Ed25519"},false,["verify"]);
    assert.equal(await crypto.subtle.verify("Ed25519",publicKey,Buffer.from(proof.signatureB64Url,"base64url"),Buffer.from(proof.challengeB64Url,"base64url")),true);
    for (const mutate of [
      (value: typeof body.signedPublication) => { value.feed.records[0].namespace = "unrelated"; },
      (value: typeof body.signedPublication) => { value.merchantReceizId = "other"; },
      (value: typeof body.signedPublication) => { value.storeStateRecord.profile.displayName = "Changed"; },
      (value: typeof body.signedPublication) => { value.feed.records.push(value.feed.records[0]); }
    ]) {
      const changed = structuredClone(body.signedPublication); mutate(changed);
      assert.throws(()=>parseSignedWildzProfilePublication(changed,profile),/signed_publication_invalid/);
    }
    return Response.json({ok:true,profile:admitted.record.profile},{status:201});
  }) as typeof fetch;
  assert.deepEqual(await publishWildzProfileWithIdentityProof(profile,{repository,fetcher}),profile);
  await assert.rejects(publishWildzProfileWithIdentityProof({...profile,username:"@other"},{repository,fetcher}),/owner_mismatch/);
  assert.equal(requests,1);
});
