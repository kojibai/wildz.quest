import test from "node:test";
import assert from "node:assert/strict";
import { issueWildsWalletIdentityAuthorityChallenge, completeWildsWalletIdentityAuthority } from "../src/lib/receiz/wilds-wallet-identity-authority";
import { WILDS_ARTIFACT_CLAIM_AUTHORITY_SCOPES as scopes } from "../src/lib/receiz/wilds-wallet-authority-scopes";
const session = { keyId: "c".repeat(64), actorId: "explorer", profileHandle: "explorer.receiz.id" };
const digest = "a".repeat(64), secret = "s".repeat(32);

function fixture() {
  const issued = issueWildsWalletIdentityAuthorityChallenge({ session, artifactDigest: digest, purpose: "artifact-claim" }, secret);
  const authority = {
    schema: "receiz.identity.proof-authority.v123" as const, applicationId: "wildz", keyId: session.keyId,
    artifactDigest: digest, grantedScopes: scopes, issuedAtKai: issued.challenge.unsigned.issuedAtKai,
    expiresAtKai: issued.challenge.unsigned.expiresAtKai, nonce: issued.challenge.unsigned.nonce,
    revocationHead: "d".repeat(64), tokenType: "Bearer" as const, expiresIn: 120, refreshable: false as const,
    authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const },
    authorityDigest: "b".repeat(64), accessToken: "test-only-claim-token"
  };
  const dependencies = {
    secret, exchange: async (input: { scopes: readonly string[] }) => { assert.deepEqual(input.scopes, scopes); return authority; },
    validate: async () => authority, loadProfile: async () => ({ id: "owner-1", handle: "explorer" }),
    introspect: async () => ({ active: true, sub: "owner-1", scope: scopes.join(" ") }), artifactDigest: async () => digest
  };
  return { issued, dependencies, input: { session, ticket: issued.ticket, purpose: "artifact-claim" as const,
    body: { artifact: "test-identity-artifact", challenge: { ...issued.challenge.unsigned, proof: { signature: "test" } } } } };
}

test("artifact claim authorizes Record and Seal without widening ordinary wallet reads", async () => {
  const f = fixture();
  assert.deepEqual((await completeWildsWalletIdentityAuthority(f.input, f.dependencies)).grantedScopes, scopes);
  const read = issueWildsWalletIdentityAuthorityChallenge({ session, artifactDigest: digest }, secret);
  assert.deepEqual(read.challenge.scopes, ["openid", "profile", "receiz:wallet.read"]);
  assert.notEqual(read.challenge.unsigned.consent.statementDigest, f.issued.challenge.unsigned.consent.statementDigest);
});

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
