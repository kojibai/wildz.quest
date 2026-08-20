import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import {
  wildzVaultAdmissionCarriesProofObject,
  type WildzAdmittedVaultProofObjects
} from "../../lib/receiz/wildz-vault-card-admission";

export type PublicCardParam = {
  assetId: string;
  source: "canonical" | "compact";
};

export type PublicWildsCardRecord = {
  schema: "receiz.wilds_public_card.v1";
  assetId: string;
  sourceUrl: string;
  registeredAt: string;
  asset: PortableCardAsset;
};

export type PublicWildsCardRegistrationOptions = {
  proofObjects?: WildzAdmittedVaultProofObjects;
};

export type PublicWildsCardTransportRecord = {
  schema: "receiz.wilds_public_card_transport.v1";
  assetId: string;
  sourceUrl: string;
  recordJson: string;
};

type CommittedPublicRestore = {
  restoreStatus: "committed";
  verifiedAssetIds: readonly string[];
  ownerState?: { playState: { inventory: readonly PortableCardAsset[] } };
  playState?: { inventory: readonly PortableCardAsset[] };
};

type PublicCardRegistrationState = {
  admitted: Map<string, PublicWildsCardRecord>;
  inFlight: Map<string, Promise<PublicWildsCardRecord>>;
};

const publicCardRegistrationStates = new WeakMap<typeof fetch, PublicCardRegistrationState>();

function publicCardRegistrationState(fetcher: typeof fetch) {
  let state = publicCardRegistrationStates.get(fetcher);
  if (!state) {
    state = { admitted: new Map(), inFlight: new Map() };
    publicCardRegistrationStates.set(fetcher, state);
  }
  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function admittedIso(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new Error("wildz_public_card_time_invalid");
  }
  return value;
}

export function parsePublicCardParam(value: string): PublicCardParam {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value).trim().toLowerCase();
  } catch {
    throw new Error("wildz_public_card_id_invalid");
  }
  if (/^wilds:[a-f0-9]{24}$/.test(decoded)) return { assetId: decoded, source: "canonical" };
  if (/^[a-f0-9]{24}$/.test(decoded)) return { assetId: `wilds:${decoded}`, source: "compact" };
  throw new Error("wildz_public_card_id_invalid");
}

export function canonicalPublicCardPath(assetId: string) {
  return `/cards/${encodeURIComponent(parsePublicCardParam(assetId).assetId)}`;
}

export function publicWildsCardRecoverySourceUrls(assetId: string, requestOrigin: string, platformDomain: string) {
  const parsed = parsePublicCardParam(assetId);
  const compactPath = `/c/${parsed.assetId.slice("wilds:".length)}`;
  const canonicalPath = canonicalPublicCardPath(parsed.assetId);
  const platformOrigin = new URL(/^https?:\/\//i.test(platformDomain) ? platformDomain : `https://${platformDomain}`).origin;
  const origins = [...new Set([new URL(requestOrigin).origin, platformOrigin])];
  return origins.flatMap((origin) => [`${origin}${canonicalPath}`, `${origin}${compactPath}`]);
}

export function createPublicWildsCardRecord(
  asset: PortableCardAsset,
  sourceOrigin: string,
  registeredAt: string
): PublicWildsCardRecord {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wildz_public_card_verification_failed");
  const origin = new URL(sourceOrigin).origin;
  return {
    schema: "receiz.wilds_public_card.v1",
    assetId: asset.id,
    sourceUrl: `${origin}${canonicalPublicCardPath(asset.id)}`,
    registeredAt: admittedIso(registeredAt),
    asset: structuredClone(asset)
  };
}

export function createPublicWildsCardTransportRecord(record: PublicWildsCardRecord): PublicWildsCardTransportRecord {
  const verified = parsePublicWildsCardRecord(record);
  if (!verified) throw new Error("wildz_public_card_verification_failed");
  return {
    schema: "receiz.wilds_public_card_transport.v1",
    assetId: verified.assetId,
    sourceUrl: verified.sourceUrl,
    recordJson: JSON.stringify(verified)
  };
}

export function parsePublicWildsCardRecord(value: unknown): PublicWildsCardRecord | null {
  const seen = new Set<object>();
  const parse = (candidate: unknown): PublicWildsCardRecord | null => {
    if (!isRecord(candidate) || seen.has(candidate)) return null;
    seen.add(candidate);
    if (candidate.schema === "receiz.wilds_public_card_transport.v1"
      && typeof candidate.assetId === "string"
      && typeof candidate.sourceUrl === "string"
      && typeof candidate.recordJson === "string") {
      try {
        const restored = parse(JSON.parse(candidate.recordJson));
        return restored?.assetId === candidate.assetId && restored.sourceUrl === candidate.sourceUrl
          ? restored
          : null;
      } catch {
        return null;
      }
    }
    if (candidate.schema === "receiz.wilds_public_card.v1"
      && typeof candidate.assetId === "string"
      && typeof candidate.sourceUrl === "string"
      && typeof candidate.registeredAt === "string"
      && isRecord(candidate.asset)) {
      try {
        const asset = candidate.asset as PortableCardAsset;
        const record = createPublicWildsCardRecord(asset, candidate.sourceUrl, candidate.registeredAt);
        return record.assetId === candidate.assetId && record.sourceUrl === new URL(candidate.sourceUrl).toString()
          ? record
          : null;
      } catch {
        return null;
      }
    }
    for (const key of [
      "state",
      "data",
      "record",
      "appState",
      "result",
      "storeStateRecord",
      "appProjectionRecord",
      "appProjectionData"
    ]) {
      const parsed = parse(candidate[key]);
      if (parsed) return parsed;
    }
    return null;
  };
  return parse(value);
}

export async function registerPublicWildsCard(
  asset: PortableCardAsset,
  fetcher: typeof fetch = globalThis.fetch,
  options: PublicWildsCardRegistrationOptions = {}
) {
  const pin = `${asset.id}:${asset.proof.digest}`;
  const state = publicCardRegistrationState(fetcher);
  const admitted = state.admitted.get(pin);
  if (admitted) return admitted;
  const existing = state.inFlight.get(pin);
  if (existing) return existing;

  const registration = registerPublicWildsCardRevision(asset, fetcher, options);
  state.inFlight.set(pin, registration);
  try {
    const record = await registration;
    state.admitted.set(pin, record);
    return record;
  } finally {
    if (state.inFlight.get(pin) === registration) state.inFlight.delete(pin);
  }
}

async function registerPublicWildsCardRevision(
  asset: PortableCardAsset,
  fetcher: typeof fetch,
  options: PublicWildsCardRegistrationOptions
) {
  const needsClientVerification = publicCardNeedsClientVerification(asset, options.proofObjects);
  if (needsClientVerification
    && !verifyAnyWildsCard(asset).ok) throw new Error("wildz_public_card_verification_failed");
  const response = await fetcher(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset })
  });
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    record?: PublicWildsCardRecord;
    error?: string;
  } | null;
  const record = needsClientVerification
    ? parsePublicWildsCardRecord(payload?.record)
    : publicationRecordForAdmittedProofObject(payload?.record, asset);
  if (!response.ok
    || payload?.ok !== true
    || record?.assetId !== asset.id
    || record.asset.proof.digest !== asset.proof.digest) {
    throw new Error(payload?.error ?? "wildz_public_card_registration_failed");
  }
  return record;
}

function publicationRecordForAdmittedProofObject(
  value: unknown,
  asset: PortableCardAsset
): PublicWildsCardRecord | null {
  if (!isRecord(value)
    || value.schema !== "receiz.wilds_public_card.v1"
    || value.assetId !== asset.id
    || typeof value.sourceUrl !== "string"
    || typeof value.registeredAt !== "string") return null;
  try {
    const sourceUrl = new URL(value.sourceUrl).toString();
    const expectedSourceUrl = `${new URL(sourceUrl).origin}${canonicalPublicCardPath(asset.id)}`;
    if (sourceUrl !== expectedSourceUrl) return null;
    return {
      schema: "receiz.wilds_public_card.v1",
      assetId: asset.id,
      sourceUrl,
      registeredAt: admittedIso(value.registeredAt),
      asset
    };
  } catch {
    return null;
  }
}

export function publicCardNeedsClientVerification(
  asset: PortableCardAsset,
  proofObjects: unknown
) {
  return !wildzVaultAdmissionCarriesProofObject(proofObjects, asset);
}

/**
 * Publication is not enough for an exported QR: prove that the public GET works
 * without the owner's cookies and returns this exact verified proof revision.
 */
export async function requireGloballyAvailablePublicWildsCard(
  asset: PortableCardAsset,
  fetcher: typeof fetch = globalThis.fetch
) {
  await registerPublicWildsCard(asset, fetcher);
  const response = await fetcher(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    headers: { accept: "application/json", "cache-control": "no-cache" }
  });
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    record?: PublicWildsCardRecord;
  } | null;
  const record = parsePublicWildsCardRecord(payload?.record);
  if (!response.ok
    || payload?.ok !== true
    || record?.assetId !== asset.id
    || record.asset.proof.digest !== asset.proof.digest) {
    throw new Error("wildz_public_card_anonymous_read_required");
  }
  return record;
}

export async function attemptPublicWildsCardRegistration(
  asset: PortableCardAsset,
  options: PublicWildsCardRegistrationOptions = {}
): Promise<{ published: true; record: PublicWildsCardRecord } | { published: false; error: string }> {
  try {
    return { published: true, record: await registerPublicWildsCard(asset, globalThis.fetch, options) };
  } catch (error) {
    return {
      published: false,
      error: error instanceof Error ? error.message : "wildz_public_card_registration_failed"
    };
  }
}

export async function registerVerifiedRestoredWildsCards(input: CommittedPublicRestore) {
  if (input.restoreStatus !== "committed") throw new Error("wildz_publication_restore_incomplete");
  const inventory = input.ownerState?.playState.inventory ?? input.playState?.inventory;
  if (!inventory) throw new Error("wildz_publication_inventory_incomplete");
  const expectedIds = [...new Set(input.verifiedAssetIds)].sort();
  if (expectedIds.length !== input.verifiedAssetIds.length) throw new Error("wildz_publication_inventory_incomplete");
  const verifiedById = new Map<string, PortableCardAsset>();
  for (const asset of inventory) {
    if (verifyAnyWildsCard(asset).ok) verifiedById.set(asset.id, asset);
  }
  const assets = expectedIds.map((assetId) => verifiedById.get(assetId));
  if (assets.some((asset) => !asset)) throw new Error("wildz_publication_inventory_incomplete");
  const published: PublicWildsCardRecord[] = [];
  for (const asset of assets) published.push(await registerPublicWildsCard(asset!));
  return published;
}
