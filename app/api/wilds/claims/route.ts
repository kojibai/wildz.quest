import { NextRequest, NextResponse } from "next/server";
import { receizKaiNow } from "@receiz/sdk";
import { decodeWildsPortableClaim } from "@/features/play/wilds-portable-claim";
import { appendWildsDirectMessage } from "@/features/play/wilds-messenger-ledger";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { claimWildsCardTransfer } from "@/lib/receiz/wilds-card-transfer";
import { publishWildsConversation } from "@/lib/receiz/wilds-messenger-server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";
import {
  executeWildsPortableClaim,
  prepareWildsPortableClaimAuthoritySession
} from "@/lib/receiz/wilds-portable-claim-runtime";
import type { WildsWalletReadAuthority } from "@/lib/receiz/wilds-wallet-route-authority";

function failure(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wilds_portable_claim_failed";
  const status = /authority_required|recipient_mismatch/.test(error) ? 403
    : /expired/.test(error) ? 410
      : /invalid|mismatch|encoding|carrier|clock/.test(error) ? 400
        : /zero-write|stale|conflict/.test(error) ? 409 : 503;
  return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.proof !== "string") throw new Error("wilds_portable_claim_encoding_invalid");
    const claim = decodeWildsPortableClaim(body.proof);
    const actor = await resolveWildsMultiplayerActor(request);
    if (!actor.accessToken || actor.practice) throw new Error("receiz_wallet_authority_required");
    const authority: WildsWalletReadAuthority = Object.freeze({
      accessToken: actor.accessToken,
      ownerReceizId: actor.receizActorId,
      actorId: actor.playerId,
      profileHandle: actor.handle
    });
    const rail = createReceizCommerceAdapter({ accessToken: actor.accessToken });

    if (claim.carrier.kind === "bearer-card") {
      const admission = await claimWildsCardTransfer({ authority, offer: claim.carrier.offer, rail });
      const conversation = appendWildsDirectMessage({
        sender: { id: actor.playerId, handle: actor.handle },
        recipient: { id: admission.sourceHandle, handle: admission.sourceHandle },
        body: `Card received: ${admission.card.manifest.name}`,
        clientMessageId: claim.claimId,
        context: {
          kind: "card-transfer",
          card: admission.card,
          subjectId: admission.subjectId,
          transferId: admission.receipt.transferId,
          receiptId: admission.receipt.receiptId,
          sourceHandle: admission.sourceHandle,
          targetHandle: admission.targetHandle,
          priorOwnerReceizId: admission.receipt.priorOwnerReceizId,
          nextOwnerReceizId: admission.receipt.nextOwnerReceizId,
          status: "claimed"
        }
      }).conversation;
      void publishWildsConversation(request, actor, conversation).catch(() => undefined);
      return NextResponse.json({ ok: true, status: "committed", claimId: claim.claimId, kind: claim.kind, admission }, { headers: { "cache-control": "private, no-store" } });
    }

    const authoritySessionInput = await prepareWildsPortableClaimAuthoritySession({
      claim,
      actor,
      executionProof: body.executionProof,
      rail
    });
    const outcome = await executeWildsPortableClaim({
      claim,
      currentKai: receizKaiNow().pulse,
      authority,
      authoritySessionInput,
      rail
    });
    if (outcome.status !== "committed") {
      return NextResponse.json({ ok: false, status: outcome.status, claimId: claim.claimId, reasonCode: outcome.reasonCode }, { status: 409, headers: { "cache-control": "private, no-store" } });
    }
    const conversation = appendWildsDirectMessage({
      sender: { id: actor.playerId, handle: actor.handle },
      recipient: { id: claim.source.ownerReceizId, handle: claim.source.ownerReceizId },
      body: `Claimed ${claim.title}`,
      clientMessageId: claim.claimId,
      context: {
        kind: "portable-claim",
        claimId: claim.claimId,
        claimKind: claim.kind,
        title: claim.title,
        status: "committed",
        executionId: outcome.executionId
      }
    }).conversation;
    void publishWildsConversation(request, actor, conversation).catch(() => undefined);
    return NextResponse.json({ ok: true, status: "committed", claimId: claim.claimId, kind: claim.kind, outcome }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    return failure(cause);
  }
}
