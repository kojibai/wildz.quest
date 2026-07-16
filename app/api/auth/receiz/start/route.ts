import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { receizCommerceAdapter } from "@/lib/receiz/adapter";
import { buildReceizConnectEntryUrl } from "@/lib/receiz/connect-url";
import { packReceizOAuthState } from "@/lib/receiz/oauth-state";
import { WILDZ_RECEIZ_OIDC_SCOPES } from "@/lib/receiz/oauth-scopes";
import {
  canonicalWildzAppOrigin,
  normalizeWildzReturnTo,
  wildzReceizCallbackUrl,
  WILDZ_RECEIZ_SESSION_SCOPE
} from "@/lib/receiz/wildz-auth-url";
import { parseWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";

export const runtime = "nodejs";

function base64Url(bytes: Buffer) {
  return bytes.toString("base64url");
}

function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = canonicalWildzAppOrigin(request.nextUrl.origin);
  } catch {
    return NextResponse.json({ error: "wildz_auth_origin_invalid" }, { status: 500 });
  }
  if (request.nextUrl.origin !== origin) {
    return NextResponse.redirect(new URL("/?receiz_error=untrusted_origin", origin), {
      headers: { "cache-control": "no-store" }
    });
  }
  const clientId = process.env.RECEIZ_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/?receiz_error=missing_client_id", origin), {
      headers: { "cache-control": "no-store" }
    });
  }

  const verifier = base64Url(randomBytes(48));
  const flowNonce = base64Url(randomBytes(32));
  const returnTo = normalizeWildzReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const coordinate = parseWildzPlayerCoordinate(request.nextUrl.searchParams.get("usernameHint") ?? "");
  const redirectUri = process.env.RECEIZ_ID_CALLBACK_URL ?? wildzReceizCallbackUrl(origin);
  const state = packReceizOAuthState({
    flowNonce,
    verifier,
    returnTo,
    sessionScope: WILDZ_RECEIZ_SESSION_SCOPE,
    startOrigin: origin
  });
  const authorizeUrl = receizCommerceAdapter.buildReceizIdAuthorizeUrl({
    clientId,
    redirectUri,
    codeChallenge: codeChallenge(verifier),
    scopes: WILDZ_RECEIZ_OIDC_SCOPES,
    state,
    ...(coordinate ? { usernameHint: coordinate.actorId } : {})
  });

  const response = NextResponse.redirect(buildReceizConnectEntryUrl(authorizeUrl));
  response.headers.set("cache-control", "no-store");
  response.cookies.set("receiz_oauth_flow", flowNonce, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/api/auth/receiz",
    sameSite: "lax",
    secure: origin.startsWith("https://")
  });
  return response;
}
