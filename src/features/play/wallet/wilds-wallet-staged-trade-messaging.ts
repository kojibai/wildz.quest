import { canonicalPortableCardJson, sha256PortableBasis } from "../portable-card";
import { sameWildzPlayerCoordinate } from "../../../lib/receiz/wildz-player-coordinate";
import { assertWildsWalletStagedTradeLegOutcome } from "./wilds-wallet-staged-trade-recovery";
import { createWildsWalletStagedTradePlan, type WildsWalletStagedTradeMessage } from "./wilds-wallet-staged-trade-types";
import type { WildsWalletTradeAgreement } from "./wilds-wallet-trade";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Transport validation only. Device approval and each receipt are independently SDK-admitted. */
export function admitWildsWalletStagedTradeMessage(value: unknown, sender: string, recipient: string): WildsWalletStagedTradeMessage {
  if (!object(value) || JSON.stringify(value).length > 2_000_000) throw Error("The staged trade message is invalid.");
  if (sameWildzPlayerCoordinate(sender, recipient)) throw Error("Choose another Explorer for this trade.");
  if (value.kind === "trade-staged-approval") {
    if (Object.keys(value).sort().join(",") !== "approval,kind,plan" || !object(value.plan) || !object(value.approval)) throw Error("The exact device approval is required.");
    const plan = createWildsWalletStagedTradePlan(value.plan.agreement as WildsWalletTradeAgreement);
    if (canonicalPortableCardJson(plan) !== canonicalPortableCardJson(value.plan)
      || !sameWildzPlayerCoordinate(String(value.approval.ownerHandle ?? ""), sender)
      || ![plan.agreement.first.senderHandle, plan.agreement.second.senderHandle].some(owner => sameWildzPlayerCoordinate(owner, recipient))) throw Error("The trade approval belongs to different Explorers.");
    return structuredClone(value) as WildsWalletStagedTradeMessage;
  }
  if (value.kind === "trade-staged-progress") {
    if (Object.keys(value).sort().join(",") !== "kind,legId,outcome,tradeId" || typeof value.tradeId !== "string" || !/^staged:[a-f0-9]{64}$/.test(value.tradeId)
      || typeof value.legId !== "string" || !new RegExp(`^${value.tradeId}:[0-9]{1,2}$`).test(value.legId)) throw Error("The exact staged leg locator is required.");
    assertWildsWalletStagedTradeLegOutcome(value.outcome);
    return structuredClone(value) as WildsWalletStagedTradeMessage;
  }
  throw Error("The staged trade message is invalid.");
}

export function wildsWalletStagedTradeMessageId(message: WildsWalletStagedTradeMessage) {
  return `wilds:trade-stage:${sha256PortableBasis(canonicalPortableCardJson(message)).replace(/^sha256:/, "")}`;
}
