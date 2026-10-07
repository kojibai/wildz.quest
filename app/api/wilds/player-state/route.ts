import { NextRequest, NextResponse } from "next/server";
import type { WildsPlayerVaultPayload } from "@/features/play/wilds-player-vault";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { loadWildzPlayerState, publishWildzPlayerState } from "@/lib/receiz/wildz-player-state-sync";
import { projectWildzPlayerStateResponse } from "@/lib/performance/wildz-player-state-transport";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request, undefined, { resolveConnectProfile: false });
    const record = await loadWildzPlayerState(request, actor);
    const response = projectWildzPlayerStateResponse(record, { ifNoneMatch: request.headers.get("if-none-match") });
    const headers = { "cache-control": "private, no-store", ...(response.etag ? { etag: response.etag } : {}) };
    return response.status === 304
      ? new NextResponse(null, { status: 304, headers })
      : NextResponse.json(response.body, { headers });
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
    const response = projectWildzPlayerStateResponse(record, {
      compact: request.headers.get("x-wildz-player-state-response") === "compact",
      incomingDigest: body.player.payloadDigest
    });
    return NextResponse.json(response.body, { headers: { "cache-control": "private, no-store",
      vary: "x-wildz-player-state-response", ...(response.etag ? { etag: response.etag } : {}) } });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wildz_player_state_sync_pending";
    const status = error.includes("identity_required") ? 401 : error.includes("invalid") || error.includes("required") ? 400 : 503;
    return NextResponse.json({ ok: false, error }, { status });
  }
}
