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
