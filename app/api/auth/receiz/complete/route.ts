import { NextRequest, NextResponse } from "next/server";
import { oauthFlowNonceMatches, unpackReceizSessionTicket } from "@/lib/receiz/oauth-state";
import {
  canonicalWildzAppOrigin,
  normalizeWildzReturnTo,
  WILDZ_RECEIZ_SESSION_SCOPE
} from "@/lib/receiz/wildz-auth-url";

export const runtime = "nodejs";

function failure(origin: string, error: string) {
  const target = new URL("/", origin);
  target.searchParams.set("receiz_error", error);
  return NextResponse.redirect(target, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = canonicalWildzAppOrigin(request.nextUrl.origin);
  } catch {
    return NextResponse.json({ error: "wildz_auth_origin_invalid" }, { status: 500 });
  }
  if (request.nextUrl.origin !== origin) return failure(origin, "untrusted_origin");
  const ticket = request.nextUrl.searchParams.get("ticket");
  if (!ticket) return failure(origin, "missing_ticket");

  try {
    const session = unpackReceizSessionTicket(ticket);
    if (session.startOrigin !== origin
      || session.sessionScope !== WILDZ_RECEIZ_SESSION_SCOPE
      || !oauthFlowNonceMatches(request.cookies.get("receiz_oauth_flow")?.value, session.flowNonce)) {
      throw new Error("invalid_ticket_binding");
    }
    const target = new URL(normalizeWildzReturnTo(session.returnTo), origin);
    target.searchParams.set("receiz", "connected");
    const response = NextResponse.redirect(target);
    response.headers.set("cache-control", "no-store");
    response.cookies.delete("receiz_oauth_flow");
    const secure = origin.startsWith("https://");
    const accessMaxAge = Math.max(60, session.expiresIn || 3_600);
    response.cookies.set("receiz_access_token", session.accessToken, {
      httpOnly: true,
      maxAge: accessMaxAge,
      path: "/",
      sameSite: "lax",
      secure
    });
    response.cookies.set("receiz_session_scope", WILDZ_RECEIZ_SESSION_SCOPE, {
      httpOnly: true,
      maxAge: accessMaxAge,
      path: "/",
      sameSite: "lax",
      secure
    });
    response.cookies.set("receiz_granted_scopes", session.grantedScopes ?? "", {
      httpOnly: true,
      maxAge: accessMaxAge,
      path: "/",
      sameSite: "lax",
      secure
    });
    return response;
  } catch {
    return failure(origin, "invalid_ticket");
  }
}
