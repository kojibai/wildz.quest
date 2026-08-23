"use client";

import {
  createReceizProofAuthorityChallenge,
  receizOidcScopesForRails,
  serializeReceizIdentityArtifact,
  sha256ReceizBytes,
  signReceizIdentityLoginProof,
  type ReceizIdentityLoginProof
} from "@receiz/sdk";
import { defaultIdentityRepository } from "@/lib/receiz/wildz-identity-adapter";
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
  statementDigest: wildsWalletTransferConsentStatementDigest,
  createChallenge: createReceizProofAuthorityChallenge
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
