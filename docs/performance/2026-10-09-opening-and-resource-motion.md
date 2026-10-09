# Opening frames and resource gathering

The optional shader preparation after the first playable HUD submitted the whole
scene twice in one idle callback. The callback took 22.5 ms despite having only
1.9 ms of idle time, then queued a burst of GPU compilation. Main-thread long-task
observers alone missed the resulting frame gaps. A browser-only control disabling
this optional preparation isolated its contribution.

Commit `6b62219` changes preparation to one renderable object between paints,
retains both shader variants and the actual scene lighting, and waits for each
batch's nonblocking GPU completion before submitting another. First-draw
preparation and the world-ready condition remain the same. Cancellation, removed
objects, disposed programs, context loss, and unsupported parallel compilation
have behavioral coverage.

The controlled production test uses a 390 × 844 Chromium viewport and synthetic
established-account data. Service workers are blocked in this particular A/B
comparison so a cached bundle cannot defeat the control. Three baseline opening
runs had worst post-HUD frames of 34.15, 41.67, and 41.75 ms. Disabling optional
preparation reduced these to 9.34, 9.27, and 9.34 ms. Final production-build
runs measured 16.67, 9.34, and 9.33 ms, with no frames above 30 ms. These are
desktop browser measurements at a mobile viewport, not physical iPhone results
or a guarantee of zero latency. The previously reported 108–125 ms gaps were
not reproduced at that magnitude in this controlled setup.

An additional online trace found about 41–47 ms spent parsing and re-verifying
an unchanged public-card response. Anonymous publication checks now reuse the
exact immutable admitted local asset only after comparing every returned field,
including complete history contents, against that asset. IDs or matching head
digests alone never bypass verification. Unadmitted expected copies follow the
normal verifier. Metadata, compressed transport bindings, anonymous availability,
and publication retry behavior remain checked. No server becomes identity
authority, and sync/public distribution remains in the background.

A separate 362,554-byte public-record microbenchmark measured the first full
verification at 115.05 ms versus 1.35 ms for exact admitted-content matching.
Subsequent full checks took 3.25–6.38 ms; matching took 0.48–0.72 ms. This isolates
record admission and excludes network transport and JSON body parsing.

## Creature round trips

The gathering regression came from clearing `activeWorkSource` immediately when
the durable harvest saved. Faster saves erased the route before the creature
could reach it. Saving and Satchel credit still complete at the same point in
the command. The existing companion frame loop separately retains the source,
records arrival, presents 900 ms of work and 350 ms of settling, then releases
the target to the existing return movement. Presentation never creates another
harvest, rewrites a receipt, or waits before saving. Failed commands, changed
leaders, and the existing eight-second safety deadline release presentation.

The trip uses the existing bounded collision sampler and 300 ms route planner.
There is no additional animation loop or frame-driven React state update.
Completion emits once. Idle sources skip work effects; only the exact active
source receives animated transforms. Tree/stone approach anchors stand outside
the body rather than inside a trunk. A following formation that overlaps an
obstacle can start at a validated nearby player landing with at most two
occupancy checks; its visual pose eases into the route. Independent or distant
workers cannot use this departure recovery. Work climbing uses the creature's
existing admitted climbing capability.

Hay retains its existing hand-gathered proof. A rested selected companion can
present its round trip without adding a contributor or changing material/fatigue
accounting. Creatures that need recovery are not sent by this presentation path.

Browser checks use synthetic accounts and physically supported resource routes.
An initial test spawn on a steep mountain without a climbing creature failed
walking support and was replaced for the ordinary round-trip checks. No invalid
landing was made traversable to satisfy a test.

The final UI checks credited exactly one lot, saved before arrival, released the
work presentation, and returned each creature to its starting formation within
0.001 m. Each sampling window includes a screenshot during work.

| Resource | Save after gesture | Arrival after gesture | p95 frame | Worst frame | Tasks / frames above 50 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Timber | 38.74 ms | 208.26 ms | 9.94 ms | 16.74 ms | 0 / 0 |
| Stone | 31.87 ms | 94.42 ms | 9.90 ms | 10.34 ms | 0 / 0 |
| Hay | 47.96 ms | 202.90 ms | 9.88 ms | 33.41 ms | 0 / 0 |

These are separate stationary gather cases, not the walking/camera trace below.
The timings include existing command admission; the change adds no admission wait.

## Create panel

The Create toolbar now uses 44 × 44 px closed controls, retaining mobile hit
targets. Labels appear only on the open tab, with an emerald/gold selected state.
The prompt is 112 px high rather than about 82.8 px, an increase of roughly 35%.
Short viewports use 96 px. The change is CSS only, with no new asset, animation
loop, layout listener, or startup dependency. Browser checks cover 320 × 640,
390 × 844, a 390 × 400 keyboard-sized viewport, and 1280 × 800.

## Verification and limits

Final measurements and exact check outcomes are retained in the
[measurement JSON](2026-10-09-opening-and-resource-motion-measurements.json).
The service-worker-controlled offline test begins walking/camera input at
the first playable HUD, retains durable proof sources and heads, and checks that
reopening does not reread the Identity Seal or replay the custody worker.

The 7.76 MB encrypted-Seal fixture reached the HUD in 347.90 ms with retained
heads, then reopened offline in 339.24 ms. The first upgrade without a custody
head took 704.56 ms and scheduled its custody recovery in the background. Retained
reopening used zero custody workers, zero main-thread Seal reads, and zero
pending-upload value scans. All opening windows had zero post-HUD long tasks.

Immediately after the offline HUD appeared, the test ran for 120.084 seconds,
with 1,379 movement inputs, 17 camera drags, and 37 distinct displayed positions.
Across 14,466 frames, p95 was 9.00 ms and maximum was 16.655 ms, with zero frames
above 50 ms, zero long tasks, zero main-thread Seal reads, and zero browser errors.
All 15 optional embodied samples and both location audio files loaded after real
network reconnection. Durable custody heads remained and the expired temporary
upload was removed through the expiry index without scanning its large values.

Create-panel checks passed 20 states across four viewports using the actual
production CSS, including each open tab and the fully closed toolbar. Only the
open tab showed its label; all targets retained at least 44 px, with no overflow.

`pnpm test` passed 3,637 tests, with one skipped and zero failures. `pnpm build`,
`pnpm lint`, `pnpm receiz:architecture-lock`, `pnpm secret:scan`, and
`git diff --check` passed. The build retains two existing Receiz SDK dynamic
require warnings from `web-worker`; it has no circular chunk or missing lint
plugin warning.

Required references were read: `threejs-debug-profiler/references/debug-profile-checklists.md`,
its scene-debugging, performance-profile, and mobile-input checklists;
`threejs-gameplay-systems/references/gameplay-workflows.md` and
`references/physics-engine-selection.md`; `threejs-game-ui-designer` and its
responsive fit/mobile input references; the Playwright skill. The existing custom
collision system, renderer ownership, and movement timestep are retained.

No physical iPhone/iPad was connected for these measurements. Browser screenshots,
runtime timings, and synthetic fixture logs stay local; original user proof
artifacts are never test inputs. Vault navigation was not changed: the explicit
Apply update action is the only app-owned reload found during the source trace.
