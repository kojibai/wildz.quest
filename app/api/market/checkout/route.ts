import { NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { planWildzTrade } from "@/features/market/wildz-market";
import { settleUnavailable } from "@/lib/receiz/wildz-market-adapter";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idempotencyKey = request.headers.get("idempotency-key") ?? body.idempotencyKey;
    const plan = planWildzTrade({ listing: body.listing, buyer: body.buyer, expectedRevision: body.expectedRevision, idempotencyKey });
    if (!process.env.RECEIZ_ACCESS_TOKEN) return NextResponse.json(settleUnavailable(plan), { status: 503 });
    const checkout = await createReceizCommerceAdapter().oneClickCheckout({ tenantHost: process.env.NEXT_PUBLIC_DEFAULT_SUBDOMAIN ?? "wildz.quest", amountUsd: (plan.priceCents / 100).toFixed(2), currency: "usd", walletFirst: true, cardFallback: true, customerReceizId: plan.buyer, orderId: plan.id, idempotencyKey, cart: { items: [{ id: plan.assetId, assetId: plan.assetId, quantity: 1, unitAmountUsd: (plan.priceCents / 100).toFixed(2) }] }, successUrl: "https://wildz.quest/?trade=success", cancelUrl: "https://wildz.quest/?trade=cancelled" });
    return NextResponse.json({ schema: "wildz.market_receipt.v1", tradeId: plan.id, status: "pending_payment", ownershipTransferred: false, nextOwner: null, checkoutSession: checkout.checkoutSession ?? null }, { status: 202 });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "checkout_invalid", ownershipTransferred: false }, { status: 400 }); }
}
