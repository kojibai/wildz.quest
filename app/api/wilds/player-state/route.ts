import { NextRequest, NextResponse } from "next/server";
import type { WildsPlayerVaultPayload } from "@/features/play/wilds-player-vault";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { loadWildzPlayerState, publishWildzPlayerState } from "@/lib/receiz/wildz-player-state-sync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request, undefined, { resolveConnectProfile: false });
    const record = await loadWildzPlayerState(request, actor);
    return NextResponse.json({ ok: true, record }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_player_state_unavailable";
    return NextResponse.json({ ok: false, error }, {
      status: error === "wildz_player_state_identity_required" || error === "wilds_guest_identity_required" ? 401 : 503
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request, undefined, { resolveConnectProfile: false });
    const body = await request.json() as { player?: WildsPlayerVaultPayload };
    if (!body.player) throw new Error("wildz_player_state_source_required");
    const record = await publishWildzPlayerState(request, actor, body.player);
    return NextResponse.json({ ok: true, record }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_player_state_sync_pending";
    const status = error.includes("identity_required") ? 401 : error.includes("invalid") || error.includes("required") ? 400 : 503;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
