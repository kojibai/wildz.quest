# Nearby gameplay CPU pass

This pass removes unrelated physics invalidations and reduces moving aerial and visible-construction work. It does not establish zero hitches on all devices.

- Physics memo inputs are now sites, bosses, structures and the three construction collections. Support projections depend only on structures and construction.
- Moving aerial sampling uses an ordered spatial broad phase. The exhaustive writer remains the reference; narrow-phase rules and original blocker order are unchanged. Large/non-finite query bounds and unusually large geometry keep a conservative fallback.
- Render construction and the builder's nearby-piece list index stable React collection inputs. Rendering selects within 64 metres before lazily projecting each piece once per collection version.
- Authoritative placement may reuse spatial/contribution indexes only for deeply immutable data. Mutable imported collections retain exhaustive scans and proof validation; no identity-only admission cache was added for them.

## Evidence

`pnpm test` includes exhaustive-versus-indexed aerial comparisons over 300 moving positions, ordering/duplicates/boundary tests, large-coordinate fallback and mutable construction-coordinate regression coverage.

After compiling tests, run `node scripts/benchmark-aerial-neighborhood.mjs`. A local run with 10,000 obstacles and 1,000 moving samples (median of five warmed runs) measured 151.08 ms exhaustive versus 1.29 ms indexed. The sample neighborhood contained 16 candidates. These are synthetic CPU timings, not browser FPS or cold-index construction timings.

## Remaining measurement

Public-card serialization already uses a worker; its main-thread path is a compatibility fallback. The full-world worker transfer protocol remains unchanged. Measure transfer/clone cost before introducing a versioned delta protocol. Cold index creation, large-account browser traces, GPU counters, low-end/mobile and sustained memory tests are still needed.

Profiler reference ledger: read `threejs-debug-profiler/references/debug-profile-checklists.md` and `references/checklists/performance-profile.md`; applied CPU isolation, identical warmed scenarios and collision-equivalence checks. No GPU improvement is claimed.
