# Motion, camera, battle display, harvesting, underwater wildlife, and creation placement

Baseline: `c1ad1bc5ddb126efb5e316da1f564955c3f3edcf`. Changes are local; no live deployment or user creation admission was performed.

## Findings and changes

Local gameplay accepted movement before the scene displayed it. A second floating-origin offset eased the world toward the new position; explorer facing, flight/swim height, orbit input, and several follow cameras then added their own easing. These layers introduced avoidable presentation delay beyond the physical update and display frame.

- World children now use the accepted player/floor origin directly, including independent crew, terrain, labels, and portal/restore changes.
- Local facing is synchronized in a layout effect, and local yaw/pitch and flight/swim height display the current accepted traversal state. Remote player interpolation is retained.
- World and atlas orbit controls apply the full gesture without damping. World camera changes publish the movement heading synchronously. Zoom bounds, rotation speeds, touch mappings, underwater targeting, cave ceilings, and interior camera projection remain in place.
- Arena fighter positions and arena/Hearttree camera framing follow accepted positions immediately. Arena shake retains the original filtered impact envelope; its offset is filtered separately from camera follow.
- A centered D-pad drag emits its first meaningful vector immediately. The existing 45 ms held-input cadence uses the RAF timestamp, including delayed callbacks. Ownership, outside release, cancellation, and teardown behavior remain covered.

Movement distances, physical flight/swim integration, collisions, energy costs, combat cadence, crew travel, proof admission, and publication timing are unchanged. Cosmetic gait/breath effects, authored physical acceleration, remote packet interpolation, and impact shake remain intentional behavior. They are not extra local input queues.

## Reproducible presentation measurements

Run `pnpm test`, then `node scripts/benchmark-motion-latency.mjs c1ad1bc5ddb126efb5e316da1f564955c3f3edcf`.

The benchmark executes the actual old/new component functions with real Three transforms and deterministic 60 Hz frame scheduling. React/Fiber lifecycle boundaries are substituted. This measures response to an already accepted state change, **not hardware input-to-photon latency or real-device FPS**. It includes the first display frame in time to 95% convergence.

| Presentation path | Before: frames to 95% | Before: simulated ms | After: frames to 95% | After: first-frame residual |
| --- | ---: | ---: | ---: | ---: |
| World translation | 10 | 166.67 | 1 | 0% |
| Flight camera height | 23 | 383.33 | 1 | 0% |
| Arena fighter movement | 19 | 316.67 | 1 | 0% |
| Hearttree camera follow | 39 | 650.00 | 1 | 0% |

At 60 Hz the first display frame is 16.67 ms. These presentation delays are removed, but device input sampling, React scheduling under load, rendering/GPU work, display scan-out, and network travel cannot be declared zero. This session did not measure those stages on the user's iPhone.

Existing movement CPU probes did not identify a need to change the game's physical rules: the indexed spatial probe was approximately .00011 ms and grounded movement .0044 ms per sample in the local harness. A small local account's full movement reducer measured approximately .058 ms. Those figures do not predict a large populated account's frame time. Existing workers, admission boundaries, world selection, quality profiles, and save batching remain intact.

## Harvesting, collection, battles, and repeated work

Local food gathering, livestock collection, and local battle turns dispatch directly to their reducers. Material harvesting already executes source validation and durable persistence in a worker, installs the accepted result immediately, and starts network publication after the scene can paint. The 8-second harvest watchdog is a timeout recovery path, not an 8-second delay imposed on successful work. The 140 ms player-state publication cadence does not defer local gameplay state. These boundaries are retained rather than replaced with optimistic resource awards.

The worker handoff did duplicate unchanged world data. It cloned the whole input on the main thread and again into the worker, returned the whole world, and prepared transferred construction evidence again before showing the harvest result. The local worker now returns field and proof-table deltas against that request's captured base. The main thread snapshots mutable maps while retaining private, deeply frozen proof rows. Unchanged rows keep their exact identities and verifier/geometry caches; new, removed or changed rows are transmitted normally. Changed bytes under an identical claimed head are still rejected by ordinary verification. Out-of-order replies use their own captured world, and worker failure recovery retains the same durable command identity.

Received-proof preparation skips previously prepared, exactly unchanged component/contribution rows without another timer or geometry pass. Changed rows still take the ordinary yielding preparation path. No cache is keyed by an ID or claimed digest alone; freezing does not grant authority. External snapshots and newly accepted source actions still undergo their required validation. Main-thread work is reduced, not guaranteed absent under every load.

Run `node scripts/benchmark-world-worker-transfer.mjs` after compiling tests. The synthetic world contains 1,000 valid construction components and executes an actual material-harvest source transition. Six paired runs discard the first warm-up; every accepted result is deep-equal. Median handoff/source/preparation time was **1,163.37 → 296.93 ms**, and the reply fell from **2,813,647 → 17,545 bytes**. This uses structured clones to simulate message boundaries and a no-op persistence sink. It excludes real worker transit, IndexedDB, GPU, browser scheduling and phone performance; source execution runs in the worker in production and these numbers are not a main-thread frame time or live-device harvest duration.

Battle, raid, arena, construction-progress and Hearttree health/state meters no longer add 160–450 ms of CSS easing after an accepted value changes. The D-pad knob also has no 45 ms transform trail. Creature battle and locomotion pose changes snap to their accepted pose on their first frame; continuing breath, impact, swim and wing animation retains its original cadence and blend.

The existing capture animation sequence (1,050/1,250/700 ms), regeneration/Kai timing, physical travel, cooldowns, and remote interpolation remain authored gameplay/presentation behavior. Capture sealing is still sequenced after the capsule phase. Roaming battles still require server responses and owner acknowledgement; polling can add time to remotely initiated changes. Required fresh source checks, hardware/display time and those network paths cannot be declared latency-free by this patch. They remain explicit limits to the requested universal zero-latency guarantee.

An additional CPU probe ran the actual ambient instance writer over the same 80 birds/fish for 10,000 frames after warm-up: approximately .056 ms/frame before and .077 ms/frame after the habitat fix. This covers transform writes with a substituted site lookup; it excludes actual terrain-site lookup cost, GPU shading/rendering, other fauna systems, and phone hardware. It does not establish that every animal subsystem is inexpensive or that animals cannot contribute to a GPU-bound frame.

## Underwater wildlife

Aerial routes used `terrain.elevation + altitude`, allowing birds to fly below the water surface over deep seabeds. Route generation now uses the higher of land and the water surface, and runtime formation positions also enforce surface clearance.

Aquatic wildlife now uses a shared anatomical fish mesh: tapered silver body, darker back, pale belly, scale shading, eyes, gill cover, dorsal/anal/paired fins, and a vertical forked tail. GPU deformation produces lateral body/tail waves and adjusts the normals for lighting. The school remains one instanced draw, and the birds remain a separate instanced draw. Fish geometry has 611 triangles; bird geometry has 349. No additional per-fish meshes, texture downloads, or per-frame swim buffer uploads are required.

Aquatic paths carry the already sampled seabed height. Formation placement clamps fish between that floor and the water surface, shrinking their display size in very shallow water. Quality population caps and deterministic identity are retained. Reduced motion freezes both paths and articulation. Geometry/material cleanup is tested.

`/test-fixtures/ambient-life` is development-only unless `WILDZ_ENABLE_TEST_FIXTURES=1` explicitly enables it. It renders the real projected school and provides a close anatomy view; it does not alter user gameplay data.

## Mansion placement rejection

The supplied screenshot reports `creation_world_canonical_overlap`. It also reports timber needed 39 and available 50, so its displayed material budget is sufficient. The error means the full footprint intersects canonical terrain/discovery/world geometry. The screenshot does not identify the exact conflicting object.

The builder preview had only its supplied visible physical chunks. Final source admission additionally checked terrain tiles and discovery neighborhoods over **every compiled chunk**, which can catch an obstacle in a distant wing of a large design. The collision law correctly rejected that placement, but the preview did not explain or predict the rejection.

The world controller now exposes a read-only full-footprint validator. Preview qualification and Build use the same canonical/admitted-overlap checks as source admission. The source checks remain enforced, with their original ordering relative to ownership, materials, reach, and evolution checks. No collision authority is bypassed and no proof rule head changes.

Blocked previews retain the complete plan, definition, placement, crew and allocation. The panel translates the raw overlap code into a clear placement explanation and offers **Move full draft**, with instructions to tap clear ground and retry. An overlap no longer suggests an affordable section as the remedy. A unit integration test moves the complete blocked draft, recompiles it without another planner request, and builds exactly once after the placement becomes clear. A source integration test finds a canonical tree in an offset wing 40 m from the origin despite empty supplied physical chunks, without spending resources.

The user's live mansion was not placed or moved in this session. Use the full draft's placement controls at a clear nearby site after deploying this change; the ordinary build reach and resource requirements still apply.

## Verification

- Full regression suite: 3,557 passed, 0 failed, 1 existing skip (3,558 tests).
- Updated worker handoff/recovery/immutability tests: 19 passed, 0 failed, including real prepare-and-persist through the delta protocol.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with the two existing warnings in `BuildGuidanceBrowserFixture.tsx` and `WildsStewardEnvironment.tsx`.
- `WILDZ_ENABLE_TEST_FIXTURES=1 pnpm build`: production build passed. Existing dependency/circular chunk warnings remain.
- `git diff --check`: passed.

New behavioral tests execute actual component/input handlers with real transforms. Coverage includes first-frame local movement, flight/swim height, camera heading publication, underwater targeting, ground/portal resets, combat positions and shake, delayed RAF cadence, gesture ownership/cancellation, wildlife habitat boundaries, shared GPU resources, reduced motion, and full-footprint placement/retry. Obsolete source regex expectations for intentional damping were replaced with behavioral coverage. A cosmetic source guard was corrected to stop matching the substring `ring` inside the module name `rendering`.

Browser checks used a production build:

- World scene and camera orbit rendered at desktop and 390×844 mobile dimensions. Mobile had no horizontal overflow and retained its selected DPR of 1.25 (487×1055 backing canvas); desktop used DPR 1.5.
- The actual projected underwater fish school, close anatomy, and reduced-motion control rendered without captured shader/console errors.
- The explicitly gated `/test-fixtures/world-worker` exercised the rebuilt real browser worker, source execution and device persistence with a separate synthetic world. One timber lot was admitted, all 64 unchanged component rows retained their identities, the scene produced 25 frames during the worker operation, and the actor moved to x=0.5. No console warning/error was captured. This establishes independent scene progress during that sample; it is not a device-wide frame-time guarantee.
- The rebuilt roaming-battle fixture resolved an actual combat-kernel turn to 99/111 and 7/55 HP. Both bars had computed transition duration `0s`, and their drawn widths matched the accepted ratios within subpixel rounding. No console warning/error was captured. The fixture simulates request/capture delays and never changes native ownership; those simulation delays are not measurements of production network latency. This fixture now accepts the same explicit `WILDZ_ENABLE_TEST_FIXTURES=1` flag while remaining inaccessible in ordinary production builds.
- The isolated placement fixture used synthetic finite resources through the real world queue, physical worker and scene. It admitted/rendered one home, spent 7 of 20 timber, allowed walking through its doorway, blocked diagonal travel through the wall, and retained 13 carried/7 spent after reload. This fixture does not represent the user's mansion.
- Local authenticated wallet requests lacked the configured Receiz application authority; no live wallet transaction was attempted. The local PWA origin also served its offline fallback for the new fixture path after a rebuild; a fresh localhost origin verified the new route. These local environment limitations are separate from rendering checks.

Screenshots:

- `output/playwright/motion-latency-mobile.jpg`
- `output/playwright/ambient-fish-detail.jpg`
- `output/playwright/ambient-fish-school.jpg`
- `output/playwright/creation-placement-check.jpg`
- `output/playwright/world-worker-gameplay.jpg`
- `output/playwright/battle-health-check.jpg`

## Debug/profile reference ledger

All applicable references were read and used:

| Read | Reference | Applied checks |
| --- | --- | --- |
| Yes | `threejs-debug-profiler/references/debug-profile-checklists.md` | Reproduction, console errors, canvas sizing, frame/physics ordering, source ownership, visual verification |
| Yes | `threejs-debug-profiler/references/checklists/performance-profile.md` | Correct build mode, CPU measurements, shared instance budgets, preserved visuals and quality |
| Yes | `threejs-debug-profiler/references/checklists/scene-debugging.md` | Camera/transforms, floating origin, geometry/shader output, resource lifetime |
| Yes | `threejs-debug-profiler/references/checklists/mobile-input.md` | Pointer ownership, first movement, outside release/cancellation, bounded repeat cadence, mobile viewport |

Paths above are relative to `/Users/bjklock/.codex/skills/`. Prompt-template references were not applicable because no reusable prompt/template was requested.
