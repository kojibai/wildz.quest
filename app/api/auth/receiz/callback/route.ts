import { NextRequest, NextResponse } from "next/server";
import { receizCommerceAdapter } from "@/lib/receiz/adapter";
import {
  oauthFlowNonceMatches,
  packReceizSessionTicket,
  unpackReceizOAuthState
} from "@/lib/receiz/oauth-state";
import {
  canonicalWildzAppOrigin,
  isAllowedWildzAuthOrigin,
  normalizeWildzReturnTo,
  wildzReceizCallbackUrl,
  WILDZ_RECEIZ_SESSION_SCOPE
} from "@/lib/receiz/wildz-auth-url";

export const runtime = "nodejs";

function redirectWithError(origin: string, error: string, returnTo = "/") {
  const target = new URL(normalizeWildzReturnTo(returnTo), origin);
  target.searchParams.set("receiz_error", error);
  return NextResponse.redirect(target, { headers: { "cache-control": "no-store" } });
}

function applySessionCookies(response: NextResponse, input: {
  accessToken: string;
  expiresIn: number;
  secure: boolean;
}) {
  const accessMaxAge = Math.max(60, input.expiresIn || 3_600);
  response.cookies.set("receiz_access_token", input.accessToken, {
    httpOnly: true,
    maxAge: accessMaxAge,
    path: "/",
    sameSite: "lax",
    secure: input.secure
  });
  response.cookies.set("receiz_session_scope", WILDZ_RECEIZ_SESSION_SCOPE, {
    httpOnly: true,
    maxAge: accessMaxAge,
    path: "/",
    sameSite: "lax",
    secure: input.secure
  });
}

export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = canonicalWildzAppOrigin(request.nextUrl.origin);
  } catch {
    return NextResponse.json({ error: "wildz_auth_origin_invalid" }, { status: 500 });
  }
  const callbackOrigin = request.nextUrl.origin;
  const configuredCallback = process.env.RECEIZ_ID_CALLBACK_URL ?? wildzReceizCallbackUrl(origin);
  if (!isAllowedWildzAuthOrigin(callbackOrigin, [origin, configuredCallback])) {
    return redirectWithError(origin, "untrusted_origin");
  }
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const clientId = process.env.RECEIZ_CLIENT_ID;

  let oauthState: ReturnType<typeof unpackReceizOAuthState>;
  try {
    if (!state) throw new Error("missing_state");
    oauthState = unpackReceizOAuthState(state);
    if (oauthState.sessionScope !== WILDZ_RECEIZ_SESSION_SCOPE || oauthState.startOrigin !== origin) {
      throw new Error("invalid_scope");
    }
  } catch {
    return redirectWithError(origin, "invalid_state");
  }
  if (callbackOrigin === origin
    && !oauthFlowNonceMatches(request.cookies.get("receiz_oauth_flow")?.value, oauthState.flowNonce)) {
    return redirectWithError(origin, "invalid_state");
  }
  if (error) return redirectWithError(origin, "authorization_denied", oauthState.returnTo);
  if (!code) return redirectWithError(origin, "missing_code", oauthState.returnTo);
  if (!clientId) return redirectWithError(origin, "missing_client_id", oauthState.returnTo);

  let token: Awaited<ReturnType<typeof receizCommerceAdapter.exchangeReceizIdToken>>;
  try {
    const redirectUri = configuredCallback;
    token = await receizCommerceAdapter.exchangeReceizIdToken({
      grant_type: "authorization_code",
      code,
      code_verifier: oauthState.verifier,
      client_id: clientId,
      client_secret: process.env.RECEIZ_CLIENT_SECRET || undefined,
      redirect_uri: redirectUri
    });
  } catch {
    return redirectWithError(origin, "token_exchange_failed", oauthState.returnTo);
  }

  if (callbackOrigin !== origin) {
    const ticket = packReceizSessionTicket({
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      returnTo: normalizeWildzReturnTo(oauthState.returnTo),
      sessionScope: WILDZ_RECEIZ_SESSION_SCOPE,
      flowNonce: oauthState.flowNonce,
      startOrigin: oauthState.startOrigin
    });
    const target = new URL("/api/auth/receiz/complete", oauthState.startOrigin);
    target.searchParams.set("ticket", ticket);
    return NextResponse.redirect(target, { headers: { "cache-control": "no-store" } });
  }

  const target = new URL(normalizeWildzReturnTo(oauthState.returnTo), oauthState.startOrigin);
  target.searchParams.set("receiz", "connected");
  const response = NextResponse.redirect(target);
  response.headers.set("cache-control", "no-store");
  response.cookies.delete("receiz_oauth_flow");
  applySessionCookies(response, {
    accessToken: token.access_token,
    expiresIn: token.expires_in,
    secure: origin.startsWith("https://")
  });
  return response;
}
