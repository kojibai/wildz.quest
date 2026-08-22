import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeWildsWalletIdentityAuthority,
  issueWildsWalletIdentityAuthorityChallenge
} from "../src/lib/receiz/wilds-wallet-identity-authority";
import { authorizeWildsWalletReadWithIdentity } from "../src/features/play/wallet/wilds-wallet-read-authorization";
import { authorizeWildsWalletTransferWithIdentity } from "../src/features/play/wallet/wilds-wallet-transfer-authorization";

const H = {
  artifact: "a".repeat(64),
  authority: "b".repeat(64),
  key: "c".repeat(64),
  revocation: "d".repeat(64)
};

describe("Receiz ID wallet read authority", () => {
  const readAuthorityScopes = ["openid", "profile", "receiz:wallet.read"];

  it("issues the exact wallet-read and identity-binding scopes bound to the active Receiz ID", () => {
    const issued = issueWildsWalletIdentityAuthorityChallenge({
      session: { keyId: H.key, actorId: "explorer", profileHandle: "explorer.receiz.id" },
      nowKai: 13_731_001,
      nonce: "wallet-read-nonce-00000001"
    }, "s".repeat(32));
    assert.deepEqual(issued.challenge.scopes, readAuthorityScopes);
    assert.equal(issued.challenge.applicationId, "wildz.quest");
    assert.equal(issued.challenge.keyId, H.key);
    assert.equal(issued.challenge.unsigned.consent.approved, true);
    assert.equal(issued.challenge.unsigned.expiresAtKai, 13_731_061);
    assert.ok(issued.ticket.length > 40);
  });

  it("exchanges the signed identity proof into an exact short-lived read bearer", async () => {
    const secret = "s".repeat(32);
    const session = { keyId: H.key, actorId: "explorer", profileHandle: "explorer.receiz.id" };
    const issued = issueWildsWalletIdentityAuthorityChallenge({ session, nowKai: 13_731_001, nonce: "wallet-read-nonce-00000001" }, secret);
    const authority = {
      schema: "receiz.identity.proof-authority.v123" as const,
      applicationId: "wildz.quest",
      keyId: H.key,
      artifactDigest: H.artifact,
      grantedScopes: readAuthorityScopes,
      issuedAtKai: 13_731_001,
      expiresAtKai: 13_731_061,
      nonce: "wallet-read-nonce-00000001",
      revocationHead: H.revocation,
      tokenType: "Bearer" as const,
      expiresIn: 300,
      refreshable: false as const,
      authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const },
      authorityDigest: H.authority,
      accessToken: "opaque-read-bearer"
    };
    let exchangedScopes: readonly string[] = [];
    const admitted = await completeWildsWalletIdentityAuthority({
      session,
      ticket: issued.ticket,
      body: { artifact: "identity-artifact", challenge: { ...issued.challenge.unsigned, proof: { schema: "receiz.identity.login_proof.v1", keyId: H.key, alg: "Ed25519", challengeB64Url: "challenge", signatureB64Url: "signature" } } }
    }, {
      secret,
      exchange: async (input) => { exchangedScopes = input.scopes; return authority; },
      validate: async () => authority,
      loadProfile: async () => ({ id: "owner-1", handle: "explorer" }),
      introspect: async () => ({ active: true, sub: "owner-1", scope: readAuthorityScopes.join(" ") }),
      artifactDigest: async () => H.artifact
    });
    assert.deepEqual(admitted, {
      accessToken: "opaque-read-bearer",
      expiresIn: 300,
      grantedScopes: readAuthorityScopes,
      keyId: H.key,
      actorId: "explorer",
      profileHandle: "explorer.receiz.id"
    });
    assert.deepEqual(exchangedScopes, readAuthorityScopes);
  });

  it("keeps the browser exchange in-game and publishes no bearer", async () => {
    const requests: Array<{ path: string; body?: unknown }> = [];
    const result = await authorizeWildsWalletReadWithIdentity("c".repeat(64), {
      loadIdentity: async () => ({
        artifact: "identity-artifact",
        artifactDigest: H.artifact,
        keyId: H.key,
        sign: async () => ({ schema: "receiz.identity.login_proof.v1", keyId: H.key, alg: "Ed25519", challengeB64Url: "challenge", signatureB64Url: "signature" })
      }),
      request: async (path, body) => {
        requests.push({ path, body });
        if (!body) return { ok: true, value: { applicationId: "wildz.quest", scopes: readAuthorityScopes, keyId: H.key, unsigned: { schema: "receiz.identity.proof-authority-challenge.v123", audience: "wildz.quest", nonce: "wallet-read-nonce-00000001", issuedAtKai: 13_731_001, expiresAtKai: 13_731_061, consent: { approved: true, statementDigest: H.authority } } } };
        return { ok: true, value: { status: "connected", scopes: readAuthorityScopes } };
      },
      challengeText: () => "canonical-challenge"
    });
    assert.equal(result, true);
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.path, `/api/auth/wildz/wallet-authority?keyId=${H.key}`);
    assert.doesNotMatch(JSON.stringify(requests), /opaque-read-bearer|accessToken/);
  });

  it("lets the edge Receiz ID establish wallet authority before a remote proof session exists", async () => {
    const secret = "s".repeat(32);
    const issued = issueWildsWalletIdentityAuthorityChallenge({
      session: { keyId: H.key },
      nowKai: 13_731_001,
      nonce: "wallet-read-nonce-00000001"
    }, secret);
    const authority = {
      schema: "receiz.identity.proof-authority.v123" as const,
      applicationId: "wildz.quest",
      keyId: H.key,
      artifactDigest: H.artifact,
      grantedScopes: readAuthorityScopes,
      issuedAtKai: 13_731_001,
      expiresAtKai: 13_731_061,
      nonce: "wallet-read-nonce-00000001",
      revocationHead: H.revocation,
      tokenType: "Bearer" as const,
      expiresIn: 300,
      refreshable: false as const,
      authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const },
      authorityDigest: H.authority,
      accessToken: "opaque-read-bearer"
    };
    const admitted = await completeWildsWalletIdentityAuthority({
      ticket: issued.ticket,
      body: { artifact: "identity-artifact", challenge: { ...issued.challenge.unsigned, proof: { schema: "receiz.identity.login_proof.v1", keyId: H.key, alg: "Ed25519", challengeB64Url: "challenge", signatureB64Url: "signature" } } }
    }, {
      secret,
      exchange: async () => authority,
      validate: async () => authority,
      loadProfile: async () => ({ id: "owner-1", handle: "explorer.receiz.id" }),
      introspect: async () => ({ active: true, sub: "owner-1", scope: readAuthorityScopes.join(" ") }),
      artifactDigest: async () => H.artifact
    });
    assert.deepEqual(admitted, {
      accessToken: "opaque-read-bearer",
      expiresIn: 300,
      grantedScopes: readAuthorityScopes,
      keyId: H.key,
      actorId: "explorer",
      profileHandle: "explorer.receiz.id"
    });
  });

  it("derives exact one-operation transfer authority from the edge Receiz ID", async () => {
    let signedBasis: unknown = null;
    const consent = await authorizeWildsWalletTransferWithIdentity(H.key, {
      attempt: "v1.exact-attempt",
      recipientUsername: "friend",
      amountPhiMicro: "2500000",
      rail: "settlement"
    }, {
      loadIdentity: async () => ({
        artifact: "identity-artifact",
        artifactDigest: H.artifact,
        keyId: H.key,
        sign: async (challengeB64Url) => ({ schema: "receiz.identity.login_proof.v1", keyId: H.key, alg: "Ed25519", challengeB64Url, signatureB64Url: "signature" })
      }),
      nowKai: () => 13_731_001,
      nonce: () => "transfer-nonce-00000001",
      statementDigest: async () => H.authority,
      challengeText: (basis) => { signedBasis = basis; return "canonical-transfer-challenge"; }
    });
    assert.equal(consent.artifact, "identity-artifact");
    assert.deepEqual(signedBasis, {
      schema: "receiz.identity.proof-authority-challenge.v123",
      applicationId: "wildz.quest",
      audience: "wildz.quest",
      artifactDigest: H.artifact,
      scopes: ["receiz:settlement.read", "receiz:settlement.write"],
      nonce: "transfer-nonce-00000001",
      issuedAtKai: 13_731_001,
      expiresAtKai: 13_731_061,
      consentStatementDigest: H.authority
    });
    assert.deepEqual(consent.challenge.consent, { approved: true, statementDigest: H.authority });
    assert.equal(consent.challenge.proof.keyId, H.key);
  });
});
