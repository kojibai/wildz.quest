import { NextRequest, NextResponse } from "next/server";
import { transportReceizSealedArtifactV124 } from "@receiz/sdk";
import { canonicalPortableCardJson } from "@/features/play/portable-card";
import { createWildsWalletStagedTradePlan } from "@/features/play/wallet/wilds-wallet-staged-trade-types";
import { verifyWildsWalletStagedTradeIdentityConsent } from "@/features/play/wallet/wilds-wallet-staged-trade-identity";
import { createReceizCommerceAdapter } from "@/lib/receiz/adapter";
import { resolveWildsWalletReadAuthority } from "@/lib/receiz/wilds-wallet-route-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "private, no-store" };

/** The existing SDK seals exact consent. This route owns no issuer/root key,
 * creates no balance or ownership transition, and runs only on Approve. */
export async function POST(request: NextRequest) {
  try {
    const authority = await resolveWildsWalletReadAuthority(request);
    if (Number(request.headers.get("content-length") ?? 0) > 2_000_000) throw Error("Approval proof is too large.");
    const text = await request.text();
    if (text.length > 2_000_000) throw Error("Approval proof is too large.");
    const body = JSON.parse(text);
    if (!body || Object.keys(body).sort().join(",") !== "approval,plan") throw Error("The exact device approval is required.");
    const plan = createWildsWalletStagedTradePlan(body.plan?.agreement);
    if (canonicalPortableCardJson(plan) !== canonicalPortableCardJson(body.plan) || !body.approval?.evidence || Object.keys(body.approval.evidence).sort().join(",") !== "original,proof,schema") throw Error("The exact staged plan is required.");
    const identity = await verifyWildsWalletStagedTradeIdentityConsent(body.approval, plan);
    if (identity.ownerHandle !== authority.profileHandle || identity.ownerReceizId !== authority.ownerReceizId) throw Error("Only this admitted Explorer can seal their consent.");
    const sealed = await createReceizCommerceAdapter({ accessToken: authority.accessToken }).client.assets.createProofObject({ assetType: "document", payload: { bytes: new TextEncoder().encode(canonicalPortableCardJson(body.approval)), mimeType: "application/json" } }, { idempotencyKey: `wildz:trade-approval:${body.approval.approvalId}`, filename: "wildz-staged-trade-approval.json" });
    return NextResponse.json({ original: await transportReceizSealedArtifactV124(sealed) }, { headers });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "The exact approval could not be sealed." }, { status: 409, headers }); }
}
