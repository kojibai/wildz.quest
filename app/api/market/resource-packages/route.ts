import { NextRequest, NextResponse } from "next/server";
import { publicResourcePackageListing, resourcePackageListingAvailable } from "@/features/market/resource-package-market";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { marketIdempotencyKey } from "@/lib/receiz/wildz-market-route";
import { createResourcePackageMarketRepository, resourcePackageMarketHead } from "@/lib/receiz/resource-package-market-repository";
import { resourcePackageMarketRouteError, parseResourcePackageMarketCommand, parseResourcePackageMarketListing, publicResourcePackageMarketAdmission } from "@/lib/receiz/resource-package-market-route";
import { cancelResourcePackageMarketListing, listResourcePackageForMarket } from "@/lib/receiz/resource-package-market";
import { createResourcePackageMarketCustody } from "@/lib/receiz/wilds-resource-package-server";
import { serializeResourcePackageMarketMutation } from "@/lib/receiz/resource-package-market-server";
import { requireWildsResourceCustodyRail } from "@/lib/receiz/wilds-resource-custody-capability";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { wildsResourceCustodySnapshot } from "@/lib/receiz/wilds-world-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "private, no-store" } });
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    // A signed ID may browse the public feed before wallet delegation arrives.
    // Application credentials stay confined to this read; mutations below still
    // require the same owner's live player token.
    const adapter = actor.accessToken
      ? createReceizCommerceAdapter({ accessToken: actor.accessToken })
      : createReceizCommerceAdapter();
    requireWildsResourceCustodyRail(adapter);
    const repository = createResourcePackageMarketRepository(adapter);
    const loaded = await repository.load();
    if (loaded.status !== "ready") return json({ status: loaded.status, listings: [] }, 503);
    const observedAt = new Date().toISOString(), head = resourcePackageMarketHead(loaded.state);
    const buyerTrades = Object.values(loaded.state.trades).filter(trade => trade.buyerActorId === actor.actorId && trade.buyerReceizUserId === actor.receizUserId && trade.status !== "settled");
    const pendingReleaseIds = new Set<string>();
    if (buyerTrades.some(trade => trade.status === "released")) {
      const source = (await wildsResourceCustodySnapshot(request, await resolveWildsMultiplayerActor(request))).projection;
      for (const trade of buyerTrades) {
        const record = source.resourcePackages?.[trade.packageId];
        if (trade.status === "released" && record?.status === "reserved" && record.listingId === trade.listingId && record.tradeId === trade.id) pendingReleaseIds.add(trade.id);
      }
    }
    return json({ status: "ready", listings: Object.values(loaded.state.listings).filter(listing => resourcePackageListingAvailable(loaded.state, listing, observedAt)).slice(0, 60).map(publicResourcePackageListing), pendingPurchases: buyerTrades.filter(trade => trade.status !== "released" || pendingReleaseIds.has(trade.id)).map(trade => ({ tradeId: trade.id, status: trade.status, expiresAt: trade.expiresAt, head })), head });
  } catch (cause) { const failure = resourcePackageMarketRouteError(cause, "package_market_unavailable"); return json(failure.body, failure.status); }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    if (!actor.accessToken) throw new Error("receiz_authority_required");
    const body = parseResourcePackageMarketListing(await request.json()), idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createResourcePackageMarketRepository(adapter), custody = createResourcePackageMarketCustody(request);
    const admission = await serializeResourcePackageMarketMutation(() => listResourcePackageForMarket(repository, custody, { ...body, idempotencyKey }, actor, new Date().toISOString()));
    const response = publicResourcePackageMarketAdmission(admission, idempotencyKey, "listing");
    return json(response.body, response.status);
  } catch (cause) { const failure = resourcePackageMarketRouteError(cause, "package_market_listing_invalid"); return json(failure.body, failure.status); }
}
export async function DELETE(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    if (!actor.accessToken) throw new Error("receiz_authority_required");
    const body = parseResourcePackageMarketCommand(await request.json(), "listingId"), idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const admission = await serializeResourcePackageMarketMutation(() => cancelResourcePackageMarketListing(createResourcePackageMarketRepository(adapter), createResourcePackageMarketCustody(request), { listingId: body.id, expectedRevision: body.expectedRevision, expectedAppendAnchorId: body.expectedAppendAnchorId, idempotencyKey }, actor, new Date().toISOString()));
    if (admission.status === "market_capability_unavailable") return json({ status: admission.status }, 503);
    if (admission.status === "market_revision_conflict") return json(admission, 409);
    if (admission.status === "recovery_pending") return json(admission, 202);
    return json({ status: admission.status, head: resourcePackageMarketHead(admission.state), ownershipTransferred: false });
  } catch (cause) { const failure = resourcePackageMarketRouteError(cause, "package_market_cancel_invalid"); return json(failure.body, failure.status); }
}
