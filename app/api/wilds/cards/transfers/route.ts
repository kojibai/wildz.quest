import { NextRequest, NextResponse } from "next/server";
import type { PortableCardAsset } from "@/features/play/portable-card";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import {
  claimWildsCardTransfer,
  issueWildsCardTransfer,
  type WildsCardTransferOffer
} from "@/lib/receiz/wilds-card-transfer";
import {
  resolveWildsWalletReadAuthority,
  wildsWalletAuthorityStatusFor
} from "@/lib/receiz/wilds-wallet-route-authority";
import { appendWildsDirectMessage } from "@/features/play/wilds-messenger-ledger";
import { publishWildsConversation } from "@/lib/receiz/wilds-messenger-server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";

function failure(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wilds_card_transfer_failed";
  const status = error.startsWith("receiz_wallet_")
    ? wildsWalletAuthorityStatusFor(error)
    : error.includes("recipient") || error.includes("invalid") ? 400
      : error.includes("stale") || error.includes("conflict") || error.includes("expired") ? 409
        : 503;
  return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const authority = await resolveWildsWalletReadAuthority(request);
    const actor = await resolveWildsMultiplayerActor(request);
    const rail = createReceizCommerceAdapter({ accessToken: authority.accessToken });
    if (body.action === "issue") {
      const offer = await issueWildsCardTransfer({
        authority,
        card: body.card as PortableCardAsset,
        targetHandle: String(body.targetHandle ?? ""),
        rail
      });
      const peer = { id: offer.targetHandle, handle: offer.targetHandle };
      const conversation = appendWildsDirectMessage({
        sender: { id: actor.playerId, handle: actor.handle },
        recipient: peer,
        body: `Card offered: ${offer.card.manifest.name}`,
        clientMessageId: `card-offer:${offer.instrument.plan.transferId}`,
        context: { kind: "card-offer", offer }
      }).conversation;
      const publication = await publishWildsConversation(request, actor, conversation);
      return NextResponse.json({ ok: true, offer, conversation, publication }, { headers: { "cache-control": "private, no-store" } });
    }
    if (body.action === "claim") {
      const admission = await claimWildsCardTransfer({
        authority,
        offer: body.offer as WildsCardTransferOffer,
        rail
      });
      const conversation = appendWildsDirectMessage({
        sender: { id: actor.playerId, handle: actor.handle },
        recipient: { id: admission.sourceHandle, handle: admission.sourceHandle },
        body: `Card received: ${admission.card.manifest.name}`,
        clientMessageId: `card-transfer:${admission.receipt.transferId}`,
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
      const publication = await publishWildsConversation(request, actor, conversation);
      return NextResponse.json({ ok: true, admission, conversation, publication }, { headers: { "cache-control": "private, no-store" } });
    }
    throw new Error("wilds_card_transfer_action_invalid");
  } catch (cause) {
    return failure(cause);
  }
}
