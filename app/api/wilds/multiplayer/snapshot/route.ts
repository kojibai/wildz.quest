import { NextRequest, NextResponse } from "next/server";
import { getWildsMultiplayerSnapshot } from "@/features/play/multiplayer-ledger";
import { hydrateWildsRoomFromReceiz, parseWildsRoomKey } from "@/lib/receiz/wilds-multiplayer-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const roomKey = parseWildsRoomKey(request.nextUrl.searchParams.get("room"));
    await hydrateWildsRoomFromReceiz(request, roomKey);
    return NextResponse.json({ ok: true, snapshot: getWildsMultiplayerSnapshot(roomKey) });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
