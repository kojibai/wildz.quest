import { defaultIdentityRepository } from "./wildz-active-identity";
import { canonicalPortableCardJson, type PortableCardAsset } from "../../features/play/portable-card";
import type { PublicWildzProfile } from "../../features/profile/public-profile";
import type { WildzIdentityRepository } from "./wildz-identity-repository";
import { sameWildzPlayerCoordinate, parseWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { prepareWildzProfilePublication } from "./wildz-profile-signing-client";

/** Sign locally and relay only the sanitized public projection and its signature. */
export async function publishWildzProfileWithIdentityProof(profile: PublicWildzProfile, options: {
  repository?: Pick<WildzIdentityRepository, "active" | "withKeyFile">;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  occurredAt?: string;
  assets?: readonly PortableCardAsset[];
} = {}) {
  options.signal?.throwIfAborted();
  const repository = options.repository ?? defaultIdentityRepository;
  const session = await repository.active();
  const owner = parseWildzPlayerCoordinate(profile.username);
  if (!session || session.localAuthority !== "verified") throw new Error("wildz_profile_identity_seal_required");
  if (!owner || !sameWildzPlayerCoordinate(owner.actorId, session.actorId)) throw new Error("wildz_public_profile_owner_mismatch");
  const prepared = await repository.withKeyFile(session.keyId, keyFile => prepareWildzProfilePublication({
    profile, session, keyFile, assets: options.assets, occurredAt: options.occurredAt
  }, options.signal));
  options.signal?.throwIfAborted();
  const response = await (options.fetcher ?? globalThis.fetch)(`/api/profiles/${encodeURIComponent(owner.actorId)}`, {
    method: "POST", credentials: "same-origin", signal: options.signal,
    headers: { "content-type": "application/json" }, body: prepared.body
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true || canonicalPortableCardJson(result.profile) !== canonicalPortableCardJson(prepared.profile)) {
    throw new Error(result?.error ?? "wildz_public_profile_publication_unconfirmed");
  }
  return prepared.profile;
}
