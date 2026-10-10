import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { admitWildsWalletTradeDraft, type WildsWalletTradeDraft } from "./wilds-wallet-trade";
import type { WildsConversation } from "../wilds-messenger-core";

export type WildsWalletTradeReply = Readonly<{ senderHandle: string; draft: WildsWalletTradeDraft }>;
export type WildsWalletTradeInboxItem = Readonly<{ id: string; senderHandle: string; message: WildsWalletTradeMessage }>;

/** Private peer negotiation. This transport object cannot authorize an asset move. */
export type WildsWalletTradeMessage = Readonly<{
  kind: "trade-package";
  stage: "offer" | "counteroffer";
  draft: WildsWalletTradeDraft;
  inReplyTo?: WildsWalletTradeReply;
}>;
export function validateWildsWalletTradeMessage(value: unknown, senderHandle: string, recipientHandle: string): WildsWalletTradeMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("wilds_wallet_trade_message_invalid");
  const message = value as WildsWalletTradeMessage;
  if (message.kind !== "trade-package" || !["offer", "counteroffer"].includes(message.stage)
    || Object.keys(value).some(key => !["kind", "stage", "draft", "inReplyTo"].includes(key))) throw Error("wilds_wallet_trade_message_invalid");
  const sender = parseWildzPlayerCoordinate(senderHandle), recipient = parseWildzPlayerCoordinate(recipientHandle);
  if (!sender || !recipient || sender.actorId === recipient.actorId) throw Error("wilds_wallet_trade_peer_invalid");
  const draft = admitWildsWalletTradeDraft(message.draft, sender.profileHandle);
  if (!sameWildzPlayerCoordinate(draft.recipientHandle, recipient.profileHandle)) throw Error("wilds_wallet_trade_recipient_invalid");
  if (message.stage === "counteroffer") {
    if (!message.inReplyTo || !sameWildzPlayerCoordinate(message.inReplyTo.senderHandle, recipient.profileHandle)
      || Object.keys(message.inReplyTo).some(key => !["senderHandle", "draft"].includes(key))) throw Error("wilds_wallet_trade_reply_invalid");
    const original = admitWildsWalletTradeDraft(message.inReplyTo.draft, recipient.profileHandle);
    if (!sameWildzPlayerCoordinate(original.recipientHandle, sender.profileHandle)) throw Error("wilds_wallet_trade_reply_invalid");
    return Object.freeze({kind: "trade-package", stage: "counteroffer", draft,
      inReplyTo: Object.freeze({senderHandle: recipient.profileHandle, draft: original})});
  }
  if (message.inReplyTo !== undefined) throw Error("wilds_wallet_trade_reply_invalid");
  return Object.freeze({kind: "trade-package", stage: "offer", draft});
}

/** Display projection of authenticated private messages; native admission remains separate. */
export function projectWildsWalletTradeInbox(conversations: readonly WildsConversation[], owner: string): readonly WildsWalletTradeInboxItem[] {
  const items: WildsWalletTradeInboxItem[] = [];
  for (const conversation of conversations) for (const message of conversation.messages) {
    if (message.deletedAt || message.editedAt || message.context?.kind !== "trade-package"
      || !sameWildzPlayerCoordinate(message.recipientHandle, owner)) continue;
    try { items.push({id: message.id, senderHandle: message.senderHandle,
      message: validateWildsWalletTradeMessage(message.context, message.senderHandle, owner)}); } catch { /* Invalid cached negotiation is not an offer. */ }
  }
  return items;
}
export function wildsWalletTradeMessageId(senderHandle: string, message: WildsWalletTradeMessage): string {
  const sender = parseWildzPlayerCoordinate(senderHandle);
  if (!sender) throw Error("wilds_wallet_trade_peer_invalid");
  return `wilds-trade:${sha256PortableBasis(canonicalPortableCardJson({schema: "wildz.wallet.trade-message-id.v1", sender: sender.profileHandle,
    attemptId: message.draft.attemptId, stage: message.stage})).replace(/^sha256:/, "")}`;
}
