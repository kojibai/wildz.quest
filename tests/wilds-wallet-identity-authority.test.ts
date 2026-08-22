import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeWildsWalletIdentityAuthority,
  issueWildsWalletIdentityAuthorityChallenge
} from "../src/lib/receiz/wilds-wallet-identity-authority";
import { authorizeWildsWalletReadWithIdentity } from "../src/features/play/wallet/wilds-wallet-read-authorization";

const H = {
  artifact: "a".repeat(64),
  authority: "b".repeat(64),
  key: "c".repeat(64),
  revocation: "d".repeat(64)
};

describe("Receiz ID wallet read authority", () => {
  it("issues a wallet-read-only challenge bound to the active Receiz ID", () => {
    const issued = issueWildsWalletIdentityAuthorityChallenge({
      session: { keyId: H.key, actorId: "explorer", profileHandle: "explorer.receiz.id" },
      nowKai: 13_731_001,
      nonce: "wallet-read-nonce-00000001"
    }, "s".repeat(32));
    assert.deepEqual(issued.challenge.scopes, ["receiz:wallet.read"]);
    assert.equal(issued.challenge.applicationId, "wildz.quest");
    assert.equal(issued.challenge.keyId, H.key);
    assert.equal(issued.challenge.unsigned.consent.approved, true);
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
      grantedScopes: ["receiz:wallet.read"],
      issuedAtKai: 13_731_001,
      expiresAtKai: 13_731_121,
      nonce: "wallet-read-nonce-00000001",
      revocationHead: H.revocation,
      tokenType: "Bearer" as const,
      expiresIn: 120,
      refreshable: false as const,
      authority: { grantIsIdentityAuthority: false as const, strongerTruth: "receiz-identity-artifact" as const },
      authorityDigest: H.authority,
      accessToken: "opaque-read-bearer"
    };
    const admitted = await completeWildsWalletIdentityAuthority({
      session,
      ticket: issued.ticket,
      body: { artifact: "identity-artifact", challenge: { ...issued.challenge.unsigned, proof: { schema: "receiz.identity.login_proof.v1", keyId: H.key, alg: "Ed25519", challengeB64Url: "challenge", signatureB64Url: "signature" } } }
    }, {
      secret,
      exchange: async () => authority,
      validate: async () => authority,
      loadProfile: async () => ({ id: "owner-1", handle: "explorer" }),
      introspect: async () => ({ active: true, sub: "owner-1", scope: "receiz:wallet.read" }),
      artifactDigest: async () => H.artifact
    });
    assert.deepEqual(admitted, {
      accessToken: "opaque-read-bearer",
      expiresIn: 120,
      grantedScopes: ["receiz:wallet.read"]
    });
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
        if (!body) return { ok: true, value: { applicationId: "wildz.quest", scopes: ["receiz:wallet.read"], keyId: H.key, unsigned: { schema: "receiz.identity.proof-authority-challenge.v123", audience: "wildz.quest", nonce: "wallet-read-nonce-00000001", issuedAtKai: 13_731_001, expiresAtKai: 13_731_121, consent: { approved: true, statementDigest: H.authority } } } };
        return { ok: true, value: { status: "connected", scopes: ["receiz:wallet.read"] } };
      },
      challengeText: () => "canonical-challenge"
    });
    assert.equal(result, true);
    assert.equal(requests.length, 2);
    assert.doesNotMatch(JSON.stringify(requests), /opaque-read-bearer|accessToken/);
  });
});
