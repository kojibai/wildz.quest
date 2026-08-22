"use client";

import {
  canonicalizeReceizV122,
  proofAuthorityChallengeBasisV123,
  receizBase64UrlEncode,
  serializeReceizIdentityArtifact,
  sha256ReceizBytes,
  signReceizIdentityLoginProof,
  type ReceizIdentityLoginProof
} from "@receiz/sdk";
import { defaultIdentityRepository } from "@/lib/receiz/wildz-identity-adapter";
import { hasExactWildsWalletReadAuthorityScopes } from "@/lib/receiz/wilds-wallet-authority-scopes";

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
  challengeText(basis: ReturnType<typeof proofAuthorityChallengeBasisV123>): string;
}>;

const DEFAULT_DEPENDENCIES: ReadAuthorizationDependencies = {
  loadIdentity: (keyId) => defaultIdentityRepository.withKeyFile(keyId, async (keyFile) => {
    const artifact = serializeReceizIdentityArtifact(keyFile);
    return {
      artifact,
      artifactDigest: await sha256ReceizBytes(new TextEncoder().encode(artifact)),
      keyId: keyFile.keyId,
      sign: async (challengeB64Url) => signReceizIdentityLoginProof({ keyFile, challengeB64Url })
    };
  }),
  async request(path, body) {
    const response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { ok: response.ok, value: await response.json().catch(() => null) };
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

export async function authorizeWildsWalletReadWithIdentity(keyId: string, dependencies: ReadAuthorizationDependencies = DEFAULT_DEPENDENCIES) {
  const identity = await dependencies.loadIdentity(keyId);
  if (identity.keyId !== keyId) return false;
  const issued = await dependencies.request("/api/auth/wildz/wallet-authority");
  const envelope = issued.ok ? challengeEnvelope(issued.value) : null;
  if (!envelope || envelope.keyId !== keyId || envelope.applicationId !== "wildz.quest"
    || !hasExactWildsWalletReadAuthorityScopes(envelope.scopes)) return false;
  const basis = proofAuthorityChallengeBasisV123({
    challenge: envelope.unsigned,
    applicationId: envelope.applicationId,
    artifactDigest: identity.artifactDigest,
    scopes: envelope.scopes
  });
  const challengeB64Url = receizBase64UrlEncode(new TextEncoder().encode(dependencies.challengeText(basis)));
  const proof = await identity.sign(challengeB64Url);
  const completed = await dependencies.request("/api/auth/wildz/wallet-authority", {
    artifact: identity.artifact,
    challenge: { ...envelope.unsigned, proof }
  });
  const value = completed.value as { status?: unknown; scopes?: unknown } | null;
  return completed.ok && value?.status === "connected" && Array.isArray(value.scopes)
    && hasExactWildsWalletReadAuthorityScopes(value.scopes);
}
