import type { NextRequest } from "next/server";
import { createReceizCommerceAdapter } from "./adapter";
import { loadReceizConnectProfile, type ReceizConnectProfile } from "./connect-profile";
import { playerReceizAccessToken, receizRequestSession } from "./session";
import { readWildzProofSessionCookie } from "./wildz-proof-session";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { receizOidcScopesForRails, type ReceizValueRailV122 } from "@receiz/sdk";

const WALLET_READ_SCOPE = "receiz:wallet.read";

export type WildsWalletReadAuthority = Readonly<{
  accessToken: string;
  ownerReceizId: string;
  actorId: string;
  profileHandle: string;
}>;

export type WildsWalletRouteAuthorityDependencies = Readonly<{
  loadProfile(accessToken: string): Promise<Pick<ReceizConnectProfile, "id" | "handle"> | null>;
  introspect(accessToken: string): Promise<unknown>;
}>;

const DEFAULT_DEPENDENCIES: WildsWalletRouteAuthorityDependencies = {
  loadProfile: loadReceizConnectProfile,
  introspect: (accessToken) => createReceizCommerceAdapter({ accessToken }).introspectAccessToken()
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function scopesFromIntrospection(value: Record<string, unknown>) {
  return typeof value.scope === "string" ? new Set(value.scope.split(/\s+/).filter(Boolean)) : new Set<string>();
}

function isAuthorityFailure(cause: unknown) {
  const status = cause && typeof cause === "object" && "status" in cause ? Number((cause as { status?: unknown }).status) : null;
  const message = cause instanceof Error ? cause.message : "";
  return status === 401 || /(?:^|\b)(?:401|unauthorized|token[_ -]?revoked)(?:\b|$)/i.test(message);
}

async function loadProfileOrThrow(
  accessToken: string,
  dependencies: WildsWalletRouteAuthorityDependencies
) {
  try {
    return await dependencies.loadProfile(accessToken);
  } catch (cause) {
    throw new Error(isAuthorityFailure(cause)
      ? "receiz_wallet_authority_revoked"
      : "receiz_wallet_profile_resolution_unavailable");
  }
}

async function introspectOrThrow(
  accessToken: string,
  dependencies: WildsWalletRouteAuthorityDependencies
) {
  try {
    return asRecord(await dependencies.introspect(accessToken));
  } catch (cause) {
    throw new Error(isAuthorityFailure(cause)
      ? "receiz_wallet_authority_revoked"
      : "receiz_wallet_introspection_unavailable");
  }
}

export function wildsWalletAuthorityStatusFor(code: string) {
  if (code === "receiz_wallet_authority_required" || code === "receiz_wallet_authority_revoked" || code === "receiz_wallet_read_scope_required" || code === "receiz_wallet_phi_scope_required") return 401;
  if (code === "receiz_wallet_profile_binding_invalid" || code === "receiz_wallet_token_binding_invalid") return 403;
  if (code === "receiz_wallet_profile_resolution_unavailable" || code === "receiz_wallet_introspection_unavailable") return 503;
  return 502;
}

export function requireWildsWalletPhiAuthorityScopes(
  grantedScopes: readonly string[],
  rail: ReceizValueRailV122
) {
  const granted = new Set(grantedScopes);
  const required = receizOidcScopesForRails(rail);
  if (!required.every((scope) => granted.has(scope))) {
    throw new Error("receiz_wallet_phi_scope_required");
  }
  return Object.freeze(required);
}

export async function resolveWildsWalletReadAuthority(
  request: NextRequest,
  dependencies: WildsWalletRouteAuthorityDependencies = DEFAULT_DEPENDENCIES
): Promise<WildsWalletReadAuthority> {
  const session = receizRequestSession(request);
  const accessToken = playerReceizAccessToken(session);
  if (!accessToken || !session.grantedScopes.includes(WALLET_READ_SCOPE)) {
    throw new Error("receiz_wallet_read_scope_required");
  }
  let proofSession: ReturnType<typeof readWildzProofSessionCookie>;
  try {
    proofSession = readWildzProofSessionCookie(request);
  } catch {
    throw new Error("receiz_wallet_authority_required");
  }
  if (proofSession.authority !== "identity-key") throw new Error("receiz_wallet_authority_required");

  const profile = await loadProfileOrThrow(accessToken, dependencies);
  if (!profile?.id || !profile.handle || !sameWildzPlayerCoordinate(profile.handle, proofSession.profileHandle)) {
    throw new Error("receiz_wallet_profile_binding_invalid");
  }
  const introspection = await introspectOrThrow(accessToken, dependencies);
  if (introspection.active !== true) throw new Error("receiz_wallet_authority_revoked");
  if (typeof introspection.sub !== "string" || introspection.sub !== profile.id) {
    throw new Error("receiz_wallet_token_binding_invalid");
  }
  if (!scopesFromIntrospection(introspection).has(WALLET_READ_SCOPE)) {
    throw new Error("receiz_wallet_read_scope_required");
  }
  return Object.freeze({
    accessToken,
    ownerReceizId: profile.id,
    actorId: proofSession.actorId,
    profileHandle: proofSession.profileHandle
  });
}
