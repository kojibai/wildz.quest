# Frame hitch reduction and regression checks

This pass removes repeated aerial collision scans while the actor is stationary. A per-actor cache compares exact X/Z, foot height, capsule height/radius, living-obstacle array, and terrain-obstacle array. Any changed input recomputes through the existing collision writer. These arrays already follow the immutable projection contract. The cached result is copied into the caller's output so site collision merges cannot corrupt the next sample. Air movement, ground movement, and site collision checks continue to run normally.

Run `pnpm test`, then `node scripts/benchmark-stationary-collision.mjs` to compare full scanning against the stationary cache with 10,000 synthetic obstacles. The work-count regression requires one scan for 300 identical frames and recomputation for every changed collision input. This is an isolated CPU measurement, not an FPS claim. Continuous movement still pays the original scan cost.

## Repeatable browser gate

1. Use a production build and record device, viewport, quality tier, account size, and route separately. Close other test renderers and compilers before measuring.
2. Open Living Story → Playtest tools. Enable local recording after warmup, then Start fresh.
3. Follow the same route for at least a minute: move, harvest, place, open and close Profile, and save. Repeat with dense construction and a large inventory. Include a separate slow-network run and a 20-minute memory/stability run.
4. Download the local session. Run `node scripts/check-playtest-performance.mjs /path/to/wildz-local-playtest.json` after `pnpm test`.
5. Exit 0 means the recorded sample passed: at least 600 frames, recent p95 at most 18 ms, no frame gap above 50 ms, and no observed long tasks. Exit 1 means a budget failed. Exit 2 means evidence is incomplete, malformed, or long-task observation is unsupported. A passing short recording does not establish sustained or device-wide performance.

The existing bounded recording stays local, includes action overlap rather than speculative cause attribution, and excludes identity, coordinates, and free text. Its p95 covers the latest 600 frames; worst frame and long-task counts cover the full recording. Compare equivalent recordings and inspect the slow intervals before attributing a hitch to an action.

## Evidence and limits

A separate local browser tab on the prior production build recorded four gaps over 50 ms, one long task, a recent p95 of 25 ms, and one Profile opening of 61 ms during a short construction/profile panel sequence. No console errors appeared. Other gameplay and test compilation overlapped this observation, so it is evidence that hitches remain, not a controlled baseline for an improvement percentage. The test tab's renderer was stopped afterward and its recording preference restored to off. The user's active game tab was not reloaded or replaced.

The Three.js profiler references were read: `references/debug-profile-checklists.md` and `references/checklists/performance-profile.md`. Checks used: production-mode reproduction, frame/long-task timing, console errors, animation-loop work and allocations, and immutable scene-input ownership. GPU counters, hardware throttling, original large-account trials, network stress, and sustained memory profiling remain unverified; this change does not claim to complete them.

Synthetic stationary scan timing: 0.2165 ms per frame before, 0.0000203 ms after (10,000 obstacles; 21 batches of 300 frames; medians). The meaningful deterministic check is 300 scans reduced to one.

The new production build rendered correctly, opened construction and Profile, and accepted movement (X -2/Z -1 to X 0/Z -2) with no console errors. Its separate, different-position test account recorded 2,982 frames, p95 17 ms, worst gap 83 ms, two gaps over 50 ms, and one long task; the new gate correctly flagged failure. This is not matched to the earlier account/route and supports no before/after browser percentage. The extra tab and server were stopped afterward.

Validation: all 2,288 tests passed; final focused tests include the rounded 50.1 ms frame boundary, which must still fail the gate. Targeted lint, architecture lock, secret scan, and production build passed (the existing source-cell dependency warning remains).
