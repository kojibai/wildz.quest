# Tree continuity and cave rendering

## Changes

Exhausted timber previously retained 24% crown scale. Its trunk shrank about a fixed center and the three crowns retained separate height anchors. Exhaustion now leaves only a rooted stump; all depletion stages use connected tree proportions. Leaf bases extend inside the solid crown. Active harvest motion shares a ground pivot, and exhausted trees stop reacting.

Cave camera obstruction previously constrained only height. The rendered camera now retracts against the existing indexed floors, walls and ceilings, retaining the desired orbit so distance recovers when unobstructed. The sweep runs only inside and reuses its output; it does not construct authority or spatial indexes during frames.

Underground scenes omit the celestial sky, sun, daylight fill and weather geometry. The existing personal lantern respects its saved equip/stow setting. Creature light remains tied to the existing active light capability. The two nearest functional built lamps/hearths within nine meters provide local illumination without additional shadow maps. The selection is a bounded linear pass over already visible construction pieces; planned pieces do not emit light.

Entrance rings now have a textured rock silhouette, and interior exit markers use the interior floor. The exit proximity check likewise compares interior height instead of exterior elevation. Cave surfaces receive deterministic relief and sediment shading within their existing surface batches.

## Verification

- Full suite: 2,360 passing tests, including depleted crown removal, grounded transforms, connected leaf roots, mission and wallet regressions, cave orbit bounds, portal round trips and lantern state.
- Production build and targeted ESLint passed. Existing unrelated build warnings remain.
- Final production Chrome check at 390×844: loaded an isolated synthetic save at an admitted cave portal, used Stow lantern, exited through Return outside, and reentered through Enter cave. Both space transitions succeeded and the stowed-lantern screenshot was dark. No page errors. Initial test setup used a reload to seed the fixture; cave controls themselves used in-place state transitions.
- Earlier isolated tree before/after renders: 13 calls and 1,202 triangles in both; same geometry budget, no added texture or light.
- Earlier full-game desktop/mobile tree comparison: p95 frame interval 16.67 ms before and after; no page/shader errors or horizontal overflow. Dynamic scene draws varied from 125.78 to 124.96 mobile and 195.16 to 194.40 desktop.
- Prepared cave-camera sweep benchmark: 10,000 samples after warmup, p95 approximately 0.00425 ms on this host. This is a CPU microbenchmark, not an iPhone frame-time guarantee.

## Limits and visual assessment

The result remains stylized, not photorealistic. Based on the inspected mobile game scene, visual realism is approximately 4/10 against real-world appearance; art coherence is approximately 7/10. Repeated vegetation silhouettes, coarse surface scale and limited contact lighting remain the main visual gaps. Local lamps intentionally do not add shadow maps; this is not a physically complete light-transport model. A functional hearth emits light; this change does not add a separate fuel-burning simulation.

## Reference ledger

Used the Three.js debug-profiler skill and its `references/debug-profile-checklists.md`, `references/checklists/scene-debugging.md`, and `references/checklists/performance-profile.md`: all read and applied. Checks covered transforms, camera bounds, scene lighting, source geometry, browser errors, fixed rendering budgets and before/after visuals.
