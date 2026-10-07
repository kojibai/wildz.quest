# Bed reload and discovery variety — 2026-10-07

## Reproduced failure and repair

A synthetic finite-resource home was admitted through the normal world controller and physical worker. A player asleep in its real admitted bed was serialized, restored, and opened in the full campaign. This reproduced `creature_history_kai_regression`: startup reconciliation could queue an automatic wake before the physical bed had restored, using a pulse captured before a queued energy settlement. Outdoor state restoration also replaced the saved constructed floor height with terrain height.

Bed reconciliation now waits for the relevant world and creation sources, rechecks the current marker, head, footprint and actor access inside the state updater, and reads the clock when that updater executes. Future saved checkpoints wait for clock catch-up. A valid admitted supporting floor repairs only the saved vertical position. No save reset or chronology validation bypass is involved.

Wake also verifies clearance using the resident navigation or the controller's prepared snapshot. Feet already clear on the room floor stay there; feet intersecting the mattress stand on its admitted top when there is headroom. The browser check reopened the sleeping state, woke, stepped off the mattress, crossed the room and exited the doorway, with zero console errors. The user's original device stack was not captured; this is a reproduced matching saved-bed scenario.

During fixture remounts, a separate audio lifecycle race reproduced `Cannot read properties of null (reading 'decodeAudioData')`. Pending fetch/decode now retains and checks its audio context and cancels after destruction. Live load errors still propagate.

## Discovery changes

- Mountain waterfalls use animated falling sheets, froth, pool ripples and seeded rock chutes along the existing hydraulic source/lip/pool paths.
- Sparse dry ruin sites receive stone inscription arches with scans, compass sight monuments with an optional panoramic view, or prism rings with a three-color light sequence and rendered crystal colors.
- Names, lore, dimensions, palette, detail and puzzle order vary by world seed. Placement is stable under partial streaming and capped at one selected ruin per 2×2 region block.
- Waterfall columns no longer act like a flat water surface at their source height. Actual pools and flooded interiors retain swimming and buoyancy.

Canonical site IDs, entrance anchors, portals, water volumes, mountain fields and route definitions are preserved. Shared part descriptions supply matching visual and physical solids. Monuments add local presentation/interactions through existing scans; they do not manufacture canonical rewards.

## Performance and verification

Waterfalls retain two draws and use 54–64 triangles instead of the previous 80. Monuments use at most three draws, at most two visible monuments within 72m, and lower detail outside 34m. Shared materials, a single time uniform, cached physical composition and prepared spatial queries avoid geometry/index work per frame. Geometry and materials are disposed on replacement/unmount.

The full browser comparison at player (-353.272565, -89.860666), 1248×484 CSS pixels, DPR 1.5, high quality measured 119 draws / 182,942 triangles before and 121 draws / 182,982 triangles after. Textures stayed at 16; geometries changed from 95 to 96. The scene already exceeded its 180,000 triangle target before this change. These are render-cost measurements, not a phone frame-time guarantee.

The prepared physics benchmark (`node scripts/benchmark-discovery-variety.mjs`, after `pnpm test`) exercised three queries per frame for 30,000 frames in both scenarios. Natural physics had 83 solids, median 0.004350541ms and p95 0.004544083ms; varied physics had 102 solids, median 0.004371333ms and p95 0.004559750ms. Both produced zero runtime or index builds during measured frames. This Node CPU measurement does not cover mobile GPU/frame pacing.

Final verification:

- `pnpm test`: 3,432 passed, one existing skip, zero failures (3,433 total).
- `pnpm typecheck`: passed.
- `pnpm lint`: zero errors; two existing warnings in BuildGuidanceBrowserFixture and WildsStewardEnvironment.
- `pnpm build`: passed, with existing SDK webpack dependency/circular-chunk warnings and the same two lint warnings.
- Built app started normally in the browser with zero startup console errors. Both new development fixture routes returned the production 404 page.
- Independent review verified ordinary and ability-route clearance across 625 canonical regions (30 selected monuments, 28,809 checks), matching visual/physical support dimensions, bounded rendering, disposal and authenticated bed recovery.
- `git diff --check`: passed.

Browser fixtures are development-only and use dedicated synthetic owners/storage keys. This change is committed locally; it has not been pushed or deployed.

Retained browser evidence:

- [Restored sleeping player](evidence/2026-10-07-bed-monuments/bed-reload.jpg)
- [Doorway exit after waking](evidence/2026-10-07-bed-monuments/bed-walkout.jpg)
- [Waterfall scene](evidence/2026-10-07-bed-monuments/waterfall.jpg)
- [Stone inscription arch](evidence/2026-10-07-bed-monuments/stone-arch.jpg)
- [Aligned prism experience](evidence/2026-10-07-bed-monuments/prism.jpg)

The same-location baseline screenshot is `/private/tmp/wildz-waterfall-before.jpg`; raw final check logs and measurements are in `/private/tmp/wildz-current-final-*`.
