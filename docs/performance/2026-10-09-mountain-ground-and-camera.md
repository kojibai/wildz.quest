# Mountain ground, camera clearance, and established Seal reopening

Wild fauna and livestock used their base-land altitude even when a mountain
occupied the same coordinates. Mountain trees already used the admitted mountain
surface. Grove foliage and regional ecology also lacked the prepared mountain
runtime. The outdoor camera copied its requested orbit without checking mountains.

The production reproduction measured animal limb instance centres as far as
5.308 m below the mountain skin and a camera position 0.102 m below it.
Animal bodies, selection rings, spatial sound sources, and hunt effects now share
the admitted mountain floor. Grove trees and flowers sample their own positions;
pollinators and migration creatures follow the surface as they move.
Saved animal anchors, proof objects, resource accounting, and command timing are
unchanged. Small negative limb-centre clearances on sloping ground remain possible
because an animal has width and its root is grounded at its centre; this change
does not add inverse kinematics or deform animal meshes.

The outdoor camera now clips the player-to-camera sightline against the exact
admitted mountain triangles. It retracts before terrain obstructs the view,
including a ridge between the player and an otherwise clear endpoint. Only the
rendered camera is adjusted: OrbitControls retains the requested rotation and
zoom, and the view restores its requested distance when clear. Very steep terrain
can bring the camera closer to the player. Cave collision, building cutaways,
clear flight views, and controls retain their existing behavior.

The query uses the existing numeric spatial index. It performs no scene raycast,
new index construction, authority generation, allocation, or network request on
camera frames. It is bounded to 64 cells, 4,096 bucket entries, and 512 triangles;
an exceeded budget retracts to the target rather than allowing terrain penetration.
Static grove foliage heights are memoized independently of player movement.
Moving creatures reuse their existing transform loops and mutable runtime.

## Matched production mountain comparison

Both measurements used the same synthetic account and 390 × 844 Chromium viewport,
with service workers blocked to ensure the intended production bundle was tested.
The scene hook only exposed the renderer for measurement; camera and animal
movement remained the actual production behavior. Thirteen camera positions and
1,300 mountain animal limb instances were sampled in each run.

| Measurement | Before | After |
| --- | ---: | ---: |
| Minimum camera clearance above mountain | −0.102 m | +0.187 m |
| Minimum animal limb-centre clearance | −5.308 m | −0.065 m |
| p95 frame interval | 10.215 ms | 10.015 ms |
| Worst frame interval | 25.005 ms | 25.020 ms |
| Frames sampled | 465 | 466 |
| Frames above 50 ms / post-start long tasks | 0 / 0 | 0 / 0 |
| Draw calls / triangles | 107 / 142,170 | 107 / 142,170 |
| Geometries / textures | 86 / 16 | 86 / 16 |

These timings show comparable frame cost, not a claimed latency improvement from
this correctness fix. The scene retains its geometry and texture counts.

A further production walking check used an ordinarily traversable mountain foot
and retained the existing capability restrictions. It recorded 11 distinct
positions across 60 movement inputs and 12 full camera drags. The 1,070 sampled
frames had p95 8.900 ms, maximum 16.665 ms, and zero long tasks or frames above
50 ms. Twenty-five camera snapshots stayed at least 0.183 m above the mountain
skin. An earlier steep-face diagnostic correctly blocked a non-climbing creature;
that stationary case was not counted as a walking pass. Collision rules were
not weakened to make the test move.

## Uploaded Identity Seal startup

No identity or proof-restoration code was changed in this patch. Source inspection
and the production reopening trace did not identify another established-Seal
source replay worth removing. Existing durable custody and inventory heads remain
the reopening path. Background synchronization and public distribution remain
unchanged.

The baseline controlled openings of the synthetic 7,763,369-byte encrypted Seal
with a received 301-event creature reached the HUD in 668.410 ms for the initial
upgrade, then 412.885 and 389.135 ms for established reopening. Their five-second
post-HUD windows contained no long tasks; worst frames were 16.595, 9.335, and
9.305 ms. This patch does not claim a further Seal startup saving.

Repeating that same controlled scenario on the final bundle reached the HUD in
575.060, 392.450, and 377.365 ms. Worst post-HUD frames were 16.670, 9.295, and
9.335 ms, with zero post-HUD long tasks or browser errors. The small reopening
timing differences do not establish a saving because no Seal optimization was
made; these runs check for a startup regression from terrain changes.

The final service-worker-controlled test reopened the same synthetic long-history
Seal account in 350.515 ms online and 339.595 ms offline. Reopening made zero
main-thread Seal reads, launched zero custody workers, and performed zero
pending-upload value scans. The first upgrade without a retained custody head
still completed its recovery in the background and became playable in 677.545 ms.
Its proof-source worker was scheduled after the HUD appeared.

Input began at the first offline HUD and continued for 120.008 seconds: 1,380
movement inputs, 17 camera drags, and 37 distinct displayed positions. Across
14,458 frames, p95 was 8.980 ms and the worst interval was 25.995 ms, with zero
frames above 50 ms, zero long tasks, zero main-thread Seal reads, and zero browser
errors. Durable custody heads and the current upload remained; an expired
temporary upload was removed through the expiry index. Reconnection restored all
15 optional embodied samples and both other location audio files. This separate
offline scenario is a regression check, not a matched startup-speed comparison
against the controlled baseline above.

## Behavioral verification

Tests exercise real component frame callbacks, Three.js transforms, actual
OrbitControls, and admitted mountain fields. They cover animal roots/audio/rings,
unchanged saved anchors, hunt impacts, separate foliage heights, rotating
pollinators, moving migration instances, camera sightlines across hundreds of
generated mountain rays, a clear endpoint behind a ridge, wheel input while
clipped, and recovery to the retained desired camera pose. Runtime index and
authority-build counters do not increase during camera checks.

`pnpm test` passed 3,645 tests, with one skipped and zero failures. `pnpm build`,
`pnpm lint`, `pnpm receiz:architecture-lock`, `pnpm secret:scan`, and
`git diff --check` passed. The build retains the two existing Receiz SDK dynamic
require warnings from `web-worker`.

The [measurement JSON](2026-10-09-mountain-ground-and-camera-measurements.json)
retains the matched scene statistics, sampled camera poses, startup runs, and
offline motion results. Local screenshots are in
`output/playwright/2026-10-09-mountain-ground-and-camera/` (ignored QA output).

Required references were read: the `threejs-debug-profiler` skill and
`references/debug-profile-checklists.md`, with its scene-debugging,
performance-profile, and mobile-input references; systematic debugging; and the
Playwright skill. The existing custom physics, renderer ownership, authority
boundaries, movement timestep, and animation loops are retained.

No physical iPhone/iPad was connected. Measurements use desktop Chromium with a
mobile viewport and synthetic proof fixtures, and cannot promise zero latency on
every device. No original user proof artifacts were used as test input.
