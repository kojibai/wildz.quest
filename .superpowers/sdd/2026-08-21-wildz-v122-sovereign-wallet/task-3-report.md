# Task 3 report — Wallet controller and exclusive modal ownership

## Delivered

- Added a dedicated `wilds-wallet-controller` reducer and a client-only `useWildsWalletController` boundary. It models `idle`, `loading`, `verified`, `offline-verified`, `authority-required`, `failed`, and `revoked` without entering gameplay state or Canvas.
- Read refreshes are explicit, bounded, abortable, and deduplicated. The hook has no timer/polling path. A same-session, identity-keyed verified cache retains only the latest admitted read projection.
- Added controller actions for open, close, navigation, refresh, receive request, and recipient lookup. Recipient lookup always exposes the honest unavailable state and makes no lookup request while the durable limiter dependency is absent.
- Added `wallet` as one `WorldOverlayOwner`, through play-shell projection, modal admission, input gating, and Escape/focus lifecycle. Closing preserves the existing focus origin behavior; Task 4 will provide the terminal UI that invokes `openTerminal`.
- Mounted the controller in `PlayCampaign` outside `WildsWorldCanvas`; no Canvas key, movement, restore, card-switch, or frame-path behavior changed.

## RED evidence

1. Added `tests/wilds-wallet-controller.test.ts`, then ran:

   ```sh
   node scripts/clean-test-build.mjs && pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-controller.test.js
   ```

   Result: expected RED compiler failure, `Cannot find module '../src/features/play/wallet/wilds-wallet-controller'`.

2. Added wallet ownership/focus contracts to `tests/world-overlay-state.test.ts` and `tests/wildz-final-integration-blockers.test.ts`, then reran the focused compiler/test command.

   Result: expected RED compiler failures because `"wallet"` was not yet assignable to `WorldOverlayOwner`.

3. Added the durable-limiter capability behavior test before its helper. Result: expected RED compiler failure because `isWildsWalletRecipientLookupAllowed` was not exported.

## GREEN evidence

Focused controller/ownership/hot-path command:

```sh
node scripts/clean-test-build.mjs && pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-controller.test.js .test-build/tests/world-overlay-state.test.js .test-build/tests/wildz-final-integration-blockers.test.js .test-build/tests/wilds-render-hot-path.test.js
```

Result: exit 0; 36 tests passed. The hot-path suite executes 10,000 creature locomotion writes and 10,000 moving-instance updates; the integration contract verifies that the wallet controller is outside Canvas, has no polling, and does not introduce a Canvas key/remount path.

Additional gates:

```sh
pnpm typecheck
pnpm exec eslint src/features/play/wallet src/features/play/world-overlay-state.ts src/features/play/play-shell-owner.ts src/features/play/use-play-modal-lifecycle.ts src/features/play/PlayCampaign.tsx tests/wilds-wallet-controller.test.ts tests/world-overlay-state.test.ts tests/wildz-final-integration-blockers.test.ts
git diff --check
```

Result: all exit 0.

## Files

- `src/features/play/wallet/wilds-wallet-controller.ts`
- `src/features/play/wallet/useWildsWalletController.ts`
- `src/features/play/world-overlay-state.ts`
- `src/features/play/play-shell-owner.ts`
- `src/features/play/use-play-modal-lifecycle.ts`
- `src/features/play/PlayCampaign.tsx`
- `tests/wilds-wallet-controller.test.ts`
- `tests/world-overlay-state.test.ts`
- `tests/wildz-final-integration-blockers.test.ts`

## Self-review

- Confirmed all wallet work stays outside `WildsWorldCanvas` and no wallet fetch, timer, verifier, digest, or state publication was added to a world/frame/movement path.
- Confirmed close resets only transient recipient work and preserves a staged exact transaction ID; identity invalidation removes current private controller projections.
- Confirmed recipient lookup cannot retry or poll the unavailable production route.
- Confirmed send remains unavailable: the controller only carries the server capability projection and creates no preview/execute call.

## Concerns / follow-up

- The durable identity-keyed distributed limiter is still absent, so production recipient discovery is deliberately unavailable. This is surfaced as `unavailable` without a network request.
- The available V122 routes have no assets endpoint, and V123 execution rails remain unavailable. Task 4 should render those constraints plainly; it must not infer an asset balance or send authority.
- Commit: this Task 3 snapshot commit (SHA supplied in the parent handoff).

## Fix round 1 — authority, runtime, cache, and ownership hardening

### RED evidence

1. Added error-code revocation, request-runtime, cache, identity-bound receive, strict projection, and owner-takeover behavior tests to `tests/wilds-wallet-controller.test.ts`. The focused compile failed as expected because the controller did not export the runtime/cache/admission APIs, did not support generation-bound identity events, and accepted the old status-only failure classifier.
2. Added strict scalar validation cases for negative display cents and malformed ledger cursors. The focused test then failed as expected with `Missing expected exception`, proving that the prior client boundary admitted malformed projection values.
3. Added the 10,000 frame diagnostic assertion before exposing wallet runtime diagnostics. The test build failed as expected because `diagnostics` did not exist on the request runtime.

### GREEN evidence

- Replaced status-only failure inference with exact safe error-code classification. Explicit revoked/expired/binding-invalid codes produce `revoked` even at HTTP 401, while only exact authority-required codes produce `authority-required`; ambiguous HTTP 401 fails closed.
- Revocation clears summary, capabilities, ledger, recipient, receive locator, staged transaction ID, active request IDs, and the matching identity-plus-generation cache entry.
- Added a synchronous request runtime used by the hook. It deduplicates same-turn refresh/receive work, aborts and replaces an explicit refresh, and prevents aborted/stale/closed/identity-mismatched completions from publishing.
- The bounded four-entry cache is keyed by exact identity plus explicit authority generation, restores only as `offline-verified`, deterministically evicts oldest entries, and is synchronously hidden on an identity/generation prop change. `WildzApp` now passes the active proof-session `keyId` as the generation.
- Added full admission validation for every summary, capability, nested V123-unavailable reason, ledger page, cursor, and ledger-entry field before state/cache publication.
- Exclusive combat/profile ownership dispatches a wallet cancellation; the wallet state remains closed after the other owner releases.
- Wallet runtime diagnostics count refresh starts, receive starts, cache writes, and controller publications. The 10,000 real creature-frame-write test holds all four counters at zero.

Final fix-round command:

```sh
node scripts/clean-test-build.mjs && pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-controller.test.js .test-build/tests/world-overlay-state.test.js .test-build/tests/wildz-final-integration-blockers.test.js .test-build/tests/wilds-render-hot-path.test.js
pnpm typecheck
pnpm exec eslint src/features/play/wallet src/features/play/world-overlay-state.ts src/features/play/play-shell-owner.ts src/features/play/use-play-modal-lifecycle.ts src/features/play/PlayCampaign.tsx src/features/shell/WildzApp.tsx tests/wilds-wallet-controller.test.ts tests/world-overlay-state.test.ts tests/wildz-final-integration-blockers.test.ts
git diff --check
```

Result: all commands exit 0; focused suite 46/46 tests passed.

## Fix round 2 — live revocation and driver boundary

### RED evidence

- Updated `tests/wilds-wallet-authority.test.ts` to require `receiz_wallet_authority_revoked` for inactive introspection and upstream 401 during a live profile/introspection validation. Focused authority tests failed with the previous `receiz_wallet_authority_required` response and unmapped status.
- Added `tests/wilds-wallet-driver.test.ts`; the test build failed because no dependency-injected controller driver existed.
- Added confusable ledger-counterparty validation; the controller test failed with `Missing expected exception`, proving the prior boundary admitted the malformed public username.
- Added an executable focus-release test; the test build failed because the lifecycle had no callable release helper.

### GREEN evidence

- Initial missing cookie/proof/scope still maps to authority-required. Once live token/profile/introspection validation starts, inactive or upstream-401 authority is returned as exact `receiz_wallet_authority_revoked` at HTTP 401; the client maps it to revoked and clears projections/cache.
- Non-network failures no longer retain an offline projection. `offline-verified` is retained only for a transport failure with a prior admitted projection.
- Added `wilds-wallet-controller-driver.ts`, a dependency-injected execution boundary used by the React hook. Direct tests exercise fetch dedupe, abort-safe publication, exact revocation, malformed HTTP-200 receive clearing/retry, identity switching, and cache state.
- Threaded non-secret proof-session `issuedAt` through the public proof-session projection and remote bridge. `WildzApp` passes that issued session generation to `PlayCampaign`; cache keys remain identity plus generation rather than key ID alone.
- Ledger counterparties now run through the shared exact public username normalizer before admission.
- Added the lifecycle release helper used by `usePlayModalLifecycle`; the wallet → profile takeover → release fixture restores focus once and never changes wallet ownership.

## Fix round 3 — ambiguous authority and shared cold cache

### RED/GREEN evidence

- Added the shared-cache ambiguous-401 driver regression. RED: an empty-code HTTP 401 ended in `failed` and retained the seeded cache. GREEN: unknown/empty 401 now classifies revoked, clears visible private state, and deletes the matching cache entry; only exact initial authority/scope codes remain authority-required.
- The same live driver first performs refresh/cache/receive work and proves all diagnostic counters increment. After that baseline, 10,000 real creature frame writes leave the same driver counters unchanged.
- The default driver cache is now a module-shared bounded four-entry cache; hook first render hydrates from exactly that cache and returns `offline-verified` rather than a blank independent initializer. Generation changes synchronously mask prior identity state.
- Public proof-session `issuedAt` is exposed as a non-secret generation. The remote session bridge projects it, and every WildzApp success/failure path around the primary connection, restoration reconciliation, and bearer reconciliation sets/clears it with connection state. The same key ID with renewed issuedAt produces a distinct generation.
