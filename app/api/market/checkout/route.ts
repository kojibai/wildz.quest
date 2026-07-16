import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail
} from "@/lib/receiz/wildz-market-repository";
import { purchaseAdmittedWildzTrade } from "@/lib/receiz/wildz-market-adapter";
import {
  marketRouteError,
  parseWildzTradeCommand
} from "@/lib/receiz/wildz-market-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const body = parseWildzTradeCommand(await request.json().catch(() => null));
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    const result = await purchaseAdmittedWildzTrade(repository, adapter, body, actor, {
      occurredAt: new Date().toISOString()
    });
    const status = result.status === "settled" ? 200
      : result.status === "recovery_pending" ? 202
        : result.status === "payment_failed" ? 402
          : result.status === "reservation_expired" ? 409
          : result.status === "market_revision_conflict" ? 409
            : 503;
    const response = result.status === "settled"
      ? { status: result.status, receipt: result.receipt, ownershipTransferred: true }
      : result;
    return NextResponse.json(response, { status, headers: { "cache-control": "no-store" } });
  } catch (cause) {
    const failure = marketRouteError(cause, "market_checkout_invalid");
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers: { "cache-control": "no-store" }
    });
  }
}
