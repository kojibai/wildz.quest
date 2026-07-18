import { NextRequest, NextResponse } from "next/server";
import {
  WILDZ_PROOF_SESSION_COOKIE,
  WILDZ_VAULT_PENDING_COOKIE,
  packWildzProofSession,
  publicWildzProofSession,
  readWildzProofSessionCookie,
  readWildzVaultPendingAdmissionCookie,
  retainWildzVaultCardAdmission,
  wildzProofSessionCookieOptions,
  wildzVaultPendingCookieOptions,
  type WildzProofSession
} from "@/lib/receiz/wildz-proof-session";
import { parseWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";

export const runtime = "nodejs";

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" }
  });
}

function requestedCoordinate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as { actorId?: unknown; profileHandle?: unknown; vaultKeyId?: unknown };
  if (typeof body.actorId !== "string"
    || typeof body.profileHandle !== "string"
    || typeof body.vaultKeyId !== "string"
    || !/^receiz_vault_[a-f0-9]{32}$/.test(body.vaultKeyId)) return null;
  const coordinate = parseWildzPlayerCoordinate(body.profileHandle);
  return coordinate?.actorId === body.actorId
    ? { ...coordinate, vaultKeyId: body.vaultKeyId }
    : null;
}

function sameCoordinate(session: WildzProofSession, actorId: string, profileHandle: string) {
  return session.actorId === actorId && session.profileHandle === profileHandle;
}

function canSatisfyVaultCommit(
  session: WildzProofSession,
  coordinate: { actorId: string; profileHandle: string; vaultKeyId: string }
) {
  return sameCoordinate(session, coordinate.actorId, coordinate.profileHandle)
    && (session.authority === "identity-key" || session.keyId === coordinate.vaultKeyId);
}

function isSameOriginRequest(request: NextRequest) {
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return false;
  try {
    const origin = new URL(rawOrigin).origin;
    if (origin === request.nextUrl.origin) return true;
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.trim();
    if (!host) return false;
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || request.nextUrl.protocol.replace(/:$/, "");
    return origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)
    || request.headers.get("x-wildz-session-intent") !== "vault-commit") {
    return json({ status: "unavailable", error: "wildz_vault_commit_forbidden" }, 403);
  }
  const coordinate = requestedCoordinate(await request.json().catch(() => null));
  if (!coordinate) return json({ status: "unavailable", error: "wildz_vault_commit_invalid" }, 400);

  let pending: WildzProofSession;
  try {
    pending = readWildzVaultPendingAdmissionCookie(request);
  } catch {
    try {
      const current = readWildzProofSessionCookie(request);
      return canSatisfyVaultCommit(current, coordinate)
        ? json(publicWildzProofSession(current))
        : json({ status: "unavailable", error: "wildz_vault_commit_mismatch" }, 409);
    } catch {
      return json({ status: "unavailable", error: "wildz_vault_commit_required" }, 401);
    }
  }

  if (!sameCoordinate(pending, coordinate.actorId, coordinate.profileHandle)
    || pending.keyId !== coordinate.vaultKeyId) {
    return json({ status: "unavailable", error: "wildz_vault_commit_mismatch" }, 409);
  }

  let admitted = pending;
  try {
    const current = readWildzProofSessionCookie(request);
    if (current.authority === "identity-key"
      && sameCoordinate(current, coordinate.actorId, coordinate.profileHandle)) {
      admitted = retainWildzVaultCardAdmission(current, pending);
    }
  } catch {
    // A verified pending Vault is sufficient for its scoped Wildz recovery session.
  }

  const response = json(publicWildzProofSession(admitted));
  response.cookies.set(
    WILDZ_PROOF_SESSION_COOKIE,
    packWildzProofSession(admitted),
    wildzProofSessionCookieOptions()
  );
  response.cookies.set(
    WILDZ_VAULT_PENDING_COOKIE,
    "",
    { ...wildzVaultPendingCookieOptions(), maxAge: 0 }
  );
  return response;
}
