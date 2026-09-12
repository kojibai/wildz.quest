# Six pillars: implementation and evidence

The six pillars remain the product scope. This ledger distinguishes implemented behavior from outcomes still requiring measurement or real players.

| Pillar | Implemented behavior | Remaining acceptance evidence |
| --- | --- | --- |
| Excellent interactions | Earlier worker admission/export and proof caching; cancellable card-publication retry recovery; this pass adds action timing, visible sync failures and manual retry, and defers offscreen profile card previews. | Repeat cold/warm profile, market, harvesting, placement and save measurements on the restored account and touch devices. No universal freeze-free claim. |
| Companionship | Portable owner-scoped memories; recorded first-meeting directions; contextual recollections at shared places; companion-specific route suggestions; owned companions near home. | Observe whether players notice and value these interactions. No invented feelings or fabricated history. |
| Clear next step | Resource/build prerequisites, unfinished shelter guidance, reachable discovery selection, one route's requirements, directions home before adding home facilities. | Watch uncoached new players choose and complete a goal. |
| Meaningful exploration | Twelve authored site premises/objectives, ability-aware approach and route guidance, alternative routes, shared discovery memories. | Sustained playtesting of variety and encounter value; no claim of unlimited authored content. |
| Useful building | Shelters support rest, nearby workbenches/cache activities, companion selection and nearby residents. Facilities count as part of home only within its existing 24 m neighborhood. | More social reasons to visit and real-player observation of home use. |
| Sustained playtesting | Opt-in browser-local frame/task timeline, specific profile/market/save action spans, temporal overlap and p95 summaries, repeatable human observation guide. | Real participant sessions, return visits, retention and delight evidence. Automated testing is not human research. |

## Live observations

- The supplied `wilds:995b23f1dc419641683e5624` standalone page resolved to the rendered, verified Moukaul card during this pass.
- The restored bjklock account became available in the browser with 34 cards. Its owner profile still reported local storage/automatic retry, while its public profile remained unavailable at the last check. Public status is not inferred from local proof validity.
- A short one-card live profile check showed recent frame-gap p95 of 9 ms, two frame gaps over 50 ms, and one long task. This includes surrounding activity and is not a controlled before/after performance result or GPU measurement.
- The 34-card owner profile eagerly rendered all full card thumbnails. Visibility-deferred previews target that observed opening cost; first previews and all card buttons remain available.

## Browser and regression checks

The development-only home fixture uses explicitly synthetic journal data and existing valid preview creatures. Companion meeting and discovery buttons changed its status correctly. Desktop and 390 × 844 layouts were visually checked; text wrapped and controls stayed usable. Browser console reported no errors for this fixture. This is viewport verification, not physical-device testing.

The 34-tile synthetic profile fixture initially mounted four previews near the browser viewport and deferred 30. Scrolling to the last tile mounted its preview and opened companion 34 successfully (eight previews mounted cumulatively, 26 still deferred); browser console errors were empty. The render regression separately confirms only the first two children render before visibility observation.

An independent review caught and corrected guidance that allowed a home-directed build far from its shelter and outdoor meeting directions computed from indoor coordinates.

Integrated verification: `pnpm test` passed all 2,275 tests (208 suites); the production `pnpm build` passed; targeted ESLint passed; architecture lock passed (660 runtime files); secret scan passed (1,369 text files). Build output retains existing warnings for the development fixture image, the steward environment hook dependency, and the third-party web-worker import. Commit/deployment identities are reported in the task. See [the playtest guide](./local-playtest-guide.md) for marker semantics and human-session protocol.

## Skill and reference ledger

Loaded the game director, gameplay, UI, debug/profile, QA/release, graphics, and 3D/image/audio generator skill files. Gameplay/UI/debug/QA workers read the applicable gameplay-workflows, ui-patterns, UI/readability/responsive checklists, debug-profile-checklists, performance-profile, and QA/release checklists. Systematic debugging and verification-before-completion instructions were read.

This pass changes gameplay guidance, diagnostics and profile presentation; it does not introduce a graphics, generated-asset, audio, or physics phase. Existing creature art and audio remain in use. No new asset-generation or AAA visual-quality claim is made. Human playtesting and sustained performance verification remain explicitly open.
