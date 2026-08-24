import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import * as capabilitiesRoute from "../app/api/wilds/wallet/capabilities/route";
import * as ledgerRoute from "../app/api/wilds/wallet/ledger/route";
import * as recipientRoute from "../app/api/wilds/wallet/recipient/route";
import * as requestRoute from "../app/api/wilds/wallet/request/route";
import * as summaryRoute from "../app/api/wilds/wallet/summary/route";

const handlerModulePath = ["../src/lib/receiz", "wilds-wallet-route-handlers.js"].join("/");

async function createHandlers(dependencies: Record<string, unknown>) {
  const handlerModule = await import(handlerModulePath) as {
    createWildsWalletRouteHandlers: (input: Record<string, unknown>) => Record<string, (request: NextRequest) => Promise<Response>>;
  };
  return handlerModule.createWildsWalletRouteHandlers(dependencies);
}

function walletRequest(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`https://wildz.quest${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  });
}

function malformedWalletRequest(path: string) {
  return new NextRequest(`https://wildz.quest${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{"
  });
}

function authority() {
  return { accessToken: "token:owner", ownerReceizId: "receiz:owner", actorId: "kai_01", profileHandle: "kai_01.receiz.id" };
}

function adapter(overrides: Partial<Record<"walletSummary" | "walletLedger" | "worldProfile", (...args: any[]) => Promise<unknown>>> = {}) {
  const calls = { summary: 0, ledger: 0, profile: 0 };
  return {
    calls,
    walletSummary: async () => {
      calls.summary += 1;
      return overrides.walletSummary?.() ?? { ok: true, balancePhiMicro: "2500000", userId: "receiz:private-owner" };
    },
    walletLedger: async (query: unknown) => {
      calls.ledger += 1;
      return overrides.walletLedger?.(query) ?? {
        ok: true, cursor: null, nextCursor: "after_1", events: [{
          id: "private-receipt", createdAt: "2026-08-21T12:00:00.000Z",
          fromActor: { handle: "kai_01.receiz.id", ownerId: "receiz:private-owner" },
          toActor: { handle: "friend_2.receiz.id", email: "friend@example.test" }, proofBundle: { digest: "private-proof" }
        }]
      };
    },
    worldProfile: async (username: unknown) => {
      calls.profile += 1;
      return overrides.worldProfile?.(username) ?? {
        ok: true, world: {
          username, profileMark: "FT", allowedTransferKinds: ["phi"], email: "friend@example.test", id: "receiz:friend"
        }
      };
    }
  };
}

function durableLimiter() {
  const usage = new Map<string, number>();
  return {
    durable: true as const,
    usage,
    consume: async ({ actorId, limit }: { actorId: string; limit: number }) => {
      const next = (usage.get(actorId) ?? 0) + 1;
      usage.set(actorId, next);
      return next <= limit ? "allowed" : "limited";
    }
  };
}

function dependencies(receiz = adapter(), limiter: unknown = durableLimiter()) {
  return { resolveAuthority: async () => authority(), createAdapter: () => receiz, recipientLookupLimiter: limiter, transferRuntime: undefined };
}

async function responseBody(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json();
}

describe("Wilds wallet read and receive handlers", () => {
  it("returns strict no-store summary and ledger projections without raw adapter redaction leaks", async () => {
    const receiz = adapter();
    const handlers = await createHandlers(dependencies(receiz));
    const summary = await handlers.summary(walletRequest("/api/wilds/wallet/summary"));
    const ledger = await handlers.ledger(walletRequest("/api/wilds/wallet/ledger?cursor=first"));

    assert.equal(summary.status, 200);
    assert.deepEqual(await responseBody(summary), {
      status: "verified", admittedPhiMicro: "2500000", displayUsdCents: null,
      assetCountsStatus: "unknown", transferableResourceCount: null, transferableCardCount: null,
      reservedCardCount: null, pendingCount: null
    });
    assert.equal(ledger.status, 200);
    const projectedLedger = await responseBody(ledger);
    assert.deepEqual(projectedLedger, {
      cursor: null, nextCursor: "after_1", entries: [{
        receiptReference: null, direction: "sent", state: "unknown", counterpartyUsername: "friend_2",
        createdAt: "2026-08-21T12:00:00.000Z"
      }]
    });
    assert.doesNotMatch(JSON.stringify({ projectedLedger }), /private|example\.test|receiz:/);
    assert.equal(receiz.calls.summary, 1);
    assert.equal(receiz.calls.ledger, 1);
  });

  it("classifies malformed cursors and authenticated authority failures with exact safe responses", async () => {
    const handlers = await createHandlers(dependencies());
    const malformed = await handlers.ledger(walletRequest("/api/wilds/wallet/ledger?cursor=forged%3Dcursor"));
    assert.equal(malformed.status, 400);
    assert.deepEqual(await responseBody(malformed), { error: "wilds_wallet_cursor_invalid" });

    const denied = await createHandlers({
      ...dependencies(), resolveAuthority: async () => { throw new Error("receiz_wallet_read_scope_required"); }
    });
    const response = await denied.summary(walletRequest("/api/wilds/wallet/summary"));
    assert.equal(response.status, 401);
    assert.deepEqual(await responseBody(response), { error: "receiz_wallet_read_scope_required" });
  });

  it("collapses every recipient lookup miss into one exact response", async () => {
    const cases = [
      adapter({ worldProfile: async () => ({ ok: false, error: "not_found" }) }),
      adapter({ worldProfile: async () => ({ ok: true, world: { malformed: true } }) }),
      adapter({ worldProfile: async () => ({ ok: true, world: { username: "other_2.receiz.id" } }) }),
      adapter({ worldProfile: async () => { throw new Error("upstream secret"); } })
    ];
    for (const receiz of cases) {
      const handlers = await createHandlers(dependencies(receiz));
      const response = await handlers.recipient(walletRequest("/api/wilds/wallet/recipient", "POST", { username: "friend_2" }));
      assert.equal(response.status, 404);
      assert.deepEqual(await responseBody(response), { error: "receiz_wallet_recipient_unavailable" });
    }
  });

  it("accepts only exact recipient and receive request bodies, including malformed username, amount, and JSON", async () => {
    const handlers = await createHandlers(dependencies());
    const recipient = await handlers.recipient(walletRequest("/api/wilds/wallet/recipient", "POST", { username: "@Friend_2.RECEIZ.ID" }));
    assert.equal(recipient.status, 200);
    assert.deepEqual(await responseBody(recipient), { username: "friend_2", profileMark: "FT", allowedTransferKinds: ["phi"] });
    for (const response of [
      await handlers.recipient(walletRequest("/api/wilds/wallet/recipient", "POST", { username: "kаi_01" })),
      await handlers.recipient(malformedWalletRequest("/api/wilds/wallet/recipient")),
      await handlers.request(walletRequest("/api/wilds/wallet/request", "POST", { amountPhiMicro: "1.2" })),
      await handlers.request(walletRequest("/api/wilds/wallet/request", "POST", { amountPhiMicro: "1", token: "forged" })),
      await handlers.request(malformedWalletRequest("/api/wilds/wallet/request"))
    ]) {
      assert.equal(response.status, 400);
      await responseBody(response);
    }
  });

  it("returns a non-authoritative receive request and never invokes transfer-capable rails", async () => {
    let transferCalls = 0;
    const receiz = {
      ...adapter(),
      connectTransfer: async () => { transferCalls += 1; },
      planPhiSettlementV122: async () => { transferCalls += 1; },
      planPhiReserveV122: async () => { transferCalls += 1; },
      executeWorldTransactionV122: async () => { transferCalls += 1; }
    };
    const handlers = await createHandlers(dependencies(receiz));
    const response = await handlers.request(walletRequest("/api/wilds/wallet/request", "POST", { amountPhiMicro: "00025" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await responseBody(response), {
      locator: "wildz:receive:kai_01",
      request: { kind: "phi", amountPhiMicro: "25", authority: "non-authoritative" }
    });
    assert.equal(transferCalls, 0);
  });

  it("uses an injected durable limiter across fresh handler instances and rejects the seventh lookup", async () => {
    const limiter = durableLimiter();
    const first = await createHandlers(dependencies(adapter(), limiter));
    const second = await createHandlers(dependencies(adapter(), limiter));
    for (let index = 0; index < 5; index += 1) {
      assert.equal((await first.recipient(walletRequest("/api/wilds/wallet/recipient", "POST", { username: "friend_2" }))).status, 200);
    }
    assert.equal((await second.recipient(walletRequest("/api/wilds/wallet/recipient", "POST", { username: "friend_2" }))).status, 200);
    const seventh = await second.recipient(walletRequest("/api/wilds/wallet/recipient", "POST", { username: "friend_2" }));
    assert.equal(seventh.status, 429);
    assert.deepEqual(await responseBody(seventh), { error: "receiz_wallet_recipient_rate_limited" });
    assert.equal(limiter.usage.get("kai_01"), 7);
  });

  it("fails recipient lookup closed when no durable limiter is configured", async () => {
    const { recipientLookupLimiter: _unused, ...withoutLimiter } = dependencies();
    const handlers = await createHandlers(withoutLimiter);
    const response = await handlers.recipient(walletRequest("/api/wilds/wallet/recipient", "POST", { username: "friend_2" }));
    assert.equal(response.status, 503);
    assert.deepEqual(await responseBody(response), { error: "receiz_wallet_recipient_lookup_unavailable" });
  });

  it("returns the V123-gated capability projection and collapses unknown failures", async () => {
    const handlers = await createHandlers(dependencies());
    const capabilities = await handlers.capabilities(walletRequest("/api/wilds/wallet/capabilities"));
    assert.equal(capabilities.status, 200);
    assert.deepEqual(await responseBody(capabilities), {
      read: "available", receive: "available",
      recipientLookup: { available: true },
      send: { available: false, reason: "receiz_v123_execution_unavailable" },
      resourceTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      cardTransfer: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiSettlement: { available: false, reason: "receiz_v123_execution_unavailable" },
      phiReserve: { available: false, reason: "receiz_v123_execution_unavailable" }
    });
    const unknown = await createHandlers({
      ...dependencies(), createAdapter: () => adapter({ walletSummary: async () => { throw new Error("receiz_wallet_internal_secret"); } })
    });
    const response = await unknown.summary(walletRequest("/api/wilds/wallet/summary"));
    assert.equal(response.status, 502);
    assert.deepEqual(await responseBody(response), { error: "receiz_wallet_read_unavailable" });
  });
});

describe("Wilds wallet Next route exports", () => {
  it("imports routes that export only Next-supported fields", () => {
    assert.deepEqual(Object.keys(summaryRoute).sort(), ["GET", "dynamic", "runtime"]);
    assert.deepEqual(Object.keys(ledgerRoute).sort(), ["GET", "dynamic", "runtime"]);
    assert.deepEqual(Object.keys(recipientRoute).sort(), ["POST", "dynamic", "runtime"]);
    assert.deepEqual(Object.keys(requestRoute).sort(), ["POST", "dynamic", "runtime"]);
    assert.deepEqual(Object.keys(capabilitiesRoute).sort(), ["GET", "dynamic", "runtime"]);
  });
});
