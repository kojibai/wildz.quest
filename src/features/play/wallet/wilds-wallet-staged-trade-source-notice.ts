import { admitWildsWalletBearerGiftMessage } from "./wilds-wallet-bearer-gift-messaging";
import { admitWildsWalletResourceSourceMessageV128 } from "./wilds-wallet-resource-source-messaging-v128";
import type { WildsWalletStagedTradePlan } from "./wilds-wallet-staged-trade-types";

/** A fresh private source message wakes only its already approved finite plan.
 * This parser admits routing/bytes; the source port supplies actual SDK proof. */
export function admitWildsWalletStagedTradeSourceNotice(value: unknown, senderHandle: string, recipientHandle: string, plan: WildsWalletStagedTradePlan): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("The exact staged source notice is required.");
  const notice = value as { kind?: unknown; tradeId?: unknown; legId?: unknown };
  const leg = plan.legs.find(leg => leg.legId === notice.legId);
  if (notice.tradeId !== plan.tradeId || !leg || leg.kind !== "asset") throw Error("The source notice belongs to a different saved asset stage.");
  if (leg.request.asset.kind === "creature") admitWildsWalletBearerGiftMessage(value, senderHandle, recipientHandle, leg);
  else admitWildsWalletResourceSourceMessageV128(value, senderHandle, recipientHandle, leg);
}
