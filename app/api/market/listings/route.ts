import { NextRequest, NextResponse } from "next/server";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import {
  admitWildzListing,
  cancelWildzListing
} from "@/lib/receiz/wildz-market-adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { resolveSdkPublicWildzCard } from "@/lib/receiz/wildz-market-public-card";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail
} from "@/lib/receiz/wildz-market-repository";
import { isWildzListingAvailableAt } from "@/lib/receiz/wildz-market-state";
import {
  assertExactMarketFields,
  marketIdempotencyKey,
  marketRouteError,
  parseWildzListingCommand,
  parseWildzListingRequest,
  publicMarketAdmission,
  publicWildzListing
} from "@/lib/receiz/wildz-market-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    const loaded = await repository.load();
    if (loaded.status !== "ready") {
      return json({ status: "market_capability_unavailable", listings: [], ownershipTransferred: false }, 503);
    }
    const observedAt = new Date().toISOString();
    const listings = Object.values(loaded.state.listings)
      .filter((listing) => isWildzListingAvailableAt(loaded.state, listing, observedAt))
      .slice(0, 60)
      .map((listing) => publicWildzListing(listing.status === "reserved"
        ? { ...listing, status: "active" }
        : listing));
    return json({
      status: "ready",
      listings,
      head: { revision: loaded.state.revision, appendAnchorId: loaded.state.appendAnchorId }
    });
  } catch (cause) {
    const failure = marketRouteError(cause, "market_listings_unavailable");
    return json(failure.body, failure.status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const rawBody = await request.json().catch(() => null);
    const exactBody = assertExactMarketFields(rawBody, ["asset", "priceCents", "expectedRevision", "expectedAppendAnchorId"]);
    const body = parseWildzListingRequest(exactBody);
    const idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const publicAsset = await resolveSdkPublicWildzCard(body.asset.id, {
      adapter,
      requestOrigin: new URL(request.url).origin
    });
    if (!publicAsset
      || publicAsset.proof.digest !== body.asset.proof.digest
      || canonicalPortableCardJson(publicAsset) !== canonicalPortableCardJson(body.asset)) {
      throw new Error("wildz_market_public_card_required");
    }
    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    const admission = await admitWildzListing(repository, {
      ...body,
      asset: publicAsset,
      idempotencyKey
    }, actor, { occurredAt: new Date().toISOString() });
    const response = publicMarketAdmission(admission, "listing", idempotencyKey);
    return json(response.body, response.status);
  } catch (cause) {
    const failure = marketRouteError(cause, "market_listing_invalid");
    return json(failure.body, failure.status);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const body = parseWildzListingCommand(await request.json().catch(() => null));
    const idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    const admission = await cancelWildzListing(repository, { ...body, idempotencyKey }, actor, {
      occurredAt: new Date().toISOString()
    });
    if (admission.status === "market_capability_unavailable") {
      return json({ status: admission.status, ownershipTransferred: false }, 503);
    }
    if (admission.status === "market_revision_conflict") {
      return json({ ...admission, ownershipTransferred: false }, 409);
    }
    const listing = admission.state.listings[body.listingId];
    if (!listing) throw new Error("market_listing_admission_missing");
    return json({
      status: admission.status,
      listing: publicWildzListing(listing),
      head: { revision: admission.state.revision, appendAnchorId: admission.state.appendAnchorId },
      ownershipTransferred: false
    });
  } catch (cause) {
    const failure = marketRouteError(cause, "market_listing_cancel_invalid");
    return json(failure.body, failure.status);
  }
}
