import type { NextRequest } from "next/server";
import { loadReceizConnectProfile, type ReceizConnectProfile } from "./connect-profile";
import { playerReceizAccessToken, receizRequestSession } from "./session";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { readWildzProofSessionCookie } from "./wildz-proof-session";

export type WildzCookieActor = {
  actorId: string;
  profileHandle: string;
  receizUserId: string;
  accessToken?: string;
};

export function wildzCookieActorFromReceizProfile(
  profile: Pick<ReceizConnectProfile, "id" | "handle">,
  accessToken: string
): WildzCookieActor {
  const coordinate = parseWildzPlayerCoordinate(profile.handle);
  if (!profile.id || !coordinate || !accessToken) throw new Error("receiz_profile_required");
  return {
    actorId: coordinate.actorId,
    profileHandle: coordinate.profileHandle,
    receizUserId: profile.id,
    accessToken
  };
}

export async function resolveWildzCookieActor(request: NextRequest): Promise<WildzCookieActor> {
  let proofSession: ReturnType<typeof readWildzProofSessionCookie> | null = null;
  try {
    proofSession = readWildzProofSessionCookie(request);
  } catch {
    // Legacy scoped Connect cookies remain accepted during migration.
  }
  if (proofSession) {
    if (proofSession.authority === "proof-sealed-vault") {
      throw new Error("receiz_identity_key_required");
    }
    return {
      actorId: proofSession.actorId,
      profileHandle: proofSession.profileHandle,
      receizUserId: `proof:${proofSession.subjectKey}`
    };
  }
  const session = receizRequestSession(request);
  const cookieAccessToken = session.cookieAccessToken;
  if (!cookieAccessToken || playerReceizAccessToken(session) !== cookieAccessToken) {
    throw new Error("receiz_authority_required");
  }
  const profile = await loadReceizConnectProfile(cookieAccessToken);
  if (!profile?.id || !profile.handle) throw new Error("receiz_profile_required");
  return wildzCookieActorFromReceizProfile(profile, cookieAccessToken);
}
