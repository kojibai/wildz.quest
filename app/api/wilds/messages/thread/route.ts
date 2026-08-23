import { NextRequest, NextResponse } from "next/server";
import {
  appendWildsDirectMessage,
  markWildsConversationRead,
  reactToWildsDirectMessage
} from "@/features/play/wilds-messenger-ledger";
import { wildsConversationSummary } from "@/features/play/wilds-messenger-core";
import {
  hydrateWildsConversation,
  publishWildsConversation
} from "@/lib/receiz/wilds-messenger-server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";

function peerFrom(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("wilds_message_peer_required");
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.handle !== "string") throw new Error("wilds_message_peer_required");
  return { id: record.id, handle: record.handle };
}

function responseError(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wilds_message_failed";
  const status = error.includes("rate_limited") ? 429 : error.includes("required") || error.includes("invalid") ? 400 : 503;
  return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request, request.nextUrl.searchParams.get("guestId"));
    const peer = peerFrom({
      id: request.nextUrl.searchParams.get("peerId"),
      handle: request.nextUrl.searchParams.get("peerHandle")
    });
    const conversation = await hydrateWildsConversation(request, actor, peer);
    return NextResponse.json({ ok: true, conversation, summary: wildsConversationSummary(conversation, actor.playerId) }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    return responseError(cause);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveWildsMultiplayerActor(request, body.guestId);
    const self = { id: actor.playerId, handle: actor.handle };
    const peer = peerFrom(body.peer);
    await hydrateWildsConversation(request, actor, peer);
    const action = body.action;
    const conversation = action === "send"
      ? appendWildsDirectMessage({
          sender: self,
          recipient: peer,
          body: String(body.message ?? ""),
          clientMessageId: String(body.clientMessageId ?? ""),
          replyToId: typeof body.replyToId === "string" ? body.replyToId : null
        }).conversation
      : action === "read"
        ? markWildsConversationRead({ left: self, right: peer, actorId: actor.playerId, through: typeof body.through === "string" ? body.through : undefined })
        : action === "react"
          ? reactToWildsDirectMessage({ left: self, right: peer, actorId: actor.playerId, messageId: String(body.messageId ?? ""), emoji: String(body.emoji ?? "") })
          : (() => { throw new Error("wilds_message_action_invalid"); })();
    const publication = await publishWildsConversation(request, actor, conversation);
    return NextResponse.json({ ok: true, conversation, summary: wildsConversationSummary(conversation, actor.playerId), publication }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    return responseError(cause);
  }
}
