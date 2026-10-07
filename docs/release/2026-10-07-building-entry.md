# Building entry, camera and global map — 2026-10-07

The subsequent [free zoom and construction follow-up](2026-10-07-building-free-zoom.md) supersedes the ground-building camera retraction described below and adds movement, mansion and crew-selection fixes.

Repeatedly hashing and reconstructing a home's bed definition while checking whether Sleep was available added measurable CPU work near buildings. Room page bounds also admitted out-of-reach beds into that expensive path. The selector now rejects against the admitted mattress footprint first and reuses a validated source only while its immutable instance, definition and admitted projection remain current. Replacement, access, occupancy and damage checks remain enforced. Settled scene pages no longer publish unchanged residency snapshots on every movement update, and completed upload queues skip idle painting work.

The ground camera can zoom to 0.45 units. Cached creation solids and manual construction obstacles constrain the camera ray against walls, floors and roofs while preserving doorway openings. OrbitControls owns a stable desired-camera clone, so collision retraction cannot discard synchronous wheel, pinch or rotation input. The rendered camera uses the rendered floor elevation and can retract inside buildings. Queries are bounded to 64 cells and 4,096 candidates. Existing discovery-site and flight camera rules remain in effect.

Map markers now include durable `world.creations` records as well as manual building projects. Prompt buildings use saved world poses and readable names. Prompt creations, completed structures and construction sites remain visible across atlas zooms, and Fit includes distant structures. Natural terrain and player exploration rules remain in effect. The existing construction publication transports creation checkpoints to the shared world snapshot; pending/offline/conflicted publication remains local until that transport succeeds. Live independent-client publication was not performed during this fix.

## Measured CPU bottleneck

`node scripts/benchmark-creation-entry.mjs` exercises real compilation, current-source admission, physical projection and bedside selection for an immutable 128-node synthetic home. Each result contains 15 samples of 100 checks. These are Node CPU timings, not browser FPS or a device-wide zero-latency claim.

| Scenario | Before median / p95 | After median / p95 |
| --- | --- | --- |
| Beside bed | 7.018 / 7.827 ms | 0.0148 / 0.0793 ms |

The repeated resident-selection regression also changes from 120 snapshot publications to zero for 120 movement updates that select the same settled pages. A separate test proves that approaching a doorway does not read the distant bed definition even when bed and room share a page.

## Validation

- `pnpm test`: 3,378 tests; 3,377 passed, one existing skip, zero failures.
- `pnpm typecheck`: passed after the final runtime changes.
- `pnpm lint`: zero errors, two existing warnings in BuildGuidanceBrowserFixture and WildsStewardEnvironment. Final changed camera/fixture/bed files also pass scoped ESLint.
- `git diff --check`: passed.
- Review caught occupied-public-bed source reuse and loss of controls input during camera retraction. Both received reproducing tests and fixes; final independent review found no further actionable regression.
- Real installed OrbitControls regressions verify wheel, two-pointer pinch, mouse rotation with damping and vista restoration. Collision tests cover prompt doorway openings, manual boxes/cylinders, translated and rotated solids, roof/floor constraints and bounded queries.
- Browser at `/test-fixtures/creation-placement`: built with synthetic finite resources through real admission and physical worker; admitted and rendered collision counts both one. Walked from z=-3.5 to z=0 through doorway, floor changed by 0.10. Wall orbit retracted to local (1.42, 1.40, 0). Inward wheel while clipped was retained after exit: desired x=6.00 became x=5.70. Saved-world reload restored one admitted/rendered home and doorway traversal passed again. Fresh browser error log empty. Canvas CSS 1280×720; drawing buffer 2560×1440. This isolated fixture does not publish a user's world.
- Interior screenshot: `/private/tmp/wildz-building-interior.jpg`.
- `pnpm build`: passed. Existing circular chunk and SDK web-worker dependency warnings remain, alongside the two lint warnings.
- Production preview: served root HTTP 200 with the Wildz title; development fixture returned 404. Reused port 3107 displayed cached Receiz content in the browser despite the server returning Wildz. Preview moved to an OS-selected fresh port, `http://127.0.0.1:50503/`, and the browser displayed the correct Wildz application. The 3D world loaded, the world atlas opened and closed, and browser error logs were empty. No browser storage or service-worker registrations were cleared. Preview remains in managed session 26820. Changes have not been pushed or deployed.

## Reference ledger

Read from `/Users/bjklock/.codex/skills/threejs-debug-profiler/`:

- Yes: `references/debug-profile-checklists.md`.
- Yes: `references/checklists/scene-debugging.md`.
- Yes: `references/checklists/performance-profile.md`.
- Yes: `references/checklists/mobile-input.md`.

Checklist work covered collision ownership, world/local transforms, camera/control frame order, current source invalidation, resident upload work, nonblank browser rendering, console errors and saved-world replay. Wheel behavior is checked with installed OrbitControls; no real-phone pinch performance claim is made. Existing geometry, textures, renderer quality and materials are retained. Browser GPU/frame-time, draw-call, texture-memory and bundle baselines were not collected because the measured change is in CPU source validation and residency, not a renderer upgrade.
