# Weather maintenance verification

## Implemented loop

The existing world tick admits bounded `construction.weathered` transitions. The construction inspector can also settle a selected piece through `construction.component.maintain`, using the existing immediate construction outbox, source verification, command receipts and publication path. No new endpoint, SDK substitute, polling interval, animation loop, or render callback was introduced.

Storm samples use the existing deterministic Kai weather field. A window spans 120 Kai pulses (about 10.5 minutes); only closed windows are evaluated, with midpoint sampling. A settlement considers at most the last 24 windows and a world tick selects at most 16 pieces. This deliberately caps offline wear rather than integrating every storm since creation. Selection still inspects the component collection; the 16-piece cap bounds weather evaluation, not total world-index cost.

- Stone-rich recipes reduce wear. Functional/finished roofs above a piece reduce wear while the roof has at least 50% condition. Planned roofs give no protection. Protection uses the current built geometry, not reconstructed historical geometry.
- Integrity cannot fall below 25%. Buildings do not collapse or disappear.
- Below 50%, beds and workshops need repair before use. Storage remains accessible.
- Owners within six metres can spend one available timber or stone lot to restore up to 25 condition. Reserved, stored, already consumed, missing or foreign-custody lots are rejected. Maintenance creates no Phi award.
- Exact predecessor heads and recent ancestry bind condition successors. Existing world checkpoints and event replay preserve the state. Stale remote candidates cannot erase retained condition or repair consumption.
- A repeated inspection in the same window adds no event; retrying an admitted repair cannot consume the lot twice.

This is simulated game-world weather, not observed Earth weather. Production must run the existing authorized world-tick mechanism for automatic settlement. Explicit inspection also settles wear. This pass does not configure deployment or a new scheduler.

## Verification

- Full suite: **2,347 tests, 211 suites, zero failures**.
- Production build and targeted ESLint passed. Existing SDK web-worker and unrelated fixture/hook warnings remain.
- Tests cover weather determinism, bounded catch-up, plans, roofs, damaged-bed gating, repair consumption, idempotency, stale/foreign/distant commands, zero-write failures, checkpoint restore, event replay, immediate outbox admission and unchanged inspection.
- Mobile UI fixture uses the real builder hook, inspector and WorldService: condition **27 → 52**, one timber consumed, rest action enabled, no page errors. Local click to observed state was **65 ms** (includes test-driver overhead, excludes live publication).
- Warmed 24-window calculation, 200 samples on the same verified fixture: p50 **0.027 ms**, p95 **0.129 ms**, maximum **0.261 ms**. This is not a bound for every world size or device.

### Production gameplay comparison

Same saved synthetic profiles, route, keyboard sequence, Chrome/macOS, viewport and drawing-buffer sizes. 180 frame intervals sampled after warmup. WebGL instrumentation counts drawing calls including shadow work; these counters differ from the previous development renderer-info report.

| Viewport | Buffer | p95 before → after | Mean draws before → after |
| --- | --- | --- | --- |
| 390 × 844 | 487 × 1055 | 16.67 → 16.67 ms | 124.95 → 124.77 |
| 1280 × 800 | 1920 × 1200 | 16.67 → 16.67 ms | 194.46 → 194.16 |

No page/shader errors or horizontal overflow. Reported gameplay first-load JavaScript remained **1.34 MB** (rounded Next build output). Small draw-count variations come from the sampled evolving scene; no render optimization is claimed in this slice. No GPU asset, shader, geometry or frame-loop changes were made.

Evidence files from this run: `/tmp/wildz-art-weather-before.json`, `/tmp/wildz-art-weather-after.json`, `/tmp/wildz-maintenance-mobile.png`, `/tmp/wildz-weather-tests.log`, `/tmp/wildz-weather-build.log`.

The comparison found no regression in the sampled gameplay path. It does not establish zero latency, real-iPhone performance, large-world tick latency, or live authenticated publication latency. No real account or material transfer was used.

## Reference ledger

- Read: `threejs-gameplay-systems/SKILL.md` and `references/gameplay-workflows.md`.
- Read: `threejs-debug-profiler/SKILL.md`, `references/debug-profile-checklists.md`, `references/checklists/performance-profile.md`.
- Reviewed repository `ai-skills/wildz-builder-skill/SKILL.md`, installed Receiz 126 SDK World documentation, MCP capability inventory, and existing source append/outbox/constitution boundaries. MCP capability inspection succeeded; it is not authority or proof of an authenticated world publication.
- Physics selection reference: not required for this slice; collision and physical geometry were unchanged.

Timed sleep animation and additional furnishing functions remain separate unfinished work.
