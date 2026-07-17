import { NextRequest, NextResponse } from "next/server";
import type { ReceizIdContinueRequest } from "@receiz/sdk";
import {
  WILDZ_PROOF_NONCE_COOKIE,
  WILDZ_PROOF_SESSION_COOKIE,
  WILDZ_VAULT_PENDING_COOKIE,
  createWildzReceizIdProofSession,
  packWildzProofSession,
  publicWildzProofSession,
  readWildzProofSessionCookie,
  receizIdContinuationNonceMatches,
  wildzProofNonceCookieOptions,
  wildzProofSessionCookieOptions,
  wildzVaultPendingCookieOptions
} from "@/lib/receiz/wildz-proof-session";

export const runtime = "nodejs";

type ReceizIdContinueResponse = {
  ok?: unknown;
  bound?: unknown;
  session?: {
    uid?: unknown;
    username?: unknown;
    displayName?: unknown;
  };
};

function continuationRequest(value: unknown): ReceizIdContinueRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Partial<ReceizIdContinueRequest>;
  if (typeof input.keyId !== "string"
    || (input.alg !== "Ed25519" && input.alg !== "P-256")
    || typeof input.publicKeyRawB64u !== "string"
    || typeof input.localUid !== "string"
    || typeof input.username !== "string"
    || typeof input.displayName !== "string"
    || (typeof input.deviceName !== "string" && input.deviceName !== null)
    || typeof input.createdAt !== "string"
    || typeof input.challengeB64Url !== "string"
    || typeof input.signatureB64Url !== "string"
    || (input.next !== undefined && typeof input.next !== "string")) return null;
  const body = {
    keyId: input.keyId,
    alg: input.alg,
    publicKeyRawB64u: input.publicKeyRawB64u,
    localUid: input.localUid,
    username: input.username,
    displayName: input.displayName,
    deviceName: input.deviceName,
    createdAt: input.createdAt,
    challengeB64Url: input.challengeB64Url,
    signatureB64Url: input.signatureB64Url,
    ...(input.next === undefined ? {} : { next: input.next })
  } satisfies ReceizIdContinueRequest;
  return JSON.stringify(body).length <= 24 * 1024 ? body : null;
}

function canonicalReceizSession(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const response = value as ReceizIdContinueResponse;
  const session = response.session;
  if (response.ok !== true
    || response.bound !== true
    || !session
    || typeof session.uid !== "string"
    || !session.uid.trim()
    || typeof session.username !== "string"
    || (typeof session.displayName !== "string" && session.displayName !== null)) return null;
  return {
    username: session.username,
    displayName: session.displayName
  };
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(publicWildzProofSession(readWildzProofSessionCookie(request)), {
      headers: { "cache-control": "no-store" }
    });
  } catch {
    return NextResponse.json({ status: "unknown" }, {
      status: 401,
      headers: { "cache-control": "no-store" }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = continuationRequest(await request.json());
    const nonce = request.cookies.get(WILDZ_PROOF_NONCE_COOKIE)?.value;
    if (!body || !nonce || !receizIdContinuationNonceMatches(body, nonce)) {
      throw new Error("wildz_proof_admission_invalid");
    }
    const baseUrl = (process.env.RECEIZ_BASE_URL || "https://receiz.com").replace(/\/$/, "");
    const upstream = await fetch(`${baseUrl}/api/auth/receiz-id/continue`, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const upstreamBody = await upstream.json().catch(() => null);
    if (upstream.status === 409) {
      return NextResponse.json({ status: "conflict", error: "wildz_username_taken" }, { status: 409 });
    }
    const canonical = canonicalReceizSession(upstreamBody);
    if (!upstream.ok || !canonical) throw new Error("wildz_receiz_id_continue_failed");
    const session = createWildzReceizIdProofSession({
      keyId: body.keyId,
      username: canonical.username,
      displayName: canonical.displayName
    });
    const response = NextResponse.json(publicWildzProofSession(session));
    response.cookies.set(WILDZ_PROOF_SESSION_COOKIE, packWildzProofSession(session), wildzProofSessionCookieOptions());
    response.cookies.set(WILDZ_PROOF_NONCE_COOKIE, "", { ...wildzProofNonceCookieOptions(), maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ status: "unavailable", error: "wildz_proof_admission_invalid" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: "unknown" });
  response.cookies.set(WILDZ_PROOF_SESSION_COOKIE, "", { ...wildzProofSessionCookieOptions(), maxAge: 0 });
  response.cookies.set(WILDZ_PROOF_NONCE_COOKIE, "", { ...wildzProofNonceCookieOptions(), maxAge: 0 });
  response.cookies.set(WILDZ_VAULT_PENDING_COOKIE, "", { ...wildzVaultPendingCookieOptions(), maxAge: 0 });
  return response;
}
