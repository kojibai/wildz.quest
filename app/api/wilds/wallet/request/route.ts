import { NextRequest, NextResponse } from "next/server";
import { parseWildsWalletMicroPhi } from "@/lib/receiz/wilds-wallet-projections";
import {
  resolveWildsWalletReadAuthority,
  wildsWalletAuthorityStatusFor
} from "@/lib/receiz/wilds-wallet-route-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

function assertExactFields(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("wilds_wallet_request_fields_invalid");
  const body = value as Record<string, unknown>;
  if (!Object.keys(body).every((field) => fields.includes(field))) throw new Error("wilds_wallet_request_fields_invalid");
  return body;
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new Error("wilds_wallet_request_fields_invalid");
  }
}

function failure(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "receiz_wallet_request_invalid";
  if (code === "wilds_wallet_request_fields_invalid" || code === "wilds_wallet_micro_phi_invalid") return json({ error: code }, 400);
  if (code.startsWith("receiz_wallet_")) return json({ error: code }, wildsWalletAuthorityStatusFor(code));
  return json({ error: "receiz_wallet_request_invalid" }, 400);
}

export async function POST(request: NextRequest) {
  try {
    const authority = await resolveWildsWalletReadAuthority(request);
    const body = assertExactFields(await readJsonBody(request), ["amountPhiMicro"]);
    const amountPhiMicro = body.amountPhiMicro === undefined ? null : parseWildsWalletMicroPhi(body.amountPhiMicro);
    return json({
      locator: `wildz:receive:${authority.actorId}`,
      request: amountPhiMicro === null ? null : {
        kind: "phi",
        amountPhiMicro,
        authority: "non-authoritative"
      }
    });
  } catch (cause) {
    return failure(cause);
  }
}
