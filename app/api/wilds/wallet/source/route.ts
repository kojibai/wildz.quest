import { NextRequest, NextResponse } from "next/server";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildsWalletReadAuthority } from "@/lib/receiz/wilds-wallet-route-authority";
import { initializeWildsWalletNativeSource } from "@/lib/receiz/wilds-wallet-native-source";
import { readWildzProofSessionCookie } from "@/lib/receiz/wildz-proof-session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
export async function GET(request: NextRequest) {
  try { const authority = await resolveWildsWalletReadAuthority(request);
    const capability = await createReceizCommerceAdapter({ accessToken: authority.accessToken }).nativeValueTransferCapabilitiesV123();
    if (capability.userId !== authority.ownerReceizId) return reply({ error: "IDENTITY_MISMATCH" }, 403);
    return reply({ sourceAvailable: capability.sourceAvailable });
  } catch { return reply({ error: "WALLET_SOURCE_UNAVAILABLE" }, 503); }
}
export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin || !request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "REQUEST_INVALID" }, 403);
    if (Number(request.headers.get("content-length")) > 2_000_000) return reply({ error: "REQUEST_INVALID" }, 413);
    const authority = await resolveWildsWalletReadAuthority(request); const session = readWildzProofSessionCookie(request);
    if (session.authority !== "identity-key") return reply({ error: "IDENTITY_REQUIRED" }, 401);
    const raw = await request.text(); if (raw.length > 2_000_000) return reply({ error: "REQUEST_INVALID" }, 413);
    return reply(await initializeWildsWalletNativeSource(authority, JSON.parse(raw), { keyId: session.keyId,
      createAdapter: accessToken => createReceizCommerceAdapter({ accessToken }) }));
  } catch { return reply({ error: "WALLET_SOURCE_UNAVAILABLE" }, 503); }
}
