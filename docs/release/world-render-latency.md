# Nearby rendering and construction worker latency

Movement now uses a render-only spatial index for structures and unfinished construction sites. The index rebuilds when its source collection changes, sorts candidates when the player changes 64-metre cells, and checks the exact 110-metre visibility radius on each movement update. Negative coordinates and radius boundaries retain the original results. Authoritative placement and collision checks are unchanged.

Construction preparation computes its base checkpoint once. After a successful durable save establishes an anchor, the admission queue sends that anchor to the worker so successor replies omit the redundant checkpoint before crossing the worker boundary. Failed saves do not establish anchors. Existing recovery verification and serial persistence remain in place. Full projections still cross the worker boundary; this removes a specific redundant payload rather than introducing shared mutable authority.

## Reproduce

Run `pnpm test`, then `node scripts/benchmark-world-render-work.mjs`. Fixtures are synthetic and contain no account data. V8 serialization sizes are a Node proxy, not browser wire measurements.

Observed locally:

| Measurement | Before | After |
| --- | ---: | ---: |
| Nearby lookup, 10,000 objects, movement within one cell | 1.844 ms | 0.0027 ms |
| Successor entry JSON, 100 projects | 129,551 bytes | 1,712 bytes |
| Complete prepared result, V8 serialization | 148,290 bytes | 125,469 bytes |
| Complete prepared result, structuredClone | 0.336 ms | 0.290 ms |

Index construction cost was 2.26 ms; each movement checked 100 candidates instead of 10,000 objects. Collection changes pay the index rebuild cost. Timings are medians and will vary by hardware and world density. This is not a browser frame-time or real-account freeze-free claim.

Validation: 2,286 tests passed, including exact proximity equivalence, cell reuse, failed-save anchor handling, and existing multi-entry recovery tests. Architecture lock passed. Targeted lint has no errors; the pre-existing source-cell memo dependency warning remains.

Production build passed. Local production smoke check reloaded the saved world, opened and closed Living Construction, and reported no console errors. Secret scan passed. Sustained frame profiling on the original large account remains unverified.
