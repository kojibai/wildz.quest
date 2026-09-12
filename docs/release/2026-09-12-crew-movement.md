# Companion movement and crew controls

## Behavior

Owned living companions have a Creature crew tool in the existing command sheet. Follow / recall and Roam nearby preferences survive local restore and are pruned when ownership changes. The panel explicitly limits movement to the active creature and two support companions; other preferences apply when accompanying. Twelve-card pagination bounds panel content.

Follow movement uses the latest player position each frame with allocation-free, collision-checked steps. A bounded detour planner runs only when direct travel is blocked. Updating physical projections does not clear an existing path. Curved-floor correction preserves the movement budget rather than unnecessarily halving speed. Stationary target-floor lookups are cached. Ground movement is conservative about walls, slopes, water, clearance and creature condition; it does not invent capabilities or teleport past obstacles. Existing selected-companion flight/swim accompaniment is retained.

The active creature transform updates before name-label projection, and the camera is finalized before labels. The name label keeps a constant screen size. This addresses the visible separation between a moving label and the creature underneath it.

Roaming choices derive from Kai moment, canonical appearance cadence and proof identity. Explicit Follow/Roam controls append owner-scoped local observations in IndexedDB, preserving per-creature causal order across regressed clocks and competing tabs. These observations are not mandates, world admissions or rewards.

## Scope limits

Gathering, hauling, construction, independently deployed full-vault workers and production mandate execution are not enabled by this change. The panel says so. Local preference/history persistence is not cross-device authority. No live transfer or live mandate was performed.

## Verification

- Full suite: 2,413 tests pass.
- Targeted ESLint passes.
- Continuous moving-target regression covers 600 frames, refreshed collision authorities, bounded speed and newly built walls.
- Existing aerial integration tests pass.
- Final production build passes (existing unrelated lint/package warnings remain).
- Real headless Chrome at390×844:24 successive walking/turning samples had no stationary companion intervals. The label projection error fell from about9.55px during pre-fix movement to less than0.000003px horizontally after the fix; no browser page errors.
- Final sampled idle p95 frame interval16.67ms, matching the earlier browser baseline. Draw counts vary with location and are not a controlled performance comparison. This is desktop Chrome at a mobile viewport, not a physical-phone latency guarantee.
- Browser harness: `/tmp/wildz-label-browser.cjs`; final log `/tmp/wildz-label-final.log`; screenshot `/tmp/wildz-label-moving.png`.

Gameplay skill references used: gameplay-workflows.md, new-game-definition-of-done.md and physics-engine-selection.md. Existing custom canonical collision remains in use; no physics engine or rendering dependency was added.
