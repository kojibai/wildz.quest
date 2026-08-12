const WILDZ_APPLY_UPDATE_MESSAGE = "WILDZ_APPLY_UPDATE";
const release = new URL(self.location.href).searchParams.get("release") || "v3.0.0";
const SHELL_CACHE = `wildz-shell-${release}`;
const PUBLIC_CACHE = `wildz-public-${release}`;
const AUDIO_CACHE = "wildz-audio-dcf17ad4caf7";
const SHELL_URLS = [
  "/",
  "/offline",
  "/brand/wildz-mark.svg",
  "/brand/wildz-wordmark.svg",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];
const PUBLIC_DOCUMENT = /^\/(?:cards\/[^/]+|u\/[^/]+)\/?$/;
const CARD_GET = /^\/api\/cards\/[^/]+(?:\/image)?\/?$/;
const PUBLIC_PROFILE_GET = /^\/api\/profiles\/[^/]+\/?$/;
const NETWORK_ONLY_PREFIXES = [
  "/api/auth",
  "/api/wilds",
  "/api/market",
  "/api/receiz",
  "/api/document-verify"
];

function isImmutableShellAsset(pathname) {
  return pathname.startsWith("/_next/static/")
    || pathname.startsWith("/brand/")
    || pathname.startsWith("/icons/");
}

function isWildzAudio(pathname) {
  return pathname.startsWith("/audio/wildz/");
}

function matchesPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function hasAuthorization(request) {
  return request.headers?.has("authorization") === true;
}

function classifyWildzRequest(request, url = new URL(request.url)) {
  if (request.method !== "GET" || hasAuthorization(request)) return "network-only";
  if (url.pathname === "/" || url.pathname === "/offline" || isImmutableShellAsset(url.pathname)) {
    return "shell";
  }
  if (isWildzAudio(url.pathname)) return "audio";
  if (request.mode === "navigate" && PUBLIC_DOCUMENT.test(url.pathname)) return "public-document";
  if (request.credentials === "omit" && PUBLIC_PROFILE_GET.test(url.pathname)) return "public-profile-get";
  if (CARD_GET.test(url.pathname)) return "card-get";
  if (NETWORK_ONLY_PREFIXES.some((prefix) => matchesPrefix(url.pathname, prefix))) return "network-only";
  return "network-only";
}

function hasWildcardVary(response) {
  return (response.headers.get("vary") ?? "")
    .split(",")
    .some((value) => value.trim() === "*");
}

function isBaseCacheable(response) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  return response.ok
    && response.type !== "opaque"
    && !response.redirected
    && !cacheControl.includes("no-store")
    && !cacheControl.includes("private")
    && !response.headers.has("set-cookie")
    && !hasWildcardVary(response);
}

function isCacheableDocument(response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return isBaseCacheable(response) && contentType.includes("text/html");
}

function isCacheableCard(response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return isBaseCacheable(response)
    && (contentType.includes("application/json") || contentType.startsWith("image/"));
}

function isCacheablePublicProfile(response) {
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return isBaseCacheable(response)
    && cacheControl.split(",").some((value) => value.trim() === "public")
    && contentType.includes("application/json")
    && response.headers.get("x-wildz-public-projection") === "sanitized";
}

async function installPublicShell() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(SHELL_URLS.filter((url) => url !== "/" && url !== "/offline"));

  const shellDocuments = await Promise.all(["/", "/offline"].map(async (pathname) => {
    const request = new Request(`${self.location.origin}${pathname}`, {
      cache: "no-store",
      credentials: "omit"
    });
    const response = await fetch(request);
    if (!isCacheableDocument(response) || response.headers.has("set-cookie")) {
      throw new Error("wildz_shell_unavailable");
    }
    const html = await response.clone().text();
    await cache.put(pathname, response);
    return html;
  }));

  const buildAssets = shellDocuments.flatMap((html) => [...html.matchAll(/(?:src|href)=["'](\/_next\/static\/[^"']+)["']/g)])
    .map((match) => new URL(match[1], self.location.origin).href);
  await Promise.all([...new Set(buildAssets)].map(async (assetUrl) => {
    const request = new Request(assetUrl, { cache: "reload", credentials: "omit" });
    const response = await fetch(request);
    if (isBaseCacheable(response)) await cache.put(request, response);
  }));
}

async function activateCurrentCaches() {
  const keys = await caches.keys();
  await Promise.all(keys
    .filter((key) => (
      key.startsWith("wildz-shell-") || key.startsWith("wildz-public-")
      || key.startsWith("wildz-audio-")
    ) && key !== SHELL_CACHE && key !== PUBLIC_CACHE && key !== AUDIO_CACHE)
    .map((key) => caches.delete(key)));
  await self.clients.claim();
}

async function offlineResponse() {
  const cache = await caches.open(SHELL_CACHE);
  return await cache.match("/offline") || Response.error();
}

async function shellCacheFirst(request, url) {
  const cache = await caches.open(SHELL_CACHE);
  const cacheKey = url.pathname === "/" ? "/" : request;
  if (request.mode === "navigate") {
    try {
      const response = await fetch(request);
      if (isCacheableDocument(response)) await cache.put(cacheKey, response.clone());
      return response;
    } catch {
      return await cache.match(cacheKey) || await offlineResponse();
    }
  }
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isBaseCacheable(response)) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    if (request.mode === "navigate") return await offlineResponse();
    throw error;
  }
}

async function publicDocumentNetworkFirst(request) {
  const cache = await caches.open(PUBLIC_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheableDocument(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return await cache.match(request) || await offlineResponse();
  }
}

async function publicCardNetworkFirst(request) {
  const cache = await caches.open(PUBLIC_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheableCard(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return await cache.match(request) || Response.error();
  }
}

async function publicProfileNetworkFirst(request) {
  const cache = await caches.open(PUBLIC_CACHE);
  try {
    const response = await fetch(request);
    if (isCacheablePublicProfile(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return await cache.match(request) || Response.error();
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (error) {
    if (request.mode === "navigate") return await offlineResponse();
    throw error;
  }
}

async function audioCacheFirst(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isBaseCacheable(response)) await cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(installPublicShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activateCurrentCaches());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === WILDZ_APPLY_UPDATE_MESSAGE) self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  switch (classifyWildzRequest(request, url)) {
    case "shell":
      event.respondWith(shellCacheFirst(request, url));
      return;
    case "public-document":
      event.respondWith(publicDocumentNetworkFirst(request));
      return;
    case "public-profile-get":
      event.respondWith(publicProfileNetworkFirst(request));
      return;
    case "card-get":
      event.respondWith(publicCardNetworkFirst(request));
      return;
    case "audio":
      event.respondWith(audioCacheFirst(request));
      return;
    default:
      event.respondWith(networkOnly(request));
  }
});
