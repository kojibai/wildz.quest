import { createReceizClient, type JsonObject } from "@receiz/sdk";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { canonicalWildzProfilePath, type PublicWildzProfile } from "../../features/profile/public-profile";
import { createPublicWildzProfileRecord } from "./wildz-profile-adapter";
import { WILDZ_PRODUCT } from "../wildz/product";
import type { WildzIdentityRepository } from "./wildz-identity-repository";
import { sameWildzPlayerCoordinate, parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

/** Sign locally and relay only the sanitized public projection and its signature. */
export async function publishWildzProfileWithIdentityProof(profile: PublicWildzProfile, options: {
  repository?: Pick<WildzIdentityRepository, "active" | "withKeyFile">;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  occurredAt?: string;
} = {}) {
  options.signal?.throwIfAborted();
  const repository = options.repository ?? (await import("./wildz-identity-adapter")).defaultIdentityRepository;
  const session = await repository.active();
  const owner = parseWildzPlayerCoordinate(profile.username);
  if (!session || session.localAuthority !== "verified") throw new Error("wildz_profile_identity_seal_required");
  if (!owner || !sameWildzPlayerCoordinate(owner.actorId, session.actorId)) throw new Error("wildz_public_profile_owner_mismatch");
  const record = createPublicWildzProfileRecord(profile as unknown as Record<string, unknown>, `${WILDZ_PRODUCT.origin}${canonicalWildzProfilePath(profile.username)}`, options.occurredAt);
  await repository.withKeyFile(session.keyId, async keyFile => {
    if (keyFile.keyId !== session.keyId || !sameWildzPlayerCoordinate(keyFile.owner.username ?? "", owner.actorId)) throw new Error("wildz_public_profile_owner_mismatch");
    if (!keyFile.crypto.privateKeyPkcs8B64u && keyFile.crypto.privateKeyPkcs8CiphertextB64u.length) throw new Error("wildz_profile_identity_unlock_required");
    options.signal?.throwIfAborted();
    const signedPublication = await createReceizClient().publicStore.signPublish({
      tenantHost: WILDZ_PRODUCT.domain, merchantReceizId: owner.profileHandle,
      title: `${record.profile.displayName} on Wildz`, sourceUrl: record.sourceUrl,
      namespace: `wildz-profile:${record.handle.slice(1)}`, projectionState: "published",
      platform: WILDZ_PRODUCT.name, storeStateRecord: record as unknown as JsonObject, keyFile
    });
    options.signal?.throwIfAborted();
    const response = await (options.fetcher ?? globalThis.fetch)(`/api/profiles/${encodeURIComponent(owner.actorId)}`, {
      method: "POST", credentials: "same-origin", signal: options.signal,
      headers: {"content-type": "application/json"}, body: JSON.stringify({profile: record.profile, signedPublication})
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true || canonicalPortableCardJson(result.profile) !== canonicalPortableCardJson(record.profile)) {
      throw new Error(result?.error ?? "wildz_public_profile_publication_unconfirmed");
    }
  });
  return record.profile;
}
