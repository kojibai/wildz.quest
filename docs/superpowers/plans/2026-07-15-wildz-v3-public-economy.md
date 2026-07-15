# Wildz V3 Public Profiles and Game Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder/process-memory profile and market behavior with durable Receiz-backed public projections, authenticated game-only listings and trades, verified settlement, and idempotent ownership append.

**Architecture:** Maintain one bounded `receiz.wildz_public_state.v1` projection for public profiles, cards, listings, trades, ownership, and public receipts. Pure reducers validate revision and proof invariants; a `WildzPublicRepository` loads and publishes the projection through Receiz public-store rails. Next.js routes derive the actor from secure Receiz cookies, while the embedded Wildz sheets consume safe public DTOs and never own authority.

**Tech Stack:** Next.js 15 route handlers, React 19, TypeScript 5.6, `@receiz/sdk` 100.0.0 public-store/Connect/commerce/webhook rails, Node test runner.

## Global Constraints

- Plans `2026-07-15-wildz-v3-identity-authority.md`, `2026-07-15-wildz-v3-kernel-continuity.md`, and `2026-07-15-wildz-v3-player-experience.md` must be complete first.
- Work on `main`, commit each task, and do not push.
- Public profiles/cards/listings are projections; identity key files and private Vault content never enter public state.
- Request JSON never supplies a trusted actor, seller, buyer, or owner.
- A listing requires a currently verified public card whose admitted owner matches the authenticated actor.
- Payment initiation never transfers ownership.
- Ownership changes only after a verified Receiz settlement event and a successful `receiz.wilds_ownership_append.v1` write.
- Every write uses an idempotency key and optimistic expected revision.
- If Receiz publication, checkout, webhook verification, or ownership append is unavailable, return an explicit unavailable/pending result and transfer nothing.
- Keep the market inside the existing Wildz sheet; do not create `/market`.

---

## File Structure

- `src/lib/receiz/wildz-public-state.ts` — pure bounded public projection, digest, revision, and command reducers.
- `src/lib/receiz/wildz-public-repository.ts` — repository interface plus Receiz public-store implementation.
- `src/lib/receiz/wildz-profile-adapter.ts` — profile-specific projection/load/publish adapter with no process map.
- `src/lib/receiz/wildz-market-adapter.ts` — listing/trade/settlement coordinator with no process map.
- `src/features/profile/public-profile.ts` — public-only profile DTO and sanitization.
- `src/features/play/public-card-registry.ts` — cookie-authenticated public-card registration client.
- `src/features/market/wildz-market.ts` — pure listing, trade, and receipt contracts.
- `app/api/profiles/[handle]/route.ts` — public profile read and authenticated publish.
- `app/api/cards/[assetId]/route.ts` — verified public-card read/register.
- `app/api/market/listings/route.ts` — listing discovery and authenticated admission.
- `app/api/market/trades/route.ts` — authenticated trade planning.
- `app/api/market/checkout/route.ts` — checkout initiation only.
- `app/api/market/settlement/route.ts` — verified webhook settlement and ownership append.
- `app/u/[handle]/page.tsx` — canonical profile deep link into the persistent shell.
- `app/c/[assetId]/page.tsx` — compatibility card deep link into the persistent shell.

---

### Task 1: Define the Durable Public Projection

**Files:**
- Create: `src/lib/receiz/wildz-public-state.ts`
- Create: `tests/wildz-public-state.test.ts`

**Interfaces:**
- Consumes: `PublicWildzProfile`, `PortableCardAsset`, `WildzListing`, `WildzTradePlan`, and `WildzMarketReceipt`.
- Produces: `WildzPublicState`, `emptyWildzPublicState()`, `restoreWildzPublicState(value)`, `wildzPublicStateDigest(state)`, and `advanceWildzPublicState(state, command)`.

- [ ] **Step 1: Write the failing projection tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceWildzPublicState, emptyWildzPublicState, restoreWildzPublicState } from "../src/lib/receiz/wildz-public-state";

test("public state rejects a stale revision and bounds every collection", () => {
  const initial = emptyWildzPublicState();
  assert.throws(() => advanceWildzPublicState(initial, {
    type: "publish-profile",
    actor: "@fern",
    expectedRevision: 2,
    profile: { schema: "wildz.public_profile.v1", username: "@fern" } as never
  }), /wildz_public_revision_conflict/);
  assert.equal(restoreWildzPublicState({ ...initial, receipts: new Array(5000).fill(null) }).receipts.length, 2048);
});

test("public state never serializes identity authority", () => {
  const restored = restoreWildzPublicState({
    ...emptyWildzPublicState(),
    keyFile: { crypto: { privateKeyPkcs8B64u: "secret" } },
    identitySeal: "secret"
  });
  assert.equal("keyFile" in restored, false);
  assert.equal("identitySeal" in restored, false);
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run:

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript fails because `wildz-public-state.ts` does not exist.

- [ ] **Step 3: Implement the public-state schema and reducer boundary**

```ts
export type WildzPublicState = {
  schema: "receiz.wildz_public_state.v1";
  revision: number;
  updatedAt: string;
  profiles: Record<string, PublicWildzProfile>;
  cards: Record<string, PortableCardAsset>;
  listings: Record<string, WildzListing>;
  trades: Record<string, WildzTradePlan>;
  ownership: Record<string, { assetId: string; ownerReceizId: string; proofDigest: string; transferredAt: string; appendId: string }>;
  receipts: WildzMarketReceipt[];
};

export type WildzPublicCommand =
  | { type: "publish-profile"; actor: string; expectedRevision: number; profile: PublicWildzProfile }
  | { type: "publish-card"; actor: string; expectedRevision: number; card: PortableCardAsset }
  | { type: "admit-listing"; actor: string; expectedRevision: number; listing: WildzListing }
  | { type: "admit-trade"; actor: string; expectedRevision: number; trade: WildzTradePlan }
  | { type: "settle-trade"; actor: string; expectedRevision: number; receipt: WildzMarketReceipt; appendId: string; transferredAt: string };

export function emptyWildzPublicState(): WildzPublicState {
  return { schema: "receiz.wildz_public_state.v1", revision: 0, updatedAt: new Date(0).toISOString(), profiles: {}, cards: {}, listings: {}, trades: {}, ownership: {}, receipts: [] };
}
```

Implement `restoreWildzPublicState` as a strict allow-list projection with limits of 1,000 profiles, 5,000 cards, 5,000 listings, 5,000 trades, 5,000 ownership entries, and the newest 2,048 receipts. `advanceWildzPublicState` must require `command.expectedRevision === state.revision`, validate the command-specific owner/proof invariant, increment revision once, and update `updatedAt` from the admitted event time rather than an untrusted client value.

- [ ] **Step 4: Run the focused tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-public-state.test.js
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-public-state.ts tests/wildz-public-state.test.ts
git commit -m "feat: define durable Wildz public projection"
```

---

### Task 2: Add the Receiz Public Repository

**Files:**
- Create: `src/lib/receiz/wildz-public-repository.ts`
- Create: `tests/wildz-public-repository.test.ts`
- Modify: `src/lib/wildz/product.ts`

**Interfaces:**
- Consumes: `WildzPublicState`, `createReceizCommerceAdapter().restoreLatestPublicStore`, and `.publishPublicStore`.
- Produces: `WildzPublicRepository`, `createReceizWildzPublicRepository(options)`, and `WILDZ_PUBLIC_NAMESPACE`.

- [ ] **Step 1: Write the failing repository contract test**

```ts
test("repository loads the latest projection and publishes with revision idempotency", async () => {
  const calls: unknown[] = [];
  const repository = createReceizWildzPublicRepository({
    adapter: {
      restoreLatestPublicStore: async () => ({ state: emptyWildzPublicState() }),
      publishPublicStore: async (input: unknown, options: unknown) => { calls.push({ input, options }); return { ok: true }; }
    },
    actorReceizId: "@fern",
    accessToken: "test-token"
  });
  const state = await repository.load();
  await repository.publish({ ...state, revision: 1 }, { expectedRevision: 0, idempotencyKey: "profile:@fern:1" });
  assert.equal(calls.length, 1);
  assert.match(JSON.stringify(calls[0]), /wildz:public:v1/);
});
```

- [ ] **Step 2: Run the test and verify failure**

Run the compile sequence from Task 1.

Expected: TypeScript fails because `createReceizWildzPublicRepository` does not exist.

- [ ] **Step 3: Implement the interface and Receiz adapter**

```ts
export interface WildzPublicRepository {
  load(): Promise<WildzPublicState>;
  publish(next: WildzPublicState, input: { expectedRevision: number; idempotencyKey: string }): Promise<WildzPublicState>;
}

export const WILDZ_PUBLIC_NAMESPACE = "wildz:public:v1";

export function createReceizWildzPublicRepository(options: {
  adapter?: Pick<ReceizCommerceAdapter, "restoreLatestPublicStore" | "publishPublicStore">;
  actorReceizId: string;
  accessToken?: string;
}): WildzPublicRepository {
  const adapter = options.adapter ?? createReceizCommerceAdapter({ baseUrl: process.env.RECEIZ_BASE_URL, accessToken: options.accessToken });
  return {
    async load() {
      const restored = await adapter.restoreLatestPublicStore({ host: "wildz.quest", requiredSchema: "receiz.wildz_public_state.v1" });
      return restoreWildzPublicState(restored.state ?? restored.storeStateRecord);
    },
    async publish(next, input) {
      if (next.revision !== input.expectedRevision + 1) throw new Error("wildz_public_revision_conflict");
      const result = await adapter.publishPublicStore({
        tenantHost: "wildz.quest",
        merchantReceizId: options.actorReceizId,
        title: "Wildz public world",
        sourceUrl: "https://wildz.quest",
        namespace: WILDZ_PUBLIC_NAMESPACE,
        projectionState: "published",
        platform: "Wildz",
        schema: next.schema,
        state: next as unknown as JsonObject
      }, { idempotencyKey: input.idempotencyKey });
      if (result && typeof result === "object" && "ok" in result && result.ok === false) throw new Error("wildz_public_publish_failed");
      return next;
    }
  };
}
```

Do not cache authoritative state in a module-level map. A request may keep one loaded snapshot only for the duration of its optimistic transaction.

- [ ] **Step 4: Run the focused repository tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-public-repository.test.js
```

Expected: pass with one publication call and the exact namespace.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-public-repository.ts src/lib/wildz/product.ts tests/wildz-public-repository.test.ts
git commit -m "feat: add Receiz-backed Wildz public repository"
```

---

### Task 3: Publish and Resolve Canonical Player Profiles

**Files:**
- Modify: `src/features/profile/public-profile.ts`
- Modify: `src/lib/receiz/wildz-profile-adapter.ts`
- Create: `app/api/profiles/[handle]/route.ts`
- Create: `app/u/[handle]/page.tsx`
- Modify: `app/[username]/page.tsx`
- Modify: `tests/wildz-profile.test.ts`
- Modify: `tests/wildz-profile-route.test.ts`

**Interfaces:**
- Consumes: `WildzPublicRepository`, `receizRequestSession`, and `loadReceizConnectProfile`.
- Produces: `canonicalWildzHandle(value)`, `canonicalWildzProfilePath(value)`, `resolvePublicWildzProfile(handle, repository)`, and `publishPublicWildzProfile(profile, authority, repository)`.

- [ ] **Step 1: Write failing canonical-route and authority tests**

```ts
test("profile handles have one canonical public route", () => {
  assert.equal(canonicalWildzHandle("@Fern"), "@fern");
  assert.equal(canonicalWildzProfilePath("@Fern"), "/u/fern");
});

test("profile publish rejects an actor/handle mismatch", async () => {
  await assert.rejects(() => publishPublicWildzProfile(profileFor("@fern"), { actorReceizId: "@moss" }, fakeRepository()), /wildz_profile_owner_mismatch/);
});
```

Add a route-source contract asserting `app/api/profiles/[handle]/route.ts` calls `receizRequestSession`, never reads `body.actor`, and returns 401 without a cookie actor.

- [ ] **Step 2: Run the focused tests and verify failure**

Use the focused compile/run sequence for `wildz-profile.test.js` and `wildz-profile-route.test.js`.

Expected: failures for missing canonical helpers, route, and repository arguments.

- [ ] **Step 3: Implement canonical profile projection and routes**

```ts
export function canonicalWildzHandle(value: string) {
  const handle = value.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,46}$/.test(handle)) throw new Error("wildz_profile_handle_invalid");
  return `@${handle}`;
}

export function canonicalWildzProfilePath(value: string) {
  return `/u/${encodeURIComponent(canonicalWildzHandle(value).slice(1))}`;
}
```

`GET /api/profiles/[handle]` loads the public repository and returns 404 for a missing profile rather than synthesizing an empty identity. `POST` derives the cookie actor and Receiz profile, requires it to equal the sanitized profile handle, applies a revisioned `publish-profile` command, and publishes with `profile:<handle>:<revision>` idempotency. `app/u/[handle]/page.tsx` opens `WildzApp` with the profile overlay; the legacy username route redirects or renders the same canonical overlay without creating a second profile identity.

- [ ] **Step 4: Run profile tests and build the routes**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-profile.test.js .test-build/tests/wildz-profile-route.test.js
pnpm typecheck
```

Expected: profile tests pass; TypeScript resolves both deep-link routes.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/public-profile.ts src/lib/receiz/wildz-profile-adapter.ts app/api/profiles app/u app/'[username]'/page.tsx tests/wildz-profile.test.ts tests/wildz-profile-route.test.ts
git commit -m "feat: publish canonical Wildz player profiles"
```

---

### Task 4: Repair Public Card Publication and Deep Links

**Files:**
- Modify: `src/features/play/public-card-registry.ts`
- Modify: `src/features/play/card-export.ts`
- Modify: `app/api/cards/[assetId]/route.ts`
- Create: `app/c/[assetId]/page.tsx`
- Modify: `app/cards/[assetId]/page.tsx`
- Create: `tests/wildz-public-card-session.test.ts`
- Modify: `tests/wildz-continuity-and-shell.test.ts`

**Interfaces:**
- Consumes: authenticated cookie session, verified portable card, and `WildzPublicRepository`.
- Produces: `registerPublicWildsCard(asset)`, durable card lookup, and compatible `/cards/:id` plus `/c/:id` shell deep links.

- [ ] **Step 1: Write the failing publication tests**

```ts
test("browser card publication never reads a key file from localStorage", () => {
  const source = readFileSync("src/features/play/public-card-registry.ts", "utf8");
  assert.doesNotMatch(source, /BROWSER_RECEIZ_ID_SESSION_KEY|keyFile/);
  assert.match(source, /credentials:\s*"same-origin"/);
});

test("both card paths enter the same persistent shell", () => {
  for (const path of ["app/cards/[assetId]/page.tsx", "app/c/[assetId]/page.tsx"]) {
    assert.match(readFileSync(path, "utf8"), /<WildzApp/);
  }
});
```

- [ ] **Step 2: Run tests and verify the old localStorage seam fails**

Expected: the source assertion fails because current publication reads `BROWSER_RECEIZ_ID_SESSION_KEY`; the alias route is missing.

- [ ] **Step 3: Move card authority to the server session**

```ts
export async function registerPublicWildsCard(asset: PortableCardAsset) {
  const response = await fetch(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "idempotency-key": `card:${asset.id}:${asset.proof.digest}` },
    body: JSON.stringify({ asset })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "wildz_card_publish_failed");
  return payload as { ok: true; card: PortableCardAsset };
}
```

The POST route verifies the card proof, derives the Receiz actor from the cookie session, requires `asset.manifest.ownerReceizId` to match that actor, loads public state, applies `publish-card`, and publishes once. GET resolves the durable projection. Both page routes pass `{ kind: "card", assetId }` into the same `WildzApp` shell. Update `standaloneCardUrl` to emit the canonical `/cards/` path while keeping `/c/` readable.

- [ ] **Step 4: Run card/session tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-public-card-session.test.js .test-build/tests/wildz-continuity-and-shell.test.js
pnpm typecheck
```

Expected: pass; no browser key-file lookup remains; both routes compile.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/public-card-registry.ts src/features/play/card-export.ts app/api/cards app/cards app/c tests/wildz-public-card-session.test.ts tests/wildz-continuity-and-shell.test.ts
git commit -m "fix: authenticate public Wildz card recovery"
```

---

### Task 5: Admit Listings and Trades With Server-Derived Actors

**Files:**
- Modify: `src/features/market/wildz-market.ts`
- Modify: `src/lib/receiz/wildz-market-adapter.ts`
- Modify: `app/api/market/listings/route.ts`
- Modify: `app/api/market/trades/route.ts`
- Modify: `app/api/market/offers/route.ts`
- Modify: `tests/wildz-market.test.ts`
- Modify: `tests/wildz-market-routes.test.ts`

**Interfaces:**
- Consumes: public-state cards/ownership, cookie actor, expected revision, and idempotency key.
- Produces: `admitWildzListing(repository, input, authority)` and `admitWildzTrade(repository, input, authority)` with no module-level maps.

- [ ] **Step 1: Write failing actor and durability tests**

```ts
test("market routes derive actor from the Receiz session", () => {
  for (const route of ["listings", "trades", "offers"]) {
    const source = readFileSync(`app/api/market/${route}/route.ts`, "utf8");
    assert.match(source, /receizRequestSession/);
    assert.doesNotMatch(source, /\.\.\.body|body\.actor|body\.owner|body\.buyer/);
  }
});

test("listing admission requires published proof ownership", async () => {
  await assert.rejects(() => admitWildzListing(repositoryWithCard("@fern"), {
    assetId: "card:1", proofDigest: "sha256:one", priceCents: 500, expectedRevision: 0, idempotencyKey: "list:1"
  }, { actorReceizId: "@moss" }), /market_ownership_required/);
});
```

- [ ] **Step 2: Run market tests and verify failure**

Expected: route source fails because the current handlers spread client bodies and the adapter uses process maps.

- [ ] **Step 3: Implement repository transactions**

```ts
export async function admitWildzListing(repository: WildzPublicRepository, input: {
  assetId: string;
  proofDigest: string;
  priceCents: number;
  expectedRevision: number;
  idempotencyKey: string;
}, authority: { actorReceizId: string }) {
  const state = await repository.load();
  const card = state.cards[input.assetId];
  if (!card || card.proof.digest !== input.proofDigest || card.manifest.ownerReceizId !== authority.actorReceizId) throw new Error("market_ownership_required");
  const listing = createWildzListing({ ownerReceizId: authority.actorReceizId, ...input });
  const next = advanceWildzPublicState(state, { type: "admit-listing", actor: authority.actorReceizId, expectedRevision: input.expectedRevision, listing });
  await repository.publish(next, { expectedRevision: input.expectedRevision, idempotencyKey: input.idempotencyKey });
  return listing;
}
```

`admitWildzTrade` loads an active listing, derives the buyer from the cookie actor, rejects self-trade and stale revision, stores a plan with `ownershipTransferred: false`, and publishes it. Routes accept only asset/listing IDs, price or offer terms, expected revision, and idempotency. GET discovery returns bounded active listings from the durable projection.

- [ ] **Step 4: Run domain and route tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-market.test.js .test-build/tests/wildz-market-routes.test.js
pnpm typecheck
```

Expected: pass; no module-level `Map` remains in the production market adapter.

- [ ] **Step 5: Commit**

```bash
git add src/features/market/wildz-market.ts src/lib/receiz/wildz-market-adapter.ts app/api/market/listings app/api/market/trades app/api/market/offers tests/wildz-market.test.ts tests/wildz-market-routes.test.ts
git commit -m "feat: admit authenticated Wildz listings and trades"
```

---

### Task 6: Start Checkout Without Granting Ownership

**Files:**
- Modify: `app/api/market/checkout/route.ts`
- Modify: `src/features/market/wildz-market.ts`
- Create: `tests/wildz-checkout-authority.test.ts`

**Interfaces:**
- Consumes: admitted trade, authenticated buyer, `oneClickCheckout`, and repository revision.
- Produces: a persisted `pending_payment` receipt with checkout/order correlation and `ownershipTransferred: false`.

- [ ] **Step 1: Write failing checkout authority tests**

```ts
test("checkout never trusts a body buyer and never settles synchronously", () => {
  const source = readFileSync("app/api/market/checkout/route.ts", "utf8");
  assert.match(source, /receizRequestSession/);
  assert.doesNotMatch(source, /body\.buyer/);
  assert.match(source, /ownershipTransferred:\s*false/);
  assert.doesNotMatch(source, /ownershipTransferred:\s*true/);
});
```

Add a pure receipt test asserting a successful checkout-session creation still returns `pending_payment` and never changes `nextOwner`.

- [ ] **Step 2: Run the test and verify failure**

Expected: current route fails because it passes `body.buyer` into the plan.

- [ ] **Step 3: Implement authenticated checkout initiation**

```ts
const session = receizRequestSession(request);
if (!session.cookieAccessToken) return NextResponse.json({ error: "receiz_authority_required", ownershipTransferred: false }, { status: 401 });
const profile = await loadReceizConnectProfile(session.cookieAccessToken);
const trade = state.trades[body.tradeId];
if (!trade || trade.buyer !== profile.handle) return NextResponse.json({ error: "market_trade_authority_required", ownershipTransferred: false }, { status: 403 });
const checkout = await createReceizCommerceAdapter({ accessToken: session.cookieAccessToken }).oneClickCheckout({
  tenantHost: "wildz.quest",
  orderId: trade.id,
  amountUsd: (trade.priceCents / 100).toFixed(2),
  currency: "usd",
  walletFirst: true,
  cardFallback: true,
  customerReceizId: profile.handle,
  idempotencyKey: trade.idempotencyKey,
  cart: { items: [{ id: trade.assetId, quantity: 1, amountUsd: (trade.priceCents / 100).toFixed(2) }] },
  successUrl: "https://wildz.quest/?trade=pending",
  cancelUrl: "https://wildz.quest/?trade=cancelled"
});
```

Persist checkout/order correlation as a bounded pending receipt. Return 202 for a created checkout session, 503 with `capability_unavailable` when the rail is unavailable, and never call the ownership reducer from this route.

- [ ] **Step 4: Run checkout tests**

Run the focused compile sequence and `node --test .test-build/tests/wildz-checkout-authority.test.js`.

Expected: pass; every response path keeps `ownershipTransferred: false`.

- [ ] **Step 5: Commit**

```bash
git add app/api/market/checkout/route.ts src/features/market/wildz-market.ts tests/wildz-checkout-authority.test.ts
git commit -m "fix: keep Wildz checkout ownership pending"
```

---

### Task 7: Verify Settlement and Append Ownership Exactly Once

**Files:**
- Create: `app/api/market/settlement/route.ts`
- Create: `src/lib/receiz/wildz-settlement.ts`
- Modify: `src/lib/receiz/wildz-market-adapter.ts`
- Modify: `src/lib/receiz/webhook-security.ts`
- Create: `tests/wildz-settlement.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: verified Receiz webhook, pending trade, public repository, and `connectRecord`.
- Produces: `settleAdmittedWildzTrade(input)` and one `receiz.wilds_ownership_append.v1` per settlement event.

- [ ] **Step 1: Write failing settlement tests**

```ts
test("failed or replayed settlement never transfers twice", async () => {
  const failed = await settleAdmittedWildzTrade(fixture({ status: "payment.failed" }));
  assert.equal(failed.ownershipTransferred, false);
  const first = await settleAdmittedWildzTrade(fixture({ status: "payment.settled", eventId: "evt:1" }));
  const replay = await settleAdmittedWildzTrade(fixture({ status: "payment.settled", eventId: "evt:1" }));
  assert.equal(first.ownershipTransferred, true);
  assert.deepEqual(replay, first);
  assert.equal(connectRecords.filter((item) => item.schema === "receiz.wilds_ownership_append.v1").length, 1);
});
```

Add route tests for missing signature, stale timestamp, amount mismatch, order mismatch, and invalid tenant.

- [ ] **Step 2: Run tests and verify missing settlement boundary**

Expected: compile fails because the route and `settleAdmittedWildzTrade` do not exist.

- [ ] **Step 3: Implement verified settlement**

```ts
export type WildzOwnershipAppend = {
  schema: "receiz.wilds_ownership_append.v1";
  action: "ownership.transferred";
  assetId: string;
  proofDigest: string;
  previousOwnerReceizId: string;
  ownerReceizId: string;
  settlementLedgerEventId: string;
  transferredAt: string;
};
```

The route reads the raw body once, verifies the Receiz webhook signature and timestamp with SDK helpers, asserts the event schema, extracts a stable event/order ID, and calls `settleAdmittedWildzTrade`. The coordinator loads the pending trade, matches tenant/order/amount/buyer, returns the prior receipt for a replayed event, writes `connectRecord(append)`, applies `settle-trade`, and publishes the next public state. If append or publication fails, return recovery-pending and do not expose transferred ownership until the admitted state can be recovered.

- [ ] **Step 4: Run settlement and full market tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-settlement.test.js .test-build/tests/wildz-market.test.js .test-build/tests/wildz-market-routes.test.js
pnpm typecheck
```

Expected: all pass; one event creates one append and one ownership update.

- [ ] **Step 5: Commit**

```bash
git add app/api/market/settlement src/lib/receiz/wildz-settlement.ts src/lib/receiz/wildz-market-adapter.ts src/lib/receiz/webhook-security.ts tests/wildz-settlement.test.ts .env.example
git commit -m "feat: settle Wildz ownership with verified Receiz receipts"
```

---

### Task 8: Wire Truthful Embedded Market and Public Recovery States

**Files:**
- Modify: `src/features/market/WildzMarketSheet.tsx`
- Modify: `src/features/market/WildzTradeConfirm.tsx`
- Modify: `src/features/profile/WildzProfileSheet.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `tests/wildz-market-presentation.test.ts`
- Create: `tests/wildz-public-recovery.test.ts`

**Interfaces:**
- Consumes: public profile/card/listing DTOs and explicit `pending_payment`, `settled`, `payment_failed`, `capability_unavailable`, and `recovery_pending` receipts.
- Produces: embedded UI that never claims ownership before an admitted settled receipt.

- [ ] **Step 1: Write failing presentation contracts**

```ts
test("market UI renders every authority state without a market route", () => {
  const source = readFileSync("src/features/market/WildzMarketSheet.tsx", "utf8");
  for (const state of ["pending_payment", "settled", "payment_failed", "capability_unavailable", "recovery_pending"]) assert.match(source, new RegExp(state));
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
});
```

Add projection tests verifying a second repository instance resolves the published profile and card without access to the originating browser storage.

- [ ] **Step 2: Run presentation tests and verify missing states**

Expected: failures for missing recovery/pending state handling.

- [ ] **Step 3: Implement the explicit state machine in the sheets**

```ts
type MarketUiState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "pending_payment"; tradeId: string; checkoutUrl: string | null }
  | { kind: "settled"; tradeId: string; ownerReceizId: string }
  | { kind: "payment_failed"; message: string }
  | { kind: "capability_unavailable"; message: string }
  | { kind: "recovery_pending"; tradeId: string };
```

Render settled ownership only from the public receipt/ownership projection. Poll public state with an abortable bounded interval only while a trade is pending, then stop on terminal state or sheet close. Keep profile/card reads public and all writes cookie-authenticated.

- [ ] **Step 4: Run the public/economy release slice**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands pass; no `app/market/page.tsx`, process-memory public authority, client actor assertion, or synchronous ownership success remains.

- [ ] **Step 5: Commit**

```bash
git add src/features/market src/features/profile/WildzProfileSheet.tsx src/features/shell/WildzApp.tsx tests/wildz-market-presentation.test.ts tests/wildz-public-recovery.test.ts
git commit -m "feat: expose truthful Wildz public and market states"
```
