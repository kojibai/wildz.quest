import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { admitWildzTrade, releaseWildzTrade } from "@/lib/receiz/wildz-market-adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail
} from "@/lib/receiz/wildz-market-repository";
import {
  marketIdempotencyKey,
  marketRouteError,
  parseWildzListingCommand,
  parseWildzTradeCommand,
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
    const failure = marketRouteError(cause, "market_trade_invalid");
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers: { "cache-control": "no-store" }
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const body = parseWildzTradeCommand(await request.json().catch(() => null));
    const idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    const admission = await releaseWildzTrade(repository, { ...body, idempotencyKey }, actor, {
      occurredAt: new Date().toISOString()
    });
    if (admission.status === "market_capability_unavailable") {
      return NextResponse.json({ status: admission.status, ownershipTransferred: false }, {
        status: 503,
        headers: { "cache-control": "no-store" }
      });
    }
    if (admission.status === "market_revision_conflict") {
      return NextResponse.json({ ...admission, ownershipTransferred: false }, {
        status: 409,
        headers: { "cache-control": "no-store" }
      });
    }
    return NextResponse.json({
      status: admission.status,
      tradeId: body.tradeId,
      head: {
        revision: admission.state.revision,
        appendAnchorId: admission.state.appendAnchorId
      },
      ownershipTransferred: false
    }, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    const failure = marketRouteError(cause, "market_trade_release_invalid");
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers: { "cache-control": "no-store" }
    });
  }
}
