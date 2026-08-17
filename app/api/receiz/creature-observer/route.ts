import { NextRequest, NextResponse } from "next/server";
import { createReceizClient } from "@receiz/sdk";
import {
  createObservedCreatureTurn,
  creatureObserverClientContext,
  creatureObserverMomentContext,
  creatureObserverThreadKey,
  creatureObserverVisitorKey,
  normalizeCreatureTwinReply,
  parseCreatureObserverRequest,
  projectVerifiedCreatureBrain
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isTwinFailureBoundary(input: Readonly<{ model?: string; speech?: string }>) {
  return input.model === "model-failure-boundary"
    || /could not form a response|no world event was created/i.test(input.speech ?? "");
}

function finalPerformanceAudio(performance: Readonly<Record<string, unknown>>) {
  const direct = typeof performance.audioB64u === "string" ? performance.audioB64u : "";
  const asset = asRecord(performance.audioAsset);
  const dataUrl = typeof asset?.dataUrl === "string" ? asset.dataUrl : "";
  const encoded = dataUrl.match(/^data:audio\/(?:wav|wave|mpeg|mp3|ogg|webm|mp4);base64,([a-z0-9+/=_-]+)$/i)?.[1]
    ?? direct;
  if (!encoded || encoded.length > 6_000_000) return null;
  return {
    type: "audio_chunk" as const,
    audioB64u: encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    startMs: 0,
    endMs: typeof asset?.durationMs === "number" && Number.isFinite(asset.durationMs)
      ? Math.max(0, Math.min(120_000, Math.round(asset.durationMs)))
      : 0
  };
}

function upstreamWorldSpeech(value: unknown, creatureName: string) {
  const reply = asRecord(value);
  if (!reply || reply.source !== "upstream") throw new Error("creature_observer_intelligence_unavailable");
  return normalizeCreatureTwinReply(reply, creatureName);
}

function upstreamWorldPerformance(value: unknown) {
  return asRecord(asRecord(value)?.performance) ?? {};
}

export async function POST(request: NextRequest) {
  try {
    const input = parseCreatureObserverRequest(await request.json().catch(() => null));
    const brain = projectVerifiedCreatureBrain(input.card);
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
    const clientOperationId = input.clientUserMessageId ?? `creature-message:${brain.contextDigest.slice(7, 39)}`;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (value: unknown) => controller.enqueue(eventBytes(value));
        send({ type: "reply_start", voiceSignature: brain.performance.expression.voiceSignature, startedAt: Date.now() });
        void (async () => {
          try {
            const subjectObservation = await observeCreatureThroughReceizV120({
              asset: input.card,
              brain,
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
                let completed = false;
                let audioSent = false;
                let finalPerformance: Readonly<Record<string, unknown>> = {};
                try {
                  for await (const event of receiz.subjects.twin.streamPerformance(input.card.id, {
                    message: groundedMessage,
                    ownerReceizId: actor.actorId,
                    threadKey: creatureObserverThreadKey(input.card.id),
                    contextHead: proofContext.head.subjectHead,
                    expectedSubjectDigest: proofContext.head.subjectDigest,
                    responseMode: "performance",
                    clientMessageId: clientOperationId
                  })) {
                    if (request.signal.aborted) throw new Error("request_aborted");
                    if (event.type === "reply_delta" && event.text) {
                      speech += event.text;
                      send({ type: "reply_delta", delta: event.text });
                    }
                    if (event.type === "audio_chunk") {
                      audioSent = true;
                      send({
                        ...event,
                        voiceSignature: subjectBrain.performance.expression.voiceSignature,
                        source: "receiz-v120-proof-performance"
                      });
                    }
                    if (["viseme", "gaze", "blink", "breath", "emotion", "gesture", "intent_proposed"].includes(event.type)) {
                      send({ type: "performance_event", event });
                    }
                    if (event.type === "reply_done") {
                      completed = true;
                      finalPerformance = event.result.performance ?? {};
                      if (!speech && event.result.spokenResponse) {
                        speech = event.result.spokenResponse;
                        send({ type: "reply_delta", delta: speech });
                      }
                    }
                  }
                } catch {
                  completed = false;
                }
                const failedBoundary = isTwinFailureBoundary({
                  model: typeof finalPerformance.model === "string" ? finalPerformance.model : undefined,
                  speech
                });
                if (!completed || !speech.trim() || failedBoundary) {
                  try {
                    const worldResponse = await receiz.world.message("wildz", {
                      action: "message",
                      message: groundedMessage,
                      visitorKey: creatureObserverVisitorKey(actor.actorId),
                      threadKey: creatureObserverThreadKey(input.card.id),
                      allowBrowserVoiceFallback: false,
                      clientContext: observerContext,
                      clientUserMessageId: clientOperationId,
                      clientOperationId,
                      quoteExpiresAt: new Date(Date.now() + 9 * 60_000).toISOString()
                    });
                    if (worldResponse.ok !== true) throw new Error(worldResponse.error || "creature_observer_intelligence_unavailable");
                    const worldSpeech = upstreamWorldSpeech(worldResponse.reply, subjectBrain.identity.name);
                    if (isTwinFailureBoundary({ speech: worldSpeech })) throw new Error("creature_observer_intelligence_unavailable");
                    const worldPerformance = upstreamWorldPerformance(worldResponse.reply);
                    send({ type: "reply_reset", text: worldSpeech });
                    const worldAudio = finalPerformanceAudio(worldPerformance);
                    if (worldAudio) send({
                      ...worldAudio,
                      voiceSignature: subjectBrain.performance.expression.voiceSignature,
                      source: "receiz-v120-proof-performance"
                    });
                    return {
                      provider: "receiz",
                      model: "receiz-world-twin-upstream",
                      version: "120.0.0",
                      speech: worldSpeech,
                      performance: {
                        ...subjectBrain.performance.expression,
                        ...worldPerformance,
                        proofContextDigest: proofContext.receipt.queryDigest,
                        generatedAudio: Boolean(worldAudio),
                        authoritative: false,
                        responseRail: "receiz-world-twin-upstream"
                      }
                    };
                  } catch {
                    throw new Error("creature_observer_intelligence_unavailable");
                  }
                }
                const finalAudio = audioSent ? null : finalPerformanceAudio(finalPerformance);
                if (finalAudio) {
                  audioSent = true;
                  send({
                    ...finalAudio,
                    voiceSignature: subjectBrain.performance.expression.voiceSignature,
                    source: "receiz-v120-proof-performance"
                  });
                }
                return {
                  provider: "receiz",
                  model: "receiz-subject-twin-performance",
                  version: "120.0.0",
                  speech: normalizeCreatureTwinReply(speech, subjectBrain.identity.name),
                  performance: {
                    ...subjectBrain.performance.expression,
                    ...finalPerformance,
                    voiceSignature: subjectBrain.performance.expression.voiceSignature,
                    neuralInterface: subjectBrain.performance.neuralInterface,
                    proofContextDigest: proofContext.receipt.queryDigest,
                    generatedAudio: audioSent,
                    authoritative: false,
                    responseRail: "receiz-subject-twin-performance"
                  }
                };
              }
            });
            const modelAudit = subjectObservation.twin.proposedIntent.modelAudit;
            const observer = "receiz-twin" as const;
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
              voice: {
                generated: asRecord(subjectObservation.twin.performance)?.generatedAudio === true,
                signature: brain.performance.expression.voiceSignature,
                authority: false
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
