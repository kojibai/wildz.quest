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
