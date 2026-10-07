# Startup recovery before boss pills

The HUD pills appear when the shared snapshot's site records reach React. Initial local source authority contains grove/emission genesis, so those pills previously waited behind world-history restoration even when a populated bootstrap had already arrived.

On the rendering-thread recovery path, resolving settled source envelopes synthesized, hashed, serialized and later verified a complete checkpoint for each historical command. The 15-second worker recovery policy could also send this same work to the main thread. A single initial timer did not partition that CPU work.

The fix verifies exact durable anchors once, retains shared projection references, and synthesizes a publication checkpoint only for pending commands. Recovery gives rendering a turn before replay and between slices with an 8 ms target; one expensive record can exceed that target. Every settled source is retained. Imported duplicate command IDs keep last-source precedence and first insertion order. Stored checkpoint, event and construction continuity laws remain unchanged. Empty outbox reads no longer replay settled history.

An available bootstrap now passes through the existing admission boundary and publishes immediately, before local restoration finishes. A rejected/stale snapshot cannot bypass continuity or overwrite the accepted world. Session cleanup suppresses late publication. Live boss damage, defeat and successors still require the current shared history; the spawn seed alone does not encode other players' actions.

## Measurements and verification

Synthetic 180-action settled construction history, compiled TypeScript, Node 24 on this host. This exercises the same CPU recovery function used when a worker is unavailable; it is not a recording of bjklock's device.

| Measurement | Before | After |
| --- | ---: | ---: |
| Recovery wall time | 1640.6 ms | 74.1 ms |
| Rendering heartbeat opportunities | 0 | 7 |
| Longest heartbeat gap | 1640.6 ms | 11.1 ms |
| Restored projects | 180 | 180 |

Reproduce with `node scripts/benchmark-world-startup-recovery.mjs` after test compilation. Timer measurements vary with hardware and concurrent work. GPU cost, rendering quality, creature identity and gameplay rules were not changed by this patch.

The first commit passed 3454 tests, with one pre-existing skip, plus typecheck, changed-file lint and independent review. Regression cases cover render opportunity, malformed source anchors, duplicate precedence, and immediate available-bootstrap publication with cancellation and stale snapshots. Final verification for the follow-up is recorded with its commit.

## Profiler reference ledger

- Read: `/Users/bjklock/.codex/skills/threejs-debug-profiler/references/debug-profile-checklists.md`.
- Read: `/Users/bjklock/.codex/skills/threejs-debug-profiler/references/checklists/performance-profile.md`.
- Read: `/Users/bjklock/.codex/skills/threejs-debug-profiler/references/checklists/scene-debugging.md`.
- Used: loading order, worker ownership/recovery, CPU task measurement, exact history equivalence, before/after heartbeat and startup dependency checks.

Remaining qualification: fresh device startup with the actual large account after deployment. This work cannot substantiate a guarantee that every possible startup or GPU/network failure is eliminated.

## Additional startup and sleep follow-up

Owner-bound runtime checkpoint restoration serialized the entire admitted inventory before parsing and discarding that copy. Restoration now serializes an empty inventory and reattaches the exact admitted handle through the existing owner-bound restore API. A synthetic 500-card, 4.63 MB inventory improved from 26.51 ms median to 5.88 ms on this host; the handle, position, food, sleep and source boundaries remain the same.

The exact proof cache now reuses deeply frozen plain proof objects without walking and rebuilding their exact data keys on every hit. All nested descriptors are checked during first inspection; mutable, root-only frozen, accessor-bearing or unsupported data retains exact-data revalidation. LRU eviction invalidates identity tokens and releases their retained keys. A synthetic 1,000-project warm pass improved from 8.14 ms to 0.11 ms.

Worker transfer and JSON parsing remove object freezing. Private received construction proof rows are frozen again without freezing caller-owned state or projection maps. Normal admission still validates them. First geometry preparation yields before work and between 8 ms target slices; cancellation prevents late adoption and interrupts unresolved worker preparation. In a 200-component / 1,000-contribution fixture, repeated geometry fell from 223.99 ms to 0.11 ms. First preparation took 263.49 ms across 26 rendering opportunities with a 14.50 ms maximum heartbeat gap. Initial freezing, grouping and a single expensive verifier are outside the slice bound. Reproduce with `node scripts/benchmark-world-startup-proofs.mjs` after test compilation.

Display Kai updates now pause while hidden and catch up once when visible. Analytical sleep/energy settlement, save timers, visible animations and command authority are preserved. This is a background cost reduction, not an explanation of the reported actively watched application error.

A malformed manual construction component could throw before bed-source verification. Bed resolution now verifies components before reading their transforms; broad-phase indexing skips missing/nonfinite horizontal positions, and null contribution rows cannot crash bed selection. A valid bed still requires its original exact funding/work/custody proof and footprint. The reproduced defensive bug predates the latest startup commits and has not been established as the user's live exception.

Unexpected client exceptions now retain four bounded local error reports and offer explicit retry/copy controls instead of the default white application-error screen. Reports capture error fields only, remove URL credentials/query/fragment, do not capture game-state objects, and do not make network requests. They preserve the actual stack needed to diagnose a recurrence; no general catch resets the game or invents recovered progress.

Follow-up validation: 3,470 tests passed with one pre-existing skip, plus typecheck, changed-file lint and independent review. Targeted error-normalization checks also passed after defensive handling of malformed error objects. An isolated production build succeeded; the production browser world rendered with movement and zero captured client errors during the check. Production build and browser qualification used a separate temporary checkout so the existing main runtime and `.next` assets remain intact. The browser check used a synthetic local explorer, not the real large account.
