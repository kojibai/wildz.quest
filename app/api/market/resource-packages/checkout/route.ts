import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { createResourcePackageMarketRepository } from "@/lib/receiz/resource-package-market-repository";
import { resourcePackageMarketRouteError, parseResourcePackageMarketCommand } from "@/lib/receiz/resource-package-market-route";
import { purchaseResourcePackageMarketTrade } from "@/lib/receiz/resource-package-market";
import { createResourcePackageMarketCustody } from "@/lib/receiz/wilds-resource-package-server";
import { serializeResourcePackageMarketMutation } from "@/lib/receiz/resource-package-market-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    if (!actor.accessToken) throw new Error("receiz_authority_required");
    const body = parseResourcePackageMarketCommand(await request.json(), "tradeId");
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const result = await serializeResourcePackageMarketMutation(() => purchaseResourcePackageMarketTrade(createResourcePackageMarketRepository(adapter), adapter, createResourcePackageMarketCustody(request), { tradeId: body.id, expectedRevision: body.expectedRevision, expectedAppendAnchorId: body.expectedAppendAnchorId }, actor, new Date().toISOString()));
    const status = result.status === "settled" ? 200 : result.status === "recovery_pending" ? 202 : result.status === "payment_failed" ? 402 : result.status === "market_capability_unavailable" ? 503 : 409;
    return NextResponse.json(result, { status, headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    const failure = resourcePackageMarketRouteError(cause, "package_market_checkout_invalid");
    return NextResponse.json(failure.body, { status: failure.status, headers: { "cache-control": "private, no-store" } });
  }
}
