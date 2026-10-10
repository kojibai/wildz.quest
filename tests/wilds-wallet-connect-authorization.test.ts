import assert from "node:assert/strict";
import test from "node:test";
import { createReceizIdentityKeyFile, createReceizProofAuthorityChallenge, proofAuthorityChallengeBasisV123, canonicalizeReceizV122, receizBase64UrlEncode, receizOidcScopesForRails, signReceizIdentityLoginProof, parseReceizIdentityArtifactText, verifyReceizIdentityLoginProof } from "@receiz/sdk";
import { authorizeWildsWalletTransferWithIdentity } from "../src/features/play/wallet/wilds-wallet-transfer-authorization";
import { createWildzIdentityAuthorizationArtifact } from "../src/lib/receiz/wildz-identity-authorization-artifact";
import { wildsWalletTransferConsentStatementDigest } from "../src/lib/receiz/wilds-wallet-transfer-consent";

async function fixture() {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "fixture", username: "alice", displayName: "Fixture" } });
  const identity = await createWildzIdentityAuthorizationArtifact(keyFile);
  const input = { attempt: "v3.synthetic-exact-attempt", recipientUsername: "bob", amountPhiMicro: "9007199254740993", rail: "settlement" as const };
  let signatures = 0;
  const unsigned = createReceizProofAuthorityChallenge({ applicationId: "real-configured-client-id", artifactDigest: identity.artifactDigest, scopes: receizOidcScopesForRails("wallet"), consentStatementDigest: await wildsWalletTransferConsentStatementDigest(input), ttlPulses: 60 }).challenge;
  const dependencies = { loadIdentity: async () => ({ ...identity, keyId: keyFile.keyId, sign: async (challengeB64Url: string) => { signatures++; return signReceizIdentityLoginProof({ keyFile, challengeB64Url }); } }), statementDigest: wildsWalletTransferConsentStatementDigest, createChallenge: createReceizProofAuthorityChallenge, requestChallenge: async () => ({ applicationId: "real-configured-client-id", scopes: receizOidcScopesForRails("wallet").sort(), unsigned }) };
  return { keyFile, identity, input, unsigned, dependencies, signatures: () => signatures };
}

test("v3 Send signs the server's configured client and exact wallet scopes without transporting a signing key", async () => {
  const f = await fixture();
  const result = await authorizeWildsWalletTransferWithIdentity(f.keyFile.keyId, f.input, f.dependencies);
  const identity = parseReceizIdentityArtifactText(result.artifact);
  assert.equal(Boolean(identity.crypto.privateKeyPkcs8B64u), false);
  const basis = proofAuthorityChallengeBasisV123({ challenge: f.unsigned, applicationId: "real-configured-client-id", artifactDigest: f.identity.artifactDigest, scopes: receizOidcScopesForRails("wallet") });
  assert.equal(result.challenge.proof!.challengeB64Url, receizBase64UrlEncode(new TextEncoder().encode(canonicalizeReceizV122(basis))));
  assert.equal(await verifyReceizIdentityLoginProof({ keyFile: identity, challengeB64Url: result.challenge.proof!.challengeB64Url, signatureB64Url: result.challenge.proof!.signatureB64Url }), true);
  assert.equal(f.signatures(), 1);
});

test("v3 Send rejects substituted amount, rail, artifact and scope challenge before the held key signs", async () => {
  const f = await fixture();
  const variations = [
    { applicationId: "real-configured-client-id", scopes: receizOidcScopesForRails("settlement"), unsigned: f.unsigned },
    { applicationId: "other-client", scopes: receizOidcScopesForRails("wallet").sort(), unsigned: f.unsigned },
    { applicationId: "real-configured-client-id", scopes: receizOidcScopesForRails("wallet").sort(), unsigned: { ...f.unsigned, consent: { ...f.unsigned.consent, statementDigest: "0".repeat(64) } } },
    { applicationId: "real-configured-client-id", scopes: receizOidcScopesForRails("wallet").sort(), unsigned: { ...f.unsigned, artifactDigest: "0".repeat(64) } }
  ];
  for (const value of variations) await assert.rejects(authorizeWildsWalletTransferWithIdentity(f.keyFile.keyId, f.input, { ...f.dependencies, requestChallenge: async () => value }));
  await assert.rejects(authorizeWildsWalletTransferWithIdentity(f.keyFile.keyId, { ...f.input, amountPhiMicro: "1" }, f.dependencies));
  await assert.rejects(authorizeWildsWalletTransferWithIdentity(f.keyFile.keyId, { ...f.input, rail: "reserve" }, f.dependencies));
  assert.equal(f.signatures(), 0);
});
