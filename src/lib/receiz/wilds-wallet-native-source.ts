import {
  digestReceizCanonicalV122, readReceizIdentityArtifact, transportReceizSealedArtifactV124,
  deriveReceizSubjectIdV122, validateReceizSubjectAdmissionResultV122,
  sha256ReceizBytes,
  type ReceizProofAuthorityChallengeV123
} from "@receiz/sdk";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";
import type { ReceizCommerceAdapter } from "./adapter";
import type { WildsWalletReadAuthority } from "./wilds-wallet-route-authority";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";

export const WILDS_NATIVE_SOURCE_SCOPES = Object.freeze([
  "openid", "profile", "receiz:record", "receiz:seal", "receiz:subjects.read", "receiz:subjects.write", "receiz:wallet.read"
]);
export function wildsWalletNativeSourceStatementDigest(keyId: string, artifactDigest: string) {
  return digestReceizCanonicalV122({ schema: "wildz.native-wallet-source-initialization.v1", applicationId: WILDZ_RECEIZ_APPLICATION_ID, keyId, artifactDigest });
}
type SourceRail = Pick<ReceizCommerceAdapter, "client" | "exchangeProofAuthorityV123" | "nativeValueTransferCapabilitiesV123" | "admitSubjectV122">;
/** Admit a real owned native document coordinate. Native V123 funding remains its separate atomic law. */
export async function initializeWildsWalletNativeSource(authority: WildsWalletReadAuthority, body: unknown, input: Readonly<{
  keyId: string; createAdapter(accessToken: string): SourceRail;
}>) {
  const current = await input.createAdapter(authority.accessToken).nativeValueTransferCapabilitiesV123();
  if (current.userId !== authority.ownerReceizId) throw Error("wilds_wallet_native_source_identity_mismatch");
  if (current.sourceAvailable) return { status: "ready" as const };
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !["artifact", "challenge"].includes(k))) throw Error("wilds_wallet_native_source_invalid");
  const { artifact, challenge } = body as { artifact: unknown; challenge: ReceizProofAuthorityChallengeV123 };
  if (typeof artifact !== "string" || artifact.length > 2_000_000 || !challenge) throw Error("wilds_wallet_native_source_invalid");
  const key = await readReceizIdentityArtifact(artifact);
  if (key.crypto.privateKeyPkcs8B64u || key.keyId !== input.keyId || !sameWildzPlayerCoordinate(key.owner.uid, authority.profileHandle)) throw Error("wilds_wallet_native_source_identity_mismatch");
  const artifactDigest = await sha256ReceizBytes(new TextEncoder().encode(artifact));
  if (challenge.audience !== WILDZ_RECEIZ_APPLICATION_ID || challenge.proof?.keyId !== key.keyId || challenge.consent?.approved !== true
    || challenge.consent.statementDigest !== await wildsWalletNativeSourceStatementDigest(key.keyId, artifactDigest)) throw Error("wilds_wallet_native_source_consent_invalid");
  const grant = await input.createAdapter(authority.accessToken).exchangeProofAuthorityV123({ artifact, challenge,
    applicationId: WILDZ_RECEIZ_APPLICATION_ID, scopes: WILDS_NATIVE_SOURCE_SCOPES });
  const rail = input.createAdapter(grant.accessToken);
  const owner = await rail.nativeValueTransferCapabilitiesV123();
  if (owner.userId !== authority.ownerReceizId) throw Error("wilds_wallet_native_source_identity_mismatch");
  if (owner.sourceAvailable) return { status: "ready" as const };
  const source = await rail.client.assets.createProofObject({ assetType: "proof_object", payload: { bytes: new TextEncoder().encode(artifact), mimeType: "application/json" } }, {
    filename: `wildz-wallet-${key.keyId}.receizkey`, idempotencyKey: `wildz:native-wallet-source:${key.keyId}:${artifactDigest}`
  });
  const wire = await transportReceizSealedArtifactV124(source);
  const subjectId = await deriveReceizSubjectIdV122(wire.artifactSha256);
  const result = await validateReceizSubjectAdmissionResultV122(await rail.admitSubjectV122({ proofObject: source.artifact,
    ownerReceizId: authority.profileHandle, idempotencyKey: `wildz:native-wallet-subject:${subjectId}`, expectedAbsent: true }));
  if (!result.ok || result.subjectId !== subjectId || result.proofDigest !== wire.artifactSha256) throw Error("wilds_wallet_native_source_admission_invalid");
  return { status: "ready" as const };
}
