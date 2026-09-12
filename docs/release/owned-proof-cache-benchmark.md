# Owned proof projection benchmark

Measured 2026-09-12 using Node v24.15.0 on the development machine. This is a bounded CPU microbenchmark, not browser FPS, network latency, or an end-to-end Identity Seal save measurement.

Fixture: 1,000 valid, distinct, owned stone material proof objects. No construction history. Each projection receives a fresh `structuredClone` of the same snapshot, reproducing changed object identities from worker messages. Baseline uses the same compiled `projectWildsOwnedWorldAdditions`, replacing its four cache wrappers with the original proof validators. Outputs are asserted identical. Setup and initial proof generation are excluded. Thirty measured warm iterations alternate baseline/cache ordering.

| Measurement | Baseline | Exact-data cache |
| --- | ---: | ---: |
| First projection | 57.20 ms | 73.87 ms |
| First projection including clone | 69.54 ms | 82.77 ms |
| Warm projection median | 38.91 ms | 11.07 ms |
| Warm projection p95 | 52.06 ms | 18.38 ms |
| Warm projection + clone median | 40.62 ms | 13.18 ms |
| Warm projection + clone p95 | 53.86 ms | 20.41 ms |

Warm projection median decreased approximately 72% for this fixture. The first cached projection is slower because records must be scanned, verified and entered into the cache. First-call numbers also include JIT effects. Exact-data scanning and snapshot cloning still take time; the change does not establish a frame-time guarantee. Existing construction-history hashing remains outside this optimization.

The cache retains at most 4,096 entries and 4 MiB of serialized key data (not a claim about total JavaScript heap overhead). Repeated identical cloned material/site/source/structure data may reuse its verifier result. Changed nested data is reverified even when the supplied proof head is unchanged. Accessors, `toJSON`, unsupported prototypes and other non-plain data bypass caching.

Isolated benchmark runner: `/tmp/wildz-phi-test/benchmark-owned-proofs.mjs`; compiled fixture tree: `/tmp/wildz-phi-test/.test-build`. It does not use or modify the central `.test-build` directory.
