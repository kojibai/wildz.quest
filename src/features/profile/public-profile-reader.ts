import { canonicalWildzHandle, sanitizePublicWildzProfile } from "./public-profile";

/** Public profile loading carries no publication, Wallet or signing runtime. */
export async function fetchPublicWildzProfile(username: string, fetcher: typeof fetch = globalThis.fetch, options: { signal?: AbortSignal } = {}) {
  const handle = canonicalWildzHandle(username);
  const response = await fetcher(`/api/profiles/${encodeURIComponent(handle.slice(1))}`, {
    signal: options.signal, cache: "no-store", credentials: "omit",
    headers: { accept: "application/json", "cache-control": "no-cache" }
  });
  const value = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (response.status === 404) return null;
  if (!response.ok || value?.ok !== true || !value.profile || typeof value.profile !== "object" || Array.isArray(value.profile)) {
    throw new Error(typeof value?.error === "string" ? value.error : "wildz_public_profile_recovery_failed");
  }
  const profile = sanitizePublicWildzProfile(value.profile as Record<string, unknown>);
  return profile.username === handle ? profile : null;
}
