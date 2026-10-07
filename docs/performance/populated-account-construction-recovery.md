# Populated account construction recovery

Measured 2026-10-07 against `e2f659f`. These are Node CPU measurements of one
saved-map admission stage, not browser FPS, PWA startup, or measurements of the
original player's private account.

Owner-state normalization, initial world adoption and subsequent owned-world
projection call `projectWildsConstructionPersistence`. Its shared recovery
collection contains project, chunk, component, material-contribution and
work-contribution histories. Previously each collection pass submitted every
recovery row to all five exact-data verification cache wrappers. Those wrappers
scan complete source bytes before their full validator rejects an unrelated
schema. Failed type checks therefore consumed the bounded cache alongside valid
proofs. On a populated history, repeated scans also evicted applicable admitted
results and forced their verification to run again.

The change dispatches by the exact supported schema before entering a cache
wrapper. Every applicable source still takes the original full validator,
including its seal, identity, nested evidence and changed-byte checks. The source
ID/head checks, ancestry merging, owner filtering, recovery records and receipt
projection remain in place. No proof-cache bounds, scenery, graphics, simulation,
world contents or account authority rules change.

The deterministic fixture has 100 valid owned project proofs and ten predecessor
proofs per project: 1,000 recovery records and 854,471 JSON bytes. Both algorithms
run against the same dependencies and receive newly cloned fixture objects. The
benchmark asserts equality of every projected field. Fixture generation, clone
time, TypeScript transpilation and module loading are outside the timed stage.
Fifteen warm samples alternate execution order.

| CPU measurement | Before | After |
| --- | ---: | ---: |
| Cold projection | 280.82 ms | 77.20 ms |
| Warm projection median | 261.65 ms | 32.14 ms |
| Warm projection p95 | 320.24 ms | 40.47 ms |
| Exact-data cache checks per projection | 14,400 | 3,400 |
| Full verifier executions, cold | 14,300 | 1,100 |
| Full verifier executions, warm | 14,300 | 0 |

Cold CPU decreased approximately 73%; the warm median decreased approximately
88%. Applicable source bytes are still scanned, and the first projection still
verifies every distinct applicable source. Timing varies with host load and map
shape. The fixture covers project ancestry; other construction proof types use
the same dispatch while retaining their existing full validators.

Reproduce after compiling the tests:

```sh
node scripts/benchmark-construction-recovery-dispatch.mjs
```

Optional arguments select the compiled tree, baseline Git revision, project
count and predecessor count. The default baseline is `e2f659f`. The benchmark
never reads account storage or player saves and never writes compiled output.

The three focused regressions cover applicable full verification, preserved
project/chunk/ancestor output, changed nested source bytes under unchanged proof
heads, unsupported schemas and altered ID/head keys. The dispatch regression
failed before the change, then all three passed. Targeted lint passes. Repository
tests and production build are part of the joint final verification; this
measurement alone does not certify the reported account freeze as resolved.
