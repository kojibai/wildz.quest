import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { marketIdempotencyKey } from "@/lib/receiz/wildz-market-route";
import { createResourcePackageMarketRepository, resourcePackageMarketHead } from "@/lib/receiz/resource-package-market-repository";
import { resourcePackageMarketRouteError, parseResourcePackageMarketCommand, publicResourcePackageMarketAdmission } from "@/lib/receiz/resource-package-market-route";
import { releaseResourcePackageMarketTrade, reserveResourcePackageMarketTrade } from "@/lib/receiz/resource-package-market";
import { createResourcePackageMarketCustody } from "@/lib/receiz/wilds-resource-package-server";
import { serializeResourcePackageMarketMutation } from "@/lib/receiz/resource-package-market-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "private, no-store" } });
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    if (!actor.accessToken) throw new Error("receiz_authority_required");
    const body = parseResourcePackageMarketCommand(await request.json(), "listingId"), idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const admission = await serializeResourcePackageMarketMutation(() => reserveResourcePackageMarketTrade(createResourcePackageMarketRepository(adapter), createResourcePackageMarketCustody(request), { listingId: body.id, expectedRevision: body.expectedRevision, expectedAppendAnchorId: body.expectedAppendAnchorId, idempotencyKey }, actor, new Date().toISOString()));
    const response = publicResourcePackageMarketAdmission(admission, idempotencyKey, "trade");
    return json(response.body, response.status);
  } catch (cause) { const failure = resourcePackageMarketRouteError(cause, "package_market_reservation_invalid"); return json(failure.body, failure.status); }
}
export async function DELETE(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    if (!actor.accessToken) throw new Error("receiz_authority_required");
    const body = parseResourcePackageMarketCommand(await request.json(), "tradeId"), idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const admission = await serializeResourcePackageMarketMutation(() => releaseResourcePackageMarketTrade(createResourcePackageMarketRepository(adapter), createResourcePackageMarketCustody(request), { tradeId: body.id, expectedRevision: body.expectedRevision, expectedAppendAnchorId: body.expectedAppendAnchorId, idempotencyKey }, actor, new Date().toISOString()));
    if (admission.status === "market_capability_unavailable") return json({ status: admission.status }, 503);
    if (admission.status === "market_revision_conflict") return json(admission, 409);
    if (admission.status === "recovery_pending") return json(admission, 202);
    return json({ status: admission.status, head: resourcePackageMarketHead(admission.state), ownershipTransferred: false });
  } catch (cause) { const failure = resourcePackageMarketRouteError(cause, "package_market_release_invalid"); return json(failure.body, failure.status); }
}
