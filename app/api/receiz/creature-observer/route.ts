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
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import { observeCreatureThroughReceizV120 } from "@/features/play/receiz-v120-creature-subject";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function failureStatus(error: string) {
  if (error === "receiz_authority_required") return 401;
  if (error === "receiz_profile_required"
    || error === "receiz_identity_key_required"
    || error === "creature_observer_owner_mismatch") return 403;
  if (error === "creature_observer_request_invalid" || error === "creature_observer_card_invalid") return 422;
  return 502;
}

function isTwinFailureBoundary(input: Readonly<{ model?: string; speech?: string }>) {
  return input.model === "model-failure-boundary"
    || /could not form a response|no world event was created/i.test(input.speech ?? "");
}

export async function POST(request: NextRequest) {
  try {
    const input = parseCreatureObserverRequest(await request.json().catch(() => null));
    const brain = projectCreatureBrain(input.card);
    const presentKaiMoment = creatureObserverMomentContext(input.kai, brain);
    const actor = await resolveWildzCookieActor(request);
    if (actor.actorId !== input.card.manifest.ownerReceizId) {
      throw new Error("creature_observer_owner_mismatch");
    }
    const receiz = createReceizClient({
      ...(process.env.RECEIZ_BASE_URL ? { baseUrl: process.env.RECEIZ_BASE_URL } : {}),
      ...(actor.accessToken ? { accessToken: actor.accessToken } : {})
    });
    const clientOperationId = input.clientUserMessageId ?? `creature-message:${brain.contextDigest.slice(7, 39)}`;
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
          `The owner says: ${input.message}`
        ].join("\n\n");
        const exactSubjectTwin = actor.accessToken ? receiz.subjects.twin.message(input.card.id, {
            message: groundedMessage,
            ownerReceizId: actor.actorId,
            threadKey: creatureObserverThreadKey(input.card.id),
            contextHead: proofContext.head.subjectHead,
            expectedSubjectDigest: proofContext.head.subjectDigest,
            responseMode: "performance",
            clientMessageId: clientOperationId
          }).then((response) => {
            if (response.schema !== "receiz.subject.twin_result.v1"
              || response.subjectId !== input.card.id
              || response.subjectHead !== proofContext.head.subjectHead
              || response.proofContext.head.subjectDigest !== proofContext.head.subjectDigest
              || response.authority.modelOutputIsWorldEvent !== false
              || response.worldEventIds.length !== 0
              || response.proposedIntent.modelAudit.model === "model-failure-boundary") {
              throw new Error("creature_observer_intelligence_unavailable");
            }
            return {
              provider: response.proposedIntent.modelAudit.provider,
              model: response.proposedIntent.modelAudit.model,
              version: response.proposedIntent.modelAudit.version,
              speech: normalizeCreatureTwinReply(response.spokenResponse),
              performance: response.performance ?? {}
            };
          }) : null;
        const receizIdTwinObserver = receiz.world.message(actor.actorId, {
          action: "message",
          message: input.message,
          visitorKey: creatureObserverVisitorKey(actor.actorId),
          threadKey: creatureObserverThreadKey(input.card.id),
          allowBrowserVoiceFallback: true,
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
          clientOperationId
        }).then((response) => {
          if (response.ok !== true) throw new Error(response.error || "creature_observer_intelligence_unavailable");
          return {
            provider: "receiz",
            model: "receiz-id-twin-observer",
            version: "120.0.0",
            speech: normalizeCreatureTwinReply(response.reply),
            performance: {}
          };
        });
        const observerRequests = exactSubjectTwin
          ? [exactSubjectTwin, receizIdTwinObserver]
          : [receizIdTwinObserver];
        const observed = await Promise.race([
          Promise.any(observerRequests),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("creature_observer_timeout")), 12_000))
        ]).catch(() => null);
        if (!observed || isTwinFailureBoundary({ model: observed.model, speech: observed.speech })) {
          return {
            provider: "wildz-proof-brain",
            model: "proof-grounded-creature-twin",
            version: "120.0.0",
            speech: localCreatureTwinReply(subjectBrain, input.message),
            performance: {
              ...subjectBrain.performance.expression,
              proofContextDigest: proofContext.receipt.queryDigest,
              authoritative: false,
              responseRail: "proof-grounded-local"
            }
          };
        }
        return {
          provider: observed.provider,
          model: observed.model,
          version: observed.version,
          speech: observed.speech,
          performance: {
            ...subjectBrain.performance.expression,
            ...observed.performance,
            proofContextDigest: proofContext.receipt.queryDigest,
            authoritative: false
          }
        };
      }
    });
    const modelAudit = subjectObservation.twin.proposedIntent.modelAudit;
    const fellThroughSdkFailureBoundary = isTwinFailureBoundary({
      model: modelAudit.model,
      speech: subjectObservation.twin.spokenResponse
    });
    const observer = modelAudit.model === "proof-grounded-creature-twin" || fellThroughSdkFailureBoundary
      ? "receiz-twin-local" as const
      : "receiz-twin" as const;
    const reply = fellThroughSdkFailureBoundary
      ? localCreatureTwinReply(brain, input.message)
      : normalizeCreatureTwinReply(subjectObservation.twin.spokenResponse);
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
