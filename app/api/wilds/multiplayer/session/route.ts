import { NextRequest, NextResponse } from "next/server";
import { heartbeatWildsPresence } from "@/features/play/multiplayer-ledger";
import { authorizeWildsMultiplayerHeartbeatCard, hydrateWildsRoomFromReceiz, parseWildsRoomKey, publishWildsRoomToReceiz, resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const roomKey = parseWildsRoomKey(body?.roomKey);
    const actor = await resolveWildsMultiplayerActor(request, body?.guestId);
    const style = body?.style === "male" ? "male" : body?.style === "female" ? "female" : null;
    if (!style) throw new Error("wilds_avatar_style_invalid");
    const x = Number(body?.x);
    const z = Number(body?.z);
    const heading = Number(body?.heading ?? 0);
    await hydrateWildsRoomFromReceiz(request, roomKey);
    const activeCard = authorizeWildsMultiplayerHeartbeatCard(
      actor,
      body?.card,
      body?.cardAdmission,
      body?.cardRef
    );
    const result = heartbeatWildsPresence({
      roomKey,
      playerId: actor.playerId,
      handle: actor.handle,
      style,
      x,
      z,
      heading,
      practice: actor.practice,
      activeCard
    });
    const publication = await publishWildsRoomToReceiz(request, actor, result.snapshot);
    return NextResponse.json({
      ok: true,
      actor: { playerId: actor.playerId, handle: actor.handle, practice: actor.practice },
      ...result,
      publication
    });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
