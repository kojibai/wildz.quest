const WILDZ_APPLY_UPDATE_MESSAGE = "WILDZ_APPLY_UPDATE";
const WILDZ_CARE_SCHEDULE_MESSAGE = "WILDZ_CARE_SCHEDULE";
const WILDZ_PREPARE_LOCAL_VOICE_MESSAGE = "WILDZ_PREPARE_LOCAL_VOICE";
const CARE_SCHEDULE_CACHE = "wildz-private-care-schedule-v1";
const CARE_SCHEDULE_URL = "/__wildz/private-care-schedule";
const CARE_LEVELS = new Set(["needs-care", "urgent", "sick", "dead"]);
const release = new URL(self.location.href).searchParams.get("release") || "v3.0.0";
const SHELL_CACHE = `wildz-shell-${release}`;
const PUBLIC_CACHE = `wildz-public-${release}`;
const AUDIO_CACHE = "wildz-audio-dcf17ad4caf7";
const LOCAL_VOICE_CACHE = "wildz-local-proof-voice-kokoro82m-q8-v1";
const LOCAL_VOICE_READY_URL = "/__wildz/local-proof-voice-ready";
let localVoicePreparationPromise = null;
const LOCAL_VOICE_URLS = [
  "/models/onnx-community/Kokoro-82M-v1.0-ONNX/config.json",
  "/models/onnx-community/Kokoro-82M-v1.0-ONNX/tokenizer.json",
  "/models/onnx-community/Kokoro-82M-v1.0-ONNX/tokenizer_config.json",
  "/models/onnx-community/Kokoro-82M-v1.0-ONNX/wildz-manifest.json",
  "/models/onnx-community/Kokoro-82M-v1.0-ONNX/onnx/model_quantized.onnx",
  "/models/onnx-community/Kokoro-82M-v1.0-ONNX/voices/af_heart.bin",
  "/models/onnx-community/Kokoro-82M-v1.0-ONNX/voices/am_michael.bin",
  "/vendor/onnxruntime/ort-wasm-simd-threaded.mjs",
  "/vendor/onnxruntime/ort-wasm-simd-threaded.wasm",
  "/vendor/onnxruntime/ort-wasm-simd-threaded.jsep.mjs",
  "/vendor/onnxruntime/ort-wasm-simd-threaded.jsep.wasm"
];
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

function isLocalVoiceAsset(pathname) {
  return pathname.startsWith("/models/onnx-community/Kokoro-82M-v1.0-ONNX/")
    || pathname.startsWith("/vendor/onnxruntime/");
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
  if (isLocalVoiceAsset(url.pathname)) return "local-voice";
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
      || key.startsWith("wildz-audio-") || key.startsWith("wildz-local-proof-voice-")
    ) && key !== SHELL_CACHE && key !== PUBLIC_CACHE && key !== AUDIO_CACHE && key !== LOCAL_VOICE_CACHE)
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

async function localVoiceCacheFirst(request) {
  const cache = await caches.open(LOCAL_VOICE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isBaseCacheable(response)) await cache.put(request, response.clone());
  return response;
}

async function populateLocalVoicePayload() {
  const cache = await caches.open(LOCAL_VOICE_CACHE);
  if (await cache.match(LOCAL_VOICE_READY_URL)) return;
  for (const pathname of LOCAL_VOICE_URLS) {
    const request = new Request(`${self.location.origin}${pathname}`, {
      cache: "reload",
      credentials: "omit"
    });
    if (await cache.match(request)) continue;
    const response = await fetch(request);
    if (!isBaseCacheable(response)) throw new Error("wildz_local_voice_payload_unavailable");
    await cache.put(request, response);
  }
  await cache.put(LOCAL_VOICE_READY_URL, new Response("ready", {
    headers: { "content-type": "text/plain", "cache-control": "no-store" }
  }));
}

function prepareLocalVoicePayload() {
  if (localVoicePreparationPromise) return localVoicePreparationPromise;
  const operation = populateLocalVoicePayload().finally(() => {
    if (localVoicePreparationPromise === operation) localVoicePreparationPromise = null;
  });
  localVoicePreparationPromise = operation;
  return operation;
}

self.addEventListener("install", (event) => {
  event.waitUntil(installPublicShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activateCurrentCaches());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === WILDZ_APPLY_UPDATE_MESSAGE) {
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === WILDZ_CARE_SCHEDULE_MESSAGE) {
    event.waitUntil((async () => {
      const cache = await caches.open(CARE_SCHEDULE_CACHE);
      const priorResponse = await cache.match(`${CARE_SCHEDULE_URL}:notified`);
      const prior = await priorResponse?.json().catch(() => null);
      const notifiedIds = new Set(Array.isArray(prior?.notifiedIds) ? prior.notifiedIds.filter((id) => typeof id === "string").slice(-256) : []);
      const entries = (Array.isArray(event.data.entries) ? event.data.entries : []).filter((entry) => (
        entry && typeof entry.id === "string" && entry.id.length <= 240
        && typeof entry.assetId === "string" && entry.assetId.length <= 160
        && typeof entry.name === "string" && entry.name.length <= 80
        && typeof entry.body === "string" && entry.body.length <= 240
        && CARE_LEVELS.has(entry.level)
        && Number.isFinite(Date.parse(entry.notifyAt))
      )).slice(0, 128).map((entry) => ({
        id: entry.id,
        assetId: entry.assetId,
        name: entry.name,
        body: entry.body,
        level: entry.level,
        notifyAt: new Date(entry.notifyAt).toISOString()
      }));
      await cache.put(CARE_SCHEDULE_URL, new Response(JSON.stringify({ entries }), {
        headers: { "content-type": "application/json", "cache-control": "no-store" }
      }));
      await cache.put(`${CARE_SCHEDULE_URL}:notified`, new Response(JSON.stringify({ notifiedIds: [...notifiedIds] }), {
        headers: { "content-type": "application/json", "cache-control": "no-store" }
      }));
    })());
  }
  if (event.data?.type === WILDZ_PREPARE_LOCAL_VOICE_MESSAGE) {
    event.waitUntil(prepareLocalVoicePayload());
  }
});

async function notifyDueCreatureCare() {
  const cache = await caches.open(CARE_SCHEDULE_CACHE);
  const response = await cache.match(CARE_SCHEDULE_URL);
  const notifiedResponse = await cache.match(`${CARE_SCHEDULE_URL}:notified`);
  const schedule = await response?.json().catch(() => null);
  const notifiedState = await notifiedResponse?.json().catch(() => null);
  const notifiedIds = new Set(Array.isArray(notifiedState?.notifiedIds) ? notifiedState.notifiedIds : []);
  const now = Date.now();
  const due = Array.isArray(schedule?.entries)
    ? schedule.entries.filter((entry) => Number.isFinite(Date.parse(entry.notifyAt)) && Date.parse(entry.notifyAt) <= now && !notifiedIds.has(entry.id)).slice(0, 3)
    : [];
  for (const entry of due) {
    await self.registration.showNotification(`${entry.name} needs you`, {
      body: entry.body,
      tag: `wildz-care:${entry.assetId}:${entry.level}`,
      renotify: false,
      data: { url: "/", assetId: entry.assetId }
    });
    notifiedIds.add(entry.id);
  }
  if (due.length) await cache.put(`${CARE_SCHEDULE_URL}:notified`, new Response(JSON.stringify({ notifiedIds: [...notifiedIds].slice(-256) }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  }));
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "wildz-creature-care") event.waitUntil(notifyDueCreatureCare());
});

self.addEventListener("notificationclick", (event) => {
  if (!event.notification?.tag?.startsWith("wildz-care:")) return;
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients[0];
    if (existing) {
      await existing.focus();
      return;
    }
    await self.clients.openWindow(event.notification.data?.url || "/");
  }));
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
    case "local-voice":
      event.respondWith(localVoiceCacheFirst(request));
      return;
    default:
      event.respondWith(networkOnly(request));
  }
});
