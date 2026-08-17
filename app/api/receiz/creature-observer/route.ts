import { NextRequest, NextResponse } from "next/server";
import { createReceizClient } from "@receiz/sdk";
import {
  createObservedCreatureTurn,
  creatureObserverClientContext,
  creatureObserverMomentContext,
  creatureObserverThreadKey,
  creatureObserverVisitorKey,
  localCreatureTwinReply,
  normalizeCreatureTwinReply,
  parseCreatureObserverRequest,
  projectCreatureBrain
} from "@/features/play/creature-consciousness";
import { observeCreatureThroughReceizV120 } from "@/features/play/receiz-v120-creature-subject";
import { resolveWildzGameplayCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { canCurrentWildzOwnerObserveCreature } from "@/lib/receiz/wildz-creature-observer-ownership";
import { readWildzProofSessionCookie } from "@/lib/receiz/wildz-proof-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function failureStatus(error: string) {
  if (error === "receiz_authority_required") return 401;
  if (error === "receiz_profile_required" || error === "receiz_identity_key_required"
    || error === "creature_observer_owner_mismatch") return 403;
  if (error === "creature_observer_request_invalid" || error === "creature_observer_card_invalid") return 422;
  return 502;
}

function eventBytes(value: unknown) {
  return encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
}

export async function POST(request: NextRequest) {
  try {
    const input = parseCreatureObserverRequest(await request.json().catch(() => null));
    const brain = projectCreatureBrain(input.card);
    const presentKaiMoment = creatureObserverMomentContext(input.kai, brain);
    const actor = await resolveWildzGameplayCookieActor(request);
    let proofSession: ReturnType<typeof readWildzProofSessionCookie> | null = null;
    try { proofSession = readWildzProofSessionCookie(request); } catch { /* Fail closed below. */ }
    if (!canCurrentWildzOwnerObserveCreature({
      actorId: actor.actorId,
      profileHandle: actor.profileHandle,
      proofSession,
      card: input.card,
      cardAdmission: input.cardAdmission
    })) throw new Error("creature_observer_owner_mismatch");

    const receiz = createReceizClient({
      ...(process.env.RECEIZ_BASE_URL ? { baseUrl: process.env.RECEIZ_BASE_URL } : {}),
      ...(actor.accessToken ? { accessToken: actor.accessToken } : {})
    });
    const twinHandle = process.env.RECEIZ_CREATURE_TWIN_HANDLE?.trim() || "wildz";
    const clientOperationId = input.clientUserMessageId ?? `creature-message:${brain.contextDigest.slice(7, 39)}`;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (value: unknown) => controller.enqueue(eventBytes(value));
        send({ type: "reply_start", voiceSignature: brain.performance.expression.voiceSignature, startedAt: Date.now() });
        void (async () => {
          try {
            const subjectObservation = await observeCreatureThroughReceizV120({
              asset: input.card,
              ownerReceizId: actor.actorId,
              message: input.message,
              clientMessageId: clientOperationId,
              speak: async ({ brain: subjectBrain, proofContext }) => {
                const observerContext = creatureObserverClientContext(subjectBrain, presentKaiMoment);
                const groundedMessage = [
                  observerContext.instruction,
                  `Present Kai causal context: ${JSON.stringify(observerContext.presentKaiMoment)}`,
                  `The person speaking with you says: ${input.message}`
                ].join("\n\n");
                let speech = "";
                let upstream = false;
                try {
                  for await (const event of receiz.world.streamProfile(twinHandle, {
                    action: "message",
                    message: groundedMessage,
                    responseMode: "text",
                    allowBrowserVoiceFallback: false,
                    visitorKey: creatureObserverVisitorKey(actor.actorId),
                    threadKey: creatureObserverThreadKey(input.card.id),
                    clientContext: {
                      ...observerContext,
                      receizV120: {
                        schema: proofContext.schema,
                        subjectHead: proofContext.head.subjectHead,
                        historyHead: proofContext.head.historyHead,
                        subjectDigest: proofContext.head.subjectDigest,
                        proofObjectIds: proofContext.primaryObjects.map((object) => object.proofObjectId),
                        eventIds: proofContext.primaryObjects.flatMap((object) => object.eventIds),
                        modelOutputIsAuthority: false
                      }
                    },
                    clientUserMessageId: clientOperationId,
                    clientAssistantMessageId: `${clientOperationId}:assistant`,
                    clientOperationId,
                    quoteExpiresAt: new Date(Date.now() + 9 * 60_000).toISOString()
                  })) {
                    if (request.signal.aborted) throw new Error("request_aborted");
                    if (event.type === "reply_delta" && typeof event.delta === "string" && event.delta) {
                      upstream = true;
                      speech += event.delta;
                      send({ type: "reply_delta", delta: event.delta });
                    }
                    if (event.type === "reply_done" && event.reply && typeof event.reply === "object") {
                      const finalText = typeof event.reply.message === "string" ? event.reply.message : speech;
                      if (finalText && !speech) {
                        upstream = true;
                        speech = finalText;
                        send({ type: "reply_delta", delta: finalText });
                      }
                    }
                  }
                } catch { /* The local proof brain below is the zero-network recovery rail. */ }
                if (!speech.trim()) {
                  speech = localCreatureTwinReply(subjectBrain, input.message);
                  send({ type: "reply_delta", delta: speech });
                }
                return {
                  provider: upstream ? "receiz" : "wildz-proof-brain",
                  model: upstream ? "receiz-world-twin-stream" : "proof-grounded-creature-twin",
                  version: "120.0.0",
                  speech: normalizeCreatureTwinReply(speech, subjectBrain.identity.name),
                  performance: {
                    ...subjectBrain.performance.expression,
                    proofContextDigest: proofContext.receipt.queryDigest,
                    authoritative: false,
                    responseRail: upstream ? "receiz-stream" : "proof-grounded-local"
                  }
                };
              }
            });
            const modelAudit = subjectObservation.twin.proposedIntent.modelAudit;
            const observer = modelAudit.model === "proof-grounded-creature-twin"
              ? "receiz-twin-local" as const
              : "receiz-twin" as const;
            const reply = normalizeCreatureTwinReply(subjectObservation.twin.spokenResponse, brain.identity.name);
            const turn = createObservedCreatureTurn({
              brain,
              ownerActorId: actor.actorId,
              message: input.message,
              reply,
              observer,
              observedAt: new Date().toISOString(),
              ...(input.clientUserMessageId ? { clientUserMessageId: input.clientUserMessageId } : {})
            });
            send({
              type: "reply_done",
              ok: true,
              observer,
              turn,
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
              intelligence: {
                genuine: observer === "receiz-twin",
                provider: modelAudit.provider,
                model: modelAudit.model,
                version: modelAudit.version,
                outputDigest: modelAudit.outputDigest
              },
              moment: presentKaiMoment
            });
          } catch (cause) {
            send({ type: "error", error: cause instanceof Error ? cause.message : "creature_observer_unavailable" });
          } finally {
            controller.close();
          }
        })();
      },
      cancel() { /* The request signal terminates upstream fetches. */ }
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      }
    });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "creature_observer_unavailable";
    return json({ ok: false, error }, failureStatus(error));
  }
}
