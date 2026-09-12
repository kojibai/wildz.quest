import { NextRequest, NextResponse } from "next/server";
import { worldSnapshot } from "@/lib/receiz/wilds-world-server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const [snapshot, actor] = await Promise.all([worldSnapshot(request), resolveWildsMultiplayerActor(request, "community-reader", { resolveConnectProfile: false })]);
    return NextResponse.json({ ok: true, communities: snapshot.projection.communities ?? {}, actor: actor.practice ? null : actor.handle }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "Community records could not be loaded. Please retry." }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}
