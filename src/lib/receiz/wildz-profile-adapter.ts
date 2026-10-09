import { createPublicWildzProfileRecord, parsePublicWildzProfileRecord, publicWildzProfileRecoverySourceUrls, type PublicWildzProfileRecord } from "./wildz-profile-record";
export { WILDZ_PUBLIC_PROFILE_SCHEMA, verifiedWildzProfileCards, createPublicWildzProfileRecord, publicWildzProfileRecoverySourceUrls, parsePublicWildzProfileRecord } from "./wildz-profile-record";
export type { PublicWildzProfileRecord } from "./wildz-profile-record";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { publishWildzProfileWithIdentityProof } from "./wildz-profile-identity-publication";
import {
  canonicalWildzHandle,
  canonicalWildzProfilePath,
  type PublicWildzProfile
} from "@/features/profile/public-profile";
import { registerPublicWildsCard } from "@/features/play/public-card-registry";
import type { PortableCardAsset } from "@/features/play/portable-card";
import type { WildzAdmittedVaultProofObjects } from "./wildz-vault-card-admission";
import { createReceizCommerceAdapter } from "./adapter";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import type { WildzPublicProjectionRepository } from "./wildz-public-repository";
import { advanceWildzPublicState } from "./wildz-public-state";

const pendingSourceProfiles = new WeakMap<typeof fetch, Map<string, string>>();

export type WildzPublicProfileAdapterPort = {
  publishPublicStore(input: Record<string, unknown>, options?: { idempotencyKey?: string }): Promise<unknown>;
  readAppStateByUrl(url: string): Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function publicationSucceeded(value: unknown) {
  if (!isRecord(value) || value.ok === false) return false;
  return value.ok === true
    || typeof value.appendAnchorId === "string"
    || isRecord(value.knownHead)
    || (typeof value.accepted === "number" && value.accepted > 0);
}

export async function publishPublicWildzProfile(
  input: Record<string, unknown>,
  options: {
    adapter?: WildzPublicProfileAdapterPort;
    sourceUrl: string;
    merchantReceizId: string;
    publishedAt?: string;
    actorHandle?: string;
    repository?: WildzPublicProjectionRepository;
  }
) {
  const record = createPublicWildzProfileRecord(input, options.sourceUrl, options.publishedAt);
  const merchantReceizId = options.merchantReceizId.trim();
  if (!merchantReceizId) throw new Error("wildz_public_profile_authority_required");
  if (options.repository) {
    const loaded = await options.repository.load();
    const next = advanceWildzPublicState(loaded.state, {
      type: "publish-profile",
      actorHandle: options.actorHandle ?? record.handle,
      expectedRevision: loaded.state.revision,
      profile: record.profile
    }, { occurredAt: record.publishedAt });
    await options.repository.publish(next, {
      expectedHead: loaded.head,
      idempotencyKey: `profile:${record.handle}:${next.revision}`,
      merchantReceizId
    });
    return record;
  }
  const adapter = options.adapter ?? createReceizCommerceAdapter();
  const idempotencyKey = `wildz-profile:${record.handle}:${record.publishedAt}`;
  const result = await adapter.publishPublicStore({
    tenantHost: new URL(record.sourceUrl).host,
    merchantReceizId,
    title: `${record.profile.displayName} on Wildz`,
    sourceUrl: record.sourceUrl,
    namespace: `wildz-profile:${record.handle.slice(1)}`,
    projectionState: "published",
    platform: WILDZ_PRODUCT.name,
    state: record as unknown as Record<string, unknown>,
    idempotencyKey
  }, { idempotencyKey });
  if (!publicationSucceeded(result)) throw new Error("wildz_public_profile_publication_failed");
  return record;
}

export async function resolvePublicWildzProfile(
  username: string,
  options: {
    adapter?: WildzPublicProfileAdapterPort;
    repository?: WildzPublicProjectionRepository;
    requestOrigin?: string;
    platformDomain?: string;
  } = {}
): Promise<PublicWildzProfile | null> {
  const handle = canonicalWildzHandle(username);
  if (options.repository) {
    return (await options.repository.load()).state.profiles[handle.toLowerCase()] ?? null;
  }
  const adapter = options.adapter ?? createReceizCommerceAdapter();
  const requestOrigin = options.requestOrigin ?? WILDZ_PRODUCT.origin;
  for (const sourceUrl of publicWildzProfileRecoverySourceUrls(
    handle,
    requestOrigin,
    options.platformDomain ?? WILDZ_PRODUCT.domain
  )) {
    try {
      const record = parsePublicWildzProfileRecord(await adapter.readAppStateByUrl(sourceUrl));
      if (record?.handle === handle) return record.profile;
    } catch {
      // Try the canonical production origin before reporting the profile unavailable.
    }
  }
  return null;
}

function publicProfileEndpoint(username: string) {
  return `/api/profiles/${encodeURIComponent(canonicalWildzHandle(username).slice(1))}`;
}

export function wildzProfilePublicationReadiness(input: {
  hasIdentity: boolean;
  hasCharacter: boolean;
  proofSessionConnected: boolean;
  localSigningAvailable?: boolean;
}) {
  return input.hasIdentity && input.hasCharacter && (input.proofSessionConnected || input.localSigningAvailable)
    ? "ready"
    : "waiting";
}

export async function fetchPublicWildzProfile(username: string, fetcher: typeof fetch = globalThis.fetch, options: { signal?: AbortSignal } = {}) {
  const handle = canonicalWildzHandle(username);
  const response = await fetcher(publicProfileEndpoint(handle), {
    signal: options.signal,
    cache: "no-store",
    credentials: "omit",
    headers: { accept: "application/json", "cache-control": "no-cache" }
  });
  const value = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (response.status === 404) return null;
  if (!response.ok || value?.ok !== true || !isRecord(value.profile)) {
    throw new Error(typeof value?.error === "string" ? value.error : "wildz_public_profile_recovery_failed");
  }
  const profile = sanitizePublicWildzProfile(value.profile);
  return profile.username === handle ? profile : null;
}

export async function publishCurrentWildzProfile(
  profile: PublicWildzProfile,
  assetsOrFetcher: readonly PortableCardAsset[] | typeof fetch = [],
  suppliedFetcher: typeof fetch = globalThis.fetch,
  options: { confirmExisting?: boolean; signal?: AbortSignal; onProgress?: () => void; proofObjects?: WildzAdmittedVaultProofObjects; prepareBody?: (value: unknown) => Promise<string>; publishSourceProfile?: (profile: PublicWildzProfile, assets: readonly PortableCardAsset[], signal?: AbortSignal) => Promise<PublicWildzProfile>; publishWithIdentityProof?: (profile: PublicWildzProfile, signal?: AbortSignal) => Promise<PublicWildzProfile> } = {}
) {
  const assets = typeof assetsOrFetcher === "function" ? [] : assetsOrFetcher;
  const fetcher = typeof assetsOrFetcher === "function" ? assetsOrFetcher : suppliedFetcher;
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const requested of profile.vault) {
    options.signal?.throwIfAborted();
    const asset = assetsById.get(requested.id);
    if (!asset || asset.proof.digest !== requested.proofDigest) {
      throw new Error("wildz_public_profile_card_unverified");
    }
  }
  // Confirm this exact public revision before waiting on unrelated standalone-card
  // uploads. The independent card publisher continues servicing the full Vault.
  if (options.confirmExisting) {
    const existing = await fetchPublicWildzProfile(profile.username, fetcher, { signal: options.signal }).catch(() => null);
    options.signal?.throwIfAborted();
    if (existing && canonicalPortableCardJson(existing) === canonicalPortableCardJson(sanitizePublicWildzProfile(profile))) {
      pendingSourceProfiles.get(fetcher)?.delete(profile.username);
      return existing;
    }
  }
  // The current signed collection carries its own exact card proofs. Publishing
  // it need not wait for separate card pages or a stale public ownership index.
  if (options.publishSourceProfile) {
    const gallery = profile.vault.map(entry => assetsById.get(entry.id)!);
    let pending = pendingSourceProfiles.get(fetcher);
    if (!pending) { pending = new Map(); pendingSourceProfiles.set(fetcher, pending); }
    const key = canonicalPortableCardJson(profile);
    if (pending.get(profile.username) !== key) {
      const published = await options.publishSourceProfile(profile, gallery, options.signal);
      options.signal?.throwIfAborted();
      if (canonicalPortableCardJson(published) !== key) throw new Error("wildz_public_profile_publication_unconfirmed");
      pending.set(profile.username, key);
      if (pending.size > 32) pending.delete(pending.keys().next().value!);
      options.onProgress?.();
    }
    // An accepted append is not evidence that the public reader sees it yet.
    // Retry only the read while this exact successful write is awaiting delivery.
    const confirmed = await fetchPublicWildzProfile(profile.username, fetcher, { signal: options.signal });
    if (!confirmed || canonicalPortableCardJson(confirmed) !== key) throw new Error("wildz_public_profile_publication_unconfirmed");
    pending.delete(profile.username);
    return confirmed;
  }
  // The supplied publishable Vault is complete; profile.vault is a bounded gallery.
  // Never use that display limit as the standalone-card publication queue.
  const pendingCards = [...assetsById.values()];
  for (let offset = 0; offset < pendingCards.length; offset += 6) {
    // Independent exact-card publications share the registration cache. Bound
    // concurrency rather than adding every card's network latency in sequence.
    const results = await Promise.allSettled(pendingCards.slice(offset, offset + 6).map(async asset => {
      options.signal?.throwIfAborted();
      await registerPublicWildsCard(asset, fetcher, { proofObjects: options.proofObjects, signal: options.signal, prepareBody: options.prepareBody });
      options.onProgress?.();
    }));
    const failed = results.find(result => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
  options.signal?.throwIfAborted();
  const response = await fetcher(publicProfileEndpoint(profile.username), {
    method: "POST",
    credentials: "same-origin",
    signal: options.signal,
    headers: { "content-type": "application/json" },
    body: options.prepareBody ? await options.prepareBody(profile) : JSON.stringify(profile)
  });
  const value = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || value?.ok !== true || !isRecord(value.profile)) {
    if (["unauthorized", "receiz_authority_required", "receiz_identity_key_required"].includes(String(value?.error))) {
      const publish = options.publishWithIdentityProof ?? (typeof window !== "undefined"
        ? async (input: PublicWildzProfile, signal?: AbortSignal) => publishWildzProfileWithIdentityProof(input, {fetcher, signal})
        : undefined);
      if (publish) return publish(profile, options.signal);
    }
    throw new Error(typeof value?.error === "string" ? value.error : "wildz_public_profile_publication_failed");
  }
  return sanitizePublicWildzProfile(value.profile);
}
