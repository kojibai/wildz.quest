import { NextRequest, NextResponse } from "next/server";
import type { WildzOwnershipReceipt } from "@/features/market/wildz-market";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { claimWildzBearerArtifact } from "@/lib/receiz/wildz-bearer-ownership";
import { extractVerifiedWildzCards } from "@/lib/receiz/wildz-cross-platform-cards";
import { resolveWildzCookieActor } from "@/lib/receiz/wildz-cookie-actor";
import {
  createReceizWildzMarketRepository,
  resolveWildzMarketConditionalAppendRail
} from "@/lib/receiz/wildz-market-repository";
import { publishWildzOwnershipSyncProjection } from "@/lib/receiz/wildz-ownership-reconcile";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { marketIdempotencyKey, marketRouteError } from "@/lib/receiz/wildz-market-route";
import { readWildzHttpArtifact } from "@/lib/receiz/wildz-http-artifact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function claimedArtifactResponse(
  admitted: Awaited<ReturnType<typeof claimWildzBearerArtifact>>,
  assetIds: readonly string[],
  marketProjection: "admitted" | "unavailable",
  ownershipSync: "admitted" | "unavailable"
) {
  return new NextResponse(admitted.artifactBytes.slice().buffer, {
    status: 201,
    headers: {
      "cache-control": "no-store",
      "content-type": admitted.mimeType,
      "content-disposition": `attachment; filename="${admitted.filename.replace(/["\\]/g, "_")}"`,
      "x-receiz-owner": admitted.ownerReceizId,
      "x-receiz-claim-id": admitted.claimId,
      "x-receiz-verify-path": admitted.verifyPath,
      "x-receiz-artifact-sha256": admitted.artifactSha256,
      "x-wildz-asset-ids": assetIds.join(","),
      "x-wildz-market-projection": marketProjection,
      "x-wildz-ownership-sync": ownershipSync
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    const uploaded = await readWildzHttpArtifact(request, {
      fallbackFilename: "wildz-bearer.receized",
      maximumBytes: 64 * 1024 * 1024
    });
    const file = new File([uploaded.bytes.slice().buffer], uploaded.filename, { type: uploaded.mimeType });
    const filename = uploaded.filename;
    const idempotencyKey = marketIdempotencyKey(request.headers);
    const adapter = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const admitted = await claimWildzBearerArtifact(file, filename, {
      artifacts: adapter.client.artifacts,
      ownership: adapter.client.ownership
    });
    if (!sameWildzPlayerCoordinate(admitted.ownerReceizId, actor.actorId)) {
      throw new Error("market_bearer_claim_owner_mismatch");
    }
    const extracted = extractVerifiedWildzCards({
      pngBasis: null,
      verifiedPortableSnapshot: null,
      restoredVaultFiles: [],
      proofObjectPayload: { bytes: admitted.payloadBytes, mimeType: admitted.mimeType }
    });
    if (!extracted.assets.length) throw new Error("market_bearer_claim_card_invalid");
    const ownershipWitness = admitted.ownershipWitness;
    if (!ownershipWitness
      || !sameWildzPlayerCoordinate(ownershipWitness.ownerReceizId, actor.actorId)) {
      throw new Error("market_bearer_claim_witness_invalid");
    }
    const assetIds = extracted.assets.map((asset) => asset.id);
    const ownershipSync = await publishWildzOwnershipSyncProjection(
      adapter.client.appState,
      ownershipWitness,
      assetIds,
      idempotencyKey
    );

    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    let marketProjection: "admitted" | "unavailable" = "admitted";
    for (const asset of extracted.assets) {
      let loaded = await repository.load();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (loaded.status !== "ready") {
          marketProjection = "unavailable";
          break;
        }
        const previousOwnerReceizId = ownershipWitness.previousOwnerReceizId;
        if (sameWildzPlayerCoordinate(previousOwnerReceizId, actor.actorId)) break;
        const occurredAt = ownershipWitness.witnessedAt;
        const receipt: WildzOwnershipReceipt = {
          schema: "receiz.wilds_ownership_receipt.v1",
          assetId: asset.id,
          proofDigest: asset.proof.digest,
          previousOwnerReceizId,
          ownerReceizId: actor.actorId,
          transferId: `bearer:${admitted.claimId}:${asset.id}`,
          ledgerEventId: `bearer-ledger:${admitted.artifactSha256}:${asset.id}`,
          proofBundle: {
            schema: "receiz.wilds_bearer_claim.v120",
            artifactSha256: admitted.artifactSha256,
            payloadSha256: admitted.payloadSha256,
            claimId: admitted.claimId,
            recordId: admitted.recordId,
            verifyPath: admitted.verifyPath,
            ownerReceizId: admitted.ownerReceizId,
            ownershipArtifactId: ownershipWitness.artifactId,
            ownershipHeadReference: ownershipWitness.headReference,
            ownershipHistoryDigestSha256: ownershipWitness.historyDigestSha256,
            ownershipAppendCount: ownershipWitness.appendCount,
            witnessedKaiPulse: ownershipWitness.witnessedKaiPulse,
            witnessedAt: ownershipWitness.witnessedAt,
            authority: {
              claim: "witnessed-kai-pulse-in-sealed-artifact",
              server: "synchronization-projection-only"
            }
          },
          transferredAt: occurredAt
        };
        const admission = await repository.compareAndAppend({
          current: loaded.state,
          expectedRevision: loaded.state.revision,
          expectedAppendAnchorId: loaded.state.appendAnchorId,
          idempotencyKey: `${idempotencyKey}:${asset.id}`,
          occurredAt,
          event: { type: "bearer-claim-admitted", asset, receipt }
        });
        if (admission.status === "admitted" || admission.status === "replayed") {
          break;
        }
        if (admission.status !== "market_revision_conflict") {
          marketProjection = "unavailable";
          break;
        }
        loaded = await repository.load();
      }
    }
    return claimedArtifactResponse(admitted, assetIds, marketProjection, ownershipSync);
  } catch (cause) {
    const failure = marketRouteError(cause, "market_bearer_claim_invalid");
    return json(failure.body, failure.status);
  }
}
