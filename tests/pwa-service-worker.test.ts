import assert from "node:assert/strict";
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

test("installation precaches the exact public shell without activating early", async () => {
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
    "/offline"
  ].sort());
  const rootRequest = worker.fetchCalls.find((request) => request.url === "https://wildz.quest/");
  assert.ok(rootRequest instanceof Request);
  assert.equal(rootRequest.credentials, "omit");
  assert.equal(rootRequest.cache, "no-store");
  const offlineRequest = worker.fetchCalls.find((request) => request.url === "https://wildz.quest/offline");
  assert.ok(offlineRequest instanceof Request);
  assert.equal(offlineRequest.credentials, "omit");
  assert.equal(offlineRequest.cache, "no-store");
  assert.equal(worker.skippedWaiting, false, "a new worker waits for explicit update approval");
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
