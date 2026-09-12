# World recovery, refresh and save comparison

This change targets the first three follow-ups from the latency audit. It does not change spatial indexing or the worker message format.

## Changes

- Durable construction storage is still read before placement. A bounded source resolver reuses an exact unchanged prefix, verifying new or changed source records from the first difference. Actor switches, reordered records, altered source bytes and missing anchors invalidate reuse. Legacy settled intents remain excluded. Cached results are serialized so callers cannot mutate retained verification results. The cache retains at most 64 prefix entries and 8 MiB of accounted strings; oversized histories use normal verification. Replay against the current world and final admission are retained.
- World refreshes share one coordinator per owner admission queue. Calls during an active refresh collapse to the latest follow-up. New work during that follow-up causes another pass. Failure does not discard newer work, and cleanup cancels queued work. There is no added debounce delay and no parallel snapshot refresh within that coordinator.
- Owned-save change detection compares collection identity and record counts first, prioritizes materials and building changes, and only serializes differing collections. Nested content changes still compare exactly, including changes under an unchanged proof head. This avoids creating two serialized copies of the entire owned save.

## Measurements

Run `pnpm test`, then `node scripts/benchmark-world-followups.mjs`. An optional compiled `.test-build` path allows comparison with another revision. The fixture creates 16 source-backed projects in in-memory SDK storage and does not read player saves. The material-change case clones the owned additions and adds a consumed-lot entry; the unchanged case includes a structured clone in each sample. Each case warms once and records 15 samples in Node. Baseline modules came from `3ae3a47`.

Final consecutive runs on the same local machine:

| Scenario | Before median | After median | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: |
| Recover 16 source records | 21.87 ms | 12.87 ms | 23.08 ms | 17.21 ms |
| Detect material lifecycle change | 0.122 ms | 0.0026 ms | 0.367 ms | 0.0168 ms |
| Compare unchanged clone | 0.165 ms | 0.185 ms | 0.302 ms | 0.444 ms |

Recovery improved about 41%; material-change detection improved about 98%. The unchanged-clone case has a small overhead (about 0.02 ms median), explicitly retained here. Earlier runs under different machine load had higher absolute times. These are CPU/work measurements, not a full-game FPS or physical-device benchmark.

The deterministic refresh regression starts a blocked request and submits two more refreshes: only the first and latest execute, all callers await the shared drain, and failure/cleanup cases are covered. The source regression verifies two records once, reuses both on an unchanged read, and verifies only one additional record when a third is appended.

## Verification

All 2,283 tests passed, including exact-prefix invalidation, tampering, bounded eviction, returned-object mutation, refresh failure/retry/cleanup, owned-state changes and existing outbox/persistence coverage. Targeted ESLint passed; architecture lock passed (661 runtime files), and secret scan passed. The production build passed. The local browser recovered the existing foundation, rejected overlapping placement, and responded to movement; its console error list was empty. New source appends are covered by automated tests; this browser check did not complete a new funded structure.

The debug/profile checklist, performance-profile checklist, systematic-debugging, test-driven-development and verification-before-completion instructions were used. No graphics, physics, assets or audio were changed. Full repeated harvesting/placement frame measurements on the restored 34-card account remain separate acceptance evidence after publishing.
