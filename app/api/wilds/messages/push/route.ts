import { NextRequest, NextResponse } from "next/server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import { messagePushConfigured, parseMessagePushSubscription, saveMessagePushSubscription, removeMessagePushSubscription } from "@/lib/receiz/wilds-message-push";

export const runtime = "nodejs";
const headers = { "cache-control": "private, no-store" };

export function GET() {
  return NextResponse.json({ configured: messagePushConfigured(), publicKey: messagePushConfigured() ? process.env.WILDS_PUSH_VAPID_PUBLIC_KEY : null }, { headers });
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "wilds_push_origin_invalid" }, { status: 403, headers });
    const actor = await resolveWildsMultiplayerActor(request, undefined, { resolveConnectProfile: false });
    if (actor.practice) return NextResponse.json({ error: "Sign in to enable message notifications" }, { status: 401, headers });
    if (!messagePushConfigured()) return NextResponse.json({ error: "Message push is not configured yet" }, { status: 503, headers });
    const body = await request.json();
    const subscription = parseMessagePushSubscription(body.subscription);
    if (body.action === "remove") await removeMessagePushSubscription(actor.playerId, subscription.endpoint);
    else await saveMessagePushSubscription(actor.playerId, subscription);
    return NextResponse.json({ ok: true }, { headers });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "wilds_push_failed";
    return NextResponse.json({ error }, { status: error.includes("invalid") ? 400 : 503, headers });
  }
}
