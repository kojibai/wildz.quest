import { canonicalPortableCardJson } from "../portable-card";
import { verifyWildsWalletStagedTradeIdentityApproval } from "./wilds-wallet-staged-trade-identity";
import { createWildsWalletStagedTradePlan, type WildsWalletStagedTradeAssetAuthority, type WildsWalletStagedTradeSourceHead } from "./wilds-wallet-staged-trade-types";
import type { WildsWalletBearerGiftLeg } from "./wilds-wallet-bearer-gift-proof";

/** Both independently admitted root-witnessed signatures authorize this exact
 * frozen stage. A peer message or supplied min-Kai value is never consent. */
export async function verifyWildsWalletBearerGiftAuthority(leg: WildsWalletBearerGiftLeg, descriptor: WildsWalletStagedTradeSourceHead, authority: WildsWalletStagedTradeAssetAuthority) {
  const same = (left: unknown, right: unknown) => canonicalPortableCardJson(left) === canonicalPortableCardJson(right);
  const plan = createWildsWalletStagedTradePlan(authority.plan.agreement);
  if (!same(plan, authority.plan) || !plan.legs.some(candidate => same(candidate, leg)) || authority.approvals.length !== 2) throw Error("Both exact whole-plan approvals are required before sending or accepting.");
  const identities = await Promise.all(authority.approvals.map(approval => verifyWildsWalletStagedTradeIdentityApproval(approval, plan)));
  const owners = new Set(identities.map(identity => identity.ownerHandle));
  if (owners.size !== 2 || !owners.has(leg.senderHandle) || !owners.has(leg.recipientHandle)
    || !authority.approvals.find(approval => approval.ownerHandle === leg.senderHandle)?.sourceHeads.some(head => same(head, descriptor))) throw Error("The peer approvals do not bind this exact Original.");
  const kai = identities.reduce((maximum, identity) => BigInt(identity.approvalKai) > maximum ? BigInt(identity.approvalKai) : maximum, 0n).toString();
  if (kai !== authority.acceptedNotBeforeKai) throw Error("The exact native approval Kai changed.");
  return kai;
}
