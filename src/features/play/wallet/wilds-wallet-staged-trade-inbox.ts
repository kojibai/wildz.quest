import type { WildsConversation } from "../wilds-messenger-core";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import { admitWildsWalletStagedTradeMessage } from "./wilds-wallet-staged-trade-messaging";
import { admitWildsWalletStagedTradeApproval } from "./wilds-wallet-staged-trade-recovery";
import type { WildsWalletTradeAgreement } from "./wilds-wallet-trade";

export type WildsWalletStagedTradeInboxItem = Readonly<{ id: string; senderHandle: string; agreement: WildsWalletTradeAgreement }>;

/** Inbox display only. Approval requires independently opening the exact native
 * identity and consent witness; rendering never opens or creates a proof. */
export function projectWildsWalletStagedTradeInbox(conversations: readonly WildsConversation[], ownerHandle: string | null | undefined): readonly WildsWalletStagedTradeInboxItem[] {
  const owner = typeof ownerHandle === "string" ? parseWildzPlayerCoordinate(ownerHandle)?.profileHandle : null;
  if (!owner) return [];
  const seen = new Set<string>(), items: WildsWalletStagedTradeInboxItem[] = [];
  for (const conversation of conversations) for (const message of conversation.messages) {
    if (message.deletedAt || message.editedAt || !sameWildzPlayerCoordinate(message.recipientHandle, owner)) continue;
    try {
      const context = admitWildsWalletStagedTradeMessage(message.context, message.senderHandle, message.recipientHandle);
      if (context.kind !== "trade-staged-approval") continue;
      const approval = admitWildsWalletStagedTradeApproval(context.approval, context.plan);
      if (seen.has(context.plan.tradeId) || sameWildzPlayerCoordinate(approval.ownerHandle, owner)) continue;
      seen.add(context.plan.tradeId);
      items.push(Object.freeze({ id: context.plan.tradeId, senderHandle: approval.ownerHandle, agreement: context.plan.agreement }));
    } catch { /* Malformed transport cannot become a reviewable agreement. */ }
  }
  return Object.freeze(items);
}
