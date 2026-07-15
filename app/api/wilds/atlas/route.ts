import { NextRequest, NextResponse } from "next/server";
import { getWildsAtlasPresence } from "@/features/play/multiplayer-ledger";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const x = Number(url.searchParams.get("x"));
    const z = Number(url.searchParams.get("z"));
    if (![x, z].every(Number.isFinite) || Math.abs(x) > 1_000_000 || Math.abs(z) > 1_000_000) {
      throw new Error("wilds_atlas_position_invalid");
    }
    const actor = await resolveWildsMultiplayerActor(request, url.searchParams.get("guestId"));
    const presence = getWildsAtlasPresence({ actorId: actor.playerId, center: { x, z }, maxClusters: 64 });
    return NextResponse.json({ ok: true, ...presence }, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
