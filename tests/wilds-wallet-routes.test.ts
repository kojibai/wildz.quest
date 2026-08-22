import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const routes = {
  summary: "app/api/wilds/wallet/summary/route.ts",
  ledger: "app/api/wilds/wallet/ledger/route.ts",
  recipient: "app/api/wilds/wallet/recipient/route.ts",
  request: "app/api/wilds/wallet/request/route.ts",
  capabilities: "app/api/wilds/wallet/capabilities/route.ts"
} as const;

function source(path: string) {
  assert.equal(existsSync(path), true, `expected wallet route ${path}`);
  return readFileSync(path, "utf8");
}

function assertNoStore(route: string) {
  assert.match(route, /cache-control["']:\s*["']no-store["']/);
}

function exportedNames(route: string) {
  return [...route.matchAll(/^export\s+(?:const|async function)\s+(\w+)/gm)].map((match) => match[1]);
}

describe("Wilds wallet read and receive routes", () => {
  it("returns the strict summary projection with a no-store response", () => {
    const route = source(routes.summary);
    assert.match(route, /resolveWildsWalletReadAuthority/);
    assert.match(route, /adapter\.walletSummary\(\)/);
    assert.match(route, /projectWildsWalletSummary/);
    assert.match(route, /NextResponse\.json\(projectWildsWalletSummary/);
    assertNoStore(route);
    assert.doesNotMatch(route, /\.client\.connect\.wallet/);
  });

  it("normalizes a bounded ledger cursor before returning one strict ledger page", () => {
    const route = source(routes.ledger);
    assert.match(route, /normalizeWildsWalletCursor\(request\.nextUrl\.searchParams\.get\(["']cursor["']\)\)/);
    assert.match(route, /adapter\.walletLedger\(\{\s*limit:\s*50,\s*cursor:\s*cursor\s*\?\?\s*undefined\s*}\)/s);
    assert.match(route, /projectWildsWalletLedgerPage\(/);
    assert.match(route, /authority\.actorId/);
    assertNoStore(route);
    assert.doesNotMatch(route, /events:\s*[^,]*adapter/);
  });

  it("allows exactly one normalized recipient username and hides resolution details", () => {
    const route = source(routes.recipient);
    assert.match(route, /assertExactFields\(await readJsonBody\(request\),\s*\["username"\]\)/);
    assert.match(route, /normalizeWildsWalletPublicUsername\(body\.username\)/);
    assert.match(route, /projectWildsWalletRecipient/);
    assert.match(route, /receiz_wallet_recipient_unavailable/);
    assert.match(route, /RECIPIENT_LOOKUP_LIMIT/);
    assert.match(route, /receiz_wallet_recipient_rate_limited/);
    assertNoStore(route);
    assert.doesNotMatch(route, /body\.(?:actor|owner|subject|head|balance|price|token|proof|id)/);
    assert.match(route, /return json\(recipient\)/);
    assert.doesNotMatch(route, /return json\(response\)/);
  });

  it("returns a non-authoritative receive request with an exact optional amount", () => {
    const route = source(routes.request);
    assert.match(route, /assertExactFields\(await readJsonBody\(request\),\s*\["amountPhiMicro"\]\)/);
    assert.match(route, /parseWildsWalletMicroPhi\(body\.amountPhiMicro\)/);
    assert.match(route, /non-authoritative/);
    assert.match(route, /locator/);
    assertNoStore(route);
    assert.doesNotMatch(route, /(?:connectTransfer|planPhi|execute|reserve|walletLedger|walletSummary)/);
    assert.doesNotMatch(route, /body\.(?:actor|owner|subject|head|balance|price|token|proof)/);
  });

  it("rejects malformed body, username, amount, cursor, and unauthenticated requests with safe codes", () => {
    const sourceText = Object.values(routes).map(source).join("\n");
    for (const code of [
      "wilds_wallet_request_fields_invalid",
      "wilds_wallet_username_invalid",
      "wilds_wallet_micro_phi_invalid",
      "wilds_wallet_cursor_invalid",
      "resolveWildsWalletReadAuthority",
      "wildsWalletAuthorityStatusFor"
    ]) assert.match(sourceText, new RegExp(code));
    for (const path of [routes.recipient, routes.request]) {
      const route = source(path);
      assert.match(route, /async function readJsonBody/);
      assert.match(route, /throw new Error\("wilds_wallet_request_fields_invalid"\)/);
    }
    assert.doesNotMatch(sourceText, /error:\s*(?:cause|error\.message)/);
  });

  it("exposes only the V123-gated capability projection", () => {
    const route = source(routes.capabilities);
    assert.match(route, /resolveWildsWalletReadAuthority/);
    assert.match(route, /projectWildsWalletCapabilities\(\)/);
    assert.match(route, /NextResponse\.json\(projectWildsWalletCapabilities\(\)/);
    assertNoStore(route);
    assert.doesNotMatch(route, /(?:connectTransfer|planPhi|execute|reserve)/);
  });

  it("exports only valid Next route fields", () => {
    for (const path of Object.values(routes)) {
      assert.deepEqual(exportedNames(source(path)).sort(), ["dynamic", "runtime", path.includes("recipient") || path.includes("request") ? "POST" : "GET"].sort());
    }
  });
});
