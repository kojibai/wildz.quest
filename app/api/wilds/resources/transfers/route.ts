import { NextRequest, NextResponse } from "next/server";
import { createWildsMaterialPortableClaim, createWildsResourcePortableClaim, encodeWildsPortableClaim, wildsPortableClaimUrl } from "@/features/play/wilds-portable-claim";
import type { WildsResourceLotV1 } from "@/features/play/wilds-resource-lot";
import type { WildsMaterialLotV1 } from "@/features/play/wilds-steward-construction";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { issueWildsMaterialTransfer, issueWildsResourceTransfer } from "@/lib/receiz/wilds-resource-transfer";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import type { WildsWalletReadAuthority } from "@/lib/receiz/wilds-wallet-route-authority";

function failure(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wilds_resource_transfer_failed";
  const status = /authority_required/.test(error) ? 403 : /recipient|invalid|owner/.test(error) ? 400 : /stale|conflict|expired/.test(error) ? 409 : 503;
  return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveWildsMultiplayerActor(request);
    if (!actor.accessToken || actor.practice) throw new Error("receiz_wallet_authority_required");
    const authority: WildsWalletReadAuthority = Object.freeze({
      accessToken: actor.accessToken, ownerReceizId: actor.receizActorId, actorId: actor.playerId, profileHandle: actor.handle
    });
    const rail = createReceizCommerceAdapter({ accessToken: actor.accessToken });
    const material = body.materialLot !== undefined;
    const offer = material
      ? await issueWildsMaterialTransfer({ authority, materialLot: body.materialLot as WildsMaterialLotV1, targetHandle: String(body.targetHandle ?? ""), rail })
      : await issueWildsResourceTransfer({ authority, resourceLot: body.resourceLot as WildsResourceLotV1, targetHandle: String(body.targetHandle ?? ""), rail });
    const claim = material ? createWildsMaterialPortableClaim(offer as Awaited<ReturnType<typeof issueWildsMaterialTransfer>>) : createWildsResourcePortableClaim(offer as Awaited<ReturnType<typeof issueWildsResourceTransfer>>);
    const claimProof = encodeWildsPortableClaim(claim);
    return NextResponse.json({
      ok: true,
      offer,
      claimId: claim.claimId,
      claimProof,
      claimUrl: wildsPortableClaimUrl(request.nextUrl.origin, claim)
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    return failure(cause);
  }
}
