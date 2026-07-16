import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { admitWildzTrade } from "@/lib/receiz/wildz-market-adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail
} from "@/lib/receiz/wildz-market-repository";
import {
  marketIdempotencyKey,
  marketRouteError,
  parseWildzListingCommand,
  publicMarketAdmission
} from "@/lib/receiz/wildz-market-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const body = parseWildzListingCommand(await request.json().catch(() => null));
    const idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    const admission = await admitWildzTrade(repository, { ...body, idempotencyKey }, actor, {
      occurredAt: new Date().toISOString()
    });
    const response = publicMarketAdmission(admission, "trade", idempotencyKey);
    return NextResponse.json(response.body, {
      status: response.status,
      headers: { "cache-control": "no-store" }
    });
  } catch (cause) {
    const failure = marketRouteError(cause, "market_offer_invalid");
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers: { "cache-control": "no-store" }
    });
  }
}
