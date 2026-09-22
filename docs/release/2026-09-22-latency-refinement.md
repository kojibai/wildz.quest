# Loading and frame-work refinement

This pass preserves world detail and game rules while removing repeated work.

## Changes

- `WildzApp`: Profile now uses its existing dynamic import loader. Optional Profile/Vault and card-art warm-up starts only after the first world draw; overlay warm-ups yield separately. Explicitly opening an overlay still requests its module immediately. Market retains its eager import; its redundant warm-up import was removed.
- `WildsEnvironment` / `wilds-resource-placements`: retain tree and rock placement arrays when capacity and work-animation inputs are unchanged. Kai updates still evaluate resource availability, including regeneration. Actual harvesting, work restarts and streamed obstacle changes update the affected transforms.
- `wilds-ordered-spatial-index`: reuse the previous ordered candidate array while the query covers the same cells. Exact collision checks still use the current position, and invalid/oversized queries retain their original full-list fallback.
- `wilds-grounded-movement`: reuse an already computed terrain sample only when the next sample coordinates are exactly equal.

## Evidence

- Baseline suite: 2,698 tests passed. Updated suite: 2,702 passed, zero failures or skips.
- Full lint: zero errors; two existing warnings in untouched BuildGuidanceBrowserFixture and WildsStewardEnvironment.
- Production build passed (Next 15.5.19), including type checking. Build also reports SDK dynamic-dependency and circular-chunk warnings.
- Isolated original/current comparison: 3,000 movement results matched exactly across walking, traversal and flight.
- Resource benchmark: 49 trees and 41 rocks, 1,000 unchanged snapshots, 237,000 redundant instance writes reduced to zero. Final isolated median projection time: 0.1140 ms to 0.0297 ms.
- Movement benchmark: 15 warmed batches of 2,000 calls; final spatial candidate query median 0.001823 ms to 0.000111 ms, ordinary ground movement median 0.010894 ms to 0.006715 ms.
- Chrome production smoke check: world renders with scenery and companion; camera drag changes view; walking updates map coordinates; Profile, Card Vault and the final eager Market open and return to gameplay. Market displayed its empty-list state and recorded a 21 ms open span. No application console errors observed during these checks.

Reproduce after `pnpm test`:

```sh
node scripts/benchmark-resource-placements.mjs
node scripts/benchmark-movement-hot-paths.mjs
```

These are synthetic CPU measurements, not browser FPS or proof that all hardware-specific hitches are eliminated. The resource benchmark embeds the original projection for comparison; the movement benchmark accepts a compiled build directory for comparing revisions. Avoid timing while builds or other CPU-heavy work are running.

No matched cold-start timing or renderer/GPU metrics were collected. The preexisting production output was not a verified build of the baseline revision, so its browser timings are not presented as a before/after comparison. The in-app WebKit browser failed local identity preparation with “Internal error”; Chrome reached gameplay successfully. Real-device sustained movement profiling remains the check for residual hitches.

Market splitting was tested and rolled back after its production panel remained empty; the final patch preserves the original eager Market behavior rather than shipping that regression.

The final mixed startup/overlay recording contained 5,127 visible frames, nine intervals over 50 ms, a 742 ms worst interval, and a recent p95 of 10 ms. This includes initial loading and opening the creature-card/Market surfaces and is not a movement-only measurement or evidence of zero hitches.

After resetting the recorder following warm-up, repeated camera drags and directional walking plus idle time produced 6,036 visible frames, recent p95 10 ms, zero main-thread tasks over 50 ms, and one 458 ms frame interval. That remaining interval is unattributed; this pass does not claim all hitches eliminated. The original recording preference was restored to off.

## Profiling reference ledger

Read and applied (no skipped references):

- `threejs-debug-profiler/references/debug-profile-checklists.md`
- `threejs-debug-profiler/references/checklists/performance-profile.md`
- `threejs-debug-profiler/references/checklists/scene-debugging.md`

Checklist focus: production build, first draw, frame allocations, instance-buffer invalidation, collision ownership, exact behavior comparison, and browser console/visual smoke checks. No quality, DPR, shadow, physics rate, or scene-detail reductions.
