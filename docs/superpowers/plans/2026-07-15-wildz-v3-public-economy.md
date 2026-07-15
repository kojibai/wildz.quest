# Wildz V3 Public Profiles and Game Economy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver durable verified public profiles and cards plus a cookie-authenticated Wildz market whose listings, transfers, and ownership changes are admitted only by a remotely proven compare-and-append rail.

**Architecture:** Public profiles and immutable signed card assets live in a bounded `receiz.wildz_public_projection.v1` read projection. Market authority is deliberately separate: `WildzMarketRepository.compareAndAppend` requires an expected revision, expected append anchor, and remote admission proof; the installed Receiz rail must prove that conditional append or the feature returns `market_capability_unavailable`. Routes derive actors only from the secure Receiz cookie profile, Connect transfers use the stored seller user ID and listing amount, and ownership is projected from separate append-only receipts without changing a card's signed manifest owner.

**Tech Stack:** Next.js 15 route handlers, React 19, TypeScript 5.6, `@receiz/sdk` 100.0.0 public-store and Connect rails, Node test runner.

## Global Constraints

- Complete `2026-07-15-wildz-v3-identity-authority.md` and Phase A Tasks 1–4 of `2026-07-15-wildz-v3-kernel-continuity.md` first. Complete this public plan before kernel Phase B and before `2026-07-15-wildz-v3-player-experience.md`, whose profile Share/Copy UI consumes this backend.
- Work on `main`, commit each task, and do not push.
- Public profiles and cards are read projections; identity key files, passphrases, private Vault content, access tokens, seller Receiz user IDs, and market admission internals never enter a public DTO.
- Request JSON never supplies a trusted actor, seller, buyer, owner, seller user ID, transfer amount, or access token.
- Every mutation route requires `receizRequestSession(request).cookieAccessToken` and a successful `loadReceizConnectProfile`; delegated/operator tokens are never player authority.
- A listing can be initiated only from Card Vault and carries the complete verified `PortableCardAsset`, the expected market revision, and the expected append anchor.
- Before listing admission, the route requires the durable public card projection to contain the same asset ID and proof digest; a client-only card is never market-visible authority.
- A listing is admitted only when the current ownership receipt, or the immutable signed manifest when no transfer exists, names the cookie actor.
- `publishPublicStore` may maintain public profile/card projections but is never treated as an atomic market compare-and-append.
- `WildzMarketRepository.compareAndAppend` requires a remotely admitted revision and append anchor plus a non-empty remote admission proof. Missing proof or missing conditional-append capability returns `market_capability_unavailable`; no process lock or memory map substitutes for it.
- Connect transfer recipient and amount come from the admitted listing: `sellerReceizUserId` and `priceCents` respectively.
- A transfer settles only when the response has `ok === true` and non-empty `transferId`, `ledgerEventId`, and `proofBundle` fields.
- Ownership changes only after the transfer proof and a separate `receiz.wilds_ownership_receipt.v1` event are remotely admitted.
- Signed `PortableCardAsset.manifest.ownerReceizId` is immutable. Current ownership is resolved from `WildzOwnershipReceipt` records.
- If payment succeeds but ownership append is not admitted, return `recovery_pending`; retry with the same transfer idempotency key and never issue a second charge.
- Every reducer receives an explicit trusted `occurredAt`; no reducer calls `Date.now()` or `new Date()` to invent event time.
- Canonical card URLs are `/cards/[encoded full wilds:ID]`; `/c/[24hex]` remains a compatibility alias and redirects to the canonical URL.
- A public card page reads only verified public API data. It never falls back to `initialPlayState`, `receiz:wilds:save:v2`, or any browser-local inventory.
- Public recovery is not a local restore-success signal. Automatic publication accepts only the exact verified asset IDs from a committed atomic `WildzContinuityCoordinator` restore, rejects any owner-state mismatch as `wildz_publication_inventory_incomplete`, and never invents or silently omits a missing Vault card.
- Keep the market inside the existing Wildz sheet; do not create `/market`.

---

## File Structure

- `src/lib/receiz/wildz-public-state.ts` — bounded public profile/card projection and explicit-time reducer.
- `src/lib/receiz/wildz-public-repository.ts` — Receiz-backed public read-projection repository; never market authority.
- `src/lib/receiz/wildz-cookie-actor.ts` — secure-cookie-only Receiz player actor resolution.
- `src/lib/receiz/wildz-profile-adapter.ts` — canonical public profile resolve/publish operations.
- `src/features/profile/public-profile.ts` — public-only profile DTO and sanitization.
- `src/features/play/public-card-registry.ts` — public card parameter parsing, immutable publication record, and cookie-authenticated registration client.
- `src/features/play/card-export.ts` — canonical `/cards/` URL generation.
- `src/features/play/WildsCardPage.tsx` — API-only public card presentation.
- `src/features/market/wildz-market.ts` — listing, trade, public receipt, and ownership receipt contracts.
- `src/lib/receiz/wildz-market-state.ts` — deterministic market event reducer and current-owner projection.
- `src/lib/receiz/wildz-market-repository.ts` — remote conditional-append contract, proof validation, and explicit capability gate.
- `src/lib/receiz/wildz-market-adapter.ts` — authenticated listing, trade, cancellation, transfer, and recovery coordinators.
- `app/api/profiles/[handle]/route.ts` — public profile read and cookie-authenticated publication.
- `app/api/cards/[assetId]/route.ts` — verified card read and cookie-authenticated publication.
- `app/api/market/listings/route.ts` — listing discovery, admission, and cancellation.
- `app/api/market/trades/route.ts` — authenticated trade planning.
- `app/api/market/checkout/route.ts` — Connect transfer and first ownership-admission attempt.
- `app/api/market/settlement/route.ts` — idempotent recovery of a proven transfer whose ownership append is pending.
- `app/u/[handle]/page.tsx` — canonical profile deep link into the persistent shell.
- `app/cards/[assetId]/page.tsx` — canonical full-ID card deep link.
- `app/c/[assetId]/page.tsx` — 24-hex compatibility redirect.

---

### Task 1: Define the Public Profile and Card Projection

**Files:**
- Create: `src/lib/receiz/wildz-public-state.ts`
- Create: `tests/wildz-public-state.test.ts`

**Interfaces:**
- Consumes: `PublicWildzProfile`, `PortableCardAsset`, and `canonicalWildzActorId` from the completed identity plan.
- Produces: `WildzPublicState`, `WildzPublicCommand`, `emptyWildzPublicState()`, `restoreWildzPublicState(value)`, `wildzPublicStateDigest(state)`, and `advanceWildzPublicState(state, command, { occurredAt })`.

- [ ] **Step 1: Write the failing projection tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizePublicWildzProfile } from "../src/features/profile/public-profile";
import { advanceWildzPublicState, emptyWildzPublicState, restoreWildzPublicState } from "../src/lib/receiz/wildz-public-state";

test("public projection rejects stale revision and uses the admitted time", () => {
  const initial = emptyWildzPublicState();
  const profile = sanitizePublicWildzProfile({ username: "@fern", displayName: "Fern", vault: [] });
  assert.throws(() => advanceWildzPublicState(initial, {
    type: "publish-profile",
    actorHandle: "@fern",
    expectedRevision: 2,
    profile
  }, { occurredAt: "2026-07-15T12:00:00.000Z" }), /wildz_public_revision_conflict/);
  const next = advanceWildzPublicState(initial, {
    type: "publish-profile",
    actorHandle: "@fern",
    expectedRevision: 0,
    profile
  }, { occurredAt: "2026-07-15T12:00:00.000Z" });
  assert.equal(next.updatedAt, "2026-07-15T12:00:00.000Z");
});

test("public projection strips private and market-only fields", () => {
  const restored = restoreWildzPublicState({
    ...emptyWildzPublicState(),
    keyFile: { crypto: { privateKeyPkcs8B64u: "secret" } },
    accessToken: "secret",
    sellerReceizUserId: "usr_private",
    listings: { "listing:1": {} },
    receipts: [{ transferId: "secret" }]
  });
  assert.equal("keyFile" in restored, false);
  assert.equal("accessToken" in restored, false);
  assert.equal("sellerReceizUserId" in restored, false);
  assert.equal("listings" in restored, false);
  assert.equal("receipts" in restored, false);
});
```

- [ ] **Step 2: Run the test and confirm the missing module failure**

Run:

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript fails because `src/lib/receiz/wildz-public-state.ts` does not exist.

- [ ] **Step 3: Implement the bounded projection and explicit-time reducer**

```ts
export type WildzPublicState = {
  schema: "receiz.wildz_public_projection.v1";
  revision: number;
  updatedAt: string;
  profiles: Record<string, PublicWildzProfile>;
  cards: Record<string, PortableCardAsset>;
};

export type WildzPublicCommand =
  | { type: "publish-profile"; actorHandle: string; expectedRevision: number; profile: PublicWildzProfile }
  | { type: "publish-card"; actorId: string; expectedRevision: number; card: PortableCardAsset };

export function emptyWildzPublicState(): WildzPublicState {
  return {
    schema: "receiz.wildz_public_projection.v1",
    revision: 0,
    updatedAt: "1970-01-01T00:00:00.000Z",
    profiles: {},
    cards: {}
  };
}

function admittedIso(value: string) {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error("wildz_public_time_invalid");
  }
  return value;
}

export function advanceWildzPublicState(
  state: WildzPublicState,
  command: WildzPublicCommand,
  context: { occurredAt: string }
): WildzPublicState {
  if (command.expectedRevision !== state.revision) throw new Error("wildz_public_revision_conflict");
  const updatedAt = admittedIso(context.occurredAt);
  if (command.type === "publish-profile") {
    if (command.profile.username.toLowerCase() !== command.actorHandle.toLowerCase()) {
      throw new Error("wildz_profile_owner_mismatch");
    }
    return {
      ...state,
      revision: state.revision + 1,
      updatedAt,
      profiles: { ...state.profiles, [command.profile.username.toLowerCase()]: command.profile }
    };
  }
  if (!verifyAnyWildsCard(command.card).ok) throw new Error("wildz_public_card_verification_failed");
  const signedOwnerId = canonicalWildzActorId({ owner: { username: command.card.manifest.ownerReceizId, uid: null } });
  if (signedOwnerId !== command.actorId) {
    throw new Error("wildz_public_card_owner_mismatch");
  }
  return {
    ...state,
    revision: state.revision + 1,
    updatedAt,
    cards: { ...state.cards, [command.card.id]: command.card }
  };
}
```

Implement `restoreWildzPublicState` as an allow-list parser that keeps at most 1,000 profiles and 5,000 verified cards, preserves only schema/revision/updatedAt/profiles/cards, and returns `emptyWildzPublicState()` for an invalid root. Implement `wildzPublicStateDigest` with the existing canonical JSON and SHA-256 helpers.

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
git commit -m "feat: define Wildz public projection"
```

---

### Task 2: Add the Durable Public Projection Repository

**Files:**
- Create: `src/lib/receiz/wildz-public-repository.ts`
- Create: `tests/wildz-public-repository.test.ts`
- Modify: `src/lib/wildz/product.ts`

**Interfaces:**
- Consumes: `WildzPublicState`, `createReceizCommerceAdapter().restoreLatestPublicStore`, and `.publishPublicStore`.
- Produces: `WildzPublicHead`, `WildzPublicLoad`, `WildzPublicProjectionRepository`, `createReceizWildzPublicRepository(options)`, and `WILDZ_PUBLIC_NAMESPACE`.

- [ ] **Step 1: Write the failing durable-recovery test**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWildzPublicState } from "../src/lib/receiz/wildz-public-state";
import { createReceizWildzPublicRepository } from "../src/lib/receiz/wildz-public-repository";

test("a second repository instance restores the published projection", async () => {
  let durableState = emptyWildzPublicState();
  let durableHead = { appendAnchorId: "anchor:0", afterKaiUpulse: "pulse:0" };
  const adapter = {
    restoreLatestPublicStore: async () => ({ state: durableState, knownHead: durableHead }),
    publishPublicStore: async (input: { state: typeof durableState }) => {
      durableState = input.state;
      durableHead = { appendAnchorId: `anchor:${durableState.revision}`, afterKaiUpulse: `pulse:${durableState.revision}` };
      return { ok: true, knownHead: durableHead };
    }
  };
  const first = createReceizWildzPublicRepository({ adapter: adapter as never });
  const loaded = await first.load();
  await first.publish({ ...loaded.state, revision: 1 }, {
    expectedHead: loaded.head,
    idempotencyKey: "profile:@fern:1"
  });
  const second = createReceizWildzPublicRepository({ adapter: adapter as never });
  assert.equal((await second.load()).state.revision, 1);
});
```

- [ ] **Step 2: Run the test and verify the missing repository failure**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript fails because `createReceizWildzPublicRepository` does not exist.

- [ ] **Step 3: Implement the projection-only repository**

```ts
export type WildzPublicHead = {
  revision: number;
  stateDigest: string;
  appendAnchorId: string | null;
  afterKaiUpulse: string | null;
};

export type WildzPublicLoad = {
  state: WildzPublicState;
  head: WildzPublicHead;
};

export interface WildzPublicProjectionRepository {
  load(): Promise<WildzPublicLoad>;
  publish(next: WildzPublicState, input: {
    expectedHead: WildzPublicHead;
    idempotencyKey: string;
  }): Promise<WildzPublicLoad>;
}

export function createReceizWildzPublicRepository(options: {
  adapter: Pick<ReceizCommerceAdapter, "restoreLatestPublicStore" | "publishPublicStore">;
}): WildzPublicProjectionRepository;

export const WILDZ_PUBLIC_NAMESPACE = "wildz:public:v1";
```

`load` must call `restoreLatestPublicStore({ host: "wildz.quest", requiredSchema: "receiz.wildz_public_projection.v1" })`, restore only the public projection, and build the head from the restored revision, `wildzPublicStateDigest(state)`, and any returned remote append metadata. `publish` reloads once and returns `wildz_public_projection_conflict` when the observed revision/digest/remote head differs from `expectedHead`, publishes with the exact namespace and idempotency key, reloads the published projection, and returns its resulting state/head. Document beside the interface that this preflight protects a read projection only and is not atomic market authority; `wildz-market-state.ts` and `wildz-market-repository.ts` may not import `WildzPublicProjectionRepository`. A listing route may read it only to prove the submitted card is already publicly recoverable before invoking separate market admission.

- [ ] **Step 4: Run the focused repository tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-public-repository.test.js
```

Expected: pass, including restoration through a fresh repository instance.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-public-repository.ts src/lib/wildz/product.ts tests/wildz-public-repository.test.ts
git commit -m "feat: persist Wildz public projections"
```

---

### Task 3: Resolve Cookie Actors and Canonical Player Profiles

**Files:**
- Create: `src/lib/receiz/wildz-cookie-actor.ts`
- Modify: `src/features/profile/public-profile.ts`
- Modify: `src/lib/receiz/wildz-profile-adapter.ts`
- Create: `app/api/profiles/[handle]/route.ts`
- Create: `app/u/[handle]/page.tsx`
- Modify: `app/[username]/page.tsx`
- Modify: `tests/wildz-profile.test.ts`
- Modify: `tests/wildz-profile-route.test.ts`

**Interfaces:**
- Consumes: `receizRequestSession`, `loadReceizConnectProfile`, `canonicalWildzActorId`, and `WildzPublicProjectionRepository`.
- Produces: `WildzCookieActor`, `resolveWildzCookieActor(request)`, `canonicalWildzHandle(value)`, `canonicalWildzProfilePath(value)`, `resolvePublicWildzProfile(handle, repository)`, and `publishPublicWildzProfile(profile, actor, repository, { occurredAt })`.

- [ ] **Step 1: Write failing cookie-authority and canonical-route tests**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canonicalWildzHandle, canonicalWildzProfilePath } from "../src/features/profile/public-profile";

test("profile handles have one canonical public route", () => {
  assert.equal(canonicalWildzHandle("@Fern"), "@fern");
  assert.equal(canonicalWildzProfilePath("@Fern"), "/u/fern");
});

test("player mutations accept only cookie profile authority", () => {
  const actorSource = readFileSync("src/lib/receiz/wildz-cookie-actor.ts", "utf8");
  assert.match(actorSource, /cookieAccessToken/);
  assert.doesNotMatch(actorSource, /session\.accessToken|delegatedAccessToken|RECEIZ_ACCESS_TOKEN|RECEIZ_CONNECT_ACCESS_TOKEN/);
  const routeSource = readFileSync("app/api/profiles/[handle]/route.ts", "utf8");
  assert.match(routeSource, /resolveWildzCookieActor/);
  assert.doesNotMatch(routeSource, /body\.actor|body\.owner|body\.accessToken/);
  const adapterSource = readFileSync("src/lib/receiz/wildz-profile-adapter.ts", "utf8");
  assert.doesNotMatch(adapterSource, /localProfiles|new Map|Map</);
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-profile.test.js .test-build/tests/wildz-profile-route.test.js
```

Expected: missing canonical helpers, cookie actor module, and route cause failures.

- [ ] **Step 3: Implement secure cookie actor resolution and profiles**

```ts
export type WildzCookieActor = {
  actorId: string;
  profileHandle: string;
  receizUserId: string;
  accessToken: string;
};

export async function resolveWildzCookieActor(request: NextRequest): Promise<WildzCookieActor> {
  const cookieAccessToken = receizRequestSession(request).cookieAccessToken;
  if (!cookieAccessToken) throw new Error("receiz_authority_required");
  const profile = await loadReceizConnectProfile(cookieAccessToken);
  if (!profile?.handle || !profile.id) throw new Error("receiz_profile_required");
  const profileHandle = canonicalWildzHandle(profile.handle);
  return {
    actorId: canonicalWildzActorId({ owner: { username: profile.handle, uid: profile.id } }),
    profileHandle,
    receizUserId: profile.id,
    accessToken: cookieAccessToken
  };
}

export function canonicalWildzHandle(value: string) {
  const handle = value.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,46}$/.test(handle)) throw new Error("wildz_profile_handle_invalid");
  return `@${handle}`;
}

export function canonicalWildzProfilePath(value: string) {
  return `/u/${encodeURIComponent(canonicalWildzHandle(value).slice(1))}`;
}
```

`GET /api/profiles/[handle]` constructs the public repository from an unauthenticated Receiz adapter, loads the public projection, and returns 404 when the profile is absent. `POST` calls `resolveWildzCookieActor`, sanitizes the body without actor fields, requires the canonical body handle to equal `actor.profileHandle`, and requires every requested public Vault entry to match an already verified `state.cards[id]` proof digest whose canonical signed owner is `actor.actorId`. Reject a missing, mismatched, or foreign entry as `wildz_public_profile_card_unverified` instead of publishing a shortened profile that could conceal an incomplete Vault restore. Apply `advanceWildzPublicState(state, { type: "publish-profile", actorHandle: actor.profileHandle, expectedRevision: state.revision, profile }, { occurredAt: serverIsoTime })`, construct an authenticated Receiz adapter with `actor.accessToken`, pass that adapter to `createReceizWildzPublicRepository`, and publish with `` `profile:${actor.profileHandle}:${next.revision}` ``. Obtain `serverIsoTime` once in the route and pass it explicitly. `app/u/[handle]/page.tsx` opens `WildzApp` with the profile overlay, while the compatible username page redirects to `canonicalWildzProfilePath`. Task 8 updates the profile admission check to use the final ownership-receipt projection after market state exists.

- [ ] **Step 4: Run profile tests and typecheck the routes**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-profile.test.js .test-build/tests/wildz-profile-route.test.js
pnpm typecheck
```

Expected: all profile tests pass; mutation source contains no delegated-token or body-actor authority.

- [ ] **Step 5: Commit**

```bash
git add src/lib/receiz/wildz-cookie-actor.ts src/features/profile/public-profile.ts src/lib/receiz/wildz-profile-adapter.ts app/api/profiles/'[handle]'/route.ts app/u/'[handle]'/page.tsx app/'[username]'/page.tsx tests/wildz-profile.test.ts tests/wildz-profile-route.test.ts
git commit -m "feat: publish cookie-authenticated Wildz profiles"
```

---

### Task 4: Publish Cards and Enforce Canonical Public Deep Links

**Files:**
- Modify: `src/features/identity/use-wildz-continuity.ts`
- Modify: `src/features/play/public-card-registry.ts`
- Modify: `src/features/play/card-export.ts`
- Modify: `src/features/play/WildsCardPage.tsx`
- Modify: `app/api/cards/[assetId]/route.ts`
- Create: `app/c/[assetId]/page.tsx`
- Modify: `app/cards/[assetId]/page.tsx`
- Create: `tests/wildz-public-card-session.test.ts`
- Modify: `tests/wildz-continuity-and-shell.test.ts`

**Interfaces:**
- Consumes: `PortableCardAsset`, `verifyAnyWildsCard`, `resolveWildzCookieActor`, and `WildzPublicProjectionRepository`.
- Produces: `PublicCardParam`, `parsePublicCardParam(value)`, `canonicalPublicCardPath(assetId)`, `registerPublicWildsCard(asset)`, `registerVerifiedRestoredWildsCards(input)`, and API-only public card recovery.

- [ ] **Step 1: Write failing path, session, and API-only recovery tests**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canonicalPublicCardPath, parsePublicCardParam } from "../src/features/play/public-card-registry";

test("full and compact card parameters resolve one canonical asset", () => {
  assert.deepEqual(parsePublicCardParam("wilds:0123456789abcdef01234567"), {
    assetId: "wilds:0123456789abcdef01234567",
    source: "canonical"
  });
  assert.deepEqual(parsePublicCardParam("0123456789abcdef01234567"), {
    assetId: "wilds:0123456789abcdef01234567",
    source: "compact"
  });
  assert.equal(canonicalPublicCardPath("wilds:0123456789abcdef01234567"), "/cards/wilds%3A0123456789abcdef01234567");
});

test("public card recovery never reads private browser inventory", () => {
  const page = readFileSync("src/features/play/WildsCardPage.tsx", "utf8");
  assert.doesNotMatch(page, /initialPlayState|restorePlayState|localStorage|receiz:wilds:save:v2/);
  assert.match(page, /fetch\(`\/api\/cards\/\$\{encodeURIComponent\(assetId\)\}`/);
  const route = readFileSync("app/api/cards/[assetId]/route.ts", "utf8");
  assert.match(route, /resolveWildzCookieActor/);
  assert.doesNotMatch(route, /identityProof|keyFile|session\.accessToken|body\.actor/);
});

test("restore publication requires a committed exact verified asset set", () => {
  const registry = readFileSync("src/features/play/public-card-registry.ts", "utf8");
  assert.match(registry, /restoreStatus:\s*"committed"/);
  assert.match(registry, /verifiedAssetIds/);
  assert.match(registry, /wildz_publication_inventory_incomplete/);
  assert.match(registry, /credentials:\s*"same-origin"/);
  assert.doesNotMatch(registry, /identityProof|keyFile|passphrase/);
  assert.doesNotMatch(registry, /registryKey|Symbol\.for\("receiz\.wilds\.public-card-registry|resolveLocalPublicWildsCard/);
  assert.doesNotMatch(registry, /initialPlayState|restorePlayState|receiz:wilds:save:v2/);
  const continuity = readFileSync("src/features/identity/use-wildz-continuity.ts", "utf8");
  assert.match(continuity, /registerVerifiedRestoredWildsCards/);
  assert.match(continuity, /restoreStatus:\s*"committed"/);
});
```

- [ ] **Step 2: Run tests and verify the old compact/local recovery seams fail**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-public-card-session.test.js .test-build/tests/wildz-continuity-and-shell.test.js
```

Expected: URL assertion fails because `standaloneCardUrl` emits `/c/`, the alias page is absent, and `WildsCardPage` reads initial/local V2 inventory.

- [ ] **Step 3: Implement content-safe parameter parsing and server card authority**

```ts
import type { CommittedWildzRestoreOutcome } from "../../lib/receiz/wildz-continuity-coordinator";

export type PublicCardParam = {
  assetId: string;
  source: "canonical" | "compact";
};

export function parsePublicCardParam(value: string): PublicCardParam {
  const decoded = decodeURIComponent(value).trim().toLowerCase();
  if (/^wilds:[a-f0-9]{24}$/.test(decoded)) return { assetId: decoded, source: "canonical" };
  if (/^[a-f0-9]{24}$/.test(decoded)) return { assetId: `wilds:${decoded}`, source: "compact" };
  throw new Error("wilds_public_card_id_invalid");
}

export function canonicalPublicCardPath(assetId: string) {
  const parsed = parsePublicCardParam(assetId);
  return `/cards/${encodeURIComponent(parsed.assetId)}`;
}

export function standaloneCardUrl(assetId: string, origin: string) {
  const base = new URL(origin);
  if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error("wilds_card_origin_invalid");
  return new URL(canonicalPublicCardPath(assetId), base.origin).toString();
}

export async function registerPublicWildsCard(asset: PortableCardAsset) {
  if (!verifyAnyWildsCard(asset).ok) throw new Error("wilds_public_card_verification_failed");
  const response = await fetch(`/api/cards/${encodeURIComponent(asset.id)}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset })
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; record?: PublicWildsCardRecord; error?: string } | null;
  if (!response.ok || payload?.ok !== true || !payload.record?.asset) {
    throw new Error(payload?.error ?? "wildz_public_card_registration_failed");
  }
  return payload.record.asset;
}

export async function registerVerifiedRestoredWildsCards(
  input: Pick<CommittedWildzRestoreOutcome, "restoreStatus" | "ownerState" | "verifiedAssetIds">
) {
  if (input.restoreStatus !== "committed") throw new Error("wildz_publication_restore_incomplete");
  const expectedIds = [...new Set(input.verifiedAssetIds)].sort();
  const verifiedById = new Map(
    input.ownerState.playState.inventory
      .filter((asset) => verifyAnyWildsCard(asset).ok)
      .map((asset) => [asset.id, asset] as const)
  );
  const assets = expectedIds.map((assetId) => verifiedById.get(assetId) ?? null);
  if (assets.some((asset) => asset === null)) throw new Error("wildz_publication_inventory_incomplete");
  const published: PortableCardAsset[] = [];
  for (const asset of assets) {
    if (!asset) throw new Error("wildz_publication_inventory_incomplete");
    published.push(await registerPublicWildsCard(asset));
  }
  return published;
}
```

Remove the symbol-backed public card registry and `resolveLocalPublicWildsCard`. The POST route accepts only `{ asset }`, parses the path with `parsePublicCardParam`, verifies the complete asset, calls `resolveWildzCookieActor`, resolves the immutable manifest owner through `canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } })`, requires it to equal `actor.actorId`, and applies `advanceWildzPublicState(state, { type: "publish-card", actorId: actor.actorId, expectedRevision: state.revision, card: asset }, { occurredAt: serverIsoTime })`. Construct an authenticated Receiz adapter with `actor.accessToken` and pass it as `{ adapter }` to `createReceizWildzPublicRepository`; GET constructs the same repository boundary with its unauthenticated public adapter. Store the canonical full-ID URL in `PublicWildsCardRecord.sourceUrl`; `publicWildsCardRecoverySourceUrls` returns canonical first and compact alias second. POST and GET return `{ ok: true, record: PublicWildsCardRecord }`, where GET builds the record from only the durable projection; this preserves the existing verified card-image route contract. After a Vault restore, call `registerVerifiedRestoredWildsCards` only with the coordinator's `CommittedWildzRestoreOutcome`; a failed/incomplete restore never triggers publication. Publish `outcome.verifiedAssetIds` sequentially from `outcome.ownerState` so every call observes the prior projection head. `app/c/[assetId]/page.tsx` accepts the 24-hex form and calls `redirect(canonicalPublicCardPath(assetId))`; `app/cards/[assetId]/page.tsx` accepts the encoded full ID. `WildsCardPage` initializes `asset` to `null` and resolves it only from `result.record.asset`. A successful public GET does not clear, replace, or downgrade a local restore error.

- [ ] **Step 4: Run card/session tests and typecheck**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-public-card-session.test.js .test-build/tests/wildz-continuity-and-shell.test.js
pnpm typecheck
```

Expected: both URL forms resolve the same verified asset, the compact route redirects, and public card source has no local inventory fallback.

- [ ] **Step 5: Commit**

```bash
git add src/features/identity/use-wildz-continuity.ts src/features/play/public-card-registry.ts src/features/play/card-export.ts src/features/play/WildsCardPage.tsx app/api/cards/'[assetId]'/route.ts app/cards/'[assetId]'/page.tsx app/c/'[assetId]'/page.tsx tests/wildz-public-card-session.test.ts tests/wildz-continuity-and-shell.test.ts
git commit -m "fix: make verified cards publicly recoverable"
```

---

### Task 5: Define Market State and Remote Compare-and-Append Authority

**Files:**
- Modify: `src/features/market/wildz-market.ts`
- Create: `src/lib/receiz/wildz-market-state.ts`
- Create: `src/lib/receiz/wildz-market-repository.ts`
- Create: `tests/wildz-market-state.test.ts`
- Create: `tests/wildz-market-repository.test.ts`

**Interfaces:**
- Consumes: `PortableCardAsset`, `JsonObject`, `canonicalWildzActorId`, and an optional Receiz conditional-append capability.
- Produces: `WildzListing`, `WildzTradePlan`, `WildzOwnershipReceipt`, `WildzMarketReceipt`, `WildzMarketEvent`, `WildzMarketState`, `advanceWildzMarketState(state, event, { occurredAt })`, `currentWildzOwner(state, asset)`, `WildzMarketRepository`, `resolveWildzMarketConditionalAppendRail(value)`, and `createReceizWildzMarketRepository(options)`.

- [ ] **Step 1: Write failing state and capability-gate tests**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";
import { createReceizWildzMarketRepository } from "../src/lib/receiz/wildz-market-repository";

test("market repository refuses an append without remote conditional proof", async () => {
  const state = emptyWildzMarketState();
  const repository = createReceizWildzMarketRepository({ rail: null });
  const loaded = await repository.load();
  assert.deepEqual(loaded, { status: "market_capability_unavailable" });
  const admission = await repository.compareAndAppend({
    current: state,
    expectedRevision: 0,
    expectedAppendAnchorId: null,
    idempotencyKey: "listing:one",
    occurredAt: "2026-07-15T12:00:00.000Z",
    event: { type: "listing-cancelled", listingId: "listing:one", actorId: "fern" }
  });
  assert.deepEqual(admission, { status: "market_capability_unavailable" });
});

test("market authority has no public-store or in-memory fallback", () => {
  const source = readFileSync("src/lib/receiz/wildz-market-repository.ts", "utf8");
  assert.doesNotMatch(source, /publishPublicStore|WildzPublicProjectionRepository|new Map|Map</);
  assert.match(source, /market_capability_unavailable/);
  assert.match(source, /expectedAppendAnchorId/);
  assert.match(source, /admissionProof/);
  assert.match(source, /verifyAdmissionProof/);
});

test("market repository rejects a shaped response whose remote proof fails verification", async () => {
  const state = emptyWildzMarketState();
  const admissionProof = {
    schema: "receiz.wildz_market_admission.v1" as const,
    admittedRevision: 0,
    previousAppendAnchorId: null,
    appendAnchorId: null,
    proofBundle: { schema: "receiz.append.genesis_proof.v1" }
  };
  const repository = createReceizWildzMarketRepository({
    rail: {
      readLatest: async () => ({ ok: true, state, admissionProof }),
      compareAndAppend: async () => ({ ok: false }),
      verifyAdmissionProof: async () => false
    }
  });
  assert.deepEqual(await repository.load(), { status: "market_capability_unavailable" });
});
```

- [ ] **Step 2: Run the tests and confirm missing market modules**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript fails because the market state and repository modules do not exist.

- [ ] **Step 3: Implement immutable contracts and explicit-time market reduction**

```ts
export type WildzListing = {
  schema: "wildz.listing.v2";
  id: string;
  asset: PortableCardAsset;
  assetId: string;
  proofDigest: string;
  sellerActorId: string;
  sellerReceizUserId: string;
  priceCents: number;
  currency: "USD";
  status: "active" | "reserved" | "sold" | "cancelled";
  idempotencyKey: string;
  createdAt: string;
};

export type WildzTradePlan = {
  schema: "wildz.trade_plan.v2";
  id: string;
  listingId: string;
  assetId: string;
  sellerActorId: string;
  buyerActorId: string;
  priceCents: number;
  currency: "USD";
  idempotencyKey: string;
  createdAt: string;
};

export type WildzOwnershipReceipt = {
  schema: "receiz.wilds_ownership_receipt.v1";
  assetId: string;
  proofDigest: string;
  previousOwnerReceizId: string;
  ownerReceizId: string;
  transferId: string;
  ledgerEventId: string;
  proofBundle: JsonObject;
  transferredAt: string;
};

export type WildzMarketReceipt = {
  schema: "wildz.market_receipt.v2";
  tradeId: string;
  status: "pending_payment" | "settled" | "payment_failed" | "market_capability_unavailable" | "recovery_pending";
  transferId: string | null;
  ledgerEventId: string | null;
  ownershipTransferred: boolean;
  nextOwnerReceizId: string | null;
};

export type WildzMarketEvent =
  | { type: "listing-admitted"; listing: WildzListing }
  | { type: "listing-cancelled"; listingId: string; actorId: string }
  | { type: "trade-admitted"; trade: WildzTradePlan }
  | { type: "settlement-admitted"; tradeId: string; receipt: WildzOwnershipReceipt };

export type WildzMarketState = {
  schema: "receiz.wildz_market_state.v1";
  revision: number;
  appendAnchorId: string | null;
  updatedAt: string;
  listings: Record<string, WildzListing>;
  trades: Record<string, WildzTradePlan>;
  ownership: Record<string, WildzOwnershipReceipt>;
  receipts: WildzMarketReceipt[];
};

export function emptyWildzMarketState(): WildzMarketState {
  return {
    schema: "receiz.wildz_market_state.v1",
    revision: 0,
    appendAnchorId: null,
    updatedAt: "1970-01-01T00:00:00.000Z",
    listings: {},
    trades: {},
    ownership: {},
    receipts: []
  };
}

export function currentWildzOwner(state: WildzMarketState, asset: PortableCardAsset) {
  return state.ownership[asset.id]?.ownerReceizId
    ?? canonicalWildzActorId({ owner: { username: asset.manifest.ownerReceizId, uid: null } });
}
```

`advanceWildzMarketState(state, event, { occurredAt })` validates the ISO time, applies exactly one event, increments revision once, and never mutates `listing.asset`. For `settlement-admitted`, it requires the active trade/listing, matches asset/digest/current owner, records `WildzOwnershipReceipt` separately, sets the listing to `sold`, and appends a settled public receipt. Restore and reduction retain at most 5,000 listings, 5,000 trades, 5,000 ownership receipts, and the newest 2,048 market receipts; exceeding an authoritative map limit rejects the new event rather than discarding active ownership.

- [ ] **Step 4: Implement the conditional repository and strict proof parser**

```ts
export type WildzMarketAdmissionProof = {
  schema: "receiz.wildz_market_admission.v1";
  admittedRevision: number;
  previousAppendAnchorId: string | null;
  appendAnchorId: string | null;
  proofBundle: JsonObject;
};

export type WildzMarketLoadResult =
  | { status: "ready"; state: WildzMarketState; admissionProof: WildzMarketAdmissionProof }
  | { status: "market_capability_unavailable" };

export type WildzMarketAdmission =
  | { status: "admitted" | "replayed"; state: WildzMarketState; admissionProof: WildzMarketAdmissionProof }
  | { status: "market_revision_conflict"; currentRevision: number; currentAppendAnchorId: string | null }
  | { status: "market_capability_unavailable" };

export interface WildzMarketRepository {
  load(): Promise<WildzMarketLoadResult>;
  compareAndAppend(input: {
    current: WildzMarketState;
    expectedRevision: number;
    expectedAppendAnchorId: string | null;
    idempotencyKey: string;
    occurredAt: string;
    event: WildzMarketEvent;
  }): Promise<WildzMarketAdmission>;
}

export interface WildzMarketConditionalAppendRail {
  readLatest(input: { namespace: "wildz:market:v1" }): Promise<unknown>;
  compareAndAppend(input: {
    schema: "receiz.wildz_market_compare_append.v1";
    namespace: "wildz:market:v1";
    expectedRevision: number;
    expectedAppendAnchorId: string | null;
    idempotencyKey: string;
    occurredAt: string;
    event: WildzMarketEvent;
    nextState: WildzMarketState;
  }): Promise<unknown>;
  verifyAdmissionProof(input:
    | { kind: "load"; proof: WildzMarketAdmissionProof; state: WildzMarketState }
    | {
      kind: "append";
      proof: WildzMarketAdmissionProof;
      expectedRevision: number;
      expectedAppendAnchorId: string | null;
      event: WildzMarketEvent;
      state: WildzMarketState;
    }
  ): Promise<boolean>;
}

export function resolveWildzMarketConditionalAppendRail(value: unknown): WildzMarketConditionalAppendRail | null {
  const candidate = value && typeof value === "object"
    ? (value as { wildzMarket?: Partial<WildzMarketConditionalAppendRail> }).wildzMarket
    : null;
  if (!candidate
    || typeof candidate.readLatest !== "function"
    || typeof candidate.compareAndAppend !== "function"
    || typeof candidate.verifyAdmissionProof !== "function") return null;
  return {
    readLatest: candidate.readLatest.bind(candidate),
    compareAndAppend: candidate.compareAndAppend.bind(candidate),
    verifyAdmissionProof: candidate.verifyAdmissionProof.bind(candidate)
  };
}
```

`createReceizWildzMarketRepository` accepts `{ rail: WildzMarketConditionalAppendRail | null }`. `load` admits a snapshot only when the state/proof head matches and `rail.verifyAdmissionProof({ kind: "load", proof, state })` returns true. Before an append it requires `current.revision === expectedRevision` and `current.appendAnchorId === expectedAppendAnchorId`, then computes `nextState` with the explicit `occurredAt`. Admit an append response only when it proves `admittedRevision === expectedRevision + 1`, `previousAppendAnchorId === expectedAppendAnchorId`, a non-empty new `appendAnchorId`, a non-empty object `proofBundle`, a restored state whose revision/anchor match the proof, and `rail.verifyAdmissionProof({ kind: "append", proof, expectedRevision, expectedAppendAnchorId, event, state: restoredState }) === true`. Any missing field, unavailable method, failed proof verification, or unprovable response returns `{ status: "market_capability_unavailable" }`; a proved competing head returns `market_revision_conflict`. Production routes call `resolveWildzMarketConditionalAppendRail(createReceizCommerceAdapter({ accessToken: actor.accessToken }))`; the currently installed adapter therefore gates the market unavailable unless the connected Receiz deployment exposes exact `wildzMarket.readLatest`, `wildzMarket.compareAndAppend`, and `wildzMarket.verifyAdmissionProof` methods. Do not route through `publishPublicStore`, a module map, a mutex, or local storage.

- [ ] **Step 5: Run the focused market authority tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-market-state.test.js .test-build/tests/wildz-market-repository.test.js
```

Expected: reducers preserve signed card data; unproved and absent conditional rails return `market_capability_unavailable`; a valid remote proof admits exactly one revision.

- [ ] **Step 6: Commit**

```bash
git add src/features/market/wildz-market.ts src/lib/receiz/wildz-market-state.ts src/lib/receiz/wildz-market-repository.ts tests/wildz-market-state.test.ts tests/wildz-market-repository.test.ts
git commit -m "feat: require proven Wildz market appends"
```

---

### Task 6: Admit Card Vault Listings, Trades, and Cancellations

**Files:**
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/market/wildz-market.ts`
- Modify: `src/lib/receiz/wildz-market-adapter.ts`
- Modify: `app/api/market/listings/route.ts`
- Modify: `app/api/market/trades/route.ts`
- Modify: `app/api/market/offers/route.ts`
- Modify: `tests/wildz-market.test.ts`
- Modify: `tests/wildz-market-routes.test.ts`

**Interfaces:**
- Consumes: complete `PortableCardAsset`, `WildzCookieActor`, a durable `WildzPublicProjectionRepository` card match, `WildzMarketRepository`, expected revision, and expected append anchor.
- Produces: `AdmitWildzListingInput`, `AdmitWildzTradeInput`, `CancelWildzListingInput`, `createWildzListing(state, input, actor, { occurredAt })`, `admitWildzListing(repository, input, actor, { occurredAt })`, `admitWildzTrade(repository, input, actor, { occurredAt })`, and `cancelWildzListing(repository, input, actor, { occurredAt })`.

- [ ] **Step 1: Write failing Card Vault and route-authority tests**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { createWildzListing } from "../src/features/market/wildz-market";
import { emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";

test("listing creation requires a verified full card owned by the actor", () => {
  const asset = initialPlayState.inventory[0];
  assert.ok(asset);
  assert.throws(() => createWildzListing(emptyWildzMarketState(), {
    asset,
    priceCents: 500,
    idempotencyKey: "list:one"
  }, { actorId: "not-the-owner", profileHandle: "@not-the-owner", receizUserId: "usr_moss", accessToken: "cookie" }, {
    occurredAt: "2026-07-15T12:00:00.000Z"
  }), /market_ownership_required/);
});

test("listing entry exists only in Card Vault and routes trust only cookie actor", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  assert.match(inventory, /onListAsset\(selected,/);
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.doesNotMatch(campaign, /onListAsset\(.*(?:rewardAsset|activeCard|nearbyCards)/);
  for (const route of ["listings", "trades", "offers"]) {
    const source = readFileSync(`app/api/market/${route}/route.ts`, "utf8");
    assert.match(source, /resolveWildzCookieActor/);
    assert.doesNotMatch(source, /body\.actor|body\.seller|body\.buyer|body\.owner|body\.accessToken|session\.accessToken/);
  }
  const listingRoute = readFileSync("app/api/market/listings/route.ts", "utf8");
  assert.match(listingRoute, /WildzPublicProjectionRepository|createReceizWildzPublicRepository/);
  assert.match(listingRoute, /wildz_market_public_card_required/);
});
```

- [ ] **Step 2: Run the focused tests and verify the old body/process-map paths fail**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-market.test.js .test-build/tests/wildz-market-routes.test.js
```

Expected: current routes fail source assertions and the market adapter still uses module-level maps.

- [ ] **Step 3: Implement verified event creation and repository coordination**

```ts
export type AdmitWildzListingInput = {
  asset: PortableCardAsset;
  priceCents: number;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
  idempotencyKey: string;
};

export type AdmitWildzTradeInput = {
  listingId: string;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
  idempotencyKey: string;
};

export type CancelWildzListingInput = {
  listingId: string;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
  idempotencyKey: string;
};
```

`createWildzListing(state, input, actor, { occurredAt })`, where `input` is `Pick<AdmitWildzListingInput, "asset" | "priceCents" | "idempotencyKey">`, verifies `verifyAnyWildsCard(input.asset).ok`, requires an integer price from 50 through 100,000,000 cents, obtains current owner through `currentWildzOwner`, requires it to equal `actor.actorId`, stores `actor.receizUserId` as `sellerReceizUserId`, and computes the deterministic listing ID from asset ID, proof digest, seller, and idempotency key. Never rewrite `input.asset.manifest.ownerReceizId`. `admitWildzListing` loads the repository, checks both expected head fields, creates a `listing-admitted` event, and calls `compareAndAppend` with the same head and explicit time.

`admitWildzTrade` loads the admitted active listing, derives `buyerActorId` from the cookie actor, rejects self-trade, copies `priceCents` and `currency` from the listing, and appends `trade-admitted`. `cancelWildzListing` requires the listing seller to equal the cookie actor and appends `listing-cancelled`. All three return the repository admission union unchanged so `market_capability_unavailable` and conflicts remain truthful.

- [ ] **Step 4: Restrict route inputs and wire Card Vault**

`POST /api/market/listings` accepts exactly `asset`, `priceCents`, `expectedRevision`, and `expectedAppendAnchorId`; idempotency comes from the header. Before market admission, load `WildzPublicProjectionRepository` and require `publicState.cards[asset.id]` to exist with the same proof digest, otherwise return `wildz_market_public_card_required`. `DELETE` accepts `listingId` and the two expected-head fields. `POST /api/market/trades` and `/offers` accept a listing ID plus expected-head fields, never a listing object or price. Each route resolves `WildzCookieActor` before constructing either repository, obtains one server `occurredAt = new Date().toISOString()`, and never accepts event time from JSON. Update the Card Vault listing action to register the selected card successfully, then pass that exact verified `PortableCardAsset` and the latest market head; no other game surface gets a listing callback.

```ts
export type WildzMarketHead = {
  revision: number;
  appendAnchorId: string | null;
};

export type ListSelectedWildzAsset = (
  asset: PortableCardAsset,
  priceCents: number,
  head: WildzMarketHead
) => Promise<WildzMarketAdmission>;
```

- [ ] **Step 5: Run domain, route, and type tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-market.test.js .test-build/tests/wildz-market-routes.test.js
pnpm typecheck
```

Expected: listing/trade/cancellation tests pass; source has no module-level market maps, client actor fields, client price in trade routes, or listing entry outside Card Vault.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/WildsInventory.tsx src/features/play/PlayCampaign.tsx src/features/market/wildz-market.ts src/lib/receiz/wildz-market-adapter.ts app/api/market/listings/route.ts app/api/market/trades/route.ts app/api/market/offers/route.ts tests/wildz-market.test.ts tests/wildz-market-routes.test.ts
git commit -m "feat: admit authenticated Wildz market events"
```

---

### Task 7: Settle With Connect Transfer and Recover Ownership Append

**Files:**
- Modify: `app/api/market/checkout/route.ts`
- Create: `app/api/market/settlement/route.ts`
- Modify: `src/features/market/wildz-market.ts`
- Modify: `src/lib/receiz/wildz-market-adapter.ts`
- Create: `tests/wildz-settlement.test.ts`
- Create: `tests/wildz-checkout-authority.test.ts`

**Interfaces:**
- Consumes: admitted trade/listing, `WildzCookieActor`, `ReceizCommerceAdapter.connectTransfer`, `ReceizCommerceAdapter.walletLedger`, SDK `isReceizProofBundle`, current market head, and `WildzMarketRepository.compareAndAppend`.
- Produces: `isAdmittedConnectTransfer(value)`, `PurchaseWildzTradeInput`, `WildzPurchaseResult`, `purchaseAdmittedWildzTrade(repository, receiz, input, actor, { occurredAt })`, and idempotent `settled` or `recovery_pending` results.

- [ ] **Step 1: Write failing transfer-proof and recovery tests**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isAdmittedConnectTransfer } from "../src/lib/receiz/wildz-market-adapter";

const transferProof = {
  kind: "receiz.proof_bundle",
  payloadVersion: "v2",
  createdAtMs: 1781524800000,
  ts: "2026-07-15T12:00:00.000Z",
  code: "WILDZ-TRANSFER",
  slug: "wildz-transfer",
  verifyPath: "/v/wildz-transfer/WILDZ-TRANSFER/1",
  verifyUrl: "https://receiz.com/v/wildz-transfer/WILDZ-TRANSFER/1",
  kaiPulseEternal: "1",
  kaiKlok: "kai:1",
  receizClaimId: "a".repeat(32),
  sigilClaimSeed: "b".repeat(64)
} as const;

test("Connect settlement requires every Receiz proof field", () => {
  assert.equal(isAdmittedConnectTransfer({ ok: true, transferId: "tr_1", ledgerEventId: "ledger_1" }), false);
  assert.equal(isAdmittedConnectTransfer({ ok: true, transferId: "tr_1", ledgerEventId: "ledger_1", proofBundle: {} }), false);
  assert.equal(isAdmittedConnectTransfer({
    ok: true,
    transferId: "tr_1",
    ledgerEventId: "ledger_1",
    proofBundle: transferProof
  }), true);
});

test("checkout route derives recipient and amount from the admitted listing", () => {
  const source = readFileSync("app/api/market/checkout/route.ts", "utf8");
  assert.match(source, /resolveWildzCookieActor/);
  assert.match(source, /purchaseAdmittedWildzTrade/);
  assert.doesNotMatch(source, /body\.buyer|body\.seller|body\.recipientUserId|body\.amount|body\.price|body\.accessToken/);
  assert.doesNotMatch(source, /oneClickCheckout|checkoutSession/);
});
```

Add the following integration test in `tests/wildz-settlement.test.ts`. It constructs a verified asset from `initialPlayState.inventory[0]`, builds exact typed listing/trade records, and supplies inline repository and adapter objects. The first `compareAndAppend` call returns `{ status: "market_capability_unavailable" }`; the second computes and returns an admitted next state. Call `purchaseAdmittedWildzTrade` twice with the same trade and assert the first result is `recovery_pending`, the second is `settled`, both `connectTransfer` calls receive the same `wildz-transfer:<tradeId>` idempotency key, and the signed card manifest owner remains unchanged while `state.ownership[asset.id].ownerReceizId` becomes the buyer.

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import type { WildzListing, WildzTradePlan } from "../src/features/market/wildz-market";
import { purchaseAdmittedWildzTrade } from "../src/lib/receiz/wildz-market-adapter";
import type { WildzMarketRepository } from "../src/lib/receiz/wildz-market-repository";
import { advanceWildzMarketState, emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";

test("a proven transfer retries ownership append without a second idempotency key", async () => {
  const asset = initialPlayState.inventory[0]!;
  const sellerActorId = asset.manifest.ownerReceizId.replace(/^@+/, "").toLowerCase();
  const listing: WildzListing = {
    schema: "wildz.listing.v2",
    id: "listing:proof-test",
    asset,
    assetId: asset.id,
    proofDigest: asset.proof.digest,
    sellerActorId,
    sellerReceizUserId: "usr_seller",
    priceCents: 500,
    currency: "USD",
    status: "active",
    idempotencyKey: "listing:proof-test",
    createdAt: "2026-07-15T12:00:00.000Z"
  };
  const trade: WildzTradePlan = {
    schema: "wildz.trade_plan.v2",
    id: "trade:proof-test",
    listingId: listing.id,
    assetId: asset.id,
    sellerActorId,
    buyerActorId: "buyer",
    priceCents: 500,
    currency: "USD",
    idempotencyKey: "trade:proof-test",
    createdAt: "2026-07-15T12:00:01.000Z"
  };
  let state = advanceWildzMarketState(emptyWildzMarketState(), { type: "listing-admitted", listing }, { occurredAt: listing.createdAt });
  state = { ...state, appendAnchorId: "anchor:1" };
  state = advanceWildzMarketState(state, { type: "trade-admitted", trade }, { occurredAt: trade.createdAt });
  state = { ...state, appendAnchorId: "anchor:2" };
  let appendAttempts = 0;
  const repository: WildzMarketRepository = {
    load: async () => ({
      status: "ready",
      state,
      admissionProof: {
        schema: "receiz.wildz_market_admission.v1",
        admittedRevision: state.revision,
        previousAppendAnchorId: "anchor:1",
        appendAnchorId: "anchor:2",
        proofBundle: { schema: "receiz.append.proof.v1" }
      }
    }),
    compareAndAppend: async (input) => {
      appendAttempts += 1;
      if (appendAttempts === 1) return { status: "market_capability_unavailable" };
      const reduced = advanceWildzMarketState(input.current, input.event, { occurredAt: input.occurredAt });
      state = { ...reduced, appendAnchorId: "anchor:3" };
      return {
        status: "admitted",
        state,
        admissionProof: {
          schema: "receiz.wildz_market_admission.v1",
          admittedRevision: 3,
          previousAppendAnchorId: "anchor:2",
          appendAnchorId: "anchor:3",
          proofBundle: { schema: "receiz.append.proof.v1" }
        }
      };
    }
  };
  const transferKeys: string[] = [];
  const transferProof = {
    kind: "receiz.proof_bundle",
    payloadVersion: "v2",
    createdAtMs: 1781524800000,
    ts: "2026-07-15T12:00:00.000Z",
    code: "WILDZ-TRANSFER",
    slug: "wildz-transfer",
    verifyPath: "/v/wildz-transfer/WILDZ-TRANSFER/1",
    verifyUrl: "https://receiz.com/v/wildz-transfer/WILDZ-TRANSFER/1",
    kaiPulseEternal: "1",
    kaiKlok: "kai:1",
    receizClaimId: "a".repeat(32),
    sigilClaimSeed: "b".repeat(64)
  } as const;
  const receiz = {
    connectTransfer: async (_body: unknown, idempotencyKey?: string) => {
      transferKeys.push(idempotencyKey ?? "");
      return {
        ok: true,
        transferId: "tr_1",
        ledgerEventId: "ledger_1",
        proofBundle: transferProof
      };
    },
    walletLedger: async () => ({
      ok: true,
      cursor: null,
      since: null,
      nextCursor: null,
      events: [{
        id: "ledger_1",
        kind: "transfer",
        createdAt: "2026-07-15T12:00:02.000Z",
        amountUsdCents: "500",
        proofBundle: transferProof
      }]
    })
  };
  const input = { tradeId: trade.id, expectedRevision: 2, expectedAppendAnchorId: "anchor:2" };
  const actor = { actorId: "buyer", profileHandle: "@buyer", receizUserId: "usr_buyer", accessToken: "cookie" };
  const first = await purchaseAdmittedWildzTrade(repository, receiz as never, input, actor, { occurredAt: "2026-07-15T12:00:02.000Z" });
  const second = await purchaseAdmittedWildzTrade(repository, receiz as never, input, actor, { occurredAt: "2026-07-15T12:00:02.000Z" });
  const third = await purchaseAdmittedWildzTrade(repository, receiz as never, input, actor, { occurredAt: "2026-07-15T12:00:02.000Z" });
  assert.equal(first.status, "recovery_pending");
  assert.equal(second.status, "settled");
  assert.equal(third.status, "settled");
  assert.deepEqual(transferKeys, [`wildz-transfer:${trade.id}`, `wildz-transfer:${trade.id}`]);
  assert.equal(asset.manifest.ownerReceizId, sellerActorId);
  assert.equal(state.ownership[asset.id]?.ownerReceizId, "buyer");
});
```

- [ ] **Step 2: Run tests and verify the existing checkout seam fails**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-settlement.test.js .test-build/tests/wildz-checkout-authority.test.js
```

Expected: the proof guard and coordinator are missing, and checkout currently trusts body listing/buyer data.

- [ ] **Step 3: Implement strict Connect proof admission**

```ts
import { isReceizProofBundle } from "@receiz/sdk";
import { canonicalPortableCardJson } from "../../features/play/portable-card";

export function isAdmittedConnectTransfer(value: unknown): value is ConnectTransferResponse & {
  ok: true;
  transferId: string;
  ledgerEventId: string;
  proofBundle: JsonObject;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const transfer = value as ConnectTransferResponse;
  return transfer.ok === true
    && typeof transfer.transferId === "string"
    && transfer.transferId.length > 0
    && typeof transfer.ledgerEventId === "string"
    && transfer.ledgerEventId.length > 0
    && isReceizProofBundle(transfer.proofBundle);
}

export type PurchaseWildzTradeInput = {
  tradeId: string;
  expectedRevision: number;
  expectedAppendAnchorId: string | null;
};

export type WildzPurchaseResult =
  | { status: "settled"; receipt: WildzMarketReceipt; ownership: WildzOwnershipReceipt; admissionProof: WildzMarketAdmissionProof }
  | { status: "recovery_pending"; tradeId: string; transferId: string; ownershipTransferred: false }
  | { status: "payment_failed"; tradeId: string; ownershipTransferred: false }
  | { status: "market_capability_unavailable"; ownershipTransferred: false }
  | { status: "market_revision_conflict"; currentRevision: number; currentAppendAnchorId: string | null; ownershipTransferred: false };
```

`purchaseAdmittedWildzTrade` loads the market head and first returns the already admitted settled receipt when the trade/transfer is present, even if the caller supplied its pre-settlement head; that replay path does not call Connect again. Otherwise it requires the loaded head to match the request before payment, resolves the admitted trade and listing, and requires `trade.buyerActorId === actor.actorId`. Call:

```ts
const transferIdempotencyKey = `wildz-transfer:${trade.id}`;
const transfer = await receiz.connectTransfer({
  recipientUserId: listing.sellerReceizUserId,
  unit: "usd",
  amountUsd: (listing.priceCents / 100).toFixed(2),
  note: `Wildz card ${listing.assetId}`,
  clientNonce: transferIdempotencyKey
}, transferIdempotencyKey);
```

Reject any response that fails `isAdmittedConnectTransfer` and do not append ownership. For a valid response, refresh `receiz.walletLedger({ limit: 100 })` as required by the SDK transfer contract. Require one event whose `id` equals `transfer.ledgerEventId`, whose `kind` is `transfer`, whose `amountUsdCents` equals `String(listing.priceCents)`, whose proof passes `isReceizProofBundle`, and whose canonical proof JSON equals the response proof. If that ledger addition is not yet visible or any field differs, return `recovery_pending` and append no ownership; a retry uses the same transfer idempotency key and reads the ledger again.

After ledger corroboration, build a separate `WildzOwnershipReceipt` using the card digest, current projected owner, cookie buyer, `transferId`, `ledgerEventId`, the ledger-observed `proofBundle`, and explicit `occurredAt`; append `settlement-admitted` against the loaded head. Return `settled` only for `admitted` or `replayed`. If the conditional append is unavailable or conflicts after the proven transfer, return `recovery_pending` with the trade and transfer IDs, keep `ownershipTransferred: false`, and retain the stable transfer idempotency key for retry. Never call `connectTransfer` with a different key for that trade.

- [ ] **Step 4: Wire checkout and recovery routes**

`POST /api/market/checkout` and `POST /api/market/settlement` accept only `tradeId`, `expectedRevision`, and `expectedAppendAnchorId`, resolve the buyer with `resolveWildzCookieActor`, construct the Receiz adapter with `actor.accessToken`, obtain `occurredAt` at the server boundary, and call the same coordinator. Checkout performs the first Connect transfer attempt; settlement is the recovery endpoint and is safe to repeat. Remove `oneClickCheckout` from this ownership path because a checkout-session response is not a transfer proof. Map results exactly: `settled` to 200, `recovery_pending` to 202, `market_revision_conflict` to 409, `market_capability_unavailable` before payment to 503, and authority errors to 401/403. A Connect response without all required transfer proof fields never returns settled ownership.

- [ ] **Step 5: Run settlement, authority, and type tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-settlement.test.js .test-build/tests/wildz-checkout-authority.test.js .test-build/tests/wildz-market.test.js .test-build/tests/wildz-market-routes.test.js
pnpm typecheck
```

Expected: full proof settles once; missing proof does not settle; append failure returns `recovery_pending`; retry reuses one transfer idempotency key and admits one ownership receipt; manifest owner remains unchanged.

- [ ] **Step 6: Commit**

```bash
git add app/api/market/checkout/route.ts app/api/market/settlement/route.ts src/features/market/wildz-market.ts src/lib/receiz/wildz-market-adapter.ts tests/wildz-settlement.test.ts tests/wildz-checkout-authority.test.ts
git commit -m "feat: settle Wildz ownership with Receiz proof"
```

---

### Task 8: Render Truthful Embedded Market and Public Recovery States

**Files:**
- Modify: `src/features/market/WildzMarketSheet.tsx`
- Modify: `src/features/market/WildzTradeConfirm.tsx`
- Modify: `src/features/profile/WildzProfileSheet.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/lib/receiz/wildz-public-state.ts`
- Modify: `app/api/profiles/[handle]/route.ts`
- Modify: `app/api/cards/[assetId]/route.ts`
- Modify: `tests/wildz-market-presentation.test.ts`
- Modify: `tests/wildz-public-state.test.ts`
- Modify: `tests/wildz-profile-route.test.ts`
- Modify: `tests/wildz-public-card-session.test.ts`
- Create: `tests/wildz-public-recovery.test.ts`

**Interfaces:**
- Consumes: public profile/card/listing DTOs and `pending_payment`, `settled`, `payment_failed`, `market_capability_unavailable`, and `recovery_pending` receipts.
- Produces: an embedded market UI that exposes only admitted ownership and guides idempotent recovery.

- [ ] **Step 1: Write failing UI authority-state tests**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("market UI renders every authority state without a market route", () => {
  const source = readFileSync("src/features/market/WildzMarketSheet.tsx", "utf8");
  for (const state of ["pending_payment", "settled", "payment_failed", "market_capability_unavailable", "recovery_pending"]) {
    assert.match(source, new RegExp(state));
  }
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
  assert.match(source, /Payment received — securing ownership/);
  assert.match(source, /\/api\/market\/settlement/);
});

test("public card page never fabricates second-device recovery", () => {
  const source = readFileSync("src/features/play/WildsCardPage.tsx", "utf8");
  assert.doesNotMatch(source, /initialPlayState|restorePlayState|localStorage|receiz:wilds:save:v2/);
  assert.match(source, /Verified public card unavailable/);
});
```

Extend `tests/wildz-profile-route.test.ts` with a transferred-card admission case: seed a verified public card whose immutable manifest names the seller, seed one admitted `WildzOwnershipReceipt` naming the buyer, POST the card from the buyer's cookie-authenticated profile and expect 200, then POST it from the prior seller and expect 403 with `wildz_public_profile_card_not_owned`. Extend `tests/wildz-public-card-session.test.ts` with the same buyer-success/prior-seller-rejection contract for `POST /api/cards/[assetId]`. In `tests/wildz-public-state.test.ts`, prove a publish-card reduction accepts an explicitly admitted current owner, rejects a mismatched actor, and preserves the original manifest owner byte-for-byte. Add an unconfigured-market case that admits the signed manifest owner because no transfer rail exists, and a configured-but-unprovable market case that rejects both routes with `market_capability_unavailable`.

Add this cross-instance recovery test to `tests/wildz-public-recovery.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizePublicWildzProfile } from "../src/features/profile/public-profile";
import { initialPlayState } from "../src/features/play/game-state";
import { advanceWildzPublicState, emptyWildzPublicState } from "../src/lib/receiz/wildz-public-state";
import { createReceizWildzPublicRepository } from "../src/lib/receiz/wildz-public-repository";

test("a fresh repository resolves the published profile and verified card", async () => {
  const card = initialPlayState.inventory[0]!;
  let durableState = emptyWildzPublicState();
  let durableHead = { appendAnchorId: "anchor:0", afterKaiUpulse: "pulse:0" };
  const adapter = {
    restoreLatestPublicStore: async () => ({ state: durableState, knownHead: durableHead }),
    publishPublicStore: async (input: { state: typeof durableState }) => {
      durableState = input.state;
      durableHead = { appendAnchorId: `anchor:${durableState.revision}`, afterKaiUpulse: `pulse:${durableState.revision}` };
      return { ok: true, knownHead: durableHead };
    }
  };
  const profileRepository = createReceizWildzPublicRepository({ adapter: adapter as never });
  const profileLoad = await profileRepository.load();
  const profile = sanitizePublicWildzProfile({ username: "@fern", displayName: "Fern", vault: [] });
  const withProfile = advanceWildzPublicState(profileLoad.state, {
    type: "publish-profile",
    actorHandle: "@fern",
    expectedRevision: 0,
    profile
  }, { occurredAt: "2026-07-15T12:00:00.000Z" });
  await profileRepository.publish(withProfile, { expectedHead: profileLoad.head, idempotencyKey: "profile:@fern:1" });
  const cardRepository = createReceizWildzPublicRepository({ adapter: adapter as never });
  const cardLoad = await cardRepository.load();
  const withCard = advanceWildzPublicState(cardLoad.state, {
    type: "publish-card",
    actorId: card.manifest.ownerReceizId.replace(/^@+/, "").toLowerCase(),
    expectedRevision: 1,
    card
  }, { occurredAt: "2026-07-15T12:00:01.000Z" });
  await cardRepository.publish(withCard, { expectedHead: cardLoad.head, idempotencyKey: `card:${card.id}:${card.proof.digest}` });
  const freshRepository = createReceizWildzPublicRepository({ adapter: adapter as never });
  const recovered = await freshRepository.load();
  assert.equal(recovered.state.profiles["@fern"]?.displayName, "Fern");
  assert.equal(recovered.state.cards[card.id]?.proof.digest, card.proof.digest);
});
```

- [ ] **Step 2: Run presentation tests and verify missing states**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-market-presentation.test.js .test-build/tests/wildz-public-recovery.test.js
```

Expected: failures for missing capability/recovery state handling and cross-instance public recovery.

- [ ] **Step 3: Implement the explicit market UI state machine**

```ts
type MarketUiState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "pending_payment"; tradeId: string }
  | { kind: "settled"; tradeId: string; ownerReceizId: string }
  | { kind: "payment_failed"; message: string }
  | { kind: "market_capability_unavailable"; message: string }
  | { kind: "recovery_pending"; tradeId: string; transferId: string };
```

Render settled ownership only when the market read projection contains the admitted `WildzOwnershipReceipt`; never infer it from a checkout URL, Connect `ok` alone, or local card state. In `WildzProfileSheet`, resolve each verified public card with `currentWildzOwner`: use the immutable signed owner only when no ownership receipt exists, and use the receipt owner after transfer without rewriting the asset manifest. Extend the `advanceWildzPublicState` context to `{ occurredAt, admittedCardOwnerId?: string }`; for `publish-card`, default the context owner to the immutable signed owner, require `command.actorId === admittedCardOwnerId`, and never persist that context field or rewrite the card. Update both `POST /api/profiles/[handle]` and `POST /api/cards/[assetId]` to resolve the conditional rail once from the authenticated adapter. When the deployment exposes no conditional rail, pass `emptyWildzMarketState()` to `currentWildzOwner` because that deployment cannot admit a transfer; when a rail exists, load its admitted projection and reject any unavailable/unproved result as `market_capability_unavailable`. For every requested verified card, require `currentWildzOwner(marketState, asset) === actor.actorId`; the card POST passes that same resolved value as `admittedCardOwnerId` to the reducer, and no route accepts it from JSON. Never fall back to manifest ownership after a configured market rail fails to prove its head. While a receipt is `pending_payment` or `recovery_pending`, poll the market read boundary at two seconds with `AbortController`, stop after 60 seconds or on sheet close, and offer an explicit retry using the same trade ID. Strip `sellerReceizUserId`, access tokens, transfer proof internals, and remote admission internals from listing and receipt DTOs before rendering.

- [ ] **Step 4: Run the complete public/economy release slice**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands pass; there is no `app/market/page.tsx`, process-memory authority, client actor assertion, local public-card fallback, synchronous unproved ownership success, or market use of `publishPublicStore`.

- [ ] **Step 5: Commit**

```bash
git add src/features/market/WildzMarketSheet.tsx src/features/market/WildzTradeConfirm.tsx src/features/profile/WildzProfileSheet.tsx src/features/shell/WildzApp.tsx src/lib/receiz/wildz-public-state.ts app/api/profiles/'[handle]'/route.ts app/api/cards/'[assetId]'/route.ts tests/wildz-market-presentation.test.ts tests/wildz-public-state.test.ts tests/wildz-profile-route.test.ts tests/wildz-public-card-session.test.ts tests/wildz-public-recovery.test.ts
git commit -m "feat: expose truthful Wildz market states"
```

## Plan Completion Gate

Run from the completed public/economy tree:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
git status --short
```

Expected: every command exits 0; durable profile/card links survive a fresh repository instance; public card pages contain no local fallback; cookie-derived actors are required; an unproved conditional-append rail is unavailable; one proven Connect transfer produces one admitted ownership receipt; signed manifests remain unchanged; the worktree is clean after the final task commit.
