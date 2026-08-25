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
import { wildsLivingWorldConsentStatementDigest, type WildsLivingWorldAuthorizationRequest } from "./wilds-living-world-consent";

export type { WildsLivingWorldAuthorizationRequest } from "./wilds-living-world-consent";

export type WildsLivingWorldAuthorizationDependencies = Readonly<{
  loadIdentity(keyId: string): Promise<Readonly<{
    artifact: string;
    artifactDigest: string;
    keyId: string;
    sign(challengeB64Url: string): Promise<ReceizIdentityLoginProof>;
  }>>;
  createChallenge: typeof createReceizProofAuthorityChallenge;
}>;

const DEFAULT_DEPENDENCIES: WildsLivingWorldAuthorizationDependencies = {
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

export async function authorizeWildsLivingWorldOperationWithIdentity(
  keyId: string,
  input: WildsLivingWorldAuthorizationRequest,
  dependencies: WildsLivingWorldAuthorizationDependencies = DEFAULT_DEPENDENCIES
) {
  if (!keyId || !input.operationId || !/^[a-f0-9]{64}$/.test(input.planDigest)
    || !input.semanticIdempotencyKey || !/^(?:0|[1-9][0-9]{0,29})$/.test(input.amountPhiMicro)) {
    throw new Error("wilds_living_world_authorization_invalid");
  }
  const identity = await dependencies.loadIdentity(keyId);
  if (identity.keyId !== keyId) throw new Error("wilds_living_world_authorization_identity_mismatch");
  const requestedRails = input.amountPhiMicro === "0" ? [] : ["settlement"] as const;
  const created = dependencies.createChallenge({
    applicationId: WILDZ_RECEIZ_APPLICATION_ID,
    artifactDigest: identity.artifactDigest,
    scopes: requestedRails.length ? receizOidcScopesForRails("settlement") : [],
    consentStatementDigest: await wildsLivingWorldConsentStatementDigest(input),
    ttlPulses: WILDS_WALLET_AUTHORITY_WINDOW_PULSES
  });
  const proof = await identity.sign(created.challengeB64Url);
  return Object.freeze({
    artifact: identity.artifact,
    challenge: Object.freeze({ ...created.challenge, proof }),
    requestedRails
  });
}
