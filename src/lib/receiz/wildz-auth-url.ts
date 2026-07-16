export const WILDZ_RECEIZ_SESSION_SCOPE = "wildz.quest:v1";

function httpOrigin(value: string) {
  const parsed = new URL(value);
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:")
    || parsed.username
    || parsed.password) {
    throw new Error("wildz_auth_origin_invalid");
  }
  return parsed.origin;
}

export function canonicalWildzAppOrigin(
  requestOrigin: string,
  configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
) {
  try {
    if (configuredSiteUrl) return httpOrigin(configuredSiteUrl);
    if (process.env.NODE_ENV !== "production") return httpOrigin(requestOrigin);
  } catch {
    throw new Error("wildz_auth_origin_invalid");
  }
  throw new Error("wildz_auth_origin_invalid");
}

export function isAllowedWildzAuthOrigin(requestOrigin: string, allowedOrigins: readonly string[]) {
  try {
    const request = httpOrigin(requestOrigin);
    return allowedOrigins.some((allowed) => httpOrigin(allowed) === request);
  } catch {
    return false;
  }
}

export function normalizeWildzReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const parsed = new URL(value, "https://wildz.quest");
    if (parsed.origin !== "https://wildz.quest") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function wildzReceizCallbackUrl(origin: string) {
  return new URL("/api/auth/receiz/callback", origin).toString();
}
