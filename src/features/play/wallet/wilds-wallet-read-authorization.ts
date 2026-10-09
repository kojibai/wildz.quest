"use client";

import {
  canonicalizeReceizV122,
  proofAuthorityChallengeBasisV123,
  receizBase64UrlEncode,
  signReceizIdentityLoginProof,
  type ReceizIdentityLoginProof
} from "@receiz/sdk";
import { connectWildzProofSession, defaultIdentityRepository } from "@/lib/receiz/wildz-identity-adapter";
import { hasExactWildsIdentityAuthorityScopes, type WildsIdentityAuthorityPurpose } from "@/lib/receiz/wilds-wallet-authority-scopes";
import { wildzRemoteSessionMatchesIdentity } from "@/lib/receiz/wildz-session-bridge";
import { readWildzIdentityForSigning } from "@/lib/receiz/wildz-identity-signing-read";
import { createWildzIdentityAuthorizationArtifact } from "@/lib/receiz/wildz-identity-authorization-artifact";
export { projectWildsWalletSourceAuthority } from "./wilds-wallet-source-client";

import { walletAuthorizationFailureCode, WildsWalletAuthorizationError } from "./wilds-wallet-authorization-error";
import { createWildsWalletReadAuthorizationCoordinator } from "./wilds-wallet-read-authorization-coordinator";

const coordinateReadAuthorization = createWildsWalletReadAuthorizationCoordinator();

type ChallengeEnvelope = Readonly<{
  applicationId: string;
  scopes: readonly string[];
  keyId: string;
  unsigned: Parameters<typeof proofAuthorityChallengeBasisV123>[0]["challenge"];
}>;

type ReadAuthorizationDependencies = Readonly<{
  loadIdentity(keyId: string): Promise<Readonly<{
    artifact: string;
    artifactDigest: string;
    keyId: string;
    sign(challengeB64Url: string): Promise<ReceizIdentityLoginProof>;
  }>>;
  request(path: string, body?: unknown): Promise<Readonly<{ ok: boolean; value: unknown }>>;
  reconnect?(keyId: string): Promise<boolean>;
  challengeText(basis: ReturnType<typeof proofAuthorityChallengeBasisV123>): string;
}>;

const DEFAULT_DEPENDENCIES: ReadAuthorizationDependencies = {
  loadIdentity: async (keyId) => {
    const keyFile = await readWildzIdentityForSigning(keyId);
    const transport = await createWildzIdentityAuthorizationArtifact(keyFile);
    return {
      ...transport,
      keyId: keyFile.keyId,
      sign: async (challengeB64Url) => signReceizIdentityLoginProof({ keyFile, challengeB64Url })
    };
  },
  async request(path, body) {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      signal: AbortSignal.timeout(10_000),
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { ok: response.ok, value: await response.json().catch(() => null) };
  },
  async reconnect(keyId) {
    const active = await defaultIdentityRepository.active();
    if (!active || active.keyId !== keyId || active.localAuthority !== "verified") return false;
    const remote = await connectWildzProofSession(active, { forceRemote: true });
    const current = await defaultIdentityRepository.active();
    return current?.keyId === keyId && remote.status === "connected" && wildzRemoteSessionMatchesIdentity(active, remote);
  },
  challengeText: canonicalizeReceizV122
};

function challengeEnvelope(value: unknown): ChallengeEnvelope | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ChallengeEnvelope>;
  return typeof candidate.applicationId === "string" && typeof candidate.keyId === "string"
    && Array.isArray(candidate.scopes) && candidate.unsigned && typeof candidate.unsigned === "object"
    ? candidate as ChallengeEnvelope : null;
}

export function authorizeWildsWalletReadWithIdentity(keyId: string, dependencies: ReadAuthorizationDependencies = DEFAULT_DEPENDENCIES, purpose: WildsIdentityAuthorityPurpose = "wallet-read") {
  const authorize = () => completeWildsWalletReadAuthorization(keyId, dependencies, purpose);
  return dependencies === DEFAULT_DEPENDENCIES
    ? coordinateReadAuthorization(JSON.stringify([keyId, purpose]), authorize)
    : authorize();
}

async function completeWildsWalletReadAuthorization(keyId: string, dependencies: ReadAuthorizationDependencies, purpose: WildsIdentityAuthorityPurpose) {
  const purposeQuery = purpose === "artifact-claim" ? "&purpose=artifact-claim" : "";
  const completionPath = `/api/auth/wildz/wallet-authority${purpose === "artifact-claim" ? "?purpose=artifact-claim" : ""}`;
  const identity = await dependencies.loadIdentity(keyId);
  if (identity.keyId !== keyId) return false;
  const attempt = async (mayReconnect: boolean): Promise<boolean> => {
    const issued = await dependencies.request(`/api/auth/wildz/wallet-authority?keyId=${encodeURIComponent(keyId)}&artifactDigest=${identity.artifactDigest}${purposeQuery}`);
    if (!issued.ok) throw new WildsWalletAuthorizationError(walletAuthorizationFailureCode(issued.value));
    const envelope = issued.ok ? challengeEnvelope(issued.value) : null;
    if (!envelope || envelope.keyId !== keyId || !envelope.applicationId || envelope.unsigned.audience !== envelope.applicationId
      || !hasExactWildsIdentityAuthorityScopes(envelope.scopes, purpose)) return false;
    const basis = proofAuthorityChallengeBasisV123({
      challenge: envelope.unsigned,
      applicationId: envelope.applicationId,
      artifactDigest: identity.artifactDigest,
      scopes: envelope.scopes
    });
    const challengeB64Url = receizBase64UrlEncode(new TextEncoder().encode(dependencies.challengeText(basis)));
    const proof = await identity.sign(challengeB64Url);
    const completed = await dependencies.request(completionPath, {
      artifact: identity.artifact,
      challenge: { ...envelope.unsigned, proof }
    });
    if (!completed.ok) {
      const code = walletAuthorizationFailureCode(completed.value);
      if (code === "IDENTITY_NOT_BOUND" && mayReconnect && dependencies.reconnect
        && await dependencies.reconnect(keyId)) return attempt(false);
      throw new WildsWalletAuthorizationError(code);
    }
    const value = completed.value as { status?: unknown; scopes?: unknown } | null;
    return completed.ok && value?.status === "connected" && Array.isArray(value.scopes)
      && hasExactWildsIdentityAuthorityScopes(value.scopes, purpose);
  };
  return attempt(true);
}
