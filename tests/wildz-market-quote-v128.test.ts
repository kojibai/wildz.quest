import assert from "node:assert/strict";
import test from "node:test";
const modulePath = "../src/lib/receiz/wildz-market-quote-v128.js";
const owner = "11111111-1111-4111-8111-111111111111";
const wallet = (overrides: object = {}) => ({ ok: true, wallet: { userId: owner, balancePhiMicro: "10000000", balanceUsd: "25.00", quote: { usdPerPhiMicrocents: "100000000" }, ...overrides } });

test("USD marketplace review uses the actual Connect effective wallet rate and exact integer Phi", async () => {
  const marketModule = await import(modulePath).catch(() => ({}));
  assert.equal(typeof marketModule.deriveWildzMarketConnectQuoteV128, "function", "the actual quote composer must be implemented");
  const quote = marketModule.deriveWildzMarketConnectQuoteV128(wallet(), { ownerUserId: owner, ownerHandle: "alice.receiz.id", priceUsdCents: "125", currentKai: 100 });
  assert.equal(quote.usdPerPhiMicrocents, "250000000");
  assert.equal(quote.amountPhiMicro, "500000");
  assert.equal(quote.priceUsdCents, "125");
});

test("market quote cannot use a different wallet or silently round a fractional USD cent", async () => {
  const marketModule = await import(modulePath);
  for (const [response, price] of [[wallet({ userId: "22222222-2222-4222-8222-222222222222" }), "125"], [wallet(), "1.25"], [wallet(), "0"], [wallet({ balanceUsd: "unknown" }), "125"]]) {
    assert.throws(() => marketModule.deriveWildzMarketConnectQuoteV128(response, { ownerUserId: owner, ownerHandle: "alice.receiz.id", priceUsdCents: price, currentKai: 100 }));
  }
});

test("quote revalidation compares effective price without mistaking a later timestamp for a new financial amount", async () => {
  const marketModule = await import(modulePath);
  const input = { ownerUserId: owner, ownerHandle: "alice.receiz.id", priceUsdCents: "125", currentKai: 100 };
  const first = marketModule.deriveWildzMarketConnectQuoteV128(wallet(), input);
  const second = marketModule.deriveWildzMarketConnectQuoteV128(wallet({ balancePhiMicro: "20000000", balanceUsd: "50.00" }), { ...input, currentKai: 101 });
  assert.equal(marketModule.sameWildzMarketConnectQuoteV128(first, second), true);
  assert.equal(marketModule.sameWildzMarketConnectQuoteV128(first, marketModule.deriveWildzMarketConnectQuoteV128(wallet({ balanceUsd: "30.00" }), input)), false);
});

test("large USD prices use BigInt arithmetic and exact official display validation", async () => {
  const marketModule = await import(modulePath);
  const quote = marketModule.deriveWildzMarketConnectQuoteV128(wallet({ balancePhiMicro: "0", balanceUsd: "0.00" }), { ownerUserId: owner, ownerHandle: "alice.receiz.id", priceUsdCents: "9007199254740991", currentKai: 100 });
  assert.equal(quote.amountPhiMicro, "90071992547409910000");
  assert.equal(quote.usdPerPhiMicrocents, "100000000");
});
