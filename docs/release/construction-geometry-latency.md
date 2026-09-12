# Construction geometry latency

Construction rendering, placement previews, bridge support, and interior/exterior collision projection previously enumerated and verified the complete contribution history once per component. A scene with C components and P contributions performed roughly C × P contribution checks per projection pass, with several systems repeating that pass.

Each pass now groups material and work contributions by component ID before calling the existing verified geometry projector. Relevant contributions still undergo component, lineage, duplicate, ordering, material, and work checks. Grouping does not admit a proof or replace those checks.

Verified geometry is also reused across consumers. Deeply frozen plain inputs use a per-component weak cache; replacing a proof invalidates the result. Mutable worker-cloned inputs use the exact plain-data key shared with the existing proof cache, never just a proof head. Their cached results are serialized and parsed for each caller to prevent mutation from poisoning the cache. This cache is limited to 128 entries and 4 MiB of accounted key/result strings. Accessors, cycles, exotic objects, and oversized keys fall back to normal verification. The render memo depends on construction data rather than unrelated world updates.

## Measurement

Run `pnpm test`, then `node scripts/benchmark-construction-geometry.mjs`. The script compares grouped and ungrouped paths in the current build. An optional compiled baseline geometry-module path compares a prior implementation instead. The recorded baseline was the geometry module from commit f3efe5c, transpiled beside the compiled test modules so its original dependencies resolved normally.

The synthetic fixture has 20 valid components and 100 valid material contributions. Both paths must return equal geometry before timing. An initial grouping-only measurement reduced the median pass from 234 ms to 26 ms. The full cache comparison against the prior module measured 373 ms before, 0.13 ms for repeated immutable projections, and 5.96 ms for repeated worker-cloned projections. Five warmed samples were used. These are isolated CPU timings, not gameplay FPS or a claim that every cold projection fits a frame. Browser activity can affect timings; the order-of-magnitude work reduction is more meaningful than sub-millisecond precision.

## Validation

Tests cover conflicting, duplicated, unrelated, and tampered contributions; immutable cache reuse; mutable proof changes without a head change; and isolation between returned mutable results. Existing placement, construction, physics, and proof tests remain applicable.

The Three.js profiler reference ledger includes `references/debug-profile-checklists.md` and `references/checklists/performance-profile.md`, both read. Checks include production builds, real panel transitions, local frame/long-task recording, exact CPU benchmarks, and immutable-data ownership. A short recording cannot certify all devices, large inventories, slow networks, or long-session memory behavior.

## Browser checks and placement regression

With compilation stopped, the prior production build on localhost:3023 recorded 6,473 visible frames over three Profile/build-panel cycles: recent p95 10 ms, worst frame 18 ms, zero gaps over 50 ms, zero long tasks, and three Profile completions (p95 36 ms). The optimized build, using the same saved account and position, recorded 4,318 frames: recent p95 10 ms, worst frame 15 ms, zero gaps over 50 ms, zero long tasks, and three Profile completions (p95 44 ms). Both passed the local gate. Durations and sample counts differ; this is a repeatability check, not an FPS improvement claim. The scene rendered normally and the console had no errors during these cycles. The earlier 83 ms observation did not reproduce after warmup without compilation.

A subsequent actual placement exposed an independent boundary bug: a valid foundation preview failed with `wilds_construction_component_region_invalid`. Project selection used the raw tap's region, while admission used the snapped component center. Snapping across zero could therefore select the wrong project. Preview now resolves the snapped region before selecting or creating the project. Regression cases cover crossing the X boundary, Z boundary, and both, including complete service admission. Build failures now log only a bounded identifier-shaped error code (or `unclassified`), never the raw arbitrary error message.

Final verification: 2,292 tests passed, targeted lint had no errors, architecture lock and secret scan passed, and the final production build passed. Retrying the exact failing browser spot produced “Foundation planned and locked”; after reload, “Continue nearby builds (1)” confirmed recovery. No new placement failure was logged after the fix (the tab log retained the earlier diagnostic). The temporary test tab and server were stopped; localhost:3022 was left running. Original large-account, cold-start, throttled-network, GPU-counter, and extended memory tests are not certified by these results.
