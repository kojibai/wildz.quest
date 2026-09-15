# Restore stable accompanying motion

The normal companion follow path had replaced the longstanding player-relative formation with a rotating target, independent navigation, catch-up substeps, and another position filter. The label moved as much as 7.83 CSS pixels between frames while the camera matrix remained constant. Normal accompaniment now uses the original stable side-by-side offsets and the existing cached floor lookup. Walking animation consumes travel cadence separately from the position. Independent roaming and work continue to use their navigation paths.

The original vertical world rebase removed in `fd54809` is restored. No new camera filter, spring, or shared transform moves the local explorer. The user tested the local build and confirmed walking was back to normal.

The shader warmup introduced by `627edf7` is removed. Its async material polling threw `Cannot read properties of undefined (reading 'isReady')` when a material was disposed during compilation, leaving its custom render gate closed indefinitely. The normal R3F renderer owns drawing again. There is no added loading screen, readiness gate, or deliberate delay before renderer mounting.

## Verification

- `pnpm test`: 2,688 passing. The three removed tests exclusively tested the deleted shader gate.
- `pnpm build`: production build, with pre-existing circular chunk and two lint warnings.
- `pnpm receiz:check`: passed; SDK/MCP/AI Skills contracts retained.
- `pnpm receiz:architecture-lock`: passed, 764 runtime files.
- Chromium, production preview at `http://127.0.0.1:3018`, 390 × 844, canvas DPR 1.25.
- Walking label trace: prior p95 frame displacement 4.415 px, max 7.831 px; restored follow p95 0.0229 px, max 0.0346 px. Both camera traces were stationary. These were consecutive route segments, not a deterministic replay.
- Twenty seconds of walking from X75/Z-112 to X56/Z-213: 2,404 sampled frames, p95 9.45 ms, max 20.78 ms, zero frames over 35 ms, zero long tasks. One shader status query took 7.61 ms.
- Profile opens and reports the test profile live. No shader/runtime exception in the motion traces. Test wallet authority requests return 401 before wallet authority admission.
- Local artifacts: `output/playwright/`; raw measurements retained in `/private/tmp/wildz-aligned-camera-result.txt` and `/private/tmp/wildz-walk-moving-result.txt`.

## Scope and limits

The intermittent hitch reported by the user did not recur in the final moving trace. This does not establish zero latency on every device or eliminate driver compilation time for unseen programs. Cold shader compilation remains browser/driver work; the crashing eager warmup and blocking gate are gone. No deployment was performed; the user will push the commit.

References used: threejs-debug-profiler `debug-profile-checklists.md`, scene-debugging, performance-profile, and mobile-input checklists; threejs-qa-release QA/release, visual-verification, playtest, and release checklists; Playwright CLI. All were read. Final checks target this regression, not a new review of unrelated game systems.

## Complete first game reveal and smaller frame spikes

The existing initial identity screen now remains mounted while the game renders hidden with its normal layout and render loop. `WildsFirstFrame` observes the first completed scene draw and reveals the whole game and HUD on the next animation frame. It restores the scene callback immediately after the first draw and cleans up its scheduled callback on unmount. The game mounts immediately; no extra screen, timed delay, compilation promise, or custom render loop was added. The identity-generation key prevents an older world from revealing a newly activated identity.

Mobile production verification observed the complete game reveal at 812 ms after navigation, no exposed HUD/intro overlap and no runtime exceptions. This is a measured run, not a guaranteed startup duration.

A subsequent walking trace correlated two shader-status queries (9.395 ms and 7.375 ms) with a 28.045 ms frame. Lantern point/spot lights now remain allocated with intensity zero when inactive, preserving shader light counts during visibility/quality transitions. The lantern meshes retain their previous visible conditions. This removes that source of shader permutations; it does not prove every recorded spike was a lantern transition or eliminate first-use compilation for every material.
