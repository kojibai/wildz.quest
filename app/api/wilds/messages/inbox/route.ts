import { NextRequest, NextResponse } from "next/server";
import { wildsConversationSummary } from "@/features/play/wilds-messenger-core";
import { hydrateWildsConversation, hydrateWildsMessengerInbox } from "@/lib/receiz/wilds-messenger-server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";

function parsePeers(value: string | null) {
  if (!value) return [];
  return value.split("|").slice(0, 80).flatMap((entry) => {
    try {
      const peer = JSON.parse(decodeURIComponent(entry)) as { id?: unknown; handle?: unknown };
      return typeof peer.id === "string" && typeof peer.handle === "string" ? [{ id: peer.id, handle: peer.handle }] : [];
    } catch {
      return [];
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request, request.nextUrl.searchParams.get("guestId"));
    const peers = parsePeers(request.nextUrl.searchParams.get("peers"));
    const [published, explicit] = await Promise.all([
      hydrateWildsMessengerInbox(actor),
      Promise.all(peers.map((peer) => hydrateWildsConversation(request, actor, peer)))
    ]);
    const byId = new Map([...published, ...explicit].map((conversation) => [conversation.id, conversation]));
    const summaries = [...byId.values()]
      .filter((conversation) => conversation.messages.length > 0)
      .map((conversation) => wildsConversationSummary(conversation, actor.playerId))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    return NextResponse.json({ ok: true, summaries }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wilds_message_inbox_failed";
    return NextResponse.json({ ok: false, error }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
}
