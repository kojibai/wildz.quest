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

test("root navigation opens the saved shell while a slow network refresh remains pending", async () => {
  let finishRefresh!: (response: Response) => void;
  const worker = createWorkerHarness({ release: RELEASE, fetch: () => new Promise(resolve => { finishRefresh = resolve; }) });
  await worker.putCached(SHELL_CACHE, "/", new Response("saved release", { headers: { "content-type": "text/html" } }));
  const launch = worker.dispatchFetch({ method: "GET", mode: "navigate", url: "https://wildz.quest/" }, { waitForBackground: false });
  const immediate = await Promise.race([launch, new Promise<null>(resolve => setTimeout(() => resolve(null), 50))]);
  finishRefresh(new Response("fresh release", { headers: { "content-type": "text/html" } }));
  assert.ok(immediate, "a cached launch must not wait for the network");
  assert.equal(await immediate.response?.text(), "saved release");
  assert.equal(immediate.waitCount, 1);
  await immediate.background;
  assert.equal(await (await worker.readCached(SHELL_CACHE, "/"))?.text(), "fresh release");
});

test("root refresh saves matching Next assets before replacing the shell", async () => {
  let finishAsset!: (response: Response) => void;
  const fresh = '<html><script src="/_next/static/chunks/fresh.js"></script></html>';
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async request => new URL(request.url).pathname === "/"
      ? new Response(fresh, { headers: { "content-type": "text/html" } })
      : new Promise(resolve => { finishAsset = resolve; })
  });
  await worker.putCached(SHELL_CACHE, "/", new Response("saved release", { headers: { "content-type": "text/html" } }));
  const result = await worker.dispatchFetch({
    method: "GET", mode: "navigate", url: "https://wildz.quest/"
  }, { waitForBackground: false });
  assert.equal(await result.response?.text(), "saved release");
  // Let the public document parse and start warming its still-pending asset.
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(await (await worker.readCached(SHELL_CACHE, "/"))?.text(), "saved release");
  assert.ok(finishAsset);
  finishAsset(new Response("new chunk", { headers: { "content-type": "text/javascript" } }));
  await result.background;
  assert.equal(await (await worker.readCached(SHELL_CACHE, "/_next/static/chunks/fresh.js"))?.text(), "new chunk");
  assert.equal(await (await worker.readCached(SHELL_CACHE, "/"))?.text(), fresh);
  const assetRequest = worker.fetchCalls.at(-1);
  assert.ok(assetRequest instanceof Request);
  assert.equal(assetRequest.credentials, "omit");
});

test("an incomplete or personalized refresh preserves the last usable public shell", async (t) => {
  for (const failure of ["missing asset", "private document", "offline"]) await t.test(failure, async () => {
    const worker = createWorkerHarness({ release: RELEASE, fetch: async request => {
      if (failure === "offline") throw new Error("offline");
      if (new URL(request.url).pathname !== "/") return new Response("missing", { status: 404 });
      return new Response('<html><script src="/_next/static/missing.js"></script></html>', {
        headers: { "content-type": "text/html", ...(failure === "private document" ? { "set-cookie": "private=1" } : {}) }
      });
    } });
    await worker.putCached(SHELL_CACHE, "/", new Response("saved release", { headers: { "content-type": "text/html" } }));
    const result = await worker.dispatchFetch({ method: "GET", mode: "navigate", url: "https://wildz.quest/" });
    assert.equal(await result.response?.text(), "saved release");
    assert.equal(await (await worker.readCached(SHELL_CACHE, "/"))?.text(), "saved release");
  });
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

test("an incomplete worker install cannot replace the usable saved shell", async () => {
  const worker = createWorkerHarness({ release: RELEASE, fetch: async request =>
    new URL(request.url).pathname.startsWith("/_next/static/")
      ? new Response("missing chunk", { status: 404 })
      : new Response('<html><script src="/_next/static/new.js"></script></html>', { headers: { "content-type": "text/html" } })
  });
  await worker.putCached(SHELL_CACHE, "/", new Response("saved release", { headers: { "content-type": "text/html" } }));
  await assert.rejects(worker.dispatchExtendable("install"), /wildz_shell_asset_unavailable/);
  assert.equal(await (await worker.readCached(SHELL_CACHE, "/"))?.text(), "saved release");
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

test("creation surfaces remain available offline after first use without caching account artifacts", async () => {
  let online=true,reads=0;
  const worker=createWorkerHarness({release:RELEASE,fetch:async()=>{reads++;if(!online)throw Error("offline");return new Response("wood-map",{headers:{"content-type":"image/webp"}});}});
  const request={method:"GET",mode:"cors",url:"https://wildz.quest/materials/creation/wood-normal-256.webp"};
  assert.equal(await (await worker.dispatchFetch(request)).response?.text(),"wood-map");
  online=false;
  assert.equal(await (await worker.dispatchFetch(request)).response?.text(),"wood-map");
  assert.equal(reads,1);
  online=true;
  await worker.dispatchFetch({...request,url:"https://wildz.quest/materials/creation/private-object.json"});
  assert.equal(await worker.readCached(SHELL_CACHE,"/materials/creation/private-object.json"),undefined);
});
