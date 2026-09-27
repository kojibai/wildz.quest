import { createReceizRemoteAdmissionStore } from "@receiz/sdk";
import { NextRequest, NextResponse } from "next/server";
import { parseWildsWorldAddress } from "@/features/play/wilds-world-address";
import { admitWildsV11Travel } from "@/lib/receiz/wilds-v11-encounter-authority";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("wilds_v11_request_invalid");
    const actor = await resolveWildsMultiplayerActor(request);
    if (actor.practice) throw new Error("wilds_v11_verified_identity_required");
    if (!actor.accessToken) throw new Error("wilds_v11_authority_unavailable");
    if (body.action === "encounter") {
      // The travel aggregate records reported movement; it is not a verified
      // player object proving presence at this site. Do not sign rarity from it.
      throw new Error("wilds_v11_player_source_required");
    }
    if (body.action !== "travel") throw new Error("wilds_v11_action_invalid");
    const store = createReceizRemoteAdmissionStore({ namespace: "wildz-v11-encounters", accessToken: actor.accessToken,
      baseUrl: process.env.RECEIZ_BASE_URL ?? "https://receiz.com" });
    const address = parseWildsWorldAddress(body.address);
    const head = await admitWildsV11Travel(store, actor.playerId, address);
    return NextResponse.json({ ok: true, head }, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    const code = cause instanceof Error && cause.message.startsWith("wilds_v11_") ? cause.message : "wilds_v11_request_failed";
    return NextResponse.json({ ok: false, error: code }, { status: code === "wilds_v11_authority_unavailable"
      || code === "wilds_v11_player_source_required" ? 503 : 400,
      headers: { "cache-control": "no-store" } });
  }
}
