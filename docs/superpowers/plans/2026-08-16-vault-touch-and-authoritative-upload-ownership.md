# Vault Touch and Authoritative Upload Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the current workspace. Do not delegate; this repository is being changed surgically on `main` at the user's request.

**Goal:** Make the existing four-card Vault page reliably finger-swipable and make every successful card/Vault upload an authoritative Receiz ownership transfer with immediate same-device and two-second cross-device active-Vault removal.

**Architecture:** Restore immediate pointer capture inside the existing `WildsInventory` gesture without changing presentation. Reuse `/api/market/claims` for every `merge-vault` upload, preflight the original artifact without committing it, then verify and restore only the newly claimed response artifact. Add a bounded authenticated ownership-reconciliation route over the verified market projection and poll it from `WildzApp` while the proof session is connected and visible.

**Tech Stack:** React 19, Next.js 15 App Router, TypeScript, Receiz SDK v119, BroadcastChannel, Node test runner

## Global Constraints

- Work directly on `main`; add no branch, dependency, visual change, copy redesign, or unrelated refactor.
- Keep four compact cards per page, existing page buttons/dots, card taps, and vertical sheet scrolling.
- Never merge the original upload after a claim attempt; merge only the server-returned ownership-head artifact.
- Never let an old historical artifact reclaim a card after a newer ownership head exists.
- Preserve Identity Seal activation and all historical receipts/events.
- Ownership reconciliation fails closed: authority unavailability removes nothing.

---

### Task 1: Lock the Real-Touch Regression With a Failing Contract

**Files:**
- Modify: `tests/wilds-render-contract.test.ts`
- Modify: `src/features/play/WildsInventory.tsx`

- [ ] **Step 1: Add the failing capture-order assertion**

In the existing compact Vault render contract, isolate the `onPointerDown` handler and require `setPointerCapture(event.pointerId)` there. Also require the handler to record the start coordinates before capture and retain `onPointerCancel`, `onLostPointerCapture`, `inventorySwipePageDelta`, and `touch-action: pan-y` contracts.

- [ ] **Step 2: Run the focused test and observe failure**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='renders an accessible Receiz Capsule reward and bounded card inventory' .test-build/tests/wilds-render-contract.test.js
```

Expected: FAIL because the current page waits until `pointermove` crosses 48 pixels before capturing.

- [ ] **Step 3: Restore immediate pointer capture**

In `WildsInventory`, keep the current gesture start and click-suppression reset, then call `event.currentTarget.setPointerCapture(event.pointerId)` inside `onPointerDown` with a narrow optional-capture guard. Do not change layout, page policy, page size, dots, buttons, or CSS.

- [ ] **Step 4: Run the focused pagination/render tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='Vault|bounded card inventory' .test-build/tests/inventory-pagination.test.js .test-build/tests/wilds-render-contract.test.js
```

Expected: PASS, including existing left/right, threshold, vertical-intent, and page-clamping coverage.

---

### Task 2: Define Bounded Server Ownership Reconciliation Test-First

**Files:**
- Create: `src/lib/receiz/wildz-ownership-reconcile.ts`
- Create: `app/api/market/ownership/reconcile/route.ts`
- Modify: `tests/wildz-global-ownership.test.ts`
- Modify: `tests/wildz-market-routes.test.ts`

**Interfaces:**
- `parseWildzOwnershipReconcileRequest(value): readonly string[]` accepts only `{ assetIds: string[] }`, rejects empty/oversized/malformed requests, trims no client authority fields, and deduplicates IDs.
- `lostWildzOwnershipAssetIds(state, actorId, assetIds): string[]` returns requested IDs that have a verified ownership receipt whose current owner differs from the cookie actor.
- `POST /api/market/ownership/reconcile` returns `{ status: "ready", revision, lostAssetIds }` or a no-store 503 when verified market authority is unavailable.

- [ ] **Step 1: Replace the obsolete local-only ownership expectation**

Update `tests/wildz-global-ownership.test.ts` so it requires ordinary `merge-vault` imports to claim first, still requires BroadcastChannel removal/history preservation, and tests the new pure parser/loss policy with same-owner, foreign-owner, duplicate, malformed, and over-limit inputs.

Update `tests/wildz-market-routes.test.ts` so the authenticated-route set includes `ownership/reconcile` and the route contract proves it trusts only `resolveWildzCookieActor`, returns only `lostAssetIds`, and never accepts or returns an owner identity.

- [ ] **Step 2: Run focused tests and observe failure**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='custody reconciliation|ownership reconciliation|market remains embedded' .test-build/tests/wildz-global-ownership.test.js .test-build/tests/wildz-market-routes.test.js
```

Expected: FAIL because the policy module and route do not exist and ordinary Vault import is still local-only.

- [ ] **Step 3: Implement the pure bounded policy**

Create `wildz-ownership-reconcile.ts` with a small fixed maximum matching the game's bounded Vault, exact request-field validation, stable de-duplication, and receipt-owner comparison through `sameWildzPlayerCoordinate`. A missing receipt is not evidence of loss and must remain in the Vault.

- [ ] **Step 4: Implement the authenticated fail-closed route**

Create the reconciliation route with `runtime = "nodejs"`, `dynamic = "force-dynamic"`, no-store JSON, cookie actor resolution, Receiz market-repository load and proof verification, and the pure loss policy. Return 503 on `market_capability_unavailable`; do not guess or expose the new owner.

- [ ] **Step 5: Run focused route and policy tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='custody reconciliation|ownership reconciliation|market remains embedded' .test-build/tests/wildz-global-ownership.test.js .test-build/tests/wildz-market-routes.test.js
```

Expected: PASS.

---

### Task 3: Make Every Vault Upload Restore Only an Authoritative Claim

**Files:**
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `tests/wildz-global-ownership.test.ts`
- Modify: `tests/wildz-market-routes.test.ts`
- Modify: `tests/wildz-vault-login-integration.test.ts`

- [ ] **Step 1: Add failing import-path contracts**

Require a lower-level claim-and-restore callback that:

1. rejects when `proofSessionConnected` is false;
2. preflights `restoreWildzFileForSurface` without committing the original bytes;
3. posts the original file to `/api/market/claims`;
4. opens/verifies the response and its `x-receiz-artifact-sha256`;
5. downloads and passes the returned `File` to `restoreArtifact(..., "merge-vault")`;
6. is used by both the in-game Card Vault upload and `WildzVaultSheet.onAddVault`;
7. leaves `activateIdentitySeal` on direct `restoreArtifact(..., "activate-identity")`;
8. remains wrapped by the existing explicit Profile claim confirmation.

- [ ] **Step 2: Run focused tests and observe failure**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='ownership|Vault upload|login integration|bearer claim route' .test-build/tests/wildz-global-ownership.test.js .test-build/tests/wildz-market-routes.test.js .test-build/tests/wildz-vault-login-integration.test.js
```

Expected: FAIL because ordinary imports still call `restoreArtifact` directly.

- [ ] **Step 3: Extract the existing claim response handling**

In `WildzApp`, add one `claimAndRestoreVaultArtifact` callback below `restoreArtifact`. It performs the local no-commit preflight before the server mutation, reuses the existing FormData/idempotency/fetch/error/digest/download logic, and restores only the claimed response bytes. Keep the current import confirmation callback for Vault-wide additions and use `false` only for the already-preflighted returned artifact.

- [ ] **Step 4: Route both upload surfaces through the authoritative callback**

Pass `claimAndRestoreVaultArtifact` to `PlayCampaign.onRestoreArtifact` and call it from `WildzVaultSheet.onAddVault`. Keep the Profile's explicit claim button as a confirmation wrapper that calls the same callback and returns the verified asset count. Do not touch Identity Seal activation.

- [ ] **Step 5: Run the focused ownership/import tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='ownership|Vault upload|login integration|bearer claim route' .test-build/tests/wildz-global-ownership.test.js .test-build/tests/wildz-market-routes.test.js .test-build/tests/wildz-vault-login-integration.test.js
```

Expected: PASS, including stale-head server rejection contracts and response-digest verification.

---

### Task 4: Reconcile Prior Owners Across Devices Every Two Seconds

**Files:**
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `tests/wildz-global-ownership.test.ts`

- [ ] **Step 1: Add failing shell polling contracts**

Require the shell to POST current inventory IDs to `/api/market/ownership/reconcile`, use a 2,000 ms interval only while connected, skip hidden documents, prevent overlapping requests, refresh on focus/visibility, validate returned string IDs, and pass them through the existing active-Vault removal and durable save path.

- [ ] **Step 2: Run the focused test and observe failure**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='custody reconciliation|cross-device ownership' .test-build/tests/wildz-global-ownership.test.js
```

Expected: FAIL because there is no cross-device reconciliation loop.

- [ ] **Step 3: Share the existing durable removal callback**

Extract the body of the BroadcastChannel listener into a memoized `removeLostVaultAssets` callback. It reads `continuityRef`, calls `removeWildzAssetsFromActiveVault`, accepts the snapshot, marks a Vault save pending, and schedules a durable Vault save without deleting history.

- [ ] **Step 4: Add the visible, non-overlapping two-second poll**

Add a connected-session effect with one in-flight flag, an immediate check, `window.setInterval(..., 2_000)`, focus and visibility listeners, and complete cleanup. The request body contains only bounded active asset IDs. On non-OK, invalid, or unavailable responses, do nothing and retry later. Use `removeLostVaultAssets` for valid losses.

- [ ] **Step 5: Reuse the callback for same-device BroadcastChannel messages**

Keep the same channel name and actor-coordinate check, but route valid asset IDs into `removeLostVaultAssets` so same-device and cross-device changes share the exact same durable mutation.

- [ ] **Step 6: Run focused ownership tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-name-pattern='custody reconciliation|cross-device ownership' .test-build/tests/wildz-global-ownership.test.js
```

Expected: PASS.

---

### Task 5: Full Verification and Surgical Commit

**Files:**
- Verify all files above
- Update the plan checkboxes as tasks complete

- [ ] **Step 1: Run static and complete automated verification**

```bash
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```

Expected: all pass without new warnings.

- [ ] **Step 2: Verify the compact Vault in the in-app browser**

Run the app on an unused local port and use the in-app browser to confirm:

1. four-card layout, page dots, and buttons are visually unchanged;
2. a left drag turns exactly one page and a right drag returns;
3. a tap still selects a creature;
4. vertical motion does not page;
5. the console has no relevant errors.

Use the source/test capture-order proof as the real-touch regression check when the browser environment exposes pointer but not physical touch emulation.

- [ ] **Step 3: Review the final diff for scope**

Confirm only the documented gesture, upload-claim, reconciliation route/policy, tests, and plan files changed. Confirm Identity Seal activation and history retention are untouched.

- [ ] **Step 4: Commit directly on main**

```bash
git add app/api/market/ownership/reconcile/route.ts src/lib/receiz/wildz-ownership-reconcile.ts src/features/play/WildsInventory.tsx src/features/shell/WildzApp.tsx tests/inventory-pagination.test.ts tests/wilds-render-contract.test.ts tests/wildz-global-ownership.test.ts tests/wildz-market-routes.test.ts tests/wildz-vault-login-integration.test.ts docs/superpowers/plans/2026-08-16-vault-touch-and-authoritative-upload-ownership.md
git commit -m "Fix Vault touch paging and upload ownership"
```
