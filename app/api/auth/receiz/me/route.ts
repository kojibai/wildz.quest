import { NextRequest, NextResponse } from "next/server";
import { loadReceizConnectProfile } from "@/lib/receiz/connect-profile";
import { playerReceizAccessToken, receizRequestSession } from "@/lib/receiz/session";
import { receizPlayerSubjectKey } from "@/lib/receiz/oauth-state";
import { parseWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import type { WildzRemoteSession } from "@/lib/receiz/wildz-session-bridge";

export const runtime = "nodejs";

const UNKNOWN: WildzRemoteSession = {
  status: "unknown",
  actorId: null,
  profileHandle: null,
  displayName: null
};

function json(session: WildzRemoteSession) {
  return NextResponse.json(session, { headers: { "cache-control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const token = playerReceizAccessToken(receizRequestSession(request));
  if (!token) return json(UNKNOWN);
  try {
    const profile = await loadReceizConnectProfile(token);
    const coordinate = parseWildzPlayerCoordinate(profile?.handle ?? "");
    if (!profile?.id || !coordinate) {
      return json({ status: "unavailable", actorId: null, profileHandle: null, displayName: null });
    }
    return json({
      status: "connected",
      subjectKey: receizPlayerSubjectKey(profile.id),
      actorId: coordinate.actorId,
      profileHandle: coordinate.profileHandle,
      displayName: profile.name || null
    });
  } catch {
    return json({ status: "unavailable", actorId: null, profileHandle: null, displayName: null });
  }
}

export async function DELETE(request: NextRequest) {
  const response = json(UNKNOWN);
  const secure = request.nextUrl.protocol === "https:";
  for (const name of ["receiz_access_token", "receiz_refresh_token", "receiz_session_scope"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      maxAge: 0,
      path: name === "receiz_refresh_token" ? "/api/auth/receiz" : "/",
      sameSite: "lax",
      secure
    });
  }
  return response;
}
