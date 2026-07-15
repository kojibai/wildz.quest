# Wildz Standalone PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `wildz.quest` as a standalone, installable, full-screen Wildz game with automatic Receiz identity, deterministic Kai Pulse characters, portable restoration, public player vaults, multiplayer, and an embedded social market.

**Architecture:** Begin from a curated copy of the proven MIT-licensed Wildz modules and tests in `kojibai/Receiz-commerce`, preserving game reducers and render behavior before changing product boundaries. A persistent Next.js game shell owns the 3D world while route-aware sheets provide identity, vault, card, profile, and market surfaces. A narrow Receiz adapter keeps proof, identity, ownership, public state, multiplayer, and settlement authoritative; local state is only a recoverable projection.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Three.js 0.182, React Three Fiber 9.6, Drei 10.7, `@receiz/sdk` 100, Lucide React, Node test runner, Playwright/browser QA, Web App Manifest, service worker.

## Global Constraints

- Customer-facing product name is `Wildz`; canonical domain is `wildz.quest`.
- Preserve the complete current upstream Wildz gameplay and social feature set.
- The root route is full-screen gameplay with no website header, footer, storefront, cart, merchant admin, or commerce navigation.
- There is no marketplace page; economy appears only as a compact in-game sheet or popover.
- Every first visit creates a Receiz ID automatically; there is no signup, password, email, or guest mode.
- The opening screen allows new character creation or restoration from a Receiz Identity Seal or portable Wildz Vault.
- Character genesis is deterministic from Receiz identity, admitted Kai Pulse coordinate, and a versioned generator.
- Public profiles use `wildz.quest/@username` and render as overlays over the persistent world.
- Proof objects and admitted Receiz history are authority; SDK is the runtime boundary; MCP is tooling only.
- Raw Identity Seal contents and private recovery material never enter logs, analytics, public projections, prompts, or MCP output.
- Purchases may expand collection but cannot fabricate mastery, achievements, ranked standing, or guaranteed wins.
- Offline state never invents multiplayer, listing, payment, transfer, ownership, ranked, or reward truth.
- Keep MIT license and source attribution for copied upstream code.

---

## File Structure

- `app/layout.tsx` — Wildz metadata, viewport, PWA controller, and global shell.
- `app/page.tsx` — root persistent game entry.
- `app/@[username]/page.tsx` — public-profile deep link into the same shell.
- `app/card/[assetId]/page.tsx` — card deep link into the same shell.
- `app/api/wildz/**` — same-origin world and multiplayer commands.
- `app/api/cards/**` — verified portable-card reads and artwork.
- `app/api/market/**` — focused listing, offer, trade, and settlement commands.
- `src/features/play/**` — preserved and adapted gameplay, cards, world, UI, and multiplayer.
- `src/features/shell/WildzApp.tsx` — persistent app state and overlay orchestration.
- `src/features/identity/**` — automatic identity, restoration, and deterministic genesis.
- `src/features/profile/**` — public profile and vault projection UI.
- `src/features/market/**` — embedded social market domain and UI.
- `src/features/pwa/**` — install/update controller.
- `src/lib/receiz/**` — the only direct Receiz SDK/application integration boundary.
- `src/lib/wildz/**` — product metadata, routes, overlay state, and shared standalone contracts.
- `public/brand/**` and `public/icons/**` — Wildz SVG and derived install assets.
- `ai-skills/**` — Wildz-specific gameplay, proof, market, and release doctrine.
- `tests/**` — upstream parity tests plus standalone identity, profile, market, shell, and PWA contracts.

---

### Task 1: Curate the Upstream Wildz Baseline

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `tsconfig.test.json`, `next.config.ts`, `eslint.config.mjs`
- Create: `LICENSE`, `NOTICE.md`, `.gitignore`, `.env.example`
- Create: `src/features/play/**`
- Create: `src/components/icons.tsx`, `src/components/ui.tsx`, `src/lib/utils.ts`
- Create: `src/lib/receiz/adapter.ts`, `src/lib/receiz/session.ts`, `src/lib/receiz/wilds-*.ts`
- Create: `src/types/domain.ts`
- Create: `app/api/wilds/**`, `app/api/cards/**`
- Create: `tests/wilds-*.test.ts`, `tests/play-game-state.test.ts`, and directly required test support

**Interfaces:**
- Consumes: upstream commit `fb366506e218d82ecac20c60bc74c5977627713e` from `kojibai/Receiz-commerce`.
- Produces: compiling Wildz game modules; preserved `PlayState`, `applyWildsInput`, `PlayCampaign`, world/multiplayer routes, portable-card contracts, and upstream parity tests.

- [ ] **Step 1: Copy the curated baseline and attribution**

Copy the upstream package/toolchain files, complete `src/features/play` directory, required shared UI/types/Receiz dependencies, Wildz/card API routes, and Wildz tests. Add `NOTICE.md` with:

```md
# Source notice

Wildz includes code derived from kojibai/Receiz-commerce at commit
fb366506e218d82ecac20c60bc74c5977627713e, used under the MIT License.
The standalone Wildz branding and product composition are maintained in this repository.
```

- [ ] **Step 2: Add a baseline import-boundary test**

Create `tests/standalone-boundary.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

test("standalone source does not import storefront or merchant features", () => {
  const roots = ["app", "src"];
  const files = roots.flatMap((root) => fs.readdirSync(root, { recursive: true })
    .map(String)
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .map((file) => path.join(root, file)));
  const forbidden = files.filter((file) => /@\/features\/(storefront|admin)|@\/lib\/storefront/.test(fs.readFileSync(file, "utf8")));
  assert.deepEqual(forbidden, []);
});
```

- [ ] **Step 3: Run the focused baseline tests**

Run: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test -- --test-name-pattern='Wilds|standalone'`  
Expected: dependencies install; any failures identify missing curated imports rather than game-rule changes.

- [ ] **Step 4: Complete only the missing dependency closure**

Copy or extract each missing non-commerce dependency reported by TypeScript. Do not copy storefront, admin, cart, builder, hosting, or merchant features. Replace domain-wide imports with focused Wildz types when only a small contract is needed.

- [ ] **Step 5: Verify the preserved baseline**

Run: `pnpm typecheck && pnpm test`  
Expected: all curated game and standalone-boundary tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json tsconfig.test.json next.config.ts eslint.config.mjs LICENSE NOTICE.md .gitignore .env.example app src tests
git commit -m "feat: extract standalone Wildz game kernel"
```

### Task 2: Create the Full-Screen Wildz Shell and Brand

**Files:**
- Create: `src/lib/wildz/product.ts`
- Create: `src/features/shell/WildzApp.tsx`
- Create: `src/features/shell/wildz-overlay.ts`
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `public/brand/wildz-mark.svg`, `public/brand/wildz-wordmark.svg`
- Test: `tests/wildz-shell.test.ts`, `tests/wildz-brand.test.ts`

**Interfaces:**
- Consumes: `PlayCampaign` and preserved game callbacks from Task 1.
- Produces: `WildzApp({ initialOverlay? })`, `WildzOverlay`, `WILDZ_PRODUCT`, and canonical brand SVG assets.

- [ ] **Step 1: Write failing shell and brand tests**

```ts
test("root page renders the persistent Wildz app", () => {
  const source = read("app/page.tsx");
  assert.match(source, /<WildzApp/);
  assert.doesNotMatch(source, /PublicStorefront|Header|Footer/);
});

test("metadata and SVG assets use only Wildz product identity", () => {
  assert.match(read("app/layout.tsx"), /Wildz/);
  assert.doesNotMatch(read("app/layout.tsx"), /Receiz\.app|ecommerce/i);
  assert.match(read("public/brand/wildz-mark.svg"), /<svg/);
  assert.match(read("public/brand/wildz-wordmark.svg"), /WILDZ/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --test-name-pattern='shell|brand'`  
Expected: FAIL because shell and brand files do not exist.

- [ ] **Step 3: Implement product metadata and overlay contract**

```ts
export const WILDZ_PRODUCT = {
  name: "Wildz",
  domain: "wildz.quest",
  description: "Explore, collect, compete, and trade in one living world.",
  themeColor: "#09110d",
  backgroundColor: "#09110d"
} as const;

export type WildzOverlay =
  | { kind: "profile"; username: string }
  | { kind: "card"; assetId: string }
  | { kind: "vault" }
  | { kind: "market" }
  | { kind: "map" }
  | { kind: "settings" }
  | null;
```

- [ ] **Step 4: Implement `WildzApp` and the root layout**

Render one persistent `.wildz-app` with `PlayCampaign enabled`, a compact brand/loading layer, and overlay state owned above the game. Set metadata, viewport fit, standalone PWA tags, `100dvh`, safe-area variables, overflow prevention, and canvas isolation in `app/globals.css`.

- [ ] **Step 5: Create the original SVG mark and wordmark**

Build a viewBox-native W-shaped terrain/rift symbol with a centered seed/star and a separate rounded `WILDZ` wordmark. Use paths and gradients only; do not embed raster data, external fonts, scripts, or remote references.

- [ ] **Step 6: Verify shell tests and production rendering**

Run: `pnpm test -- --test-name-pattern='shell|brand' && pnpm typecheck && pnpm build`  
Expected: PASS; root route builds as a full-screen Wildz surface.

- [ ] **Step 7: Commit**

```bash
git add app src/features/shell src/lib/wildz public/brand tests/wildz-shell.test.ts tests/wildz-brand.test.ts
git commit -m "feat: add full-screen Wildz shell and brand"
```

### Task 3: Add Automatic Receiz Identity, Restore, and Kai Pulse Genesis

**Files:**
- Create: `src/features/identity/wildz-identity.ts`
- Create: `src/features/identity/wildz-genesis.ts`
- Create: `src/features/identity/WildzGenesis.tsx`
- Create: `src/features/identity/WildzRestore.tsx`
- Create: `src/lib/receiz/wildz-identity-adapter.ts`
- Modify: `src/features/shell/WildzApp.tsx`
- Test: `tests/wildz-identity.test.ts`, `tests/wildz-genesis.test.ts`, `tests/wildz-restore.test.ts`

**Interfaces:**
- Consumes: official Receiz identity artifact helpers and SDK client behind `wildz-identity-adapter.ts`.
- Produces: `ensureWildzIdentity()`, `inspectWildzRestore(file)`, `adoptWildzRestore(plan)`, `generateWildzCharacter(input)`, `WildzCharacterGenesis`, and `WildzIdentityState`.

- [ ] **Step 1: Write failing deterministic-genesis tests**

```ts
const input = { identityRef: "receiz:test", kaiPulse: "kai:100:7", gender: "female" as const, version: 1 };
const first = generateWildzCharacter(input);
const second = generateWildzCharacter(input);
assert.deepEqual(first, second);
assert.notDeepEqual(first, generateWildzCharacter({ ...input, kaiPulse: "kai:100:8" }));
assert.equal(first.digest.length, 64);
```

- [ ] **Step 2: Write failing identity and restore safety tests**

Test that first load creates one identity, repeated load restores it, invalid imports do not mutate active identity, Seal inspection never returns raw secret bytes, Vault restore does not grant identity authority, and ownership-sensitive features remain locked until reconciliation.

- [ ] **Step 3: Run tests to verify failure**

Run: `pnpm test -- --test-name-pattern='identity|genesis|restore'`  
Expected: FAIL because contracts are not implemented.

- [ ] **Step 4: Implement the versioned pure character generator**

Use SHA-256 over a canonical string of version, identity reference, Kai Pulse, and gender. Map deterministic digest segments into authored arrays for hair, complexion, outfit, primary/secondary colors, accessory, trail, and signature mark. Return the canonical traits and SHA-256 digest of their canonical JSON.

- [ ] **Step 5: Implement the SDK identity adapter**

Wrap official `createReceizIdIdentity`, identity artifact read/verify/sign primitives, and supported app-state resolution. Keep private artifacts in the SDK-supported local storage boundary. Return only public identity references and explicit capability state to React.

- [ ] **Step 6: Implement the opening ceremony**

`WildzGenesis` automatically ensures a Receiz ID, then presents `Create my explorer` and `Restore my Wildz`. Create asks for gender before requesting the admitted Kai Pulse and revealing the deterministic character. Restore accepts an Identity Seal or Vault and displays a reconciliation preview before adoption.

- [ ] **Step 7: Verify identity flows**

Run: `pnpm test -- --test-name-pattern='identity|genesis|restore' && pnpm typecheck`  
Expected: PASS; secret-scanning assertions find no raw artifact logging.

- [ ] **Step 8: Commit**

```bash
git add src/features/identity src/lib/receiz/wildz-identity-adapter.ts src/features/shell/WildzApp.tsx tests/wildz-identity.test.ts tests/wildz-genesis.test.ts tests/wildz-restore.test.ts
git commit -m "feat: add automatic identity and deterministic explorers"
```

### Task 4: Add Shareable Public Profiles and Vault Overlays

**Files:**
- Create: `src/features/profile/public-profile.ts`
- Create: `src/features/profile/WildzProfileSheet.tsx`
- Create: `src/features/profile/WildzVaultSheet.tsx`
- Create: `src/lib/receiz/wildz-profile-adapter.ts`
- Create: `app/@[username]/page.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Test: `tests/wildz-profile.test.ts`, `tests/wildz-profile-route.test.ts`

**Interfaces:**
- Consumes: verified identity, portable-card, progression, team/league, and listing projections.
- Produces: `resolvePublicWildzProfile(username)`, `publishPublicWildzProfile(input)`, `sanitizePublicWildzProfile(input)`, `WildzProfileSheet`, and `WildzVaultSheet`.

- [ ] **Step 1: Write failing privacy and route tests**

```ts
const publicProfile = sanitizePublicWildzProfile(privateFixture);
assert.equal("identitySeal" in publicProfile, false);
assert.equal("privateKey" in publicProfile, false);
assert.deepEqual(publicProfile.vault.map((card) => card.id), ["public-card"]);
assert.match(read("app/@[username]/page.tsx"), /initialOverlay=.*profile/);
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --test-name-pattern='profile'`  
Expected: FAIL because profile contracts and route do not exist.

- [ ] **Step 3: Implement the public projection and adapter**

Define a versioned profile containing username, public explorer traits, active companion, public vault cards, achievements, discoveries, records, team/league, reputation, listings, and bounded public activity. Sanitize before publication and resolve by canonical username through Receiz app-state/public proof rails.

- [ ] **Step 4: Implement profile and Vault sheets**

Render identity, explorer, active companion, verified proof indicators, collection, lineage, achievements, competitive record, trade availability, and privacy-aware empty/error states. Opening a card reuses the card overlay; closing restores the underlying game state and focus.

- [ ] **Step 5: Implement the shareable route**

The username route renders `WildzApp` with `{ kind: "profile", username }` and canonical metadata while preserving the same game shell and overlay dismissal behavior.

- [ ] **Step 6: Verify**

Run: `pnpm test -- --test-name-pattern='profile' && pnpm typecheck && pnpm build`  
Expected: PASS; private fields never appear in serialized public fixtures.

- [ ] **Step 7: Commit**

```bash
git add app/@\[username\] src/features/profile src/lib/receiz/wildz-profile-adapter.ts src/features/shell/WildzApp.tsx tests/wildz-profile.test.ts tests/wildz-profile-route.test.ts
git commit -m "feat: add public Wildz profiles and vaults"
```

### Task 5: Add the Embedded Social Market

**Files:**
- Create: `src/features/market/wildz-market.ts`
- Create: `src/features/market/WildzMarketSheet.tsx`
- Create: `src/features/market/WildzTradeConfirm.tsx`
- Create: `src/lib/receiz/wildz-market-adapter.ts`
- Create: `app/api/market/listings/route.ts`, `app/api/market/offers/route.ts`, `app/api/market/trades/route.ts`, `app/api/market/checkout/route.ts`
- Modify: `src/features/shell/WildzApp.tsx`, `src/features/play/WildsCommandDock.tsx`
- Test: `tests/wildz-market.test.ts`, `tests/wildz-market-routes.test.ts`, `tests/wildz-market-presentation.test.ts`

**Interfaces:**
- Consumes: verified identity, ownership, portable cards, player context, Receiz transfer and settlement rails.
- Produces: listing/offer/trade command schemas, `discoverWildzListings(context)`, `planWildzTrade(input)`, `settleWildzPurchase(input)`, and compact `WildzMarketSheet`.

- [ ] **Step 1: Write failing market law tests**

Test that every mutation requires identity, expected revision, and idempotency key; sellers must own listed assets; purchases do not transfer ownership before admitted settlement; stale trades fail; duplicate commands return the original result; and market source contains no full-page navigation.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --test-name-pattern='market'`  
Expected: FAIL because market contracts do not exist.

- [ ] **Step 3: Implement pure market contracts**

Define versioned `WildzListing`, `WildzOffer`, `WildzTradePlan`, and `WildzMarketReceipt` types with explicit states. Parse bounded inputs and keep price, currency, asset proof, seller, buyer, ownership head, expiry, and idempotency data explicit.

- [ ] **Step 4: Implement the Receiz market adapter and routes**

Resolve actor identity, verify current ownership and asset proof, call the supported Receiz listing/transfer/checkout rails, and return admitted receipts. If an atomic capability is absent, return a typed `capability_unavailable` result and do not simulate settlement.

- [ ] **Step 5: Implement the compact market sheet**

Add one small command-dock market icon. The mobile bottom sheet and desktop popover show nearby, teammate, opponent, event-relevant, and searched listings. Asset inspection, seller profile, listing, offer, direct trade, purchase, cancellation, confirmation, pending, success, and failure remain inside overlays over the live world.

- [ ] **Step 6: Verify market laws and UI boundary**

Run: `pnpm test -- --test-name-pattern='market' && pnpm typecheck && pnpm build`  
Expected: PASS; no `/market` page exists; failed payment fixtures never mutate ownership.

- [ ] **Step 7: Commit**

```bash
git add app/api/market src/features/market src/lib/receiz/wildz-market-adapter.ts src/features/shell/WildzApp.tsx src/features/play/WildsCommandDock.tsx tests/wildz-market*.test.ts
git commit -m "feat: embed the Wildz social market"
```

### Task 6: Complete PWA Installation and Recovery

**Files:**
- Create: `app/manifest.ts`
- Create: `public/sw.js`
- Create: `src/features/pwa/PwaController.tsx`
- Create: `scripts/render-pwa-icons.mjs`
- Create: `public/icons/icon-180.png`, `icon-192.png`, `icon-512.png`, maskable variants, and favicon assets
- Modify: `app/layout.tsx`
- Test: `tests/pwa.test.ts`, `tests/pwa-runtime.test.ts`

**Interfaces:**
- Consumes: `WILDZ_PRODUCT` and approved SVG brand assets.
- Produces: installable manifest, branded icons, bounded shell cache, update prompt, and offline startup.

- [ ] **Step 1: Write failing PWA contract tests**

Assert Wildz name/domain branding, `display: standalone`, `/` start URL, maskable icons, correct icon dimensions, service-worker registration, no caching of market/payment mutation responses, and an update prompt rather than forced reload.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --test-name-pattern='PWA|pwa'`  
Expected: FAIL because manifest, worker, and icons are incomplete.

- [ ] **Step 3: Implement manifest, icon renderer, and worker**

Render raster icons from the master SVG using the existing workspace-compatible image toolchain. Cache only versioned application-shell and safe immutable assets. Use network-first or no-store behavior for identity, world mutation, multiplayer, market, payment, card ownership, and public-state mutation APIs.

- [ ] **Step 4: Implement install/update control**

Register the worker after first interactive paint, expose install when supported, announce offline/online state, and show `Update ready` with an explicit player action. Preserve current game state before activating a waiting worker.

- [ ] **Step 5: Verify**

Run: `node scripts/render-pwa-icons.mjs && pnpm test -- --test-name-pattern='PWA|pwa' && pnpm build`  
Expected: PASS; generated icon dimensions and manifest references match.

- [ ] **Step 6: Commit**

```bash
git add app/manifest.ts app/layout.tsx public/sw.js public/icons src/features/pwa scripts/render-pwa-icons.mjs tests/pwa*.test.ts
git commit -m "feat: make Wildz an installable resilient PWA"
```

### Task 7: Add Wildz MCP and AI Operating Doctrine

**Files:**
- Create: `ai-skills/README.md`
- Create: `ai-skills/wildz-builder-skill/SKILL.md`
- Create: `ai-skills/wildz-market-operator-skill/SKILL.md`
- Create: `ai-skills/wildz-release-skill/SKILL.md`
- Create: `docs/RECEIZ_RAILS.md`, `docs/MCP.md`
- Modify: `.env.example`, `README.md`, `package.json`
- Test: `tests/wildz-ai-skills.test.ts`, `tests/sdk-version.test.ts`

**Interfaces:**
- Consumes: implemented identity, proof, profile, market, world, PWA, and release boundaries.
- Produces: repository doctrine for future agents and a pinned SDK/MCP compatibility contract.

- [ ] **Step 1: Write failing documentation-contract tests**

Assert the SDK and documented MCP major versions match, every skill states proof authority and confirmation requirements, and prohibited raw token/secret examples are absent.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- --test-name-pattern='skills|SDK|MCP'`  
Expected: FAIL because Wildz skills and docs do not exist.

- [ ] **Step 3: Write focused skills and rail documentation**

Document primitive, authority, SDK rail, MCP rail, first paint, append, no-db, confirmation, security, and verification rules for gameplay extension, character generator versioning, identity/Vault restore, public profiles, marketplace operation, and releases.

- [ ] **Step 4: Add safe diagnostics**

Add a `receiz:doctor` script that reports only capability/version/configuration presence and never secret values. Pin `@receiz/sdk@^100.0.0` and document `@receiz/mcp-server@100.0.0` as the compatible agent tool layer.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test -- --test-name-pattern='skills|SDK|MCP' && pnpm receiz:doctor`  
Expected: PASS; doctor prints capability markers without credentials.

```bash
git add ai-skills docs README.md .env.example package.json tests/wildz-ai-skills.test.ts tests/sdk-version.test.ts
git commit -m "docs: add Wildz Receiz and MCP doctrine"
```

### Task 8: Complete Feature-Parity, Mobile, and Release Verification

**Files:**
- Modify: only files implicated by failing verification
- Create: `docs/release/feature-parity.md`
- Create: `docs/release/verification.md`
- Create: browser screenshots and performance evidence under `output/verification/`
- Test: entire `tests/**` suite

**Interfaces:**
- Consumes: all preceding tasks.
- Produces: release evidence showing feature parity, gameplay correctness, responsive quality, PWA readiness, and known intentional deviations.

- [ ] **Step 1: Run the complete automated gate**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`  
Expected: all commands exit 0.

- [ ] **Step 2: Run the local production application**

Run: `pnpm start -p 3000`  
Expected: Wildz responds at `http://127.0.0.1:3000`, renders a nonblank 3D canvas, and reports no console/page errors.

- [ ] **Step 3: Verify the complete gameplay path in a real browser**

Exercise automatic identity, create and restore openings, gender choice, deterministic reveal, movement, camera, exploration, encounter, capture, card inspection, training, mission, battle, failure/restart, map, landmark, rift, multiplayer, profile, Vault, listing, offer, trade, purchase failure/success fixtures, settings, audio, and update recovery.

- [ ] **Step 4: Verify responsive and accessibility targets**

Capture and inspect screenshots at 360×640, 390×844, 412×915, 768×1024, and 1440×900. Check safe areas, thumb controls, touch targets, overlays, focus return, keyboard movement, contrast, reduced motion, rotation, and constrained quality mode.

- [ ] **Step 5: Verify PWA and performance evidence**

Check manifest/installability, offline startup, reconnection, update prompt, service-worker cache boundaries, nonblank canvas pixels, frame stability, memory, draw calls, and first playable time. Record exact measurements and device/browser versions in `docs/release/verification.md`.

- [ ] **Step 6: Complete the parity matrix**

For every upstream Wildz feature and test family, record `preserved`, `adapted`, or `intentionally removed`, the evidence path, and reason. The only accepted removals are commerce-shell behavior unrelated to the approved game, social, profile, Vault, identity, or market product.

- [ ] **Step 7: Fix every critical or high-severity gap and rerun affected gates**

No critical identity, ownership, payment, secret-handling, gameplay, mobile-control, PWA, or feature-parity defect may remain. Re-run the smallest affected test first, then the full automated gate.

- [ ] **Step 8: Final verification and commit**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`  
Expected: all commands exit 0; browser console is clean; verification documents contain no unresolved critical or high-severity gap.

```bash
git add app src public scripts tests ai-skills docs README.md package.json pnpm-lock.yaml output/verification
git commit -m "release: verify standalone Wildz PWA"
```
