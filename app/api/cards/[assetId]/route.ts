import { NextRequest, NextResponse } from "next/server";
import {
  createPublicWildsCardRecord,
  parsePublicCardParam
} from "@/features/play/public-card-registry";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { createReceizWildzPublicRepository } from "@/lib/receiz/wildz-public-repository";
import {
  loadVerifiedWildzPublicOwnershipAuthority,
  requireCurrentWildzPublicOwner
} from "@/lib/receiz/wildz-public-ownership";
import {
  advanceWildzPublicState,
  isCurrentWildzPublicCardRegistration
} from "@/lib/receiz/wildz-public-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requestOrigin(request: NextRequest) {
  const url = new URL(request.url);
  return url.hostname === "localhost" || url.hostname === "127.0.0.1"
    ? url.origin
    : WILDZ_PRODUCT.origin;
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
    const body = await request.json().catch(() => null);
    if (!isRecord(body) || Object.keys(body).length !== 1 || !isRecord(body.asset)) {
      throw new Error("wildz_public_card_request_invalid");
    }
    const asset = body.asset as PortableCardAsset;
    if (asset.id !== assetId || !verifyAnyWildsCard(asset).ok) {
      throw new Error("wildz_public_card_verification_failed");
    }

    const actor = await resolveWildzCookieActor(request);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const ownershipAuthority = await loadVerifiedWildzPublicOwnershipAuthority(adapter);
    const admittedOwnerId = requireCurrentWildzPublicOwner(
      ownershipAuthority,
      asset,
      actor.actorId,
      "wildz_public_card_owner_mismatch"
    );
    const repository = createReceizWildzPublicRepository({ adapter });
    const current = await repository.load();
    const occurredAt = new Date().toISOString();
    if (isCurrentWildzPublicCardRegistration(current.state, asset)) {
      const record = createPublicWildsCardRecord(asset, requestOrigin(request), current.state.updatedAt);
      return NextResponse.json({ ok: true, record }, {
        headers: { "cache-control": "no-store" }
      });
    }
    const next = advanceWildzPublicState(current.state, {
      type: "publish-card",
      actorId: actor.actorId,
      expectedRevision: current.state.revision,
      card: asset
    }, { occurredAt, admittedCardOwnerId: admittedOwnerId });
    await repository.publish(next, {
      expectedHead: current.head,
      idempotencyKey: `card:${asset.id}:${asset.proof.digest}`,
      merchantReceizId: actor.receizUserId
    });
    const record = createPublicWildsCardRecord(asset, requestOrigin(request), occurredAt);
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
    const repository = createReceizWildzPublicRepository({ adapter: createReceizCommerceAdapter() });
    const { state } = await repository.load();
    const asset = state.cards[assetId];
    if (!asset || !verifyAnyWildsCard(asset).ok) {
      return NextResponse.json({ ok: false, error: "wildz_public_card_not_found" }, { status: 404 });
    }
    const record = createPublicWildsCardRecord(asset, requestOrigin(request), state.updatedAt);
    return NextResponse.json({ ok: true, record }, {
      headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" }
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_public_card_recovery_failed";
    const status = error === "wildz_public_card_id_invalid" ? 400 : 503;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
