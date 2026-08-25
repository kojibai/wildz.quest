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
import { WILDS_WALLET_AUTHORITY_WINDOW_PULSES } from "@/lib/receiz/wilds-wallet-authority-scopes";
import { WILDZ_RECEIZ_APPLICATION_ID } from "@/lib/receiz/wildz-application";
import {
  wildsPortableClaimConsentStatementDigest,
  type WildsPortableClaimAuthorizationRequest
} from "./wilds-portable-claim-consent";

type Dependencies = Readonly<{
  loadIdentity(keyId: string): Promise<Readonly<{
    artifact: string;
    artifactDigest: string;
    keyId: string;
    sign(challengeB64Url: string): Promise<ReceizIdentityLoginProof>;
  }>>;
  createChallenge: typeof createReceizProofAuthorityChallenge;
}>;

const DEFAULT_DEPENDENCIES: Dependencies = {
  loadIdentity: (keyId) => defaultIdentityRepository.withKeyFile(keyId, async (keyFile) => {
    const artifact = serializeReceizIdentityArtifact(keyFile);
    return {
      artifact,
      artifactDigest: await sha256ReceizBytes(new TextEncoder().encode(artifact)),
      keyId: keyFile.keyId,
      sign: async (challengeB64Url) => signReceizIdentityLoginProof({ keyFile, challengeB64Url })
    };
  }),
  createChallenge: createReceizProofAuthorityChallenge
};

export async function authorizeWildsPortableClaimWithIdentity(
  keyId: string,
  input: WildsPortableClaimAuthorizationRequest,
  dependencies: Dependencies = DEFAULT_DEPENDENCIES
) {
  if (!keyId || !/^wildz-claim:[a-f0-9]{64}$/.test(input.claimId)
    || !/^[a-f0-9]{64}$/.test(input.exactPlanDigest)) {
    throw new Error("wilds_portable_claim_authorization_invalid");
  }
  const identity = await dependencies.loadIdentity(keyId);
  if (identity.keyId !== keyId) throw new Error("wilds_portable_claim_authorization_identity_mismatch");
  const requestedRails = input.kind === "phi" ? ["settlement"] as const : [];
  const created = dependencies.createChallenge({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    artifactDigest: identity.artifactDigest,
    scopes: requestedRails.length ? receizOidcScopesForRails("settlement") : [],
    consentStatementDigest: await wildsPortableClaimConsentStatementDigest(input),
    ttlPulses: WILDS_WALLET_AUTHORITY_WINDOW_PULSES
  });
  const proof = await identity.sign(created.challengeB64Url);
  return Object.freeze({
    artifact: identity.artifact,
    challenge: Object.freeze({ ...created.challenge, proof }),
    requestedRails
  });
}
