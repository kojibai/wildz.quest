import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { friendlyWildzMarketError, readWildzMarket } from "../src/features/market/market-session-read";

type Actor = { actorId: string; profileHandle: string; receizUserId: string; accessToken?: string };
const signedId: Actor = { actorId: "keeper", profileHandle: "keeper.receiz.id", receizUserId: "proof:verified-subject" };

function resourceRoute(actor: Actor | null, target: "resource-packages" | "listings" = "resource-packages") {
  const adapters: unknown[] = [];
  let reads = 0;
  const testModule = { exports: {} as Record<"GET" | "POST" | "DELETE", (request: unknown) => Promise<Response>> };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, options: ResponseInit) => Response.json(body, options) } },
    "@/lib/receiz/wildz-cookie-actor": { resolveWildzCookieActor: async () => { if (!actor) throw new Error("receiz_authority_required"); return actor; } },
    "@/lib/receiz/adapter": { createReceizCommerceAdapter: (options?: unknown) => { adapters.push(options); return {}; } },
    "@/lib/receiz/wilds-resource-custody-capability": { requireWildsResourceCustodyRail: () => ({}) },
    "@/lib/receiz/resource-package-market-repository": {
      createResourcePackageMarketRepository: () => ({ load: async () => {
        reads++;
        return { status: "ready", state: { listings: {}, trades: {}, revision: 2, appendAnchorId: "anchor:2" } };
      } }),
      resourcePackageMarketHead: (state: { revision: number; appendAnchorId: string }) => ({ revision: state.revision, appendAnchorId: state.appendAnchorId })
    },
    "@/features/market/resource-package-market": { resourcePackageListingAvailable: () => true, publicResourcePackageListing: (value: unknown) => value },
    "@/lib/receiz/resource-package-market-route": { resourcePackageMarketRouteError: (cause: Error) => ({ status: 401, body: { error: cause.message, ownershipTransferred: false } }) },
    "@/lib/receiz/wildz-market-repository": {
      resolveWildzMarketConditionalAppendRail: () => ({}),
      createReceizWildzMarketRepository: () => ({ load: async () => {
        reads++; return { status: "ready", state: { listings: {}, revision: 2, appendAnchorId: "anchor:2" } };
      } })
    },
    "@/lib/receiz/wildz-market-state": { isWildzListingAvailableAt: () => true },
    "@/lib/receiz/wildz-market-route": { marketRouteError: (cause: Error) => ({ status: 401, body: { error: cause.message } }), publicWildzListing: (value: unknown) => value }
  };
  const source = ts.transpileModule(readFileSync(`app/api/market/${target}/route.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  Function("module", "exports", "require", source)(testModule, testModule.exports, (name: string) => dependencies[name] ?? dependencies[`${name}.js`] ?? {});
  return { route: testModule.exports, adapters, reads: () => reads };
}

test("authenticated signed ID browses the resource feed before player wallet delegation arrives", async () => {
  const measured = resourceRoute(signedId);
  const response = await measured.route.GET({});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ready", listings: [], pendingPurchases: [], head: { revision: 2, appendAnchorId: "anchor:2" } });
  assert.deepEqual(measured.adapters, [undefined], "only the configured application adapter may read before player delegation");
  assert.equal(measured.reads(), 1);
});

test("public read fix never grants proof-only identities financial mutations", async () => {
  const measured = resourceRoute(signedId);
  for (const method of ["POST", "DELETE"] as const) {
    const response = await measured.route[method]({});
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "receiz_authority_required");
  }
  assert.deepEqual(measured.adapters, []);
  assert.equal(measured.reads(), 0);
});

test("market read retains matching live player authority and rejects unauthenticated callers", async () => {
  const connected = resourceRoute({ ...signedId, receizUserId: "usr_keeper", accessToken: "player-delegation" });
  assert.equal((await connected.route.GET({})).status, 200);
  assert.deepEqual(connected.adapters, [{ accessToken: "player-delegation" }]);
  const unauthenticated = resourceRoute(null);
  assert.equal((await unauthenticated.route.GET({})).status, 401);
  assert.deepEqual(unauthenticated.adapters, []);
  assert.equal(unauthenticated.reads(), 0);
});

test("card browsing uses the same signed-ID read authority without changing player delegation", async () => {
  const measured = resourceRoute(signedId, "listings");
  const response = await measured.route.GET({});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ready");
  assert.deepEqual(measured.adapters, [undefined]);
  const delegated = resourceRoute({ ...signedId, accessToken: "player-delegation" }, "listings");
  assert.equal((await delegated.route.GET({})).status, 200);
  assert.deepEqual(delegated.adapters, [{ accessToken: "player-delegation" }]);
});

test("market GET automatically recovers an arriving authenticated session", async () => {
  const requests: RequestInit[] = [], delays: number[] = [];
  const result = await readWildzMarket<{ status: string }>("/api/market/listings", {
    fetcher: async (_url, options) => {
      requests.push(options!);
      return requests.length === 1 ? Response.json({ error: "receiz_authority_required" }, { status: 401 }) : Response.json({ status: "ready" });
    },
    wait: async delay => { delays.push(delay); }
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.result?.status, "ready");
  assert.deepEqual(delays, [300]);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.method, "GET"); assert.equal(request.credentials, "same-origin"); assert.equal(request.cache, "no-store");
    assert.equal(request.body, undefined);
  }
});

test("session retry is bounded and unavailable custody is never retried as authentication", async () => {
  let calls = 0;
  const delays: number[] = [];
  const unavailable = await readWildzMarket("/api/market/resource-packages", {
    fetcher: async () => { calls++; return Response.json({ error: "receiz_authority_required" }, { status: 401 }); },
    wait: async delay => { delays.push(delay); }
  });
  assert.equal(unavailable.response.status, 401); assert.equal(calls, 4); assert.deepEqual(delays, [300, 900, 1800]);
  calls = 0;
  const capability = await readWildzMarket("/api/market/resource-packages", {
    fetcher: async () => { calls++; return Response.json({ status: "market_capability_unavailable" }, { status: 503 }); },
    wait: async () => { assert.fail("missing backend capability must require an explicit refresh"); }
  });
  assert.equal(capability.response.status, 503); assert.equal(calls, 1);
});

test("closing the market aborts session retry before another GET", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(readWildzMarket("/api/market/listings", {
    signal: controller.signal,
    fetcher: async () => { calls++; return Response.json({ error: "receiz_authority_required" }, { status: 401 }); },
    wait: async () => { controller.abort(); }
  }), (cause: unknown) => cause instanceof Error && cause.name === "AbortError");
  assert.equal(calls, 1);
});

test("market presents session and backend failures as useful player instructions", () => {
  assert.match(friendlyWildzMarketError("receiz_authority_required", "Fallback"), /Receiz ID.*Refresh/);
  assert.match(friendlyWildzMarketError("market_capability_unavailable", "Fallback"), /temporarily unavailable.*Refresh/);
  assert.equal(friendlyWildzMarketError(new Error("package_market_internal_error"), "Please refresh."), "Please refresh.");
  assert.equal(friendlyWildzMarketError(new Error("Your local Vault refresh is pending."), "Fallback"), "Your local Vault refresh is pending.");
});
