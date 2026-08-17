import { NextRequest, NextResponse } from "next/server";
import { createReceizClient } from "@receiz/sdk";
import {
  createObservedCreatureTurn,
  creatureObserverClientContext,
  creatureObserverMomentContext,
  creatureObserverThreadKey,
  creatureObserverVisitorKey,
  proofGroundedCreatureReply,
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
const PERFORMANCE_ENRICHMENT_BUDGET_MS = 2_500;

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

function withinPerformanceBudget<T>(promise: Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      timeout = setTimeout(() => resolve(null), PERFORMANCE_ENRICHMENT_BUDGET_MS);
    })
  ]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
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
        let closed = false;
        const send = (value: unknown) => {
          if (!closed && !request.signal.aborted) controller.enqueue(eventBytes(value));
        };
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
                const speech = proofGroundedCreatureReply(subjectBrain, input.message, presentKaiMoment.temporalRoot.uPulse);
                send({ type: "reply_reset", text: speech });
                const performanceMessage = [
                  observerContext.instruction,
                  `Present Kai causal context: ${JSON.stringify(observerContext.presentKaiMoment)}`,
                  `The person's message was: ${input.message}`,
                  `Perform this exact proof-derived response without changing its words: ${speech}`
                ].join("\n\n");
                const enrichedAudio = withinPerformanceBudget(receiz.world.message("wildz", {
                  action: "message",
                  message: performanceMessage,
                  visitorKey: creatureObserverVisitorKey(actor.actorId),
                  threadKey: creatureObserverThreadKey(input.card.id),
                  allowBrowserVoiceFallback: false,
                  clientContext: observerContext,
                  clientUserMessageId: clientOperationId,
                  clientOperationId,
                  quoteExpiresAt: new Date(Date.now() + 9 * 60_000).toISOString()
                }).then((worldResponse) => {
                  if (worldResponse.ok !== true) throw new Error(worldResponse.error || "creature_observer_intelligence_unavailable");
                  const reply = asRecord(worldResponse.reply);
                  if (!reply || reply.source !== "upstream") return null;
                  return finalPerformanceAudio(upstreamWorldPerformance(reply));
                }).catch(() => null));
                void enrichedAudio.then((audio) => {
                  if (audio && !request.signal.aborted) send({
                    ...audio,
                    voiceSignature: subjectBrain.performance.expression.voiceSignature,
                    source: "receiz-v120-proof-performance"
                  });
                }).catch(() => { /* Enrichment never affects the proof response rail. */ });
                return {
                  provider: "wildz-proof-brain",
                  model: "proof-grounded-creature-twin",
                  version: "120.0.0",
                  speech,
                  performance: {
                    ...subjectBrain.performance.expression,
                    voiceSignature: subjectBrain.performance.expression.voiceSignature,
                    neuralInterface: subjectBrain.performance.neuralInterface,
                    proofContextDigest: proofContext.receipt.queryDigest,
                    generatedAudio: false,
                    authoritative: false,
                    responseRail: "proof-grounded-local"
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
            closed = true;
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
