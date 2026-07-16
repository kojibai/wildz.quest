import assert from "node:assert/strict";
import { test } from "node:test";
import { createWorkerHarness, type RequestLike } from "./support/pwa-worker-harness";

const RELEASE = "cache-policy";
const SHELL_CACHE = `wildz-shell-${RELEASE}`;
const PUBLIC_CACHE = `wildz-public-${RELEASE}`;

function request(path: string, mode = "navigate", headers?: Headers): RequestLike {
  return {
    headers,
    method: "GET",
    mode,
    url: new URL(path, "https://wildz.quest").href
  };
}

test("visited public documents are network-first and available by exact URL offline", async () => {
  let online = true;
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => {
      if (!online) throw new Error("offline");
      return new Response("alice public profile", {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }
  });
  const profile = request("/u/alice");

  assert.equal(await (await worker.dispatchFetch(profile)).response?.text(), "alice public profile");
  online = false;
  assert.equal(await (await worker.dispatchFetch(profile)).response?.text(), "alice public profile");
  assert.equal(await (await worker.readCached(PUBLIC_CACHE, profile))?.text(), "alice public profile");
});

test("sanitized public profile JSON is cached only for its exact anonymous URL", async () => {
  let online = true;
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async (incoming) => {
      if (!online) throw new Error("offline");
      const handle = new URL(incoming.url).pathname.split("/").at(-1);
      return new Response(JSON.stringify({ ok: true, profile: { username: `@${handle}` } }), {
        headers: {
          "cache-control": "public, max-age=60, stale-while-revalidate=300",
          "content-type": "application/json; charset=utf-8",
          "x-wildz-public-projection": "sanitized"
        }
      });
    }
  });
  const alice = new Request("https://wildz.quest/api/profiles/alice", {
    credentials: "omit",
    headers: { accept: "application/json" }
  });
  const bob = new Request("https://wildz.quest/api/profiles/bob", {
    credentials: "omit",
    headers: { accept: "application/json" }
  });

  assert.equal(
    await (await worker.dispatchFetch(alice)).response?.text(),
    JSON.stringify({ ok: true, profile: { username: "@alice" } })
  );
  online = false;
  assert.equal(
    await (await worker.dispatchFetch(alice)).response?.text(),
    JSON.stringify({ ok: true, profile: { username: "@alice" } })
  );
  assert.equal((await worker.dispatchFetch(bob)).response?.status, 0);
  assert.equal((await worker.cacheKeys(PUBLIC_CACHE)).length, 1);
});

test("public profile caching rejects unmarked or personalized responses and every mutation", async () => {
  let online = true;
  const worker = createWorkerHarness({
    release: `${RELEASE}-profile-boundary`,
    fetch: async (incoming) => {
      if (!online) throw new Error("offline");
      const pathname = new URL(incoming.url).pathname;
      if (pathname.endsWith("/private")) {
        return new Response('{"private":true}', {
          headers: {
            "cache-control": "private, max-age=300",
            "content-type": "application/json",
            "x-wildz-public-projection": "sanitized"
          }
        });
      }
      return new Response('{"unmarked":true}', {
        headers: {
          "cache-control": "public, max-age=300",
          "content-type": "application/json"
        }
      });
    }
  });
  const unmarked = new Request("https://wildz.quest/api/profiles/unmarked", { credentials: "omit" });
  const privateResponse = new Request("https://wildz.quest/api/profiles/private", { credentials: "omit" });
  const mutation = new Request("https://wildz.quest/api/profiles/alice", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: "{}"
  });

  await worker.dispatchFetch(unmarked);
  await worker.dispatchFetch(privateResponse);
  online = false;

  assert.equal((await worker.dispatchFetch(unmarked)).response?.status, 0);
  assert.equal((await worker.dispatchFetch(privateResponse)).response?.status, 0);
  await assert.rejects(worker.dispatchFetch(mutation), /offline/);
  assert.deepEqual(await worker.cacheKeys(`wildz-public-${RELEASE}-profile-boundary`), []);
});

test("an unvisited public document falls back to offline guidance, never the root shell", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => { throw new Error("offline"); }
  });
  await worker.putCached(SHELL_CACHE, "/", new Response("root shell"));
  await worker.putCached(SHELL_CACHE, "/offline", new Response("offline guidance"));

  const result = await worker.dispatchFetch(request("/cards/unvisited-card"));

  assert.equal(await result.response?.text(), "offline guidance");
});

test("public card JSON and images are cached only for the exact successful GET", async () => {
  const responses = new Map([
    ["/api/cards/card-1", new Response('{"id":"card-1"}', { headers: { "content-type": "application/json" } })],
    ["/api/cards/card-1/image", new Response("card-image", { headers: { "content-type": "image/png" } })]
  ]);
  let online = true;
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async (incoming) => {
      if (!online) throw new Error("offline");
      const response = responses.get(new URL(incoming.url).pathname);
      if (!response) return new Response("missing", { status: 404 });
      return response.clone();
    }
  });
  const detail = request("/api/cards/card-1", "cors");
  const image = request("/api/cards/card-1/image", "cors");

  await worker.dispatchFetch(detail);
  await worker.dispatchFetch(image);
  online = false;

  assert.equal(await (await worker.dispatchFetch(detail)).response?.text(), '{"id":"card-1"}');
  assert.equal(await (await worker.dispatchFetch(image)).response?.text(), "card-image");
  assert.equal((await worker.cacheKeys(PUBLIC_CACHE)).length, 2);
});

test("cache admission rejects private, variant, failed, and wrong-MIME responses", async (t) => {
  const cases = [
    ["no-store", new Response("private", {
      headers: { "cache-control": "private, no-store", "content-type": "text/html" }
    })],
    ["vary-star", new Response("variant", {
      headers: { "content-type": "text/html", vary: "*" }
    })],
    ["failed", new Response("failed", {
      status: 503,
      headers: { "content-type": "text/html" }
    })],
    ["wrong-mime", new Response("json", {
      headers: { "content-type": "application/json" }
    })]
  ] as const;

  for (const [name, response] of cases) {
    await t.test(name, async () => {
      const profile = request(`/u/${name}`);
      const worker = createWorkerHarness({
        release: `${RELEASE}-${name}`,
        fetch: async () => response.clone()
      });

      await worker.dispatchFetch(profile);

      assert.equal(await worker.readCached(`wildz-public-${RELEASE}-${name}`, profile), undefined);
    });
  }
});

test("authorization stays network-only while mutation failures remain errors", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => { throw new Error("offline"); }
  });
  await worker.putCached(SHELL_CACHE, "/offline", new Response("offline guidance"));
  const authenticatedProfile = request("/u/alice", "navigate", new Headers({ authorization: "Bearer secret" }));
  const mutation = {
    method: "POST",
    mode: "cors",
    url: "https://wildz.quest/api/market/listings"
  };

  assert.equal(await (await worker.dispatchFetch(authenticatedProfile)).response?.text(), "offline guidance");
  await assert.rejects(worker.dispatchFetch(mutation), /offline/);
  assert.deepEqual(await worker.cacheKeys(PUBLIC_CACHE), []);
});

test("failed non-public navigation renders offline guidance while APIs remain errors", async () => {
  const worker = createWorkerHarness({
    release: RELEASE,
    fetch: async () => { throw new Error("offline"); }
  });
  await worker.putCached(SHELL_CACHE, "/offline", new Response("offline guidance"));

  const navigation = await worker.dispatchFetch(request("/world"));
  assert.equal(await navigation.response?.text(), "offline guidance");

  await assert.rejects(worker.dispatchFetch(request("/api/wilds/world/snapshot", "cors")), /offline/);
});
