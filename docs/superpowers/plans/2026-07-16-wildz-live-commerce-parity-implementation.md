# Wildz Live Commerce Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan. Every behavior change follows superpowers:test-driven-development: add the focused test, run it and confirm the expected failure, implement the minimum production change, then rerun the focused test before refactoring.

**Goal:** Make key-backed Wildz entry complete canonical Receiz ID connection, make a verified legacy Vault enter the shared world through an artifact-scoped recovery session, restore current Receiz Commerce movement/camera/boss parity, and keep a 100-card Vault responsive without hiding any card.

**Architecture:** `WildzApp` owns a proof-native entry gate. Local SDK identity creation/restore remains the proof root: key-backed identities build the official v104 signed continuation request and the same-origin server proxy accepts only the canonical bound account returned by Receiz. A fully verified legacy proof-sealed player Vault is exact-byte recovery authority for its embedded player and cards; document verification creates a short-lived pending admission, local IndexedDB commit happens first, and a separate same-origin exchange creates an artifact-scoped Wildz session. Legacy Vault sessions cannot authorize canonical account-scoped profile, market, proof-object, ownership, or settlement writes without Identity Seal/key or owner-continuity authority, while their scoped principals can participate in shared-world and multiplayer paths after an acknowledged authenticated world bootstrap. Gameplay input follows the current Commerce implementation exactly. The sortable world card rail uses Commerce's existing 4-card mobile / 8-card desktop pagination inside a memoized boundary so movement state never reconciles a complete restored Vault.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, React Three Fiber, `@receiz/sdk` 104.0.0, Node test runner, WebKit browser verification, PWA service worker.

**Reference:** `kojibai/receiz-commerce` `main` at `adaaa4305fc7c249c484656576ee07b2454846f5`.

## Global Constraints

- Work directly on `main` because the user explicitly requested it. Do not create a worktree or feature branch.
- Use only the Receiz SDK and existing app storage/cookies. Add no third-party database or persistence service.
- Fresh explorer and verified Identity Seal use the official v104 same-origin continuation proxy. A verified legacy Vault uses pending admission followed by an artifact-scoped session exchange after local commit. A separate Connect prompt or redirect to `receiz.com` is forbidden.
- Gameplay mounts from any committed proof-native `identity + character` snapshot. The proof-session extension is asynchronous and must not block the local game shell.
- Never send private key material, Vault bytes, or generated user access tokens into browser state, logs, proof images, or environment variables. Durable shared-world publication uses a separately provisioned server-only `RECEIZ_CONNECT_ACCESS_TOKEN`; it is not player login state.
- Preserve locally verified identity/Vault state on proof-session or network failure. Never replace or block a Vault identity with a foreign legacy browser session.
- Match current Commerce input exactly: 45 ms hold cadence only, analog radius 42%, movement scales `1.0` walk and `1.25` run.
- Match current Commerce camera exactly: FOV `42`, position `[4.6, 5.8, 7.2]`, damping disabled, target `[0, .55, 0]`, existing distance/polar limits, one-finger rotate, and two-finger dolly/rotate.
- On mobile, living-world pills stack vertically at lower-left using `flex-direction: column`, `align-items: flex-start`, and `gap: 5px`.
- All restored cards remain present and sortable by rarity/newest/oldest. Use Commerce's exact 4-card compact / 8-card wide pagination and page clamping; the world rail must not mount the complete Vault.
- Bump the default and example service-worker release from `v3.0.0-r104.1` to `v3.0.0-r104.2` so installed PWAs receive this client.

## Task 1: Make Receiz connection part of every Wildz entry

> **Final architecture correction:** The original OIDC-oriented steps in Tasks 1 and 2 below are superseded by the approved proof-native implementation. Normal fresh, Identity Seal, and Vault entry must never call `continueLocalIdentity`, `/api/auth/receiz/start`, `/api/auth/receiz/me`, or navigate away from Wildz. Key-backed entry uses `/api/auth/wildz/challenge` plus the official SDK `buildReceizIdContinueRequest`, then `/api/auth/wildz/session` proxies the signed continuation to Receiz and accepts only its canonical bound account response. Complete legacy Vault verification creates a non-authorizing pending cookie; only `/api/auth/wildz/vault-session`, called after the IndexedDB transaction commits, creates an artifact-scoped world session. That session restores the carried player and all cards but cannot authorize canonical account-only writes. Gameplay mounts from committed local state and its network hooks activate only after the matching final cookie exists. The older checklist remains as change history, not as release instructions.

**Files:**

- Modify: `src/lib/receiz/wildz-session-bridge.ts`
- Modify: `src/lib/receiz/wildz-identity-adapter.ts`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/identity/WildzGenesis.tsx` only if a small status/callback prop is needed; do not change the approved visual design
- Modify: `tests/wildz-auth-session.test.ts`
- Modify: `tests/wildz-shell.test.ts`
- Modify: `tests/wildz-vault-login-integration.test.ts` if the integration contract needs coverage

- [ ] **Step 1: Add failing session-reconciliation tests.** Extend `tests/wildz-auth-session.test.ts` to prove a verified local Identity Seal/fresh identity becomes `remoteStatus: "connected"` only when the remote actor coordinate matches; a foreign actor returns `unavailable` with `disconnect: true`; and the local `keyId`, `actorId`, and proof authority remain unchanged in both cases. Keep the existing proof-backed Vault behavior covered.
- [ ] **Step 2: Run the focused test and confirm RED.** Run `pnpm test -- wildz-auth-session` if filtering is supported; otherwise run `pnpm test`. The new verified-identity assertion must fail because `reconcileWildzRemoteIdentitySession` currently returns early for `localAuthority !== "remote-only"`.
- [ ] **Step 3: Reconcile every identity without weakening account binding.** Update `reconcileWildzRemoteIdentitySession` so verified local identities reconcile by actor coordinate while retaining their local key/proof authority. Preserve the opaque-subject-key check for ordinary remote-only sessions and the actor-coordinate rule for proof-backed Vault sessions. Update `bootstrapWildzContinuity` to revalidate every active session, persist the resulting status, and disconnect a foreign scoped cookie.
- [ ] **Step 4: Add failing shell-entry tests.** Replace the obsolete optional-Connect assertions in `tests/wildz-shell.test.ts` with contracts that require: automatic `continueLocalIdentity`, no “Not now” button, no dismissible Connect prompt, a `remoteStatus === "connected"` gameplay gate, callback error preservation, and an explicit offline/recovery choice before practice gameplay. Add source or pure-state tests proving fresh character completion, Identity Seal restore, and identity-bearing Vault restore all reach the same connection function.
- [ ] **Step 5: Run the shell tests and confirm RED.** Run `pnpm test`; the new assertions must fail against the existing `vaultLoginUrl` / `vaultPromptMode` prompt implementation.
- [ ] **Step 6: Implement one automatic entry gate.** In `WildzApp`, remove the optional Vault Connect prompt and route every `identity + character` snapshot through one idempotent connection effect. If remote status is not connected and the browser is online, invoke `wildzRemoteSessionBridge.continueLocalIdentity(session, returnTo)` once for that actor/return path. After OAuth return, bootstrap continuity, reconcile `/me`, and fail closed on an actor mismatch or `receiz_error`; show a focused retry state while preserving the local identity and Vault. Mount `PlayCampaign` only after connected status and Task 2 world readiness. When `navigator.onLine === false`, show an explicit “Continue offline” recovery action; only that user action may mount practice gameplay.
- [ ] **Step 7: Preserve pending Vault semantics.** Keep `wildzResume` processing ahead of the general entry gate. A committed matching Vault continues into the same gate; login-required or account-mismatch outcomes retain the staged restore and use their sealed login URL. Do not reintroduce a card-only confirmation for an identity-bearing Vault.
- [ ] **Step 8: Verify GREEN and regressions.** Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`. Confirm no test still describes live Receiz connection as optional.
- [ ] **Step 9: Commit.** Commit the focused entry-gate change with message `fix: connect every Wildz login to Receiz`.

## Task 2: Bootstrap the canonical shared world with the authenticated user session

**Files:**

- Modify: `src/lib/receiz/wilds-world-server.ts`
- Add: `app/api/wilds/world/bootstrap/route.ts`
- Add or modify: `tests/wilds-world-bootstrap.test.ts`
- Modify: `tests/wilds-world-repository.test.ts` only if repository conflict behavior needs an explicit contract
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/play/use-wilds-world.ts` only if initial mode handoff needs a connected-state contract

- [ ] **Step 1: Add failing bootstrap tests.** Create `tests/wilds-world-bootstrap.test.ts` with dependency-injected or exported pure/server seams proving: an authenticated non-practice actor publishes the first deterministic world tick plus ecology tick from expected head `{ revision: 0, lastEventId: null }`; an existing canonical revision is returned without another publication; a concurrent winning record is rehydrated and returned live; an unauthenticated/practice actor is rejected; and a failed publication never reports `receiz_live`.
- [ ] **Step 2: Run the focused suite and confirm RED.** Run `pnpm test`; the bootstrap exports/route do not yet exist and the test must fail for that reason.
- [ ] **Step 3: Implement serialized idempotent bootstrap.** Add `bootstrapWildsWorld(request)` under the existing mutation queue. Resolve the player from the scoped cookie, reject practice, recover canonical state, and return it immediately when revision is already positive. For revision zero, tick world and ecology once, publish with the authenticated actor/access token and the zero head, and claim `receiz_live` only after repository acknowledgement. On a publish conflict containing a valid positive-revision record, rehydrate that winning record and return it live. On all other failures restore the pre-bootstrap service and throw `wilds_world_canonical_publish_required`.
- [ ] **Step 4: Add the authenticated route.** Add `POST /api/wilds/world/bootstrap` with `runtime = "nodejs"`, `cache-control: no-store`, a success body containing `{ ok: true, projection, mode: "receiz_live", publication }`, and a safe non-secret error response. Do not accept a guest identifier.
- [ ] **Step 5: Gate gameplay on bootstrap.** After session reconciliation succeeds, have `WildzApp` call the bootstrap endpoint with same-origin credentials. Set shared-world readiness only for a valid `receiz_live` response. Provide retry/offline recovery UI for failures and do not mount normal gameplay into a practice snapshot while online.
- [ ] **Step 6: Verify GREEN and security boundaries.** Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm secret:scan`. Verify no response or client state contains `receiz_access_token` and the bootstrap route cannot accept the scheduler credential as a signed-in player.
- [ ] **Step 7: Commit.** Commit with message `feat: enter one shared world on Receiz login`.

## Task 3: Restore current Commerce movement, camera, and mobile boss HUD

**Files:**

- Modify: `src/features/play/WildzDpad.tsx`
- Modify: `src/features/play/wilds-movement.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-reference-hud.test.ts`
- Modify: `tests/wildz-reference-layout.test.ts`
- Modify: `tests/wilds-context-action.test.ts` if it owns duplicate-control assertions

- [ ] **Step 1: Add failing parity tests.** Assert the D-pad radius is `.42`, movement is emitted by the 45 ms interval only (not directly in `pointerdown`/`pointermove`), `movementScale("walk") === 1`, and run remains `1.25`. Assert Canvas camera and OrbitControls use the exact values in Global Constraints. Assert `PlayCampaign` mounts no hidden duplicate `WildsWorldControls`. Assert the mobile living-world HUD has the exact vertical stack declarations.
- [ ] **Step 2: Run the focused tests and confirm RED.** Run `pnpm test`; failures must identify the existing 32% radius, immediate pointer emissions, `0.8` walk scale, drifted camera, duplicate controls, and wrapped boss HUD.
- [ ] **Step 3: Apply exact Commerce input behavior.** Pointer handlers update the held vector/knob and pointer capture only. The active 45 ms interval is the sole movement emitter. Keep blur, visibility-change, pointer-cancel, lost-capture, and pointer-up stops. Use the 42% radius and leave the authored explorer animation unchanged.
- [ ] **Step 4: Apply exact Commerce camera and speed.** Change walk scale to `1.0`; set Canvas FOV/position and OrbitControls damping/target to the exact reference values while retaining the reference distance, polar, touch, rotation, and zoom settings.
- [ ] **Step 5: Remove the duplicate control owner.** Delete the hidden/preserved `WildsWorldControls` import and JSX from `PlayCampaign` when the visible `WildzSocialDeck` D-pad is the active control. Preserve context actions and accessibility labels.
- [ ] **Step 6: Restore the vertical boss stack.** Replace the mobile wrap rule with `flex-direction: column`, `align-items: flex-start`, and `gap: 5px` at the existing lower-left position. Keep compact pill sizing and sheet placement.
- [ ] **Step 7: Verify GREEN.** Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`. Compare the edited values against `/tmp/receiz-commerce-reference` at the pinned commit.
- [ ] **Step 8: Commit.** Commit with message `fix: match Receiz Commerce world controls`.

## Task 4: Use the current Commerce Vault paging boundary

**Files:**

- Add: `src/features/play/WildzPagedCardRail.tsx`
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Modify: `app/globals.css`
- Modify: `tests/inventory-pagination.test.ts`
- Modify: `tests/wildz-card-rail-ui.test.ts`
- Modify: `tests/wilds-render-contract.test.ts` if component composition is contract-tested there

- [ ] **Step 1: Add failing Commerce-parity paging tests.** Extend `tests/inventory-pagination.test.ts` and `tests/wildz-card-rail-ui.test.ts` to require the shared Commerce `inventoryPageSize` contract of four cards on compact screens and eight on wider screens, clamped first/last pages for zero and 100 cards, and a first-page reset after sort changes. Require the world rail to render `sortedCards.slice(safePage * pageSize, safePage * pageSize + pageSize)` rather than `sortedCards.map`.
- [ ] **Step 2: Run the focused tests and confirm RED.** Run `pnpm test`; assertions must fail because the world rail currently mounts every sorted card.
- [ ] **Step 3: Implement the isolated Commerce-paged rail.** Add `memo(WildzPagedCardRail)` using the existing `inventoryPageSize` and `clampInventoryPage` helpers, the same compact breakpoint as `WildsInventory`, and page state clamped when collection length or viewport size changes. Keep sorting, page navigation, swipe gesture, card selection, XP/name/check layout, and all-card count within this child. Do not pass movement, camera, player-position, or transient world state into it.
- [ ] **Step 4: Preserve every card and all three sorts.** Reset to page zero when rarity/newest/oldest changes. Provide previous/next controls plus a page indicator and retain horizontal swipe navigation, so every restored card is reachable across pages. Announce the full collection count, current page, total pages, and each card's logical position. Keep the verified badge and selected-card behavior unchanged.
- [ ] **Step 5: Keep the detailed Vault Commerce-native.** Confirm `WildsInventory` continues to use the same 4/8 helpers and only mounts through the active command sheet. Do not add a second full collection map to the always-mounted play surface.
- [ ] **Step 6: Verify GREEN and responsiveness.** Run `pnpm test`, `pnpm typecheck`, and `pnpm lint`. In browser instrumentation with the real 98-card Vault, confirm the closed Vault sheet plus world rail mounts no more than four card articles on mobile and movement/camera updates do not rerender a full collection. Reach the last page in rarity/newest/oldest order.
- [ ] **Step 7: Commit.** Commit with message `perf: match Commerce Vault paging`.

## Task 5: Deliver the PWA update and prove the complete mobile flow

**Files:**

- Modify: `.env.example`
- Modify: `src/features/pwa/PwaController.tsx`
- Modify: `tests/pwa-runtime.test.ts`
- Modify: release documentation only if its recorded release identifier is asserted

- [ ] **Step 1: Add the failing release assertion.** Change `tests/pwa-runtime.test.ts` to require `v3.0.0-r104.2` in both the controller fallback and `.env.example`; run `pnpm test` and confirm the old `r104.1` values fail.
- [ ] **Step 2: Bump the PWA release.** Update both production references to `v3.0.0-r104.2`; do not change package versions or the already-pinned SDK/MCP/AI Skills v104 packages.
- [ ] **Step 3: Run automated release verification.** Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm secret:scan`, `pnpm build`, `pnpm receiz:doctor`, and finally `pnpm release:check`. Confirm the Vercel output trace no longer requests a missing runtime JSON file.
- [ ] **Step 4: Run real mobile WebKit verification.** Start the production server and use the browser-control skill before Playwright. At an iPhone viewport, verify the available entry paths without external navigation: fresh explorer and Identity Seal/key entry build the official v104 signed continuation and bind to the canonical account returned by Receiz; the user-supplied exact 98-card Vault restores the carried `@bjklock` presentation identity with all 98 cards, commits that state before exchanging pending admission, enters the shared world under its artifact-scoped non-practice principal, and survives a cold reload. Confirm a foreign legacy browser session cannot override or block the scoped Vault actor, and confirm the legacy Vault alone cannot authorize canonical account-only writes.
- [ ] **Step 5: Verify gameplay parity under the real Vault.** With the 98-card Vault loaded, hold/drag the D-pad, release/cancel it, rotate with one finger, pinch with two, switch walk/run, reach the last Commerce-sized Vault page in rarity/newest/oldest ordering, and open the stacked boss HUD. Record console errors and confirm no more than the active 4-card mobile page is mounted during movement.
- [ ] **Step 6: Capture evidence.** Save mobile screenshots for the live-world HUD, card-rail end, and cold-reload Vault state under `output/playwright/`. Do not commit generated evidence unless release policy requires it.
- [ ] **Step 7: Whole-change review.** Review from commit `24ffb99` through HEAD for spec compliance, actor/session security, render performance, and accidental changes. Fix every Critical or Important finding and rerun the covering tests.
- [ ] **Step 8: Commit the release delivery.** Commit with message `chore: ship Wildz live world release` and leave `main` clean. Do not push; the user said they will push.
