import { platform } from "../platform";

const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "blog",
  "docs",
  "help",
  "localhost",
  "receiz",
  "support",
  "www"
]);

function stripProtocolAndPath(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function normalizeTenantSlug(input: string, rootDomain = platform.domain) {
  const host = stripProtocolAndPath(input);
  const withoutRoot = host.endsWith(`.${rootDomain}`)
    ? host.slice(0, -1 * (`.${rootDomain}`).length)
    : host;
  const firstLabel = withoutRoot.split(".")[0] ?? "";
  const slug = firstLabel
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  if (!slug || slug.length < 3) {
    throw new Error("Subdomain must be at least 3 letters or numbers.");
  }

  if (RESERVED_SUBDOMAINS.has(slug)) {
    throw new Error("That subdomain is reserved.");
  }

  return slug;
}

export function subdomainForSlug(slug: string, rootDomain = platform.domain) {
  return `${normalizeTenantSlug(slug, rootDomain)}.${rootDomain}`;
}

export function normalizeCustomDomain(input: string) {
  const domain = stripProtocolAndPath(input).replace(/^\*\./, "");

  if (!domain.includes(".") || domain.length < 4) {
    throw new Error("Enter a full domain, like shop.example.com.");
  }

  if (domain.endsWith(`.${platform.domain}`) || domain === platform.domain) {
    throw new Error(`Use the free subdomain field for ${platform.domain} domains.`);
  }

  if (!/^[a-z0-9.-]+$/.test(domain) || domain.includes("..")) {
    throw new Error("Domain can only contain letters, numbers, dashes, and dots.");
  }

  return domain;
}

export function cleanHost(host: string | null | undefined) {
  return stripProtocolAndPath(host ?? "");
}

export function tenantSlugFromHost(host: string | null | undefined, rootDomain = platform.domain) {
  const clean = cleanHost(host);
  const localDevSuffix = ".localhost";

  if (clean.endsWith(localDevSuffix)) {
    const localSlug = clean.slice(0, -1 * localDevSuffix.length);
    if (!localSlug || localSlug.includes(".")) return null;
    return localSlug;
  }

  if (!clean.endsWith(`.${rootDomain}`)) return null;

  const slug = clean.slice(0, -1 * (`.${rootDomain}`).length);
  if (!slug || slug === "www" || slug.includes(".")) return null;

  return slug;
}

export function isPlatformHost(host: string | null | undefined, rootDomain = platform.domain) {
  const clean = cleanHost(host);
  return (
    clean === rootDomain ||
    clean === `www.${rootDomain}` ||
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean.startsWith("localhost:") ||
    clean.endsWith(".vercel.app")
  );
}

export function shouldBypassTenantRouting(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}
