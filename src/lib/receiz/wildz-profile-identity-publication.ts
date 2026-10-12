import {verifyWildzPublishedOwnershipClaims} from "./wildz-upload-ownership";
import { readWildzOwnerPublishedOwnershipClaims, admitWildzOwnerPublishedOwnershipClaims } from "./wildz-published-ownership";
import type { WildzCrewCustody } from "./wildz-artifact-codec";
import { defaultContinuityDatabase, defaultIdentityRepository } from "./wildz-active-identity";
import { canonicalPortableCardJson, type PortableCardAsset } from "../../features/play/portable-card";
import type { PublicWildzProfile } from "../../features/profile/public-profile";
import type { WildzIdentityRepository } from "./wildz-identity-repository";
import { sameWildzPlayerCoordinate, parseWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { prepareWildzProfilePublication } from "./wildz-profile-signing-client";
import { readWildzIdentityForSigning } from "./wildz-identity-signing-read";

/** Sign locally and relay only the sanitized public projection and its signature. */
export async function publishWildzProfileWithIdentityProof(profile: PublicWildzProfile, options: {
  repository?: Pick<WildzIdentityRepository, "active" | "withKeyFile">;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  occurredAt?: string;
  assets?: readonly PortableCardAsset[];
  publishMarketCollection?: boolean;
  ownershipClaims?: readonly unknown[];
  ownershipHistory?: readonly unknown[];
  custody?: WildzCrewCustody | null;
} = {}) {
  options.signal?.throwIfAborted();
  const repository = options.repository ?? defaultIdentityRepository;
  const withKeyFile: WildzIdentityRepository["withKeyFile"] = options.repository
    ? repository.withKeyFile.bind(repository)
    : async (keyId, operation) => operation(await readWildzIdentityForSigning(keyId, options.signal));
  const session = await repository.active();
  const owner = parseWildzPlayerCoordinate(profile.username);
  if (!session || session.localAuthority !== "verified") throw new Error("wildz_profile_identity_seal_required");
  if (!owner || !sameWildzPlayerCoordinate(owner.actorId, session.actorId)) throw new Error("wildz_public_profile_owner_mismatch");
  const galleryIds = new Set(profile.vault.map(card => card.id));
  const galleryCards = (options.assets ?? []).filter(card => galleryIds.has(card.id));
  const suppliedClaims = options.ownershipClaims ?? (options.repository ? [] : await readWildzOwnerPublishedOwnershipClaims(defaultContinuityDatabase, session, galleryCards, options.custody));
  const ownershipClaims = await admitWildzOwnerPublishedOwnershipClaims(suppliedClaims, session, galleryCards, options.custody);
  const ownershipHistory = (await verifyWildzPublishedOwnershipClaims(options.ownershipHistory ?? [])).filter(({claim}) => claim.keyId === session.keyId && sameWildzPlayerCoordinate(claim.ownerReceizId, session.actorId));
  const prepared = await withKeyFile(session.keyId, keyFile => prepareWildzProfilePublication({
    profile, session, keyFile, assets: options.assets, occurredAt: options.occurredAt, publishMarketCollection: options.publishMarketCollection, ownershipClaims, ownershipHistory
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
  if(options.publishMarketCollection&&result.collectionPublished!==true)throw Error('wildz_market_collection_sync_pending');
  return prepared.profile;
}
