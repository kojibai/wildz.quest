import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createWorkerHarness } from "./support/pwa-worker-harness";

const RELEASE = "qa-a";
const SHELL_CACHE = `wildz-shell-${RELEASE}`;
const PUBLIC_CACHE = `wildz-public-${RELEASE}`;

test("activation keeps only the current release caches and controls open clients", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    cacheNames: [
      "wildz-shell-old-release",
      "wildz-public-old-release",
      "other-library-cache",
      SHELL_CACHE,
      PUBLIC_CACHE
    ]
  });

  await worker.dispatchExtendable("activate");

  assert.equal(worker.claimed, true);
  assert.deepEqual(await worker.caches.keys(), ["other-library-cache", SHELL_CACHE, PUBLIC_CACHE]);
});

test("installation precaches the exact public shell and waits for explicit update consent", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async (request) => new URL(request.url).pathname === "/"
      ? new Response('<html><script src="/_next/static/chunks/app.js"></script></html>', {
          headers: { "content-type": "text/html; charset=utf-8" }
        })
      : new URL(request.url).pathname === "/offline"
        ? new Response('<html><script src="/_next/static/chunks/offline.js"></script></html>', {
            headers: { "content-type": "text/html; charset=utf-8" }
          })
      : new Response("chunk", { headers: { "content-type": "text/javascript" } })
  });

  await worker.dispatchExtendable("install");

  const cachedPaths = (await worker.cacheKeys(SHELL_CACHE)).map((url) => new URL(url).pathname).sort();
  assert.deepEqual(cachedPaths, [
    "/",
    "/_next/static/chunks/app.js",
    "/_next/static/chunks/offline.js",
    "/brand/wildz-mark.svg",
    "/brand/wildz-wordmark.svg",
    "/icons/icon-180.png",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/offline",
    "/zk/document_seal_proof_final.zkey",
    "/zk/document_seal_proof_js/sigil_proof.wasm",
    "/snarkjs.min.js",
  ].sort());
  const rootRequest = worker.fetchCalls.find((request) => request.url === "https://wildz.quest/");
  assert.ok(rootRequest instanceof Request);
  assert.equal(rootRequest.credentials, "omit");
  assert.equal(rootRequest.cache, "no-store");
  const offlineRequest = worker.fetchCalls.find((request) => request.url === "https://wildz.quest/offline");
  assert.ok(offlineRequest instanceof Request);
  assert.equal(offlineRequest.credentials, "omit");
  assert.equal(offlineRequest.cache, "no-store");
  assert.equal(worker.skippedWaiting, false, "install must not replace a running game before the player applies the update");
});

test("root navigation prefers the deployed document over a stale cached Next shell", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => new Response("fresh release", { headers: { "content-type": "text/html" } })
  });
  await worker.putCached(SHELL_CACHE, "/", new Response("stale release", { headers: { "content-type": "text/html" } }));

  const result = await worker.dispatchFetch({
    method: "GET",
    mode: "navigate",
    url: "https://wildz.quest/"
  });

  assert.equal(await result.response?.text(), "fresh release");
  assert.equal(worker.fetchCalls.length, 1);
  assert.equal(await (await worker.readCached(SHELL_CACHE, "/"))?.text(), "fresh release");
});

test("installation rejects a personalized root document", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => new Response("<html>private shell</html>", {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "set-cookie": "session=private"
      }
    })
  });

  await assert.rejects(worker.dispatchExtendable("install"), /wildz_shell_unavailable/);
});

test("only the shared update message activates a waiting worker", async () => {
  const worker = createWorkerHarness({ release: RELEASE });

  await worker.dispatchMessage({ type: "SKIP_WAITING" });
  assert.equal(worker.skippedWaiting, false);

  await worker.dispatchMessage({ type: "WILDZ_APPLY_UPDATE" });
  assert.equal(worker.skippedWaiting, true);
});

test("apply update keeps skipWaiting alive through the service-worker event", () => {
  const source = readFileSync("public/sw.js", "utf8");
  assert.match(source, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
});

test("private care alerts are scheduled without entering the gameplay fetch path", () => {
  const source = readFileSync("public/sw.js", "utf8");
  assert.match(source, /WILDZ_CARE_SCHEDULE/);
  assert.match(source, /periodicsync/);
  assert.match(source, /showNotification/);
  assert.doesNotMatch(source, /SHELL_URLS\s*=\s*\[[^\]]*private-care-schedule/s);
});

test("network-only APIs are fetched but never cached", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => new Response('{"authenticated":false}', {
      headers: { "content-type": "application/json" }
    })
  });
  const request = {
    method: "GET",
    mode: "cors",
    url: "https://wildz.quest/api/auth/receiz/session"
  };

  const result = await worker.dispatchFetch(request);

  assert.equal(await result.response?.text(), '{"authenticated":false}');
  assert.equal(worker.fetchCalls.length, 1);
  assert.deepEqual(await worker.cacheKeys(PUBLIC_CACHE), []);
});

test("release-distinct shell assets are served cache-first", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => { throw new Error("shell assets should not need the network"); }
  });
  await worker.putCached(SHELL_CACHE, "/icons/icon-192.png", new Response("release icon"));

  const result = await worker.dispatchFetch({
    method: "GET",
    mode: "cors",
    url: "https://wildz.quest/icons/icon-192.png"
  });

  assert.equal(await result.response?.text(), "release icon");
  assert.equal(worker.fetchCalls.length, 0);
});

test("message push wakes closed PWAs with a private notification and delivers updates to open clients", async () => {
  const messages: unknown[] = [];
  const worker = createWorkerHarness({ clients: [{ url: "https://wildz.quest/", postMessage: (data) => messages.push(data), focus: async () => {}, navigate: async () => {} }] });
  const payload = { type: "wildz-message", messageId: "direct-message:123", recipientId: "@recipient", peer: { id: "@sender", handle: "Sender" }, title: "Sender messaged you", body: "Do not show private message text on the lock screen" };
  await worker.dispatchExtendable("push", { data: { json: () => payload } });
  assert.equal(messages.length, 1);
  assert.equal(worker.notifications.length, 1);
  assert.equal(worker.notifications[0].title, payload.title);
  assert.equal(worker.notifications[0].options.body, "Open Wildz to read your message.");
  assert.equal(worker.notifications[0].options.tag, "wildz-message:direct-message:123");
});

test("message notification clicks cold-open the addressed conversation", async () => {
  const worker = createWorkerHarness();
  let closed = false;
  await worker.dispatchExtendable("notificationclick", { notification: {
    tag: "wildz-message:123", data: { recipientId: "@recipient", peer: { id: "@sender", handle: "Sender & Friend" } }, close: () => { closed = true; }
  } });
  assert.equal(closed, true);
  const url = new URL(worker.openedWindows[0]);
  assert.equal(url.origin, "https://wildz.quest");
  assert.equal(url.searchParams.get("messages"), "1");
  assert.equal(url.searchParams.get("recipientId"), "@recipient");
  assert.equal(url.searchParams.get("peerHandle"), "Sender & Friend");
});

test("invalid message pushes do not display arbitrary notifications", async () => {
  const worker = createWorkerHarness();
  await worker.dispatchExtendable("push", { data: { json: () => { throw new Error("invalid JSON"); } } });
  await worker.dispatchExtendable("push", { data: { json: () => ({ type: "wildz-message", title: "Untrusted" }) } });
  assert.equal(worker.notifications.length, 0);
});
