export const PROFILE_USERNAME_MIN = 3;
export const PROFILE_USERNAME_MAX = 24;
export const PROFILE_USERNAME_RE = /^[a-z0-9_]{3,24}$/;

const RESERVED_PROFILE_USERNAMES = new Set([
  "account",
  "admin",
  "affiliate",
  "api",
  "assetseal",
  "auth",
  "dashboard",
  "deposit-proof",
  "developers",
  "favicon",
  "identity",
  "login",
  "make",
  "milestone-acceptance-proof",
  "og",
  "opengraph-image",
  "payments",
  "powered-by",
  "programs",
  "privacy",
  "profile",
  "proof-of-delivery",
  "r",
  "robots",
  "seal",
  "session",
  "signin",
  "sitemap",
  "ssr",
  "standards",
  "status",
  "terms",
  "trust",
  "twitter-image",
  "u",
  "upgrade",
  "v",
  "verifier",
  "verify",
  "what-can-you-do-with-a-receiz",
  "what-is-a-receiz",
  "wireproof",
]);

export function normalizeProfileUsername(raw: string): string {
  const trimmed = (raw ?? "").trim().toLowerCase().replace(/^@+/, "");
  if (!trimmed) return "";

  return trimmed
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, PROFILE_USERNAME_MAX);
}

export function isValidProfileUsername(username: string): boolean {
  return PROFILE_USERNAME_RE.test(username);
}

export function parseProfileUsername(raw: string): string | null {
  const normalized = normalizeProfileUsername(raw);
  if (!normalized) return null;
  return isValidProfileUsername(normalized) ? normalized : null;
}

export function isReservedProfileUsername(username: string): boolean {
  const normalized = normalizeProfileUsername(username);
  if (!normalized) return false;
  return RESERVED_PROFILE_USERNAMES.has(normalized);
}

function compactUid(uid: string): string {
  return (uid ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ensureMinimumLength(candidate: string, uid: string): string {
  if (candidate.length >= PROFILE_USERNAME_MIN) return candidate;

  const suffix = compactUid(uid).slice(0, PROFILE_USERNAME_MIN - candidate.length) || "rx";
  const merged = `${candidate}${suffix}`.slice(0, PROFILE_USERNAME_MAX);
  if (merged.length >= PROFILE_USERNAME_MIN) return merged;

  const fallback = `user${suffix}`.slice(0, PROFILE_USERNAME_MAX);
  return fallback.length >= PROFILE_USERNAME_MIN ? fallback : "user";
}

function syntheticPasskeySuffixFromEmail(email: string): string | null {
  const normalized = (email ?? "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at >= normalized.length - 1) return null;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);

  const brandedMatch = local.match(/^receiz[-_]?([a-z0-9]{4,32})$/);
  if (brandedMatch?.[1]) {
    return brandedMatch[1];
  }

  const legacyMatch = local.match(/^passkey[-_]?([a-z0-9]{4,32})$/);
  if (legacyMatch?.[1] && domain.includes("receiz")) {
    return legacyMatch[1];
  }

  if (domain === "passkey.receiz.local" || domain.endsWith(".passkey.receiz.local")) {
    const fallback = compactUid(local).slice(0, 12);
    return fallback || null;
  }

  return null;
}

export function usernameFromEmailDefault(email: string, uid: string): string {
  const passkeySuffix = syntheticPasskeySuffixFromEmail(email);
  if (passkeySuffix) {
    const branded = normalizeProfileUsername(`receiz_${passkeySuffix}`);
    if (branded) return ensureMinimumLength(branded, uid);
  }

  const localPart = (email ?? "").split("@")[0] ?? "";
  const fromEmail = normalizeProfileUsername(localPart);
  if (fromEmail) return ensureMinimumLength(fromEmail, uid);

  const fromUid = normalizeProfileUsername(`user_${compactUid(uid).slice(0, 12)}`);
  if (fromUid) return ensureMinimumLength(fromUid, uid);

  return "user";
}

export function usernameWithNumericSuffix(base: string, value: number): string {
  if (value <= 0) return base;

  const suffix = String(value);
  const headMax = PROFILE_USERNAME_MAX - suffix.length;
  const safeHead = headMax > 0 ? base.slice(0, headMax) : "";
  const merged = `${safeHead}${suffix}`;
  return ensureMinimumLength(merged, suffix);
}
