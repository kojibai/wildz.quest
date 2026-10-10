"use client";

import {
  createReceizProofAuthorityChallenge,
  canonicalizeReceizV122,
  proofAuthorityChallengeBasisV123,
  receizBase64UrlEncode,
  receizOidcScopesForRails,
  signReceizIdentityLoginProof,
  type ReceizIdentityLoginProof
} from "@receiz/sdk";
import { readWildzIdentityForSigning } from "@/lib/receiz/wildz-identity-signing-read";
import { createWildzIdentityAuthorizationArtifact } from "@/lib/receiz/wildz-identity-authorization-artifact";
import { wildsWalletTransferConsentStatementDigest } from "@/lib/receiz/wilds-wallet-transfer-consent";
import { WILDS_WALLET_AUTHORITY_WINDOW_PULSES } from "@/lib/receiz/wilds-wallet-authority-scopes";
import { WILDZ_RECEIZ_APPLICATION_ID } from "@/lib/receiz/wildz-application";

type TransferAuthorizationInput = Readonly<{
  attempt: string;
  recipientUsername: string;
  amountPhiMicro: string;
  rail: "settlement" | "reserve";
}>;

type TransferAuthorizationDependencies = Readonly<{
  loadIdentity(keyId: string): Promise<Readonly<{
    artifact: string;
    artifactDigest: string;
    keyId: string;
    sign(challengeB64Url: string): Promise<ReceizIdentityLoginProof>;
  }>>;
  statementDigest(input: TransferAuthorizationInput): Promise<string>;
  createChallenge: typeof createReceizProofAuthorityChallenge;
  requestChallenge?(attempt: string, artifactDigest: string): Promise<unknown>;
}>;

const DEFAULT_DEPENDENCIES: TransferAuthorizationDependencies = {
  loadIdentity: async (keyId) => {
    const keyFile = await readWildzIdentityForSigning(keyId);
    const transport = await createWildzIdentityAuthorizationArtifact(keyFile);
    return {
      ...transport,
      keyId: keyFile.keyId,
      sign: async (challengeB64Url) => signReceizIdentityLoginProof({ keyFile, challengeB64Url })
    };
  },
  statementDigest: wildsWalletTransferConsentStatementDigest,
  createChallenge: createReceizProofAuthorityChallenge,
  async requestChallenge(attempt, artifactDigest) {
    const query = new URLSearchParams({ attempt, artifactDigest });
    const response = await fetch(`/api/wilds/wallet/transfer/consent?${query}`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("wilds_wallet_transfer_consent_unavailable");
    return response.json();
  }
};

export async function authorizeWildsWalletTransferWithIdentity(
  keyId: string,
  input: TransferAuthorizationInput,
  dependencies: TransferAuthorizationDependencies = DEFAULT_DEPENDENCIES
) {
  if (!keyId || !input.attempt || !input.recipientUsername || !/^[1-9][0-9]*$/.test(input.amountPhiMicro)
    || (input.rail !== "settlement" && input.rail !== "reserve")) {
    throw new Error("wilds_wallet_transfer_authorization_invalid");
  }
  const identity = await dependencies.loadIdentity(keyId);
  if (identity.keyId !== keyId) throw new Error("wilds_wallet_transfer_authorization_identity_mismatch");
  if (input.attempt.startsWith("v3.")) {
    if (input.rail !== "settlement" || !dependencies.requestChallenge) throw new Error("wilds_wallet_transfer_consent_binding_invalid");
    const value = await dependencies.requestChallenge(input.attempt, identity.artifactDigest) as { applicationId?: unknown; scopes?: unknown; unsigned?: Parameters<typeof proofAuthorityChallengeBasisV123>[0]["challenge"] } | null;
    const expectedScopes = receizOidcScopesForRails("wallet").sort();
    const exactFields = (record: unknown, fields: string[]) => !!record && typeof record === "object" && !Array.isArray(record)
      && Object.keys(record).length === fields.length && fields.every(field => Object.hasOwn(record, field));
    if (!value || typeof value.applicationId !== "string" || !value.applicationId || !Array.isArray(value.scopes) || JSON.stringify(value.scopes) !== JSON.stringify(expectedScopes)
      || !exactFields(value, ["applicationId", "scopes", "unsigned"])
      || !exactFields(value.unsigned, ["schema", "audience", "nonce", "issuedAtKai", "expiresAtKai", "consent"])
      || !exactFields(value.unsigned?.consent, ["approved", "statementDigest"])
      || !value.unsigned || value.unsigned.consent.statementDigest !== await dependencies.statementDigest(input)) throw new Error("wilds_wallet_transfer_consent_binding_invalid");
    const basis = proofAuthorityChallengeBasisV123({ challenge: value.unsigned, applicationId: value.applicationId, artifactDigest: identity.artifactDigest, scopes: expectedScopes });
    const proof = await identity.sign(receizBase64UrlEncode(new TextEncoder().encode(canonicalizeReceizV122(basis))));
    return Object.freeze({ artifact: identity.artifact, challenge: Object.freeze({ ...value.unsigned, proof }) });
  }
  const created = dependencies.createChallenge({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    artifactDigest: identity.artifactDigest,
    scopes: receizOidcScopesForRails(input.rail),
    consentStatementDigest: await dependencies.statementDigest(input),
    ttlPulses: WILDS_WALLET_AUTHORITY_WINDOW_PULSES
  });
  const proof = await identity.sign(created.challengeB64Url);
  return Object.freeze({ artifact: identity.artifact, challenge: Object.freeze({ ...created.challenge, proof }) });
}
