import "server-only";
import type { NextRequest } from "next/server";
import type { WildsDirectMessage, WildsMessengerParticipant } from "@/features/play/wilds-messenger-core";
import { appendWildsDirectMessage } from "@/features/play/wilds-messenger-ledger";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
import { wildsWalletTradeMessageId } from "@/features/play/wallet/wilds-wallet-trade-messaging";
import { wildzMarketOfferMessageId } from "@/features/market/wildz-market-offers";
import { createWildzReceizChatClient, readWildzReceizChatSessionForIdentity } from "./wildz-receiz-chat-session";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { readWildzProofSessionCookie } from "./wildz-proof-session";

const carrierKind = "wildz_trade_message";
const inboxPath = "/api/chat/conversations?appMessage=wildz-trade";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
const sourceKinds = new Set([
  "trade-package", "trade-staged-approval", "trade-staged-progress",
  "trade-bearer-source", "trade-bearer-accepted", "trade-resource-source", "trade-resource-accepted",
  "market-offer", "market-offer-response", "resource-offer",
]);

export const isWildzPrivateTradeMessage = (value: unknown) => {
  const kind = asObject(value)?.kind;
  return typeof kind === "string" && sourceKinds.has(kind);
};

const unavailable = (): never => { throw Error("wildz_private_trade_delivery_pending"); };
function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function directThread(value: unknown, viewerId: string, viewerHandle: string, expectedPeer?: string) {
  const thread = asObject(value);
  if (!thread || typeof thread.id !== "string" || !uuid.test(thread.id) || !Array.isArray(thread.members) || thread.members.length !== 2) return unavailable();
  const members = thread.members.map(member => {
    const record = asObject(member);
    const handle = typeof record?.username === "string" ? parseWildzPlayerCoordinate(record.username)?.profileHandle : null;
    if (!handle || typeof record?.userId !== "string" || !uuid.test(record.userId)) return unavailable();
    return { handle, userId: record.userId };
  });
  const viewer = members.find(member => member.userId === viewerId);
  const peer = members.find(member => member.userId !== viewerId);
  if (!viewer || !peer || !sameWildzPlayerCoordinate(viewer.handle, viewerHandle)
    || sameWildzPlayerCoordinate(viewer.handle, peer.handle)
    || (expectedPeer !== undefined && !sameWildzPlayerCoordinate(peer.handle, expectedPeer))) return unavailable();
  return { conversationId: thread.id, viewer, peer };
}

function connection(request: NextRequest) {
  const proof = readWildzProofSessionCookie(request);
  if (proof.authority !== "identity-key") throw Error("receiz_wallet_authority_required");
  const session = readWildzReceizChatSessionForIdentity(request, proof);
  return { session, client: createWildzReceizChatClient(session) };
}

type DirectThread = ReturnType<typeof directThread>;
function readOriginal(value: unknown, thread: DirectThread) {
  const supplied = asObject(value);
  const original = asObject(supplied?.original);
  const receipt = asObject(supplied?.receipt);
  const carrier = asObject(original?.walletTransfer);
  const sender = [thread.viewer, thread.peer].find(member => member.userId === original?.senderUserId);
  if (!original || original.version !== 1 || original.primitive !== "receiz.chat.message.original.v1"
    || original.conversationId !== thread.conversationId || !sender || original.senderKind !== "user"
    || typeof original.messageId !== "string" || !uuid.test(original.messageId)
    || typeof original.body !== "string" || typeof original.createdAt !== "string" || !Number.isFinite(Date.parse(original.createdAt))
    || receipt?.kind !== "message" || receipt.scopeId !== original.messageId || receipt.receizedBy !== sender.userId
    || typeof original.receiptDigest !== "string" || !digest.test(original.receiptDigest)
    || receipt.digest !== original.receiptDigest || receipt.payloadDigest !== original.payloadDigest || receipt.originDigest !== original.originDigest
    || carrier?.kind !== carrierKind || typeof carrier.clientMessageId !== "string" || !isWildzPrivateTradeMessage(carrier.context)) return unavailable();
  const recipient = sender === thread.viewer ? thread.peer : thread.viewer;
  if (carrier.recipientUserId !== recipient.userId) return unavailable();
  return {
    sender: { id: sender.handle, handle: sender.handle },
    recipient: { id: recipient.handle, handle: recipient.handle },
    body: original.body,
    clientMessageId: carrier.clientMessageId,
    context: carrier.context as WildsDirectMessage["context"],
    now: original.createdAt,
    nativeOriginal: { messageId: original.messageId, receiptDigest: original.receiptDigest },
    nativeThread: thread,
  };
}

type ConversationConnection = ReturnType<typeof connection>;

async function nativeMessages(port: ConversationConnection, query = "") {
  const value = asObject(await port.client.request(inboxPath + query, { bearerToken: null }));
  if (value?.ok !== true || value.viewerId !== port.session.userId || !Array.isArray(value.results)) return unavailable();
  return {
    results: value.results.map(item => {
      const thread = directThread(asObject(item)?.thread, port.session.userId, port.session.profileHandle);
      return readOriginal(item, thread);
    }),
    cursor: typeof value.nextCursor === "string" ? value.nextCursor : null,
    head: typeof value.headCursor === "string" ? value.headCursor : null,
  };
}

function originalOfferId(context: WildsDirectMessage["context"]) {
  if (context?.kind === "trade-package" && context.stage === "counteroffer" && context.inReplyTo) {
    return wildsWalletTradeMessageId(context.inReplyTo.senderHandle, { kind: "trade-package", stage: "offer", draft: context.inReplyTo.draft });
  }
  if (context?.kind === "market-offer-response") return wildzMarketOfferMessageId({ kind: "market-offer", offer: context.offer });
  return null;
}

function missingOriginal(cause: unknown) {
  return cause instanceof Error && ["wilds_wallet_trade_original_offer_required", "wildz_market_original_offer_required"].includes(cause.message);
}

async function recoverOriginalOffer(port: ConversationConnection, conversationId: string, context: WildsDirectMessage["context"]) {
  const id = originalOfferId(context);
  if (!id) return;
  const query = new URLSearchParams({ conversationId, clientMessageId: id });
  const page = await nativeMessages(port, `&${query}`);
  for (const original of page.results) if (original.clientMessageId === id) appendWildsDirectMessage(original);
}

const observedHead = new Map<string, string>();
const runningInbox = new Map<string, Promise<void>>();

export async function hydrateWildzPrivateTrades(request: NextRequest) {
  let port: ConversationConnection;
  try { port = connection(request); } catch { return; }
  const viewer = JSON.stringify([port.session.origin, port.session.userId, port.session.profileHandle, port.session.keyId]);
  const running = runningInbox.get(viewer);
  if (running) return running;
  const read = async () => {
    const after = observedHead.get(viewer);
    const page = await nativeMessages(port, after ? `&after=${encodeURIComponent(after)}` : "");
    // Native order is ascending for additions and descending on cold reopen.
    const messages = after ? page.results : page.results.reverse();
    for (const message of messages) {
      try {
        appendWildsDirectMessage(message);
      } catch (cause) {
        if (!missingOriginal(cause)) continue;
        await recoverOriginalOffer(port, message.nativeThread.conversationId, message.context);
        try { appendWildsDirectMessage(message); } catch { /* No exact original offer was admitted. */ }
      }
    }
    if (page.head) {
      observedHead.delete(viewer);
      observedHead.set(viewer, page.head);
      if (observedHead.size > 512) observedHead.delete(observedHead.keys().next().value!);
    }
  };
  const operation = read();
  runningInbox.set(viewer, operation);
  try { await operation; }
  finally { runningInbox.delete(viewer); }
}

export async function sendWildzPrivateTrade(request: NextRequest, input: {
  sender: WildsMessengerParticipant;
  recipient: WildsMessengerParticipant;
  clientMessageId: string;
  body: string;
  context: NonNullable<WildsDirectMessage["context"]>;
}) {
  const port = connection(request);
  const recipient = parseWildzPlayerCoordinate(input.recipient.handle);
  if (!recipient || !sameWildzPlayerCoordinate(input.sender.handle, port.session.profileHandle)) return unavailable();
  const originalId = originalOfferId(input.context);
  const inbox = originalId ? await nativeMessages(port).catch(() => null) : null;
  const original = inbox?.results.find(message => message.clientMessageId === originalId
    && sameWildzPlayerCoordinate(message.nativeThread.peer.handle, recipient.profileHandle));
  let thread: DirectThread;
  if (original) {
    appendWildsDirectMessage(original);
    thread = original.nativeThread;
  } else {
    const envelope = asObject(await port.client.request("/api/chat/conversations", {
      method: "POST", bearerToken: null, body: { kind: "dm", participantUsernames: [recipient.actorId] },
    }));
    const conversation = asObject(envelope?.conversation);
    if (envelope?.ok !== true || conversation?.kind !== "dm") return unavailable();
    thread = directThread(conversation, port.session.userId, port.session.profileHandle, recipient.profileHandle);
  }
  const normalized = {
    ...input,
    sender: { id: thread.viewer.handle, handle: thread.viewer.handle },
    recipient: { id: thread.peer.handle, handle: thread.peer.handle },
  };
  const preview = async () => {
    const draft = { ...normalized, preview: true as const };
    try { return appendWildsDirectMessage(draft); }
    catch (cause) {
      if (!missingOriginal(cause)) throw cause;
      await recoverOriginalOffer(port, thread.conversationId, input.context);
      return appendWildsDirectMessage(draft);
    }
  };
  const prepared = await preview();
  const response = await port.client.request(`/api/chat/conversations/${thread.conversationId}/messages?appMessage=wildz-trade`, {
    method: "POST", bearerToken: null, body: {
      body: prepared.message.body,
      appMessage: {
        kind: carrierKind, clientMessageId: normalized.clientMessageId,
        recipientUserId: thread.peer.userId, context: normalized.context,
      },
    },
  });
  const admitted = readOriginal(response, thread);
  if (admitted.sender.id !== normalized.sender.id || admitted.clientMessageId !== normalized.clientMessageId
    || admitted.body !== prepared.message.body
    || canonicalPortableCardJson(admitted.context) !== canonicalPortableCardJson(normalized.context)) return unavailable();
  return appendWildsDirectMessage(admitted);
}
