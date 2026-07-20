import type { JsonObject, ReceizKeyFileV1 } from "@receiz/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  createPublicWildsCardRecord,
  createPublicWildsCardTransportRecord,
  parsePublicCardParam,
  type PublicWildsCardIdentityProof
} from "@/features/play/public-card-registry";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { resolvePublicWildsCardRecord } from "@/lib/receiz/wildz-public-card-resolver";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReceizKeyFile(value: unknown): value is ReceizKeyFileV1 {
  return isRecord(value) && value.schema === "receiz.key.v1" && value.name === "Receiz Key" && value.version === 1;
}

function requestOrigin(_request: NextRequest) {
  return WILDZ_PRODUCT.origin;
}

function publicationSucceeded(value: unknown) {
  return isRecord(value)
    && value.ok !== false
    && (value.ok === true || typeof value.appendAnchorId === "string" || isRecord(value.knownHead));
}

function publicCardError(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wildz_public_card_failed";
  if (error === "receiz_authority_required") {
    return NextResponse.json({ ok: false, error }, { status: 401 });
  }
  if (error === "receiz_profile_required" || error === "wildz_public_card_owner_mismatch") {
    return NextResponse.json({ ok: false, error }, { status: 403 });
  }
  if (error === "wildz_public_projection_conflict" || error === "wildz_public_revision_conflict") {
    return NextResponse.json({ ok: false, error }, { status: 409 });
  }
  if (error.includes("publish") || error.includes("unconfirmed") || error.includes("unavailable")) {
    return NextResponse.json({ ok: false, error }, { status: 503 });
  }
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId: rawAssetId } = await context.params;
    const { assetId } = parsePublicCardParam(rawAssetId);
    const body = await request.json().catch(() => null) as {
      asset?: PortableCardAsset;
      identityProof?: PublicWildsCardIdentityProof;
    } | null;
    if (!body?.asset || !isRecord(body.asset)) {
      throw new Error("wildz_public_card_request_invalid");
    }
    const asset = body.asset as PortableCardAsset;
    if (asset.id !== assetId || !verifyAnyWildsCard(asset).ok) {
      throw new Error("wildz_public_card_verification_failed");
    }

    const identityProof = body.identityProof;
    const identityKeyFile = isReceizKeyFile(identityProof?.keyFile)
      ? identityProof.keyFile
      : null;
    let accessToken: string | undefined;
    if (identityKeyFile) {
      if (!identityKeyFile.owner.username
        || !sameWildzPlayerCoordinate(asset.manifest.ownerReceizId, identityKeyFile.owner.username)) {
        throw new Error("wildz_public_card_owner_mismatch");
      }
    } else {
      const actor = await resolveWildzCookieActor(request);
      if (!sameWildzPlayerCoordinate(asset.manifest.ownerReceizId, actor.profileHandle)) {
        throw new Error("wildz_public_card_owner_mismatch");
      }
      accessToken = actor.accessToken;
    }
    const adapter = createReceizCommerceAdapter(accessToken ? { accessToken } : undefined);
    const occurredAt = new Date().toISOString();
    const record = createPublicWildsCardRecord(asset, requestOrigin(request), occurredAt);
    const transportRecord = createPublicWildsCardTransportRecord(record);
    const ownerCoordinate = parseWildzPlayerCoordinate(record.asset.manifest.ownerReceizId);
    if (!ownerCoordinate) throw new Error("wildz_public_card_owner_mismatch");
    const base = {
      tenantHost: WILDZ_PRODUCT.domain,
      merchantReceizId: ownerCoordinate.profileHandle,
      title: `${asset.manifest.name} living card`,
      sourceUrl: record.sourceUrl,
      namespace: `wildz-card:${record.assetId}`,
      projectionState: "published",
      platform: WILDZ_PRODUCT.name
    } as const;
    const publishOptions = { idempotencyKey: `wildz-card:${asset.id}:${asset.proof.digest}` };
    const result = identityKeyFile
      ? await adapter.publishPublicStoreWithIdentityProof({
        ...base,
        storeStateRecord: transportRecord as unknown as JsonObject,
        keyFile: identityKeyFile,
        ...(identityProof?.passphrase !== undefined ? { passphrase: identityProof.passphrase } : {})
      }, publishOptions)
      : await adapter.publishPublicStore({ ...base, state: transportRecord as unknown as JsonObject }, publishOptions);
    if (!publicationSucceeded(result)) {
      throw new Error(isRecord(result) && typeof result.error === "string"
        ? result.error
        : "wildz_public_card_publication_failed");
    }
    return NextResponse.json({ ok: true, record }, {
      status: 201,
      headers: { "cache-control": "no-store" }
    });
  } catch (cause) {
    return publicCardError(cause);
  }
}
export async function GET(request: NextRequest, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId: rawAssetId } = await context.params;
    const { assetId } = parsePublicCardParam(rawAssetId);
    const record = await resolvePublicWildsCardRecord(assetId, requestOrigin(request));
    if (!record) {
      return NextResponse.json({ ok: false, error: "wildz_public_card_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, record }, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" }
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_public_card_recovery_failed";
    const status = error === "wildz_public_card_id_invalid" ? 400 : 503;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
