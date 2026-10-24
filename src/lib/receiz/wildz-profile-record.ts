import {parseWildzPublishedOwnershipClaims} from "./wildz-published-ownership-record";
import { verifyAnyWildsCard, rememberAdmittedWildsCardVerification, type PortableCardAsset } from "../../features/play/portable-card";
import { canonicalWildzHandle, canonicalWildzProfilePath, sanitizePublicWildzProfile, type PublicWildzProfile } from "../../features/profile/public-profile";
import { WILDZ_PRODUCT } from "../wildz/product";
import { parseWildzProfileVaultPacket, readWildzProfileVaultPacket, type WildzProfileVaultPacket } from "../../features/profile/profile-vault-packet";

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
  vaultPacket?: WildzProfileVaultPacket;
  vaultDeliveryVersion?: 1;
  ownershipClaims?: readonly unknown[];
  ownershipHistory?: readonly unknown[];
  publisherKeyId?: string;
  vaultCardRoots?: Readonly<Record<string,string>>;
};

/** Reuse an identical admitted delivery, never an id or claimed digest alone. */
const packets = new Map<string, { bytes: number; cards: readonly PortableCardAsset[] }>();
let packetBytes = 0;
export function publicWildzProfileCards(record: PublicWildzProfileRecord): readonly PortableCardAsset[] {
  if (!record.vaultPacket) return record.vaultCards ?? [];
  const packet = parseWildzProfileVaultPacket(record.vaultPacket), held = packets.get(packet.data);
  if (held?.bytes === packet.bytes) {
    const byId = new Map(held.cards.map(card => [card.id, card]));
    if (held.cards.length !== record.profile.vault.length || record.profile.vault.some(card => byId.get(card.id)?.proof.digest !== card.proofDigest)) throw new Error("wildz_public_profile_card_unverified");
    packets.delete(packet.data); packets.set(packet.data, held);
    return record.profile.vault.map(card => byId.get(card.id)!);
  }
  const cards = verifiedWildzProfileCards(record.profile, readWildzProfileVaultPacket(packet));
  // These freshly decoded public objects are display-only. Keep the cache's
  // verified bytes immutable so subsequent source reads cannot mutate them.
  const freeze = (value: unknown): void => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(cards);
  cards.forEach(rememberAdmittedWildsCardVerification);
  while (packets.size && (packets.size >= 8 || packetBytes + packet.bytes > 32 * 1024 * 1024)) {
    const oldest = packets.keys().next().value!; packetBytes -= packets.get(oldest)!.bytes; packets.delete(oldest);
  }
  packets.set(packet.data, { bytes: packet.bytes, cards }); packetBytes += packet.bytes;
  return cards;
}

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
        if (candidate.publisherKeyId !== undefined) {
          if (typeof candidate.publisherKeyId !== "string" || !/^[a-f0-9]{64}$/.test(candidate.publisherKeyId)) throw Error("wildz_public_ownership_claim_invalid");
          record.publisherKeyId = candidate.publisherKeyId;
        }
        if (candidate.vaultCardRoots !== undefined) {
          if (!isRecord(candidate.vaultCardRoots) || Object.keys(candidate.vaultCardRoots).some(id => !record.profile.vault.some(card => card.id === id)
            || typeof candidate.vaultCardRoots !== "object" || !/^sha256:[a-f0-9]{64}$/.test(String((candidate.vaultCardRoots as Record<string,unknown>)[id])))) throw Error("wildz_public_ownership_claim_invalid");
          record.vaultCardRoots = candidate.vaultCardRoots as Record<string,string>;
        }
        if (candidate.ownershipHistory !== undefined) {
          if (!Array.isArray(candidate.ownershipHistory)) throw Error("wildz_public_ownership_claim_invalid");
          const ids = candidate.ownershipHistory.flatMap(row => isRecord(row) && isRecord(row.claim) && typeof row.claim.assetId === "string" ? [row.claim.assetId] : []);
          record.ownershipHistory = parseWildzPublishedOwnershipClaims(candidate.ownershipHistory, record.handle, ids);
        }
        if (candidate.ownershipClaims !== undefined) record.ownershipClaims = parseWildzPublishedOwnershipClaims(candidate.ownershipClaims, record.handle, record.profile.vault.map(card => card.id));
        if (candidate.vaultCards !== undefined) record.vaultCards = verifiedWildzProfileCards(record.profile, candidate.vaultCards);
        if (candidate.vaultPacket !== undefined) {
          record.vaultPacket = parseWildzProfileVaultPacket(candidate.vaultPacket);
          publicWildzProfileCards(record);
        }
        if (candidate.vaultDeliveryVersion !== undefined) {
          if (candidate.vaultDeliveryVersion !== 1) throw new Error("wildz_public_profile_card_packet_invalid");
          record.vaultDeliveryVersion = 1;
        }
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

