import { NextRequest, NextResponse } from "next/server";
import { projectWildsWalletCapabilities } from "@/lib/receiz/wilds-wallet-projections";
import {
  resolveWildsWalletReadAuthority,
  wildsWalletAuthorityStatusFor
} from "@/lib/receiz/wilds-wallet-route-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function failure(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "receiz_wallet_capabilities_unavailable";
  if (code.startsWith("receiz_wallet_")) return json({ error: code }, wildsWalletAuthorityStatusFor(code));
  return json({ error: "receiz_wallet_capabilities_unavailable" }, 502);
}

export async function GET(request: NextRequest) {
  try {
    await resolveWildsWalletReadAuthority(request);
    return NextResponse.json(projectWildsWalletCapabilities(), {
      headers: { "cache-control": "no-store" }
    });
  } catch (cause) {
    return failure(cause);
  }
}
