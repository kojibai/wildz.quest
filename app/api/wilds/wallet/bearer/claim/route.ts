import { NextRequest, NextResponse } from "next/server";
import { claimWildsWalletBearerGift } from "@/lib/receiz/wilds-wallet-bearer-claim-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

export async function POST(request: NextRequest) {
  try { return NextResponse.json(await claimWildsWalletBearerGift(request), { headers }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "The same native one-use claim is pending." }, { status: 409, headers }); }
}
