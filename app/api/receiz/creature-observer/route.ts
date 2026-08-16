import { NextRequest, NextResponse } from "next/server";
import {
  createObservedCreatureTurn,
  creatureObserverClientContext,
  creatureObserverThreadKey,
  creatureObserverVisitorKey,
  normalizeCreatureTwinReply,
  parseCreatureObserverRequest,
  projectCreatureBrain
} from "@/features/play/creature-consciousness";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function failureStatus(error: string) {
  if (error === "receiz_authority_required") return 401;
  if (error === "receiz_profile_required" || error === "receiz_identity_key_required") return 403;
  if (error === "creature_observer_request_invalid" || error === "creature_observer_card_invalid") return 422;
  return 502;
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const input = parseCreatureObserverRequest(await request.json().catch(() => null));
    const brain = projectCreatureBrain(input.card);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const response = await adapter.worldMessage(actor.actorId, {
      action: "message",
      visitorKey: creatureObserverVisitorKey(actor.actorId),
      threadKey: creatureObserverThreadKey(input.card.id),
      message: input.message,
      allowBrowserVoiceFallback: true,
      clientContext: creatureObserverClientContext(brain),
      ...(input.clientUserMessageId ? { clientUserMessageId: input.clientUserMessageId } : {})
    });
    if (response.ok !== true) throw new Error(response.error || "creature_observer_unavailable");
    const reply = normalizeCreatureTwinReply(response.reply);
    const turn = createObservedCreatureTurn({
      brain,
      ownerActorId: actor.actorId,
      message: input.message,
      reply,
      observedAt: new Date().toISOString(),
      ...(input.clientUserMessageId ? { clientUserMessageId: input.clientUserMessageId } : {})
    });
    return json({
      ok: true,
      observer: "receiz-twin",
      brain: {
        schema: brain.schema,
        brainId: brain.brainId,
        contextDigest: brain.contextDigest,
        proofDigest: brain.identity.proofDigest,
        historyHead: brain.memory.historyHead,
        observerHead: brain.memory.observerHead
      },
      turn
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "creature_observer_unavailable";
    return json({ ok: false, error }, failureStatus(error));
  }
}
