# Free building camera, movement and prompt construction — 2026-10-07

Follow-up to [building entry and global map markers](2026-10-07-building-entry.md). This change supersedes that report's ground-building camera retraction behavior.

## Camera and movement

Ground OrbitControls now retain the player's selected camera position while crossing constructed walls. The rendered camera follows the desired camera without automatically retracting indoors. The existing ground zoom range is 0.45–12.5 units. Prompt creation walls and manual shelter roofs use presentation cutaways when they obstruct the view; collision, source admission and ownership remain unchanged.

Creation cutaways prepare an index buffer once, match rendered boxes to admitted solids, and update indices only when visibility changes. Arbitrary or curved triangles remain visible. React StrictMode initially exposed a lifecycle issue: its second memo evaluation attached a different index from the retained writer. Preparation now returns the same writer for the same geometry and chunk. A regression uses production-scale world coordinates and double preparation, and the browser visibly confirms the cutaway.

Walking uses rounded capsule contacts with oriented walls and door jambs, small substeps and wall sliding. Shallow restored overlaps can recover without allowing passage through deep solids. Resident created floors participate in grounded movement before water and terrain slope gates. Adjusted slide endpoints receive a second terrain, site, floor and headroom check so wall sliding cannot leave the player below terrain or inside a natural obstacle. Flight movement remains separately validated.

Placement can still put a doorway against a legitimate terrain or natural obstacle; these changes do not relocate an existing house or allow walking through trees and solid walls.

## Prompt construction and ownership messages

The proposal endpoint previously rejected more than eight workers with a generic ownership error, although the shared creation world allows 32. The screenshot showed 14 selected workers, so that cap mismatch can account for its error. The endpoint now uses the shared limit and distinguishes selection errors from failed ownership proofs. Existing canonical player-coordinate aliases also work during materialized creation execution; foreign and forged proofs remain rejected.

Verified historical ownership can pass proposal validation. Execution still requires a current authenticated owner in its durable worker record; genuinely transferred historical cards need that durable custody bridge and are not made authoritative by this patch.

The local planner now builds multi-floor mansions with exact requested room counts, connected galleries, usable doors and external stairs. The user's ten-room multi-floor prompt produces ten rooms over two floors. Supported compositions remain bounded to 24 rooms, four floors, 128 nodes and the registered part vocabulary. Requests beyond those bounds receive a specific error rather than a silently smaller building. Literal requests for arbitrary new game mechanics still require registered parts.

The default ten-room, two-floor layout has 33 nodes and costs 109 timber. A player with 47 timber must gather the remainder. Real finite-budget admission consumes the resources when construction executes; saved-world replay and repeated application cannot spend them twice. Tests cover exact balances and replay. The browser's synthetic finite inventory changes from 20 timber to 13 after building a seven-timber home and remains 13 after reload.

Mansion dependency closure can use eight small pages per quality tier while retaining the existing vertex, drawing and upload ceilings. This keeps all rooms and stair pages resident for the supported maximum layout without increasing those other ceilings.

Global map markers and creation checkpoint publication are retained from the previous commit. Independent live-client propagation was not exercised in this follow-up.

## Measured camera CPU work

`node scripts/benchmark-created-building-camera.mjs` exercises actual planned, compiled and admitted geometry at a translated and rotated pose. Each scenario warms up 3,000 iterations, then measures 30 windows of 120 frames. These are Node CPU measurements across all pages, not GPU frame times or phone FPS.

| Layout | Pages / solids / vertices | Stable median / p95 | Orbit median / p95 |
| --- | --- | --- | --- |
| 10 rooms, 2 floors | 3 / 103 / 5,256 | 0.00575 / 0.00862 ms | 0.00625 / 0.01054 ms |
| 24 rooms, 4 floors | 6 / 251 / 10,584 | 0.01554 / 0.01921 ms | 0.01692 / 0.02354 ms |

Both stable scenarios produce zero index updates over 3,600 measured frames. Orbit visibility changes produce 630 and 1,051 page updates respectively. The earlier source-validation and idle-residency latency fixes remain in place. No claim of zero latency on every device is made.

## Validation

- `pnpm test`: 3,410 tests; 3,409 passed, one existing skip, zero failures.
- `pnpm typecheck`: passed.
- `pnpm lint`: zero errors, two existing warnings in BuildGuidanceBrowserFixture and WildsStewardEnvironment.
- `git diff --check`: passed.
- Real installed OrbitControls tests cover wheel zoom, pinch input, rotation and damping while inside a building.
- Movement regressions cover rotated wall sliding, shallow restored overlap, repeated diagonal doorway traversal, created floor support over water and steep terrain, slide endpoint height, and natural obstacle rejection.
- Actual proposal POST tests cover 14 and 32 authenticated workers, oversize and duplicate selections, historical ownership proof validation and invalid proofs. Actual world application tests cover canonical owner aliases and finite resource replay.
- Mansion tests compile and physically traverse connected rooms and stairs, check exact room counts and resource bounds, and verify low-quality residency includes all maximum-layout rooms and stairs.
- Fresh browser fixture: one admitted and rendered home; repeated doorway entry and exit; saved-world reload; player local position (0, 0.10, 0) indoors while camera remains at (12, 3, 0), distance 12.18. Real outward wheel input increases camera distance from 1.25 to 11.97 while the player remains indoors. The near wall cuts away visibly. Browser error log is empty.
- Browser proof: `/private/tmp/wildz-free-building-zoom.jpg`. The isolated fixture uses synthetic resources and does not publish the user's world.

- `pnpm build`: passed. Existing circular chunk and SDK web-worker dependency warnings remain, alongside the two lint warnings.
- Production preview at `http://127.0.0.1:53093/`: the correct Wildz application and 3D world render; the world atlas opens and closes; the fresh browser error log is empty. The development fixture returns 404 in production. Preview runs in managed session 35229. Changes are not pushed or deployed.

## Reference ledger

Read from `/Users/bjklock/.codex/skills/threejs-debug-profiler/`:

- Yes: `references/debug-profile-checklists.md`.
- Yes: `references/checklists/scene-debugging.md`.
- Yes: `references/checklists/performance-profile.md`.
- Yes: `references/checklists/mobile-input.md`.

Checklist work includes physics/presentation separation, world-to-local transforms, camera/control frame order, immutable buffer ownership, bounded local navigation queries, finite materials, source replay and browser console/visual checks. Real phone GPU, gesture performance, draw-call, texture-memory and bundle baselines were not collected. Existing renderer quality and materials are retained.
