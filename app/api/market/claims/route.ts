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
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { currentWildzOwner } from "@/lib/receiz/wildz-market-state";
import { marketIdempotencyKey, marketRouteError } from "@/lib/receiz/wildz-market-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveWildzCookieActor(request);
    if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return json({ error: "market_bearer_artifact_required", ownershipTransferred: false }, 415);
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) return json({ error: "market_bearer_artifact_required", ownershipTransferred: false }, 400);
    const filename = file instanceof File ? file.name : "wildz-bearer.receized";
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

    const repository = createReceizWildzMarketRepository({
      rail: resolveWildzMarketConditionalAppendRail(adapter)
    });
    let transferred = 0;
    for (const asset of extracted.assets) {
      let loaded = await repository.load();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (loaded.status !== "ready") return json({ status: loaded.status, ownershipTransferred: false }, 503);
        const previousOwnerReceizId = currentWildzOwner(loaded.state, asset);
        if (sameWildzPlayerCoordinate(previousOwnerReceizId, actor.actorId)) break;
        const occurredAt = new Date().toISOString();
        const receipt: WildzOwnershipReceipt = {
          schema: "receiz.wilds_ownership_receipt.v1",
          assetId: asset.id,
          proofDigest: asset.proof.digest,
          previousOwnerReceizId,
          ownerReceizId: actor.actorId,
          transferId: `bearer:${admitted.claimId}:${asset.id}`,
          ledgerEventId: `bearer-ledger:${admitted.artifactSha256}:${asset.id}`,
          proofBundle: {
            schema: "receiz.wilds_bearer_claim.v108",
            artifactSha256: admitted.artifactSha256,
            payloadSha256: admitted.payloadSha256,
            claimId: admitted.claimId,
            recordId: admitted.recordId,
            verifyPath: admitted.verifyPath,
            ownerReceizId: admitted.ownerReceizId
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
          transferred += admission.status === "admitted" ? 1 : 0;
          break;
        }
        if (admission.status !== "market_revision_conflict") {
          return json({ status: admission.status, ownershipTransferred: false }, 503);
        }
        loaded = await repository.load();
      }
    }
    return json({
      status: "admitted",
      ownershipTransferred: transferred > 0,
      ownerReceizId: actor.actorId,
      artifactSha256: admitted.artifactSha256,
      claimId: admitted.claimId,
      verifyPath: admitted.verifyPath,
      assetCount: extracted.assets.length
    }, 201);
  } catch (cause) {
    const failure = marketRouteError(cause, "market_bearer_claim_invalid");
    return json(failure.body, failure.status);
  }
}
