import { NextRequest, NextResponse } from "next/server";
import { addWildsRoomMessage, getWildsMultiplayerSnapshot } from "@/features/play/multiplayer-ledger";
import { commitWildsRoomToReceiz, hydrateWildsRoomFromReceiz, parseWildsRoomKey, resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const roomKey = parseWildsRoomKey(body?.roomKey);
    const actor = await resolveWildsMultiplayerActor(request, body?.guestId);
    await hydrateWildsRoomFromReceiz(request, roomKey);
    const previous = getWildsMultiplayerSnapshot(roomKey);
    const result = addWildsRoomMessage({ roomKey, actorId: actor.playerId, text: String(body?.text ?? "") });
    const publication = await commitWildsRoomToReceiz(request, actor, previous, result.snapshot);
    return NextResponse.json({ ok: true, ...result, publication });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
