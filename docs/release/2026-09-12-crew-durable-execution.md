# Durable crew causal execution boundary

## Behavior

The crew scheduling journal now stores append-only Kai causal events, exact transaction candidates, worker heads and material reservations atomically in browser IndexedDB. Replayed commands cannot reserve different lots or overwrite transaction bytes. Safe cancellation applies only to proposals that have not entered the pending dispatch state.

The execution boundary binds admitted dependencies into SDK causal parents, records dispatch before sending, retains uncertain outcomes, and recovers exact commitments without redispatch. Local completion failures preserve recovery state. Approved transaction inputs cannot be mutated by validation or staging callbacks.

## Verification

- 2,399 tests pass, including atomic competing workers, owner isolation, command replay, storage rollback, pending reload/recovery, causal dependency binding and staging mutation.
- Targeted ESLint passes.
- Production build passes. The last additional isolated causal-parent guard was subsequently covered by the full test TypeScript compilation and regression test.
- Real headless Chrome with two tabs and browser IndexedDB: exactly one contender reserved a shared lot; all three causal events survived reload; a regressed clock observation preserved causal ordering; completion released the reservation.
- Browser harness: `/tmp/wildz-crew-browser.cjs`. No real world asset mutation or live mandate issuance was performed.

## Release limits

This is an execution infrastructure checkpoint. The gameplay UI, autonomous task policy, independently rendered workers, canonical movement sampler and production worker authorization/admission integration are still outstanding. No new animation-frame work or polling was introduced. Full crew mobile frame-time equivalence has not been measured. Local IndexedDB concurrency is not cross-device world authority.

Gameplay skill reference ledger: gameplay-workflows.md read; new-game-definition-of-done.md read; physics-engine-selection.md not applicable because this checkpoint changes no physics or collision. This checkpoint is not a first-playable crew release.
