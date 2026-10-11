import { receizKaiNow, transportReceizSealedArtifactV124 } from "@receiz/sdk";
import type { NextRequest } from "next/server";
import { resolveWildsWalletReadAuthority } from "./wilds-wallet-route-authority";
import { readWildzProofSessionCookie } from "./wildz-proof-session";
import { readWildzReceizChatSession } from "./wildz-receiz-chat-session";
import { createWildzReceizBearerClient } from "./wildz-receiz-bearer-session";
import { canonicalPortableCardJson } from "../../features/play/portable-card";
import { verifyWildsWalletStagedTradeIdentityApproval } from "../../features/play/wallet/wilds-wallet-staged-trade-identity";
import { verifyWildsWalletBearerGiftAuthority } from "../../features/play/wallet/wilds-wallet-bearer-gift-authority";
import { verifyWildsWalletBearerGiftSource, verifyWildsWalletBearerGiftAccepted } from "../../features/play/wallet/wilds-wallet-bearer-gift-proof";
import { verifyWildsWalletBearerGiftOriginV128 } from "../../features/play/wallet/wilds-wallet-bearer-gift-source-v128";
import type { WildsWalletBearerGiftLeg } from "../../features/play/wallet/wilds-wallet-bearer-gift-proof";
import type { WildsWalletStagedTradeAssetAuthority } from "../../features/play/wallet/wilds-wallet-staged-trade-types";
import type { WildsWalletBearerGiftSource } from "../../features/play/wallet/wilds-wallet-bearer-gift-recovery";
import { WILDZ_RECEIZ_APPLICATION_ID } from "./wildz-application";

/** Explicit receiver action only. Native published SDK law owns the one-use
 * claim and retained successor; no app-supplied owner/head/receipt grants title. */
export async function claimWildsWalletBearerGift(request: NextRequest) {
  const account = await resolveWildsWalletReadAuthority(request), proofSession = readWildzProofSessionCookie(request);
  const session = readWildzReceizChatSession(request, { ...account, keyId: proofSession.keyId });
  if (Number(request.headers.get("content-length") ?? 0) > 2_000_000) throw Error("The native claim proof is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 2_000_000) throw Error("The native claim proof is too large.");
  const body = JSON.parse(text) as { leg: WildsWalletBearerGiftLeg; source: WildsWalletBearerGiftSource; authority: WildsWalletStagedTradeAssetAuthority };
  if (!body || Object.keys(body).sort().join(",") !== "authority,leg,source" || body.leg?.kind !== "asset"
    || body.leg.recipientHandle !== account.profileHandle || !body.source || Object.keys(body.source).sort().join(",") !== "originProof,original,projectionOriginal") throw Error("Only the exact reviewed recipient can accept this native gift.");
  const sdk = createWildzReceizBearerClient(session);
  await verifyWildsWalletBearerGiftOriginV128(body.leg, body.source, sdk, WILDZ_RECEIZ_APPLICATION_ID);
  const source = await verifyWildsWalletBearerGiftSource({ leg: body.leg, original: body.source.original, projectionOriginal: body.source.projectionOriginal, artifacts: sdk.artifacts, assertSelection: async () => undefined });
  const barrier = await verifyWildsWalletBearerGiftAuthority(body.leg, source.descriptor, body.authority);
  const own = body.authority.approvals.find(approval => approval.ownerHandle === account.profileHandle);
  if (!own) throw Error("The receiving Explorer's exact approval is required.");
  const admitted = await verifyWildsWalletStagedTradeIdentityApproval(own, body.authority.plan);
  if (admitted.ownerReceizId !== account.ownerReceizId || admitted.keyId !== proofSession.keyId || admitted.ownerHandle !== session.profileHandle) throw Error("The receiving Identity Seal changed.");
  // Avoid creating a same-pulse successor that cannot meet the strict admitted
  // temporal barrier. The accepted ROOT Kai is still independently enforced.
  if (BigInt(receizKaiNow().pulse) <= BigInt(barrier)) throw Error("Both approvals are saved. Accept this same gift after the current Kai pulse advances.");
  const accepted = await sdk.ownership.claimBearerAsset({ artifact: source.opened.sealedArtifact });
  const original = await transportReceizSealedArtifactV124(accepted);
  await verifyWildsWalletBearerGiftAccepted({ leg: body.leg, descriptor: source.descriptor, predecessor: body.source.original, successor: original, projectionOriginal: body.source.projectionOriginal, acceptedNotBeforeKai: barrier, artifacts: sdk.artifacts });
  // No independently derived continuation state is returned as proof authority.
  if (canonicalPortableCardJson(original).length > 2_000_000) throw Error("The accepted Original is too large for private delivery.");
  return { original };
}
