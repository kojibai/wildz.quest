import { NextRequest, NextResponse } from "next/server";
import { validateReceizProofAuthorityV123, sha256ReceizBytes } from "@receiz/sdk";
import { createReceizCommerceAdapter, receizCommerceAdapter } from "@/lib/receiz/adapter";
import { loadReceizConnectProfile } from "@/lib/receiz/connect-profile";
import { receizHttpFailureCode } from "@/lib/receiz/receiz-http-failure";
import { receizOAuthSecret } from "@/lib/receiz/oauth-state";
import { WILDZ_RECEIZ_SESSION_SCOPE } from "@/lib/receiz/wildz-auth-url";
import {
  WILDZ_PROOF_SESSION_COOKIE,
  createWildzReceizIdProofSession,
  packWildzProofSession,
  readWildzProofSessionCookie,
  wildzProofSessionCookieOptions
} from "@/lib/receiz/wildz-proof-session";
import {
  completeWildsWalletIdentityAuthority,
  issueWildsWalletIdentityAuthorityChallenge,
  wildsWalletIdentitySessionForChallenge
} from "@/lib/receiz/wilds-wallet-identity-authority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKET_COOKIE = "wildz_wallet_authority_ticket";

function cookieOptions(maxAge = 180) {
  return { httpOnly: true, maxAge, path: "/api/auth/wildz/wallet-authority", sameSite: "strict" as const, secure: process.env.NODE_ENV === "production" };
}

function proofSession(request: NextRequest) {
  try {
    const session = readWildzProofSessionCookie(request);
    if (session.authority !== "identity-key") return undefined;
    return { keyId: session.keyId, actorId: session.actorId, profileHandle: session.profileHandle };
  } catch {
    return undefined;
  }
}

function edgeIdentity(request: NextRequest) {
  const session = proofSession(request);
  return wildsWalletIdentitySessionForChallenge(session, request.nextUrl.searchParams.get("keyId"));
}

function failure(cause: unknown) {
  const code = receizHttpFailureCode(cause)
    ?? (cause instanceof Error ? cause.message : "receiz_wallet_identity_authority_failed");
  const status = /required/.test(code) ? 401 : /binding|profile|token/.test(code) ? 403 : 400;
  return NextResponse.json({ error: code }, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  try {
    const issued = issueWildsWalletIdentityAuthorityChallenge({
      session: edgeIdentity(request),
      artifactDigest: request.nextUrl.searchParams.get("artifactDigest") ?? ""
    }, receizOAuthSecret());
    const response = NextResponse.json(issued.challenge, { headers: { "cache-control": "no-store" } });
    response.cookies.set(TICKET_COOKIE, issued.ticket, cookieOptions());
    return response;
  } catch (cause) {
    return failure(cause);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ticket = request.cookies.get(TICKET_COOKIE)?.value;
    if (!ticket) throw new Error("receiz_wallet_identity_authority_ticket_required");
    const admitted = await completeWildsWalletIdentityAuthority({
      session: proofSession(request),
      ticket,
      body: await request.json()
    }, {
      secret: receizOAuthSecret(),
      exchange: (input) => receizCommerceAdapter.exchangeProofAuthorityV123(input),
      validate: validateReceizProofAuthorityV123,
      loadProfile: loadReceizConnectProfile,
      introspect: (accessToken) => createReceizCommerceAdapter({ accessToken }).introspectAccessToken(),
      artifactDigest: async (artifact) => sha256ReceizBytes(new TextEncoder().encode(artifact))
    });
    const response = NextResponse.json({ status: "connected", scopes: admitted.grantedScopes }, { headers: { "cache-control": "no-store" } });
    const accessMaxAge = Math.max(1, Math.min(120, admitted.expiresIn));
    const sessionCookie = { httpOnly: true, maxAge: accessMaxAge, path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
    response.cookies.set("receiz_access_token", admitted.accessToken, sessionCookie);
    response.cookies.set("receiz_session_scope", WILDZ_RECEIZ_SESSION_SCOPE, sessionCookie);
    response.cookies.set("receiz_granted_scopes", admitted.grantedScopes.join(" "), sessionCookie);
    const establishedSession = createWildzReceizIdProofSession({
      keyId: admitted.keyId,
      username: admitted.profileHandle,
      displayName: null
    });
    response.cookies.set(WILDZ_PROOF_SESSION_COOKIE, packWildzProofSession(establishedSession), wildzProofSessionCookieOptions());
    response.cookies.set(TICKET_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
    return response;
  } catch (cause) {
    return failure(cause);
  }
}
