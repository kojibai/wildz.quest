import { NextRequest, NextResponse } from "next/server";
import { getWildsMultiplayerSnapshot, mutateWildsChallenge } from "@/features/play/multiplayer-ledger";
import { authorizeWildsMultiplayerCard, commitWildsRoomToReceiz, hydrateWildsRoomFromReceiz, parseWildsRoomKey, resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
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
    const action = body?.action;
    if (action !== "offer" && action !== "accept" && action !== "decline" && action !== "cancel") throw new Error("wilds_challenge_action_invalid");
    const result = mutateWildsChallenge({
      roomKey,
      actorId: actor.playerId,
      action,
      opponentId: typeof body?.opponentId === "string" ? body.opponentId : undefined,
      challengeId: typeof body?.challengeId === "string" ? body.challengeId : undefined,
      card: authorizeWildsMultiplayerCard(actor, body?.card, body?.cardAdmission),
      mode: body?.mode === "card_stake" || body?.mode === "money_stake" ? body.mode : "friendly"
    });
    const publication = await commitWildsRoomToReceiz(request, actor, previous, result.snapshot);
    return NextResponse.json({ ok: true, ...result, publication });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
