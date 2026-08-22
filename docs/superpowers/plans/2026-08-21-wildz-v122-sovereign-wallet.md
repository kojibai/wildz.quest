# Wildz V123 Sovereign Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the complete in-game sovereign wallet on Receiz V123: verified Phi summary, bounded ledger, receive identity, proof-authorized Settlement/Reserve sends with exact recovery, and a native responsive terminal without touching gameplay hot paths.

**Architecture:** Server routes bind the proof session, delegated token, live Receiz profile, exact granted scopes, proof-authority grant, and value heads before projecting strict privacy-safe wallet data. Exact V123 Settlement/Reserve intents are staged before execution and recovered by idempotency key. A dedicated client controller outside Canvas owns bounded reads and stable same-session cache state; HUD and terminal consume only sanitized projections.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Receiz SDK/MCP/AI Skills 123.0.0, existing Wildz modal ownership, CSS, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-wildz-sovereign-wallet-terminal-design.md`

## Global Constraints

- Pin `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills` at exactly `123.0.0`; do not add a compatibility shim or legacy authority fallback.
- Never execute Phi Settlement/Reserve, public world publication, resource transfer, or card transfer without an SDK-custodied plan/execution rail and authoritative SDK-derived scopes.
- Wallet routes require same-account proof/cookie/profile continuity; private responses use `cache-control: no-store` and sanitized error codes.
- No token, Receiz owner/user/subject identifier, proof digest, raw receipt, command bytes, authority object, or private access membership reaches ordinary UI.
- No wallet request, verifier, digest, filter/map/sort, timer, React setter, or controller work may occur in Canvas, `useFrame`, movement, camera, traversal, creature animation, card-switch, or restore paths.
- Opening and closing the wallet must preserve Canvas identity, player/world state, camera, active creature, exploration, and movement performance.
- Mobile controls are at least 44 CSS px; the primary confirmation floor is 52 px; safe areas and reduced motion are required.
- Tests follow strict RED → GREEN → REFACTOR and must exercise behavior rather than source-text-only contracts whenever a functional boundary exists.

---

### Task 1: Strict wallet projections and authenticated V122 read authority

**Files:**
- Create: `src/lib/receiz/wilds-wallet-projections.ts`
- Create: `src/lib/receiz/wilds-wallet-route-authority.ts`
- Modify: `src/lib/receiz/adapter.ts`
- Create: `tests/wilds-wallet-authority.test.ts`
- Create: `tests/wilds-wallet-projections.test.ts`

**Interfaces:**
- Produces `WalletSummaryProjection`, `WalletLedgerPageProjection`, `WalletRecipientProjection`, `WalletCapabilityProjection`, and strict normalization functions.
- Produces `resolveWildsWalletReadAuthority(request, deps)` returning only server-internal same-account token/profile context.
- Extends the adapter only with exact indexed SDK operations already present in V122: wallet summary/read ledger/profile lookup/introspection as needed.

- [ ] Write failing tests for cookie/profile/proof mismatch, missing wallet-read scope, revoked token, upstream unavailable, omitted granted-scope behavior, and privacy redaction.
- [ ] Run focused tests and confirm each fails for the missing authority/projection behavior.
- [ ] Implement strict bounded schemas, integer micro-Phi parsing, exact public username normalization, bounded cursors, and capability projection that marks V123 execution unavailable.
- [ ] Implement same-account read authority using existing session/cookie/profile primitives; never accept actor IDs, balances, heads, tokens, or scopes from request bodies.
- [ ] Run focused tests, app/test typechecks, and diff-check; refactor only while green.
- [ ] Commit the scoped task.

### Task 2: No-store wallet summary, ledger, recipient, and receive-request routes

**Files:**
- Create: `app/api/wilds/wallet/summary/route.ts`
- Create: `app/api/wilds/wallet/ledger/route.ts`
- Create: `app/api/wilds/wallet/recipient/route.ts`
- Create: `app/api/wilds/wallet/request/route.ts`
- Create: `app/api/wilds/wallet/capabilities/route.ts`
- Create: `tests/wilds-wallet-routes.test.ts`

**Interfaces:**
- `GET summary` returns only `WalletSummaryProjection`.
- `GET ledger?cursor=` returns one bounded `WalletLedgerPageProjection`.
- `POST recipient` resolves one exact normalized public username without enumeration leakage.
- `POST request` returns a non-authoritative public receive locator/request; it never reserves or moves value.
- `GET capabilities` exposes read/receive availability and explicit V123 dependency codes for send/resource/card publication.

- [ ] Write failing route tests for success, no-store headers, method/body allowlists, malformed cursor/username/amount, auth failures, rate-limit boundary, and redaction.
- [ ] Verify RED against absent routes.
- [ ] Implement thin routes over Task 1 authority and projections with exact status classification and no broad error leakage.
- [ ] Prove route imports export only valid Next.js route fields.
- [ ] Run focused tests, typechecks, and diff-check; commit the scoped task.

### Task 3: Wallet controller and exclusive modal ownership

**Files:**
- Create: `src/features/play/wallet/useWildsWalletController.ts`
- Create: `src/features/play/wallet/wilds-wallet-controller.ts`
- Modify: `src/features/play/world-overlay-state.ts`
- Modify: `src/features/play/play-shell-owner.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Create: `tests/wilds-wallet-controller.test.ts`
- Modify: `tests/world-overlay-state.test.ts`
- Modify: `tests/wildz-final-integration-blockers.test.ts`

**Interfaces:**
- Produces a bounded controller state distinguishing `idle`, `loading`, `verified`, `offline-verified`, `authority-required`, `failed`, and `revoked`.
- Adds `wallet` as one exact exclusive owner and preserves focus origin through the existing modal lifecycle.
- Exposes open/close/navigation/refresh/recipient/request actions; send execution remains unavailable when capability projection says so.

- [ ] Write failing reducer/controller tests for request deduplication, cancellation, identity invalidation, retained verified cold state, exclusive ownership, close focus, and no world reset/remount.
- [ ] Verify RED.
- [ ] Implement pure controller transitions and the React boundary outside Canvas; use explicit event-driven refresh, no polling timer.
- [ ] Wire `wallet` through modal ownership and `PlayCampaign` without changing movement, restore, card-switch, or Canvas keys.
- [ ] Run focused tests plus 10k hot-path diagnostics proving zero wallet counters; typecheck/diff-check; commit.

### Task 4: Coordinated V123 adoption and live Phi execution authority

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/lib/receiz/adapter.ts`
- Modify: `src/lib/receiz/oauth-scopes.ts`
- Create: `src/lib/receiz/wilds-wallet-transfer.ts`
- Create: `src/lib/receiz/wilds-wallet-transfer-journal.ts`
- Modify: `src/lib/receiz/wilds-wallet-projections.ts`
- Modify: `src/lib/receiz/wilds-wallet-route-authority.ts`
- Modify: `scripts/receiz-v122-check.mjs` or replace it with a V123-named checker and update `package.json`
- Create: `tests/wilds-wallet-transfer.test.ts`
- Modify: `tests/wildz-receiz-v122-adoption.test.ts`

**Interfaces:**
- Adds exact indexed V123 proof-authority exchange, Settlement/Reserve execute/recovery, world planners, and namespace resolution to the adapter.
- Produces preview/stage/execute/recover functions with stable semantic idempotency and zero-write/unknown/committed outcomes.
- Produces live capabilities only after exact installed-rail and granted-scope admission.

- [ ] Write failing V123 release-identity, scope, adapter, execution, lost-response, stale-head, and zero-write tests.
- [ ] Verify RED against the V122 checker/capability projection.
- [ ] Implement coordinated V123 adoption, exact proof-authority/value orchestration, and persistent minimum recovery journal.
- [ ] Run focused tests, typechecks, checker/conformance, lint, and diff-check; commit.

### Task 5: Live transfer routes and controller state machine

**Files:**
- Create: `app/api/wilds/wallet/transfer/preview/route.ts`
- Create: `app/api/wilds/wallet/transfer/execute/route.ts`
- Create: `app/api/wilds/wallet/transfer/status/route.ts`
- Modify: `src/lib/receiz/wilds-wallet-route-handlers.ts`
- Modify: `src/features/play/wallet/wilds-wallet-controller.ts`
- Modify: `src/features/play/wallet/wilds-wallet-controller-driver.ts`
- Modify: `src/features/play/wallet/useWildsWalletController.ts`
- Create: `tests/wilds-wallet-transfer-routes.test.ts`
- Modify: `tests/wilds-wallet-controller.test.ts`

**Interfaces:**
- Adds recipient/amount/review/stage/authorize/unknown/zero-write/committed states with exact cancellation and identity binding.
- Browser never receives proof authority, raw intent, heads, subject IDs, or transaction bytes.

- [ ] Write failing route/controller tests for injection, exact scopes, review expiry, pointer cancellation, ambiguous recovery, duplicate idempotency, and committed receipt adoption.
- [ ] Verify RED.
- [ ] Implement thin live routes and controller transitions over Task 4 authority.
- [ ] Run focused tests, typechecks, lint, diff-check; commit.

### Task 6: Sovereign HUD instrument and responsive terminal

**Files:**
- Create: `src/features/play/wallet/WildsWalletInstrument.tsx`
- Create: `src/features/play/wallet/WildsWalletTerminal.tsx`
- Create: `src/features/play/wallet/WildsWalletOverview.tsx`
- Create: `src/features/play/wallet/WildsWalletReceive.tsx`
- Create: `src/features/play/wallet/WildsWalletLedger.tsx`
- Create: `src/features/play/wallet/WildsWalletAssets.tsx`
- Create: `src/features/play/wallet/WildsWalletSend.tsx`
- Modify: `src/features/play/WildsBalancedStatusHud.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/globals.css`
- Create: `tests/wilds-wallet-ui.test.tsx`
- Create: `tests/wilds-wallet-browser-fixture.test.tsx`

**Interfaces:**
- HUD instrument sits directly below Kai Klok and exposes exact accessible value/status.
- Terminal owns Overview, Send, Receive, Assets, and Ledger navigation.
- Send surface stages exact recipient/amount/review state, requests deliberate proof authorization, and renders unknown/zero-write/committed outcomes without exposing authority bytes.

- [ ] Write failing behavioral render tests for instrument placement, exact states, exclusive dialog semantics, focus return, five surfaces, fail-closed send, reduced motion, and long-value/username fit.
- [ ] Verify RED.
- [ ] Implement focused components with stable projection props; no component reads raw adapter data.
- [ ] Add desktop side-terminal, tablet sheet, mobile full-screen/bottom-rail, safe-area, touch-target, and reduced-motion styling.
- [ ] Run UI tests, typechecks, scoped lint, and diff-check; commit.

### Task 7: Browser, performance, and release closure

**Files:**
- Modify: `docs/receiz-decisions/2026-08-21-wilds-authored-world-authority.md`
- Modify: `docs/superpowers/specs/2026-08-21-wildz-sovereign-wallet-terminal-design.md`
- Create or modify: focused browser/release tests under `tests/`

**Interfaces:**
- Records the exact V123 production capability matrix and any remaining non-SDK deployment dependencies.
- Produces release evidence for desktop/mobile terminal, no console errors, no overflow, stable world state, and zero wallet hot-path work.

- [ ] Add failing continuity/performance tests for open/close, refresh, card switching, Identity Seal restore, 10k traversal/frame diagnostics, and bounded route/controller work.
- [ ] Verify RED, then close any integration defects without weakening authority boundaries.
- [ ] Run focused wallet suite, full `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm receiz:check`, `pnpm receiz:architecture-lock`, and cache-disabled production build.
- [ ] Launch the production build and perform desktop/mobile browser smoke checks for HUD, terminal tabs, receive locator, ledger, capability explanation, focus, safe areas, console, and world continuity.
- [ ] Request independent whole-tranche review; fix all critical/important findings and rerun affected gates.
- [ ] Commit final release/doc changes and report only evidence-backed remaining blockers.
