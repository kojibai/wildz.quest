import { verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { canonicalWildzHandle, canonicalWildzProfilePath, sanitizePublicWildzProfile, type PublicWildzProfile } from "../../features/profile/public-profile";
import { WILDZ_PRODUCT } from "../wildz/product";

export const WILDZ_PUBLIC_PROFILE_SCHEMA = "receiz.wilds_public_profile.v1" as const;
export type PublicWildzProfileRecord = {
  schema: typeof WILDZ_PUBLIC_PROFILE_SCHEMA;
  handle: string;
  sourceUrl: string;
  publishedAt: string;
  profile: PublicWildzProfile;
  /** Exact public card proofs carried by the player's signed collection projection.
   * This projection is not a native transfer or command authorization. */
  vaultCards?: readonly PortableCardAsset[];
};

export function verifiedWildzProfileCards(profile: PublicWildzProfile, value: unknown): PortableCardAsset[] {
  if (!Array.isArray(value) || value.length !== profile.vault.length) throw new Error("wildz_public_profile_card_unverified");
  const cards = new Map<string, PortableCardAsset>();
  for (const asset of value as PortableCardAsset[]) {
    if (!asset || !verifyAnyWildsCard(asset).ok || cards.has(asset.id)) throw new Error("wildz_public_profile_card_unverified");
    cards.set(asset.id, asset);
  }
  return profile.vault.map(entry => {
    const asset = cards.get(entry.id);
    if (!asset || asset.proof.digest !== entry.proofDigest) throw new Error("wildz_public_profile_card_unverified");
    return asset;
  });
}

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
        if (candidate.vaultCards !== undefined) record.vaultCards = verifiedWildzProfileCards(record.profile, candidate.vaultCards);
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

