import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import {
  parseWildzListingRequest,
  publicMarketAdmission,
  publicWildzListing
} from "../src/lib/receiz/wildz-market-route";
import { createWildzListing } from "../src/features/market/wildz-market";
import { emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";

test("market remains embedded and every mutation trusts only the scoped cookie actor", () => {
  assert.equal(existsSync("app/market/page.tsx"), false);
  const actorSource = readFileSync("src/lib/receiz/wildz-cookie-actor.ts", "utf8");
  assert.match(actorSource, /cookieAccessToken/);
  assert.match(actorSource, /loadReceizConnectProfile/);
  assert.doesNotMatch(actorSource, /session\.accessToken|delegatedAccessToken|RECEIZ_ACCESS_TOKEN|RECEIZ_CONNECT_ACCESS_TOKEN/);

  for (const route of ["listings", "trades", "offers", "checkout", "claims", "ownership/reconcile"]) {
    const source = readFileSync(`app/api/market/${route}/route.ts`, "utf8");
    assert.match(source, /resolveWildzCookieActor/);
    assert.doesNotMatch(source, /body\.(actor|seller|buyer|owner|accessToken|recipientUserId|amount|price)/);
    assert.doesNotMatch(source, /session\.accessToken|process\.env\.RECEIZ_ACCESS_TOKEN/);
  }
});

test("ownership reconciliation returns only foreign active asset IDs from the synced projection", () => {
  const route = readFileSync("app/api/market/ownership/reconcile/route.ts", "utf8");

  assert.match(route, /resolveWildzCookieActor/);
  assert.match(route, /parseWildzOwnershipReconcileRequest/);
  assert.match(route, /adapter\.client\.appState\.resolve/);
  assert.match(route, /WILDZ_OWNERSHIP_SYNC_NAMESPACE/);
  assert.match(route, /lostWildzOwnershipAssetIdsFromSync/);
  assert.match(route, /lostAssetIds/);
  assert.doesNotMatch(route, /resolveWildzMarketConditionalAppendRail/);
  assert.doesNotMatch(route, /currentOwner|ownerReceizId/);
  assert.doesNotMatch(route, /body\.(actor|owner|accessToken)/);
});

test("bearer claim route admits complete artifacts through v120 ownership before projecting cards", () => {
  const route = readFileSync("app/api/market/claims/route.ts", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");

  assert.match(route, /resolveWildzCookieActor/);
  assert.match(route, /claimWildzBearerArtifact/);
  assert.match(route, /adapter\.client\.ownership/);
  assert.match(route, /readWildzHttpArtifact/);
  assert.match(route, /bearer-claim-admitted/);
  assert.match(route, /compareAndAppend/);
  assert.match(route, /receiz\.wilds_bearer_claim\.v120/);
  assert.match(route, /admitted\.ownershipWitness/);
  assert.match(route, /witnessedKaiPulse/);
  assert.match(route, /witnessedAt/);
  assert.match(route, /publishWildzOwnershipSyncProjection/);
  assert.match(route, /adapter\.client\.appState/);
  assert.doesNotMatch(route, /currentWildzOwner/);
  assert.doesNotMatch(route, /new Date\(\)\.toISOString/);
  assert.doesNotMatch(route, /request\.json/);
  assert.doesNotMatch(route, /body\.(actor|seller|buyer|owner|accessToken|recipientUserId)/);
  assert.match(shell, /\/api\/market\/claims/);
  assert.match(shell, /proofSessionConnected/);
  assert.match(shell, /window\.confirm/);
  assert.match(shell, /openWildzArtifactSameOrigin/);
  assert.match(shell, /creates and downloads a new Receiz ownership artifact/);
});

test("listing admission requires an SDK-recovered public proof and exact request fields", () => {
  const route = readFileSync("app/api/market/listings/route.ts", "utf8");
  const publicCard = readFileSync("src/lib/receiz/wildz-market-public-card.ts", "utf8");

  assert.match(route, /resolveSdkPublicWildzCard/);
  assert.match(route, /wildz_market_public_card_required/);
  assert.match(route, /assertExactMarketFields/);
  assert.match(publicCard, /readAppStateByUrl/);
  assert.match(publicCard, /verifyAnyWildsCard/);
  assert.doesNotMatch(publicCard, /new Map|Map<|publishPublicStore|resolveLocalPublicWildsCard/);
});

test("listing UI delegates the exact asset and price to the identity-bound native market service", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(shell, /onMarketServiceChange=\{setMarketService\}/);
  assert.match(campaign, /const snapshot = await lazyMarket\.service\.read\(\)/);
  assert.match(campaign, /pending\?\.attemptId/);
  assert.match(campaign, /lazyMarket\.service\.list\(\{asset: \{kind: "creature", assetId: card\.id\}, priceUsdCents: String\(priceCents\)/);
  assert.match(campaign, /currentIdentity,\s*readSelections/);
  assert.doesNotMatch(shell, /onListAsset=\{async/);
});

test("market routes expose no process-memory fallback and settle only through admitted proof", () => {
  const adapter = readFileSync("src/lib/receiz/wildz-market-adapter.ts", "utf8");
  const checkout = readFileSync("app/api/market/checkout/route.ts", "utf8");

  assert.doesNotMatch(adapter, /new Map|Map<|publishPublicStore|Date\.now|new Date/);
  assert.match(adapter, /compareAndAppend/);
  assert.match(checkout, /purchaseAdmittedWildzTrade/);
  assert.match(checkout, /result\.status === "settled"[\s\S]*ownershipTransferred:\s*true/);
  assert.match(checkout, /asset:\s*result\.asset/);
  assert.match(checkout, /proofDigest:\s*result\.ownership\.proofDigest/);
  assert.match(adapter, /verifyAnyWildsCard\(currentListing\.asset\)\.ok/);
  assert.doesNotMatch(checkout, /oneClickCheckout|checkoutSession/);
});

test("Market delegates received custody to native asset acceptance rather than importing a response card", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const controller = readFileSync("src/features/market/wildz-market-controller-v128.ts", "utf8");
  assert.match(shell, /service=\{marketService && marketService\.binding\.keyId === identity\?\.keyId/);
  assert.doesNotMatch(shell, /onSettlement=|admitPurchasedMarketAsset/);
  assert.match(controller, /input\.staged\.assetPort\.verifyAccepted\(leg,descriptor,\{status:"accepted",receipt\}/);
  assert.match(controller, /Only the exact buyer may accept this purchase/);
  assert.match(controller, /adapter\.acceptIncomingAsset\(plan\.legs\[1\]\.legId\)/);
});

test("market exposes buyer-only reservation release and discovers expired reservations", () => {
  const trades = readFileSync("app/api/market/trades/route.ts", "utf8");
  const listings = readFileSync("app/api/market/listings/route.ts", "utf8");

  assert.match(trades, /export async function DELETE/);
  assert.match(trades, /resolveWildzCookieActor/);
  assert.match(trades, /releaseWildzTrade/);
  assert.doesNotMatch(trades, /body\.(?:actor|buyer|seller|expiresAt|releasedAt)/);
  assert.match(listings, /isWildzListingAvailableAt/);
});

test("route parsers reject client authority and public DTOs strip private market proof fields", () => {
  const asset = initialPlayState.inventory[0]!;
  assert.throws(() => parseWildzListingRequest({
    asset,
    priceCents: 500,
    expectedRevision: 0,
    expectedAppendAnchorId: null,
    actor: "client-assertion"
  }), /market_request_fields_invalid/);
  const listing = createWildzListing(emptyWildzMarketState(), {
    asset,
    priceCents: 500,
    idempotencyKey: "listing:route-test"
  }, {
    actorId: asset.manifest.ownerReceizId,
    profileHandle: `@${asset.manifest.ownerReceizId}`,
    receizUserId: "usr_private",
    accessToken: "cookie_private"
  }, { occurredAt: "2026-07-15T12:00:00.000Z" });
  const publicListing = publicWildzListing(listing) as Record<string, unknown>;
  assert.equal("sellerReceizUserId" in publicListing, false);
  assert.equal("idempotencyKey" in publicListing, false);
  assert.equal("asset" in publicListing, false);
  const response = publicMarketAdmission({
    status: "admitted",
    state: {
      ...emptyWildzMarketState(),
      revision: 1,
      appendAnchorId: "anchor:1",
      listings: { [listing.id]: listing }
    },
    admissionProof: {
      schema: "receiz.wildz_market_admission.v1",
      admittedRevision: 1,
      previousAppendAnchorId: null,
      appendAnchorId: "anchor:1",
      proofBundle: { private: "remote-proof" }
    }
  }, "listing", listing.idempotencyKey);
  assert.equal(JSON.stringify(response.body).includes("remote-proof"), false);
  assert.equal(JSON.stringify(response.body).includes("usr_private"), false);
});
