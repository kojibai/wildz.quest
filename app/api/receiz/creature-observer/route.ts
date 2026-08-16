import { NextRequest, NextResponse } from "next/server";
import {
  createObservedCreatureTurn,
  creatureObserverClientContext,
  creatureObserverThreadKey,
  creatureObserverVisitorKey,
  localCreatureTwinReply,
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
    const input = parseCreatureObserverRequest(await request.json().catch(() => null));
    const brain = projectCreatureBrain(input.card);
    const actor = await resolveWildzCookieActor(request).catch((cause) => {
      const error = cause instanceof Error ? cause.message : "receiz_authority_required";
      if (error !== "receiz_authority_required" && error !== "receiz_identity_key_required") throw cause;
      return {
        actorId: input.card.manifest.ownerReceizId,
        profileHandle: input.card.manifest.ownerReceizId,
        receizUserId: `card:${input.card.id}`,
        accessToken: undefined
      };
    });
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const twinHandle = process.env.RECEIZ_CREATURE_TWIN_HANDLE
      || (actor.accessToken ? actor.profileHandle : "receiz");
    const clientOperationId = input.clientUserMessageId ?? `creature-message:${brain.contextDigest.slice(7, 39)}`;
    const response = await Promise.race([
      adapter.worldMessage(twinHandle, {
        action: "message",
        visitorKey: creatureObserverVisitorKey(actor.actorId),
        threadKey: creatureObserverThreadKey(input.card.id),
        message: input.message,
        allowBrowserVoiceFallback: true,
        clientContext: creatureObserverClientContext(brain),
        clientUserMessageId: clientOperationId,
        clientOperationId,
        quoteExpiresAt: new Date(Date.now() + 9 * 60_000).toISOString()
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("creature_observer_timeout")), 12_000))
    ]).catch(() => null);
    const remoteReply = response?.ok === true
      ? (() => { try { return normalizeCreatureTwinReply(response.reply); } catch { return null; } })()
      : null;
    const observer = remoteReply ? "receiz-twin" as const : "receiz-twin-local" as const;
    const reply = remoteReply ?? localCreatureTwinReply(brain, input.message);
    const turn = createObservedCreatureTurn({
      brain,
      ownerActorId: actor.actorId,
      message: input.message,
      reply,
      observer,
      observedAt: new Date().toISOString(),
      ...(input.clientUserMessageId ? { clientUserMessageId: input.clientUserMessageId } : {})
    });
    return json({
      ok: true,
      observer,
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
