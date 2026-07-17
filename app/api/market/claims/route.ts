import { NextRequest, NextResponse } from "next/server";
import { verifyAnyWildsCard, type PortableCardAsset } from "@/features/play/portable-card";
import type { WildzOwnershipReceipt } from "@/features/market/wildz-market";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail
} from "@/lib/receiz/wildz-market-repository";
import { currentWildzOwner } from "@/lib/receiz/wildz-market-state";
import { assertExactMarketFields, marketIdempotencyKey, marketRouteError } from "@/lib/receiz/wildz-market-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function parseWildzClaimRequest(value: unknown) {
  const body = assertExactMarketFields(value, ["asset"]);
  if (!body.asset || typeof body.asset !== "object" || !/^wilds:[a-f0-9]{24}$/.test(String((body.asset as { id?: unknown }).id ?? ""))) {
    throw new Error("market_asset_invalid");
  }
  const asset = body.asset as PortableCardAsset;
  if (!verifyAnyWildsCard(asset).ok) throw new Error("market_bearer_claim_card_invalid");
  return { asset };
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const { asset } = parseWildzClaimRequest(await request.json().catch(() => null));
    const idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    let loaded = await repository.load();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (loaded.status !== "ready") return json({ status: loaded.status, ownershipTransferred: false }, 503);
      const previousOwnerReceizId = currentWildzOwner(loaded.state, asset);
      if (previousOwnerReceizId === actor.actorId) {
        return json({
          status: "ready",
          ownershipTransferred: false,
          ownerReceizId: actor.actorId,
          head: { revision: loaded.state.revision, appendAnchorId: loaded.state.appendAnchorId }
        });
      }
      const occurredAt = new Date().toISOString();
      const receipt: WildzOwnershipReceipt = {
        schema: "receiz.wilds_ownership_receipt.v1",
        assetId: asset.id,
        proofDigest: asset.proof.digest,
        previousOwnerReceizId,
        ownerReceizId: actor.actorId,
        transferId: `bearer:${asset.id}:${actor.actorId}:${asset.proof.digest.slice(7, 23)}`,
        ledgerEventId: `bearer-ledger:${asset.id}:${actor.actorId}:${asset.proof.digest.slice(7, 23)}`,
        proofBundle: {
          schema: "receiz.wilds_bearer_claim.v1",
          custody: "offline-bearer",
          claimedBy: actor.actorId,
          assetId: asset.id,
          proofDigest: asset.proof.digest
        },
        transferredAt: occurredAt
      };
      const admission = await repository.compareAndAppend({
        current: loaded.state,
        expectedRevision: loaded.state.revision,
        expectedAppendAnchorId: loaded.state.appendAnchorId,
        idempotencyKey,
        occurredAt,
        event: { type: "bearer-claim-admitted", asset, receipt }
      });
      if (admission.status === "admitted" || admission.status === "replayed") {
        return json({
          status: admission.status,
          ownershipTransferred: true,
          ownerReceizId: actor.actorId,
          previousOwnerReceizId,
          head: { revision: admission.state.revision, appendAnchorId: admission.state.appendAnchorId }
        }, admission.status === "admitted" ? 201 : 200);
      }
      if (admission.status !== "market_revision_conflict") return json({ status: admission.status, ownershipTransferred: false }, 503);
      loaded = await repository.load();
    }
    return json({ status: "market_revision_conflict", ownershipTransferred: false }, 409);
  } catch (cause) {
    const failure = marketRouteError(cause, "market_bearer_claim_invalid");
    return json(failure.body, failure.status);
  }
}
