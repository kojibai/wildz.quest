import type { NextRequest } from "next/server";
import { WILDZ_RECEIZ_SESSION_SCOPE } from "./wildz-auth-url";

export type ReceizRequestSession = {
  accessToken: string | undefined;
  cookieAccessToken: string | undefined;
  delegatedAccessToken: string | undefined;
  sessionScope: string | undefined;
  source: "cookie" | "delegated" | null;
};

export function receizRequestSession(request: NextRequest): ReceizRequestSession {
  const cookieAccessToken = request.cookies.get("receiz_access_token")?.value;
  // Runtime application authority is an explicitly provisioned Connect service
  // credential. The release-doctor RECEIZ_ACCESS_TOKEN never becomes request or
  // player authority inside the application.
  const delegatedAccessToken = process.env.RECEIZ_CONNECT_ACCESS_TOKEN;
  const accessToken = cookieAccessToken ?? delegatedAccessToken;

  return {
    accessToken,
    cookieAccessToken,
    delegatedAccessToken,
    sessionScope: request.cookies.get("receiz_session_scope")?.value,
    source: cookieAccessToken ? "cookie" : delegatedAccessToken ? "delegated" : null
  };
}

export function receizAccessTokenFromRequest(request: NextRequest) {
  return receizRequestSession(request).accessToken;
}

export function playerReceizAccessToken(session: ReceizRequestSession) {
  if (session.source !== "cookie" || session.sessionScope !== WILDZ_RECEIZ_SESSION_SCOPE) return undefined;
  return session.cookieAccessToken;
}

export function receizAuthorityRequired(returnTo = "/admin") {
  return {
    ok: false,
    error: "receiz_authority_required",
    message: "Create or restore a verified Receiz proof object in app, then try again.",
    connectUrl: `/api/auth/receiz/start?returnTo=${encodeURIComponent(returnTo)}`
  };
}
