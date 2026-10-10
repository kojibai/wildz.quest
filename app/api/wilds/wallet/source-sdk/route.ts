import { NextRequest, NextResponse } from "next/server";
import { proxyWildsWalletSourceSdkV128, wildsWalletSourceSdkConfigV128 } from "@/lib/receiz/wilds-wallet-source-sdk-runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };
export async function GET(request: NextRequest) {
  try { return NextResponse.json(await wildsWalletSourceSdkConfigV128(request), { headers }); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "The actual source application is unavailable." }, { status: 409, headers }); }
}
export async function POST(request: NextRequest) {
  try { return await proxyWildsWalletSourceSdkV128(request); }
  catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "The same native source request is pending." }, { status: 409, headers }); }
}
