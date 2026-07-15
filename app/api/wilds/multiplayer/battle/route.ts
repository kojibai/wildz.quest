import { NextRequest, NextResponse } from "next/server";
import { submitWildsBattleIntent } from "@/features/play/multiplayer-ledger";
import type { PvpIntent } from "@/features/play/pvp-battle-engine";
import { parseWildsRoomKey, publishWildsRoomToReceiz, resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { wildsMultiplayerError } from "@/lib/receiz/wilds-multiplayer-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIntent(value: unknown): PvpIntent {
  if (!value || typeof value !== "object") throw new Error("wilds_pvp_intent_invalid");
  const intent = value as Record<string, unknown>;
  if (intent.type === "guard") return { type: "guard" };
  if (intent.type === "ability" && (intent.slot === 0 || intent.slot === 1)) return { type: "ability", slot: intent.slot };
  throw new Error("wilds_pvp_intent_invalid");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    const roomKey = parseWildsRoomKey(body?.roomKey);
    const actor = await resolveWildsMultiplayerActor(request, body?.guestId);
    const battleId = typeof body?.battleId === "string" ? body.battleId : "";
    const intentId = typeof body?.intentId === "string" && body.intentId.length <= 160 ? body.intentId : "";
    if (!battleId || !intentId) throw new Error("wilds_pvp_request_invalid");
    const result = submitWildsBattleIntent({ roomKey, actorId: actor.playerId, battleId, intent: parseIntent(body?.intent), intentId });
    const publication = await publishWildsRoomToReceiz(request, actor, result.snapshot);
    return NextResponse.json({ ok: true, ...result, publication });
  } catch (error) {
    return wildsMultiplayerError(error);
  }
}
