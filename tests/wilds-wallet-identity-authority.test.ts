import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { receizKaiNow } from "@receiz/sdk";
import {
  completeWildsWalletIdentityAuthority,
  issueWildsWalletIdentityAuthorityChallenge,
  wildsWalletIdentitySessionForChallenge
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
    const before = receizKaiNow().pulse;
    const issued = issueWildsWalletIdentityAuthorityChallenge({
      session: { keyId: H.key, actorId: "explorer", profileHandle: "explorer.receiz.id" },
      artifactDigest: H.artifact
    }, "s".repeat(32));
    const after = receizKaiNow().pulse;
    assert.deepEqual(issued.challenge.scopes, readAuthorityScopes);
    assert.equal(issued.challenge.applicationId, "wildz");
    assert.equal(issued.challenge.keyId, H.key);
    assert.equal(issued.challenge.unsigned.consent.approved, true);
    assert.ok(issued.challenge.unsigned.issuedAtKai >= before && issued.challenge.unsigned.issuedAtKai <= after);
    assert.equal(issued.challenge.unsigned.expiresAtKai, issued.challenge.unsigned.issuedAtKai + 60);
    assert.match(issued.challenge.unsigned.nonce, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(issued.ticket.length > 40);
  });

  it("exchanges the signed identity proof into an exact short-lived read bearer", async () => {
    const secret = "s".repeat(32);
    const session = { keyId: H.key, actorId: "explorer", profileHandle: "explorer.receiz.id" };
    const issued = issueWildsWalletIdentityAuthorityChallenge({ session, artifactDigest: H.artifact }, secret);
    const authority = {
      schema: "receiz.identity.proof-authority.v123" as const,
      applicationId: "wildz",
      keyId: H.key,
      artifactDigest: H.artifact,
      grantedScopes: readAuthorityScopes,
      issuedAtKai: issued.challenge.unsigned.issuedAtKai,
      expiresAtKai: issued.challenge.unsigned.expiresAtKai,
      nonce: issued.challenge.unsigned.nonce,
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
        if (!body) return { ok: true, value: { applicationId: "wildz", scopes: readAuthorityScopes, keyId: H.key, unsigned: { schema: "receiz.identity.proof-authority-challenge.v123", audience: "wildz", nonce: "wallet-read-nonce-00000001", issuedAtKai: 13_731_001, expiresAtKai: 13_731_061, consent: { approved: true, statementDigest: H.authority } } } };
        return { ok: true, value: { status: "connected", scopes: readAuthorityScopes } };
      },
      challengeText: () => "canonical-challenge"
    });
    assert.equal(result, true);
    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.path, `/api/auth/wildz/wallet-authority?keyId=${H.key}&artifactDigest=${H.artifact}`);
    assert.doesNotMatch(JSON.stringify(requests), /opaque-read-bearer|accessToken/);
  });

  it("lets the edge Receiz ID establish wallet authority before a remote proof session exists", async () => {
    const secret = "s".repeat(32);
    const issued = issueWildsWalletIdentityAuthorityChallenge({
      session: { keyId: H.key },
      artifactDigest: H.artifact
    }, secret);
    const authority = {
      schema: "receiz.identity.proof-authority.v123" as const,
      applicationId: "wildz",
      keyId: H.key,
      artifactDigest: H.artifact,
      grantedScopes: readAuthorityScopes,
      issuedAtKai: issued.challenge.unsigned.issuedAtKai,
      expiresAtKai: issued.challenge.unsigned.expiresAtKai,
      nonce: issued.challenge.unsigned.nonce,
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

  it("lets a freshly signed source Receiz ID supersede a stale proof-session projection", async () => {
    const secret = "s".repeat(32);
    const staleSession = { keyId: "e".repeat(64), actorId: "older", profileHandle: "older.receiz.id" };
    const selected = wildsWalletIdentitySessionForChallenge(staleSession, H.key);
    assert.deepEqual(selected, { keyId: H.key });
    const issued = issueWildsWalletIdentityAuthorityChallenge({ session: selected, artifactDigest: H.artifact }, secret);
    const authority = {
      schema: "receiz.identity.proof-authority.v123" as const,
      applicationId: "wildz",
      keyId: H.key,
      artifactDigest: H.artifact,
      grantedScopes: readAuthorityScopes,
      issuedAtKai: issued.challenge.unsigned.issuedAtKai,
      expiresAtKai: issued.challenge.unsigned.expiresAtKai,
      nonce: issued.challenge.unsigned.nonce,
      revocationHead: H.revocation,
      tokenType: "Bearer" as const,
      expiresIn: 300,
      refreshable: false as const,
      authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const },
      authorityDigest: H.authority,
      accessToken: "fresh-source-read-bearer"
    };
    const admitted = await completeWildsWalletIdentityAuthority({
      session: staleSession,
      ticket: issued.ticket,
      body: { artifact: "fresh-identity-artifact", challenge: { ...issued.challenge.unsigned, proof: { schema: "receiz.identity.login_proof.v1", keyId: H.key, alg: "Ed25519", challengeB64Url: "challenge", signatureB64Url: "signature" } } }
    }, {
      secret,
      exchange: async () => authority,
      validate: async () => authority,
      loadProfile: async () => ({ id: "owner-2", handle: "current.receiz.id" }),
      introspect: async () => ({ active: true, sub: "owner-2", scope: readAuthorityScopes.join(" ") }),
      artifactDigest: async () => H.artifact
    });
    assert.equal(admitted.keyId, H.key);
    assert.equal(admitted.profileHandle, "current.receiz.id");
  });

  it("derives exact one-operation transfer authority from the edge Receiz ID", async () => {
    let challengeInput: unknown = null;
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
      statementDigest: async () => H.authority,
      createChallenge: (input) => {
        challengeInput = input;
        return {
          challenge: {
            schema: "receiz.identity.proof-authority-challenge.v123",
            audience: "wildz",
            nonce: "transfer-nonce-00000001",
            issuedAtKai: 13_731_001,
            expiresAtKai: 13_731_061,
            consent: { approved: true, statementDigest: H.authority }
          },
          challengeB64Url: "canonical-transfer-challenge"
        };
      }
    });
    assert.equal(consent.artifact, "identity-artifact");
    assert.deepEqual(challengeInput, {
      applicationId: "wildz",
      artifactDigest: H.artifact,
      scopes: ["receiz:settlement.read", "receiz:settlement.write"],
      consentStatementDigest: H.authority,
      ttlPulses: 60
    });
    assert.deepEqual(consent.challenge.consent, { approved: true, statementDigest: H.authority });
    assert.equal(consent.challenge.proof.keyId, H.key);
  });
});
