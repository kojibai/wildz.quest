import { NextRequest, NextResponse } from "next/server";
import {
  createObservedCreatureTurn,
  creatureObserverClientContext,
  creatureObserverMomentContext,
  creatureObserverThreadKey,
  creatureObserverVisitorKey,
  normalizeCreatureTwinReply,
  parseCreatureObserverRequest,
  projectCreatureBrain
} from "@/features/play/creature-consciousness";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { observeCreatureThroughReceizV120 } from "@/features/play/receiz-v120-creature-subject";

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
    const presentKaiMoment = creatureObserverMomentContext(input.kai, brain);
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
    const adapter = createReceizCommerceAdapter({
      accessToken: actor.accessToken || process.env.RECEIZ_CONNECT_ACCESS_TOKEN
    });
    const twinHandle = process.env.RECEIZ_CREATURE_TWIN_HANDLE
      || (actor.accessToken ? actor.profileHandle : "receiz");
    const clientOperationId = input.clientUserMessageId ?? `creature-message:${brain.contextDigest.slice(7, 39)}`;
    let remoteObserved = false;
    const subjectObservation = await observeCreatureThroughReceizV120({
      asset: input.card,
      ownerReceizId: actor.actorId,
      message: input.message,
      clientMessageId: clientOperationId,
      speak: async ({ brain: subjectBrain, proofContext }) => {
        const response = await Promise.race([
          adapter.worldMessage(twinHandle, {
            action: "message",
            visitorKey: creatureObserverVisitorKey(actor.actorId),
            threadKey: creatureObserverThreadKey(input.card.id),
            message: input.message,
            allowBrowserVoiceFallback: true,
            clientContext: {
              ...creatureObserverClientContext(subjectBrain, presentKaiMoment),
              receizV120: {
                schema: proofContext.schema,
                subjectHead: proofContext.head.subjectHead,
                historyHead: proofContext.head.historyHead,
                proofObjectIds: proofContext.primaryObjects.map((object) => object.proofObjectId),
                eventIds: proofContext.primaryObjects.flatMap((object) => object.eventIds),
                modelOutputIsAuthority: false
              }
            },
            clientUserMessageId: clientOperationId,
            clientOperationId,
            quoteExpiresAt: new Date(Date.now() + 9 * 60_000).toISOString()
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("creature_observer_timeout")), 24_000))
        ]).catch(() => null);
        const remoteReply = response?.ok === true
          ? (() => { try { return normalizeCreatureTwinReply(response.reply); } catch { return null; } })()
          : null;
        if (!remoteReply) throw new Error("creature_observer_intelligence_unavailable");
        remoteObserved = true;
        return {
          provider: "receiz",
          model: "subject-twin",
          version: "120.0.0",
          speech: remoteReply,
          performance: {
            ...subjectBrain.performance.expression,
            proofContextDigest: proofContext.receipt.queryDigest,
            authoritative: false
          }
        };
      }
    });
    const observer = remoteObserved ? "receiz-twin" as const : "receiz-twin-local" as const;
    const reply = subjectObservation.twin.spokenResponse;
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
      subject: {
        schema: "receiz.subject.v1",
        version: "120.0.0",
        subjectId: input.card.id,
        subjectHead: subjectObservation.subjectHead,
        brainHead: subjectObservation.brainHead,
        objectMerkleRoot: subjectObservation.objectMerkleRoot,
        objectCount: subjectObservation.objectCount,
        registryDigest: subjectObservation.registryDigest,
        reducerDigest: subjectObservation.reducerDigest,
        observedEventIds: subjectObservation.twin.observedFacts.flatMap((fact) => fact.eventIds),
        modelOutputIsWorldEvent: subjectObservation.twin.authority.modelOutputIsWorldEvent
      },
      moment: presentKaiMoment,
      turn
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "creature_observer_unavailable";
    return json({ ok: false, error }, failureStatus(error));
  }
}
