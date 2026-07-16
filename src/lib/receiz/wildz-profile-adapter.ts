import {
  canonicalWildzHandle,
  canonicalWildzProfilePath,
  sanitizePublicWildzProfile,
  type PublicWildzProfile
} from "@/features/profile/public-profile";
import { registerPublicWildsCard } from "@/features/play/public-card-registry";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { createReceizCommerceAdapter } from "./adapter";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import type { WildzPublicProjectionRepository } from "./wildz-public-repository";
import { advanceWildzPublicState } from "./wildz-public-state";

export const WILDZ_PUBLIC_PROFILE_SCHEMA = "receiz.wilds_public_profile.v1" as const;

export type PublicWildzProfileRecord = {
  schema: typeof WILDZ_PUBLIC_PROFILE_SCHEMA;
  handle: string;
  sourceUrl: string;
  publishedAt: string;
  profile: PublicWildzProfile;
};

export type WildzPublicProfileAdapterPort = {
  publishPublicStore(input: Record<string, unknown>, options?: { idempotencyKey?: string }): Promise<unknown>;
  readAppStateByUrl(url: string): Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function admittedIso(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("wildz_public_profile_time_invalid");
  }
  return value;
}

function canonicalProfileSourceUrl(sourceUrl: string, handle: string) {
  const url = new URL(sourceUrl);
  if (!/^https?:$/.test(url.protocol) || url.pathname !== canonicalWildzProfilePath(handle)) {
    throw new Error("wildz_public_profile_url_invalid");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function publicationSucceeded(value: unknown) {
  if (!isRecord(value) || value.ok === false) return false;
  return value.ok === true
    || typeof value.appendAnchorId === "string"
    || isRecord(value.knownHead)
    || (typeof value.accepted === "number" && value.accepted > 0);
}

export function createPublicWildzProfileRecord(
  input: Record<string, unknown>,
  sourceUrl: string,
  publishedAt = new Date().toISOString()
): PublicWildzProfileRecord {
  const profile = sanitizePublicWildzProfile(input);
  const handle = canonicalWildzHandle(profile.username);
  return {
    schema: WILDZ_PUBLIC_PROFILE_SCHEMA,
    handle,
    sourceUrl: canonicalProfileSourceUrl(sourceUrl, handle),
    publishedAt: admittedIso(publishedAt),
    profile
  };
}

export function publicWildzProfileRecoverySourceUrls(
  username: string,
  requestOrigin: string,
  platformDomain: string = WILDZ_PRODUCT.domain
) {
  const path = canonicalWildzProfilePath(username);
  const platformOrigin = new URL(/^https?:\/\//i.test(platformDomain) ? platformDomain : `https://${platformDomain}`).origin;
  const origins = [...new Set([new URL(requestOrigin).origin, platformOrigin])];
  return origins.map((origin) => `${origin}${path}`);
}

export function parsePublicWildzProfileRecord(value: unknown): PublicWildzProfileRecord | null {
  const visited = new Set<object>();
  const parse = (candidate: unknown): PublicWildzProfileRecord | null => {
    if (!isRecord(candidate) || visited.has(candidate)) return null;
    visited.add(candidate);
    if (candidate.schema === WILDZ_PUBLIC_PROFILE_SCHEMA && isRecord(candidate.profile)) {
      try {
        const handle = canonicalWildzHandle(String(candidate.handle ?? ""));
        const record = createPublicWildzProfileRecord(
          candidate.profile,
          String(candidate.sourceUrl ?? ""),
          String(candidate.publishedAt ?? "")
        );
        return record.handle === handle ? record : null;
      } catch {
        return null;
      }
    }
    for (const key of ["state", "data", "record", "appState", "result", "storeStateRecord"]) {
      const nested = parse(candidate[key]);
      if (nested) return nested;
    }
    return null;
  };
  return parse(value);
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
    schema: WILDZ_PUBLIC_PROFILE_SCHEMA,
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

export async function fetchPublicWildzProfile(username: string, fetcher: typeof fetch = globalThis.fetch) {
  const handle = canonicalWildzHandle(username);
  const response = await fetcher(publicProfileEndpoint(handle), {
    cache: "no-cache",
    credentials: "omit",
    headers: { accept: "application/json" }
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
  suppliedFetcher: typeof fetch = globalThis.fetch
) {
  const assets = typeof assetsOrFetcher === "function" ? [] : assetsOrFetcher;
  const fetcher = typeof assetsOrFetcher === "function" ? assetsOrFetcher : suppliedFetcher;
  for (const requested of profile.vault) {
    const asset = assets.find((candidate) => candidate.id === requested.id);
    if (!asset || !verifyAnyWildsCard(asset).ok || asset.proof.digest !== requested.proofDigest) {
      throw new Error("wildz_public_profile_card_unverified");
    }
    await registerPublicWildsCard(asset, fetcher);
  }
  const response = await fetcher(publicProfileEndpoint(profile.username), {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(profile)
  });
  const value = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || value?.ok !== true || !isRecord(value.profile)) {
    throw new Error(typeof value?.error === "string" ? value.error : "wildz_public_profile_publication_failed");
  }
  return sanitizePublicWildzProfile(value.profile);
}
