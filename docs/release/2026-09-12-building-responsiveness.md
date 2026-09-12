# Building responsiveness

## Root causes and changes

Every immediate construction command restored the persisted world source before admission. Project creation followed by placement did this twice. Startup recovery and early construction now share one session-scoped promise; later commands use the admitted queue already in memory. Failed recovery is retryable and a different identity gets a separate recovery. Background refresh and publication remain active. Commands still validate and persist locally before success: this change does not fabricate completed work or skip material custody.

World meshes previously intercepted selection only in explicit inspection mode. Normal building now intercepts taps on existing pieces even while an admission is pending. A newly placed plan switches to inspection with the material and work controls; another ground tap does not place a duplicate. Choosing another piece explicitly resumes placement. Selected plans reopen a minimized tray, and existing missing-material explanations remain visible next to the relevant controls.

## Validation

- 2,362 tests passed. New tests cover shared startup/early action recovery, 100 subsequent actions with no additional recovery, retry after failure, and independent sessions.
- Targeted ESLint: clean.
- No geometry, texture, lighting, frame callbacks, SDK semantics, or network endpoints changed.
- Structural work reduction: one restore per construction command becomes zero after session recovery. This is not a measured millisecond or FPS guarantee.

## Reference ledger

Read: threejs-debug-profiler/SKILL.md, references/debug-profile-checklists.md, references/checklists/mobile-input.md, references/checklists/scene-debugging.md, references/checklists/performance-profile.md.

## Limits

Local durable admission still takes nonzero time. Global publication may take longer and continues in the background. This pass addresses redundant recovery and incorrect tap routing; it does not establish zero latency on real iPhones or a 10/10 realism grade.

## Final scope

The initially interrupted building work was backed up, then restored when the user confirmed it belongs in this task. Nothing was discarded.

Compact mobile CSS no longer hides material requirements or blocked-action explanations. A production browser check before the final tree pass measured 132 ms from placement click to the material controls becoming available, using desktop Chrome at 390 × 844. This is a single observation, not a mobile-device percentile or a zero-latency guarantee.

Trees now use broad, upright and tiered growth habits with location-stable height variation. The same four instanced tree batches and existing geometry, texture and animation resources are reused. Connected-crown and rooted-stump tests pass, including all depletion states. No imported hero model, terrain mesh, or lighting upgrade is claimed in this pass.

Asset-source review: read threejs-aaa-graphics-builder, its visual-scorecard, implementation-blueprint, model-recipes, render-recipes, AAA quality and visual gate checklists; read threejs-3d-generator and threejs-image-generator. The director credential probe emitted `TRIPO_API_KEY=`, `GEMINI_API_KEY=`, and `ELEVENLABS_API_KEY=` (this installed probe prints blank instead of MISSING). No provider key was available from that probe. Existing generated forest-floor texture remains in use; tree instances are procedural. This limited pass does not pass the premium/showcase gate and does not establish 10/10 realism. Character anatomy, finer authored vegetation, terrain surfaces and lighting remain material gaps.

## Final verification results

- Full final suite: **2,363 passed**, zero failed. Production build passed; targeted ESLint clean. Existing unrelated fixture-image/steward hook and SDK bundler warnings remain.
- Production Chrome, 390 × 844: placement to material controls **128 ms**; missing-material explanation visible; no page errors. Screenshot: `/tmp/wildz-building-mobile.png`.
- Same isolated session resized to 1280 × 800: screenshot `/tmp/wildz-realism-desktop.png`. Native WebGL instrumentation over 120 animation frames measured **171.1 draw calls/frame**, **111,648.9 triangles/frame**, **16.67 ms p95 frame interval**. Instrumentation lives only in the temporary browser script. These are post-change observations, not a controlled before/after comparison or real-iPhone performance guarantee.
- Duplicate placement prevention is covered by the selection/inspection regression contract. The first scripted repeated screen-coordinate click hit the resized tray; that attempt is not counted as a successful world-mesh retap test.
- Material deposit and funded work transitions are covered by the construction tests. The browser scenario used an empty satchel and did not measure a funded deposit/work transaction.

Visual scorecard (0–3, before / after): art direction 2/2; hero 1/1; enemies 1/1; interactables 1/1; environment 1/1; materials 2/2; lighting 2/2; VFX 2/2; HUD 2/2; performance evidence 2/2. Average 1.6/3. Tree variation improves one surface but does not remove the primitive-dominant scene, coarse terrain, or character-detail gaps. Overall photorealism remains about 4/10. A larger authored model/material pass and real-device interaction measurements remain necessary.
