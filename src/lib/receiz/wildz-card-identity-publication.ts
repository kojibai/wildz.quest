import { createReceizClient, type JsonObject } from "@receiz/sdk";
import { createPublicWildsCardRecord, createPublicWildsCardTransportRecord, parsePublicWildsCardRecord } from "../../features/play/public-card-registry";
import type { PortableCardAsset } from "../../features/play/portable-card";
import { WILDZ_PRODUCT } from "../wildz/product";
import type { WildzIdentityRepository } from "./wildz-identity-repository";
import { sameWildzPlayerCoordinate, parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

/** Sign the public projection locally; the private Identity Seal never leaves its repository. */
export async function publishWildzCardWithIdentityProof(
  asset: PortableCardAsset,
  options: {
    repository?: Pick<WildzIdentityRepository, "active" | "withKeyFile">;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
    occurredAt?: string;
  } = {}
) {
  options.signal?.throwIfAborted();
  const repository = options.repository ?? (await import("./wildz-identity-adapter")).defaultIdentityRepository;
  const session = await repository.active();
  const owner = parseWildzPlayerCoordinate(asset.manifest.ownerReceizId);
  if (!session || session.localAuthority !== "verified") throw new Error("wildz_card_identity_seal_required");
  if (!owner || !sameWildzPlayerCoordinate(owner.actorId, session.actorId)) throw new Error("wildz_public_card_owner_mismatch");
  const record = createPublicWildsCardRecord(asset, WILDZ_PRODUCT.origin, options.occurredAt ?? new Date().toISOString());
  const transport = createPublicWildsCardTransportRecord(record);
  const request = options.fetcher ?? globalThis.fetch;
  const client = createReceizClient();
  await repository.withKeyFile(session.keyId, async keyFile => {
    if (keyFile.keyId !== session.keyId || !sameWildzPlayerCoordinate(keyFile.owner.username ?? "", owner.actorId)) {
      throw new Error("wildz_public_card_owner_mismatch");
    }
    // Background work never prompts for or transmits an encrypted seal's password.
    if (!keyFile.crypto.privateKeyPkcs8B64u && keyFile.crypto.privateKeyPkcs8CiphertextB64u.length) {
      throw new Error("wildz_card_identity_unlock_required");
    }
    options.signal?.throwIfAborted();
    const signedPublication = await client.publicStore.signPublish({
      tenantHost: WILDZ_PRODUCT.domain,
      merchantReceizId: owner.profileHandle,
      title: `${asset.manifest.name} living card`,
      sourceUrl: record.sourceUrl,
      namespace: `wildz-card:${asset.id}`,
      projectionState: "published",
      platform: WILDZ_PRODUCT.name,
      storeStateRecord: transport as unknown as JsonObject,
      keyFile
    });
    options.signal?.throwIfAborted();
    // Same-origin relay avoids the registry's CORS restriction on Idempotency-Key.
    const response = await request(`/api/cards/${encodeURIComponent(asset.id)}`, {
      method: "POST", credentials: "same-origin", signal: options.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ asset, signedPublication })
    });
    const result = await response.json().catch(() => null) as {ok?:boolean; error?:string; record?:unknown} | null;
    if (!response.ok || result?.ok !== true) throw new Error(result?.error ?? "wildz_public_card_publication_unconfirmed");
    const published = parsePublicWildsCardRecord(result.record);
    if (published?.assetId !== asset.id || published.asset.proof.digest !== asset.proof.digest || published.sourceUrl !== record.sourceUrl) {
      throw new Error("wildz_public_card_publication_unconfirmed");
    }
  });
  return record;
}
