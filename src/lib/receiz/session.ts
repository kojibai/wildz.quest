import type { NextRequest } from "next/server";

export type ReceizRequestSession = {
  accessToken: string | undefined;
  cookieAccessToken: string | undefined;
  delegatedAccessToken: string | undefined;
  sessionScope: string | undefined;
  source: "cookie" | "delegated" | null;
};

export function receizRequestSession(request: NextRequest): ReceizRequestSession {
  const cookieAccessToken = request.cookies.get("receiz_access_token")?.value;
  const delegatedAccessToken = process.env.RECEIZ_ACCESS_TOKEN ?? process.env.RECEIZ_CONNECT_ACCESS_TOKEN;
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

export function receizAuthorityRequired(returnTo = "/admin") {
  return {
    ok: false,
    error: "receiz_authority_required",
    message: "Create or restore a verified Receiz proof object in app, then try again.",
    connectUrl: `/api/auth/receiz/start?returnTo=${encodeURIComponent(returnTo)}`
  };
}
