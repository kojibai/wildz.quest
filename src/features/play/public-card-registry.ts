import { canonicalPublicCardPath, createPublicWildsCardRecord, createPublicWildsCardTransportRecord, parsePublicWildsCardRecord, type PublicWildsCardRecord } from "./public-card-record";
export { parsePublicCardParam, canonicalPublicCardPath, publicWildsCardRecoverySourceUrls, createPublicWildsCardRecord, createPublicWildsCardTransportRecord, parsePublicWildsCardRecord } from "./public-card-record";
export type { PublicCardParam, PublicWildsCardRecord, PublicWildsCardTransportRecord } from "./public-card-record";
import { publishWildzCardWithIdentityProof } from "../../lib/receiz/wildz-card-identity-publication";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import {
  wildzVaultAdmissionCarriesProofObject,
  type WildzAdmittedVaultProofObjects
} from "../../lib/receiz/wildz-vault-card-admission";

export type PublicWildsCardRegistrationOptions = {
  signal?: AbortSignal;
  profileHandle?: string;
  prepareBody?: (value: unknown) => Promise<string>;
  proofObjects?: WildzAdmittedVaultProofObjects;
  publishWithIdentityProof?: (asset: PortableCardAsset, signal?: AbortSignal) => Promise<PublicWildsCardRecord>;
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

function waitForPublicCardRegistration<T>(
  registration: Promise<T>,
  signal?: AbortSignal
) {
  if (!signal) return registration;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    void registration.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function registerPublicWildsCard(
  asset: PortableCardAsset,
  fetcher: typeof fetch = globalThis.fetch,
  options: PublicWildsCardRegistrationOptions = {}
) {
  options.signal?.throwIfAborted();
  const pin = `${asset.id}:${asset.proof.digest}`;
  const state = publicCardRegistrationState(fetcher);
  const admitted = state.admitted.get(pin);
  if (admitted) return admitted;
  const existing = state.inFlight.get(pin);
  if (existing) return waitForPublicCardRegistration(existing, options.signal);

  // A secondary caller only cancels its own wait. The owning request's deadline,
  // however, must release the shared slot even if body preparation ignores abort.
  const registration = waitForPublicCardRegistration(
    registerPublicWildsCardRevision(asset, fetcher, options), options.signal
  ).then(record => {
    state.admitted.set(pin, record);
    return record;
  }).finally(() => {
    if (state.inFlight.get(pin) === registration) state.inFlight.delete(pin);
  });
  state.inFlight.set(pin, registration);
  return waitForPublicCardRegistration(registration, options.signal);
}

async function registerPublicWildsCardRevision(
  asset: PortableCardAsset,
  fetcher: typeof fetch,
  options: PublicWildsCardRegistrationOptions
) {
  if (options.publishWithIdentityProof) {
    const record = parsePublicWildsCardRecord(await options.publishWithIdentityProof(asset, options.signal));
    if (!record || record.assetId !== asset.id || record.asset.proof.digest !== asset.proof.digest) throw new Error("wildz_public_card_publication_unconfirmed");
    return record;
  }
  const needsClientVerification = publicCardNeedsClientVerification(asset, options.proofObjects);
  if (needsClientVerification
    && !verifyAnyWildsCard(asset).ok) throw new Error("wildz_public_card_verification_failed");
  const body = options.prepareBody ? await options.prepareBody({ asset }) : JSON.stringify({ asset });
  // A retired serializer must never start an upload after a fresh retry takes over.
  options.signal?.throwIfAborted();
  const response = await fetcher(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    signal: options.signal,
    body
  });
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    record?: PublicWildsCardRecord;
    error?: string;
  } | null;
  if (!response.ok && (response.status === 413 || payload?.error === "unauthorized" || payload?.error === "receiz_authority_required")) {
    options.signal?.throwIfAborted();
    const publishSigned = options.publishWithIdentityProof ?? (typeof window !== "undefined"
      ? async (card: PortableCardAsset, signal?: AbortSignal) => publishWildzCardWithIdentityProof(card, { fetcher, signal })
      : null);
    if (publishSigned) {
      const signedRecord = parsePublicWildsCardRecord(await publishSigned(asset, options.signal));
      if (signedRecord?.assetId !== asset.id || signedRecord.asset.proof.digest !== asset.proof.digest) {
        throw new Error("wildz_public_card_registration_failed");
      }
      return signedRecord;
    }
  }
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
  fetcher: typeof fetch = globalThis.fetch,
  options: PublicWildsCardRegistrationOptions = {}
) {
  const readPublicRevision = async () => {
    options.signal?.throwIfAborted();
    const response = await fetcher(`/api/cards/${encodeURIComponent(asset.id)}${options.profileHandle ? `?profile=${encodeURIComponent(options.profileHandle)}` : ""}`, {
      method: "GET", signal: options.signal, credentials: "omit", cache: "no-store",
      headers: { accept: "application/json", "cache-control": "no-cache" }
    });
    const payload = await response.json().catch(() => null) as { ok?: boolean; record?: PublicWildsCardRecord } | null;
    const record = parsePublicWildsCardRecord(payload?.record,
      publicCardNeedsClientVerification(asset, options.proofObjects) ? undefined : asset);
    return response.ok && payload?.ok === true && record?.assetId === asset.id
      && record.asset.proof.digest === asset.proof.digest ? record : null;
  };
  // A card already live at this exact revision needs no publication credentials or upload.
  const existing = await waitForPublicCardRegistration(readPublicRevision(), options.signal);
  if (existing) return existing;
  // An old upload acknowledgment cannot override the anonymous read we just
  // performed. Otherwise every profile retry reuses that cached acknowledgment
  // and never republishes a revision that is missing from the public projection.
  publicCardRegistrationState(fetcher).admitted.delete(`${asset.id}:${asset.proof.digest}`);
  await registerPublicWildsCard(asset, fetcher, options);
  const record = await waitForPublicCardRegistration(readPublicRevision(), options.signal);
  if (!record) throw new Error("wildz_public_card_anonymous_read_required");
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
