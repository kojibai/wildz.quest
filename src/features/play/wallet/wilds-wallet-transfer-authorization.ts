"use client";

import {
  canonicalizeReceizV122,
  proofAuthorityChallengeBasisV123,
  receizBase64UrlEncode,
  receizOidcScopesForRails,
  serializeReceizIdentityArtifact,
  sha256ReceizBytes,
  signReceizIdentityLoginProof,
  type ReceizIdentityLoginProof
} from "@receiz/sdk";
import { defaultIdentityRepository } from "@/lib/receiz/wildz-identity-adapter";
import { observeWildsKaiPulse } from "@/features/play/wilds-kai-runtime";
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
  nowKai(): number;
  nonce(): string;
  statementDigest(input: TransferAuthorizationInput): Promise<string>;
  challengeText(basis: ReturnType<typeof proofAuthorityChallengeBasisV123>): string;
}>;

const DEFAULT_DEPENDENCIES: TransferAuthorizationDependencies = {
  loadIdentity: (keyId) => defaultIdentityRepository.withKeyFile(keyId, async (keyFile) => {
    const artifact = serializeReceizIdentityArtifact(keyFile);
    return {
      artifact,
      artifactDigest: await sha256ReceizBytes(new TextEncoder().encode(artifact)),
      keyId: keyFile.keyId,
      sign: async (challengeB64Url) => signReceizIdentityLoginProof({ keyFile, challengeB64Url })
    };
  }),
  nowKai: observeWildsKaiPulse,
  nonce: () => crypto.randomUUID(),
  statementDigest: wildsWalletTransferConsentStatementDigest,
  challengeText: canonicalizeReceizV122
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
  const issuedAtKai = dependencies.nowKai();
  const nonce = dependencies.nonce();
  if (!Number.isSafeInteger(issuedAtKai) || issuedAtKai < 0 || !nonce || nonce.length > 256) {
    throw new Error("wilds_wallet_transfer_authorization_challenge_invalid");
  }
  const unsigned = Object.freeze({
    schema: "receiz.identity.proof-authority-challenge.v123" as const,
    audience: WILDZ_RECEIZ_APPLICATION_ID,
    nonce,
    issuedAtKai,
    expiresAtKai: issuedAtKai + WILDS_WALLET_AUTHORITY_WINDOW_PULSES,
    consent: Object.freeze({ approved: true, statementDigest: await dependencies.statementDigest(input) })
  });
  const basis = proofAuthorityChallengeBasisV123({
    challenge: unsigned,
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    artifactDigest: identity.artifactDigest,
    scopes: receizOidcScopesForRails(input.rail)
  });
  const challengeB64Url = receizBase64UrlEncode(new TextEncoder().encode(dependencies.challengeText(basis)));
  const proof = await identity.sign(challengeB64Url);
  return Object.freeze({ artifact: identity.artifact, challenge: Object.freeze({ ...unsigned, proof }) });
}
