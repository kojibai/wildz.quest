import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "./wildz-player-coordinate";

type ReceizConnectSession = {
  status?: unknown;
  profileHandle?: unknown;
};

export type WildzNativeProofResume =
  | { kind: "card"; assetId: string }
  | { kind: "vault" };

/**
 * Enters the SDK v113 tenant-session rail when native Record -> Seal authority
 * is not already present. The token remains an HttpOnly transport credential;
 * the admitted Receiz ID and resulting sealed proof object remain authority.
 */
export async function ensureWildzNativeProofSession(
  ownerReceizId: string,
  resume: WildzNativeProofResume
) {
  if (typeof window === "undefined") throw new Error("wildz_native_session_browser_required");
  const owner = parseWildzPlayerCoordinate(ownerReceizId);
  if (!owner) throw new Error("wildz_proof_object_owner_mismatch");
  const response = await fetch("/api/auth/receiz/me", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json", "cache-control": "no-cache" }
  });
  const session = await response.json().catch(() => null) as ReceizConnectSession | null;
  if (response.ok && session?.status === "connected" && typeof session.profileHandle === "string") {
    if (!sameWildzPlayerCoordinate(owner.profileHandle, session.profileHandle)) {
      throw new Error("wildz_proof_object_owner_mismatch");
    }
    return true;
  }

  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.delete("receiz");
  returnUrl.searchParams.delete("receiz_error");
  returnUrl.searchParams.set("receizResume", resume.kind);
  if (resume.kind === "card") returnUrl.searchParams.set("receizAssetId", resume.assetId);
  else returnUrl.searchParams.delete("receizAssetId");
  const connectUrl = new URL("/api/auth/receiz/start", window.location.origin);
  connectUrl.searchParams.set("returnTo", `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`);
  connectUrl.searchParams.set("usernameHint", owner.actorId);
  window.location.assign(connectUrl.toString());
  return false;
}

export function consumeWildzNativeProofResume(): WildzNativeProofResume | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  if (url.searchParams.get("receiz") !== "connected") return null;
  const kind = url.searchParams.get("receizResume");
  const assetId = url.searchParams.get("receizAssetId");
  const resume = kind === "vault"
    ? { kind: "vault" as const }
    : kind === "card" && assetId
      ? { kind: "card" as const, assetId }
      : null;
  if (!resume) return null;
  for (const key of ["receiz", "receizResume", "receizAssetId"]) url.searchParams.delete(key);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  return resume;
}
