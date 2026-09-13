import test from "node:test";
import assert from "node:assert/strict";
import { digestReceizCanonicalV122, normalizeReceizProofAuthorityScopesV123, validateReceizProofAuthorityV123 } from "@receiz/sdk";
import { issueWildsWalletIdentityAuthorityChallenge, completeWildsWalletIdentityAuthority } from "../src/lib/receiz/wilds-wallet-identity-authority";
import { WILDS_ARTIFACT_CLAIM_AUTHORITY_SCOPES as scopes } from "../src/lib/receiz/wilds-wallet-authority-scopes";
const session = { keyId: "c".repeat(64), actorId: "explorer", profileHandle: "explorer.receiz.id" };
const digest = "a".repeat(64), secret = "s".repeat(32);

function fixture(grantedScopes: readonly string[] = scopes) {
  const issued = issueWildsWalletIdentityAuthorityChallenge({ session, artifactDigest: digest, purpose: "artifact-claim" }, secret);
  const authority = {
    schema: "receiz.identity.proof-authority.v123" as const, applicationId: "wildz", keyId: session.keyId,
    artifactDigest: digest, grantedScopes, issuedAtKai: issued.challenge.unsigned.issuedAtKai,
    expiresAtKai: issued.challenge.unsigned.expiresAtKai, nonce: issued.challenge.unsigned.nonce,
    revocationHead: "d".repeat(64), tokenType: "Bearer" as const, expiresIn: 120, refreshable: false as const,
    authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const },
    authorityDigest: "b".repeat(64), accessToken: "test-only-claim-token"
  };
  const dependencies = {
    secret, exchange: async (input: { scopes: readonly string[] }) => {
      assert.deepEqual(input.scopes, scopes);
      const { authorityDigest: _digest, accessToken: _token, ...basis } = authority;
      return { ...authority, authorityDigest: await digestReceizCanonicalV122({
        ...basis, grantedScopes: normalizeReceizProofAuthorityScopesV123(grantedScopes)
      }) };
    },
    validate: validateReceizProofAuthorityV123, loadProfile: async () => ({ id: "owner-1", handle: "explorer" }),
    introspect: async () => ({ active: true, sub: "owner-1", scope: scopes.join(" ") }), artifactDigest: async () => digest
  };
  return { issued, dependencies, input: { session, ticket: issued.ticket, purpose: "artifact-claim" as const,
    body: { artifact: "test-identity-artifact", challenge: { ...issued.challenge.unsigned, proof: { signature: "test" } } } } };
}

test("artifact claim authorizes Record and Seal without widening ordinary wallet reads", async () => {
  const f = fixture();
  const expectedScopes = ["openid", "profile", "receiz:record", "receiz:seal", "receiz:wallet.read"];
  assert.deepEqual((await completeWildsWalletIdentityAuthority(f.input, f.dependencies)).grantedScopes, expectedScopes);
  assert.deepEqual(f.issued.challenge.scopes, expectedScopes);
  const read = issueWildsWalletIdentityAuthorityChallenge({ session, artifactDigest: digest }, secret);
  assert.deepEqual(read.challenge.scopes, ["openid", "profile", "receiz:wallet.read"]);
  assert.notEqual(read.challenge.unsigned.consent.statementDigest, f.issued.challenge.unsigned.consent.statementDigest);
});

for (const grantedScopes of [
  ["openid", "profile", "receiz:wallet.read"],
  ["openid", "profile", "receiz:record", "receiz:seal", "receiz:wallet.read", "receiz:wallet.write"]
]) {
  test(`claim rejects SDK-validated authority with a different scope set: ${grantedScopes.join(" ")}`, async () => {
    const f = fixture(grantedScopes);
    let loadedProfile = false;
    await assert.rejects(completeWildsWalletIdentityAuthority(f.input, {
      ...f.dependencies,
      loadProfile: async () => { loadedProfile = true; return { id: "owner-1", handle: "explorer" }; }
    }), /receiz_wallet_identity_authority_response_invalid/);
    assert.equal(loadedProfile, false);
  });
}

test("a read-purpose ticket cannot be replayed as claim authority", async () => {
  const f = fixture(); let exchanged = false;
  await assert.rejects(completeWildsWalletIdentityAuthority({ ...f.input, purpose: "wallet-read" }, {
    ...f.dependencies, exchange: async () => { exchanged = true; throw new Error("must not exchange"); }
  }), /binding_invalid/);
  assert.equal(exchanged, false);
});

test("claim rejects a read-only introspection even when the exchange projects the requested scopes", async () => {
  const f = fixture();
  await assert.rejects(completeWildsWalletIdentityAuthority(f.input, {
    ...f.dependencies, introspect: async () => ({ active: true, sub: "owner-1", scope: "openid profile receiz:wallet.read" })
  }), /token_invalid/);
});
