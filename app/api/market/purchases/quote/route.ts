import { NextRequest, NextResponse } from "next/server";
import { receizKaiNow } from "@receiz/sdk";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildsWalletReadAuthority } from "@/lib/receiz/wilds-wallet-route-authority";
import { deriveWildzMarketConnectQuoteV128 } from "@/lib/receiz/wildz-market-quote-v128";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

/** Read actual connected-wallet pricing. This route moves no money or custody. */
export async function POST(request: NextRequest) {
  try {
    const authority = await resolveWildsWalletReadAuthority(request);
    const text = await request.text();
    if (text.length > 512) throw Error("The marketplace quote request is too large.");
    const body = JSON.parse(text);
    if (!body || Object.keys(body).join(",") !== "priceUsdCents") throw Error("An exact USD-cent price is required.");
    const wallet = await createReceizCommerceAdapter({ accessToken: authority.accessToken }).walletSummary();
    const quote = deriveWildzMarketConnectQuoteV128(wallet, { ownerUserId: authority.ownerReceizId, ownerHandle: authority.profileHandle, priceUsdCents: body.priceUsdCents, currentKai: receizKaiNow().pulse });
    return NextResponse.json({ quote }, { headers });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "The actual marketplace quote is unavailable." }, { status: 409, headers });
  }
}
