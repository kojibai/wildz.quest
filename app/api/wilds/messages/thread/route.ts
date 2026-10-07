import { NextRequest, NextResponse } from "next/server";
import {
  appendWildsDirectMessage,
  markWildsConversationRead,
  reactToWildsDirectMessage
} from "@/features/play/wilds-messenger-ledger";
import { wildsConversationSummary } from "@/features/play/wilds-messenger-core";
import {
  hydrateWildsConversation,
  publishWildsConversation
} from "@/lib/receiz/wilds-messenger-server";
import { resolveWildsMultiplayerActor } from "@/lib/receiz/wilds-multiplayer-server";

import { validateResourceOfferMessage } from '@/features/play/wilds-resource-messaging';
import { decodeWildsPortableClaim } from '@/features/play/wilds-portable-claim';
import { sameWildzPlayerCoordinate } from '@/lib/receiz/wildz-player-coordinate';
import { createReceizCommerceAdapter } from '@/lib/receiz/adapter';

function peerFrom(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("wilds_message_peer_required");
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.handle !== "string") throw new Error("wilds_message_peer_required");
  return { id: record.id, handle: record.handle };
}

function phiTransferContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_message_phi_transfer_invalid");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join("\0") !== ["amountPhiMicro", "kind", "rail", "status", "transferReference"].sort().join("\0")
    || record.kind !== "phi-transfer" || record.rail !== "settlement" || record.status !== "committed"
    || typeof record.amountPhiMicro !== "string" || typeof record.transferReference !== "string") {
    throw new Error("wilds_message_phi_transfer_invalid");
  }
  return {
    kind: "phi-transfer" as const,
    amountPhiMicro: record.amountPhiMicro,
    rail: "settlement" as const,
    status: "committed" as const,
    transferReference: record.transferReference
  };
}

function responseError(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "wilds_message_failed";
  const status = error.includes("rate_limited") ? 429 : error.includes("required") || error.includes("invalid") ? 400 : 503;
  return NextResponse.json({ ok: false, error }, { status, headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveWildsMultiplayerActor(request, request.nextUrl.searchParams.get("guestId"));
    const peer = peerFrom({
      id: request.nextUrl.searchParams.get("peerId"),
      handle: request.nextUrl.searchParams.get("peerHandle")
    });
    const conversation = await hydrateWildsConversation(request, actor, peer);
    return NextResponse.json({ ok: true, conversation, summary: wildsConversationSummary(conversation, actor.playerId) }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    return responseError(cause);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const actor = await resolveWildsMultiplayerActor(request, body.guestId);
    const self = { id: actor.playerId, handle: actor.handle };
    const peer = peerFrom(body.peer);
    await hydrateWildsConversation(request, actor, peer);
    const action = body.action;
    let resourceContext;
    if (action === 'resource-offer') {
      if (!actor.accessToken || actor.practice) throw Error('receiz_wallet_authority_required');
      resourceContext = validateResourceOfferMessage(body.context);
      const claim = decodeWildsPortableClaim(resourceContext.claimProof);
      if (claim.source.ownerReceizId !== actor.receizActorId || claim.recipient.handle !== null && !sameWildzPlayerCoordinate(claim.recipient.handle, peer.handle)
        || claim.carrier.kind === 'portable-execution') throw Error('wilds_message_resource_claim_invalid');
      const rail = createReceizCommerceAdapter({ accessToken: actor.accessToken });
      const inspection = await rail.inspectBearerTransferInstrument(claim.carrier.offer.instrument);
      if (!inspection.valid || !inspection.offlineVerified || inspection.instrument.artifactDigest !== claim.carrier.offer.instrument.artifactDigest) throw Error('wilds_message_resource_claim_invalid');
    }
    const conversation = action === "send" || action === "phi-transfer" || action === "resource-offer"
      ? appendWildsDirectMessage({
          sender: self,
          recipient: peer,
          body: String(body.message ?? ""),
          clientMessageId: String(body.clientMessageId ?? ""),
          replyToId: typeof body.replyToId === "string" ? body.replyToId : null,
          ...(action === "phi-transfer" ? { context: phiTransferContext(body.context) } : resourceContext ? { context: resourceContext } : {})
        }).conversation
      : action === "read"
        ? markWildsConversationRead({ left: self, right: peer, actorId: actor.playerId, through: typeof body.through === "string" ? body.through : undefined })
        : action === "react"
          ? reactToWildsDirectMessage({ left: self, right: peer, actorId: actor.playerId, messageId: String(body.messageId ?? ""), emoji: String(body.emoji ?? "") })
          : (() => { throw new Error("wilds_message_action_invalid"); })();
    const publication = await publishWildsConversation(request, actor, conversation);
    return NextResponse.json({ ok: true, conversation, summary: wildsConversationSummary(conversation, actor.playerId), publication }, { headers: { "cache-control": "private, no-store" } });
  } catch (cause) {
    return responseError(cause);
  }
}
