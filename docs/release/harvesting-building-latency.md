# Harvesting and building: reconciliation CPU cost

After worker admission, `useWildsWorld` still merges portable additions and preserves construction history on the rendering thread. `PlayCampaign` then projects owned additions for persistence. These paths repeatedly verified unchanged projects, chunks, components, contributions, lots, sources and structures. History equality also hashed both canonical values just to compare them.

The change reuses bounded verification results keyed by exact plain-data contents and validator. It extends the existing cache to construction history and owner merges, and compares canonical history contents directly instead of computing two SHA hashes. Nested mutations still revalidate; a proof head alone never grants a cache hit. Durable admission ordering, command replay, source restoration, material lifecycle and reward rules are retained.

## Reproducible CPU measurement

Run `pnpm test`, then `node scripts/benchmark-world-reconciliation.mjs`. The optional first argument selects another compiled `.test-build` directory. This benchmark creates synthetic valid proof records and never opens a player's save.

Measured on the same local Node runtime, after warmup, with 100 projects and 100 material lots and an unchanged worker-shaped snapshot. The baseline uses these modules from main commit `dab1b01`. Each stage has five warmups and thirty samples; snapshot cloning is excluded. Rendering was paused during these runs.

| CPU stage | Before median | After median | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: |
| Merge owned additions | 14.91 ms | 4.71 ms | 15.71 ms | 8.46 ms |
| Preserve construction history | 21.12 ms | 4.87 ms | 22.05 ms | 5.79 ms |
| Project owned additions | 13.17 ms | 3.81 ms | 13.59 ms | 4.43 ms |

Summed stage medians decrease from 49.20 ms to 13.40 ms (about 73%). These are isolated CPU stages, not total action latency, GPU frame time, physical-phone performance, or proof that every freeze is gone. Cold cache misses and histories exceeding cache bounds still validate normally. Each new construction/history cache retains at most 4,096 entries and 4 MiB of accounted key bytes; normal map overhead is additional.

## Verification

- All 2,277 tests passed, including harvesting/building authority, persistence, replay, spent-material protections, exact-clone cache reuse, cache limits, and nested tampering under an already-verified project head.
- Targeted ESLint passed; architecture lock passed for 660 runtime files; secret scan passed.
- Debug/profile references read: `threejs-debug-profiler/SKILL.md`, `references/debug-profile-checklists.md`, `references/checklists/performance-profile.md`; systematic debugging and test-driven-development skill instructions applied.
- Production `pnpm build` passed. In the optimized local production browser, the world rendered and a foundation placement completed from Saving to Locked in place with the correct two-stone requirement; console errors were empty. This was plan placement, not completion of a funded structure. The local one-card browser session is not the restored 34-card account. End-to-end repeated harvesting/placement frame measurements on that account remain necessary after publishing.
