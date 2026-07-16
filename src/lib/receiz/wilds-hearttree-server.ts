import type { NextRequest } from "next/server";
import type { JsonObject } from "@receiz/sdk";
import { emptyHearttreeCondition, projectHearttreeCard, type HearttreeCardCondition } from "@/features/play/hearttree/card-capability";
import { applyHearttreeConsequences, projectHearttreeConsequences, type HearttreeConsequenceSet, type HearttreeMortalConsent } from "@/features/play/hearttree/consequences";
import type { HearttreeExpeditionDefinition } from "@/features/play/hearttree/expedition-director";
import { sealHearttreeReceipt, type HearttreeReceipt } from "@/features/play/hearttree/receipt";
import { replayHearttreeTranscript, type HearttreeTranscript } from "@/features/play/hearttree/transcript";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import { platform } from "@/lib/platform";
import { createReceizCommerceAdapter } from "./adapter";
import { resolveWildsMultiplayerActor, type WildsMultiplayerActor } from "./wilds-multiplayer-server";

export type HearttreeAdmissionProjection = Readonly<{
  schema: "receiz.wilds.hearttree_projection.v1";
  actorId: string;
  revision: number;
  conditions: Readonly<Record<string, HearttreeCardCondition>>;
  receiptTail: readonly HearttreeReceipt[];
}>;

export type HearttreeAdmissionDependencies = {
  resolveActor(request: NextRequest, guestId?: unknown): Promise<WildsMultiplayerActor>;
  publish(request: NextRequest, actor: WildsMultiplayerActor, projection: HearttreeAdmissionProjection, idempotencyKey: string): Promise<boolean>;
  audit(request: NextRequest, actor: WildsMultiplayerActor, receipt: HearttreeReceipt): Promise<boolean>;
  now(): string;
};

type HearttreeAdmissionBody = Readonly<{
  guestId?: unknown;
  idempotencyKey: string;
  cards: readonly PortableCardAsset[];
  priorConditions: Readonly<Record<string, HearttreeCardCondition>>;
  definition: HearttreeExpeditionDefinition;
  transcript: HearttreeTranscript;
  mortalConsent: HearttreeMortalConsent | null;
}>;

type HearttreeAdmissionResult = Readonly<{
  receipt: HearttreeReceipt | null;
  preview: HearttreeConsequenceSet;
  projection: HearttreeAdmissionProjection | null;
  publication: Readonly<{ published: boolean; mode: "receiz_live" | "local_practice"; revision: number }>;
}>;

const ledgerKey = Symbol.for("receiz.wilds.hearttree.admission.v1");
type Ledger = { projections: Map<string, HearttreeAdmissionProjection>; results: Map<string, HearttreeAdmissionResult> };
function ledger() {
  const root = globalThis as typeof globalThis & { [ledgerKey]?: Ledger };
  return (root[ledgerKey] ??= { projections: new Map(), results: new Map() });
}

function origin(request: NextRequest) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host ?? platform.domain;
  const protocol = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${protocol}://${host}`;
}

const defaultDependencies: HearttreeAdmissionDependencies = {
  resolveActor: resolveWildsMultiplayerActor,
  async publish(request, actor, projection, idempotencyKey) {
    if (!actor.accessToken) return false;
    const sourceUrl = `${origin(request)}/api/wilds/hearttree`;
    try {
      const result = await createReceizCommerceAdapter({ accessToken: actor.accessToken }).publishPublicStore({
        tenantHost: new URL(sourceUrl).host,
        merchantReceizId: actor.handle,
        title: "Receiz Wilds Hearttree record",
        sourceUrl,
        namespace: `wilds:hearttree:v1:${actor.playerId}`,
        projectionState: "published",
        platform: platform.productName,
        state: projection as unknown as JsonObject
      }, { idempotencyKey });
      return !(result && typeof result === "object" && "ok" in result && result.ok === false);
    } catch {
      return false;
    }
  },
  async audit(_request, actor, receipt) {
    if (!actor.accessToken) return false;
    try {
      await createReceizCommerceAdapter({ accessToken: actor.accessToken }).auditAppend({
        tenantHost: platform.domain,
        action: `wilds.hearttree:${receipt.digest}`,
        actorReceizId: actor.handle
      }, { idempotencyKey: `hearttree:${receipt.digest}` });
      return true;
    } catch {
      return false;
    }
  },
  now: () => new Date().toISOString()
};

function bodyValue(value: unknown): HearttreeAdmissionBody {
  if (!value || typeof value !== "object") throw new Error("hearttree_admission_body_invalid");
  const body = value as Partial<HearttreeAdmissionBody>;
  if (typeof body.idempotencyKey !== "string" || !/^[a-z0-9:_-]{8,128}$/i.test(body.idempotencyKey)) throw new Error("hearttree_idempotency_invalid");
  if (!Array.isArray(body.cards) || body.cards.length < 1 || body.cards.length > 3 || !body.priorConditions || !body.definition || !body.transcript) throw new Error("hearttree_admission_body_invalid");
  return body as HearttreeAdmissionBody;
}

function authorizeCards(actor: WildsMultiplayerActor, body: HearttreeAdmissionBody) {
  return body.cards.map((card) => {
    if (!verifyAnyWildsCard(card).ok) throw new Error("hearttree_card_proof_invalid");
    if (!actor.practice && card.manifest.ownerReceizId !== actor.handle && card.manifest.ownerReceizId !== "wilds.player.receiz.id") throw new Error("hearttree_card_owner_invalid");
    const condition = body.priorConditions[card.id] ?? emptyHearttreeCondition(card.id);
    return projectHearttreeCard(card, condition);
  });
}

function nextProjection(actorId: string, previous: HearttreeAdmissionProjection | undefined, prior: Readonly<Record<string, HearttreeCardCondition>>, consequences: HearttreeConsequenceSet, receipt: HearttreeReceipt) {
  const conditions = { ...(previous?.conditions ?? prior) };
  for (const [assetId, consequence] of Object.entries(consequences.cards)) {
    const condition = conditions[assetId];
    if (!condition) throw new Error("hearttree_prior_condition_invalid");
    conditions[assetId] = applyHearttreeConsequences(condition, consequence);
  }
  return {
    schema: "receiz.wilds.hearttree_projection.v1" as const,
    actorId,
    revision: (previous?.revision ?? 0) + 1,
    conditions,
    receiptTail: [...(previous?.receiptTail ?? []), receipt].slice(-32)
  };
}

export async function executeHearttreeAdmission(request: NextRequest, rawBody: unknown, dependencies: HearttreeAdmissionDependencies = defaultDependencies): Promise<HearttreeAdmissionResult> {
  const body = bodyValue(rawBody);
  const actor = await dependencies.resolveActor(request, body.guestId);
  const cacheKey = `${actor.playerId}:${body.idempotencyKey}`;
  const cached = ledger().results.get(cacheKey);
  if (cached) return cached;
  const squad = authorizeCards(actor, body);
  const replayed = replayHearttreeTranscript(body.definition, squad, body.transcript);
  const replay = { ...replayed, transcriptDigest: body.transcript.digest };
  const preview = projectHearttreeConsequences({ definition: body.definition, replay, priorConditions: body.priorConditions, mortalConsent: body.mortalConsent });
  if (actor.practice) {
    const result: HearttreeAdmissionResult = { receipt: null, preview, projection: null, publication: { published: false, mode: "local_practice", revision: 0 } };
    ledger().results.set(cacheKey, result);
    return result;
  }

  const previous = ledger().projections.get(actor.playerId);
  if (previous) {
    for (const pin of body.definition.squadPins) {
      if (canonicalCondition(previous.conditions[pin.assetId]) !== canonicalCondition(body.priorConditions[pin.assetId])) throw new Error("hearttree_prior_condition_stale");
    }
  }
  const revision = (previous?.revision ?? 0) + 1;
  const receipt = sealHearttreeReceipt({
    definition: body.definition,
    transcript: body.transcript,
    priorConditions: body.priorConditions,
    consequences: preview,
    actorId: actor.playerId,
    publicationRevision: revision,
    createdAt: dependencies.now()
  });
  const projection = nextProjection(actor.playerId, previous, body.priorConditions, preview, receipt);
  if (!await dependencies.publish(request, actor, projection, `hearttree:${receipt.digest}`)) throw new Error("hearttree_canonical_publish_required");
  if (!await dependencies.audit(request, actor, receipt)) throw new Error("hearttree_canonical_audit_required");
  const result: HearttreeAdmissionResult = { receipt, preview, projection, publication: { published: true, mode: "receiz_live", revision } };
  ledger().projections.set(actor.playerId, projection);
  ledger().results.set(cacheKey, result);
  if (ledger().results.size > 512) ledger().results.delete(ledger().results.keys().next().value!);
  return result;
}

function canonicalCondition(condition: HearttreeCardCondition | undefined) {
  return condition ? JSON.stringify(condition) : "";
}

export function resetHearttreeAdmissionForTests() {
  ledger().projections.clear();
  ledger().results.clear();
}
