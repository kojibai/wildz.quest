# Creation worker deployment and exploration regression

## Why Build stopped working

Commit `a76ff3dd82394dd0f4fa5f479a2dcf91b1b40281` added the landscape-clearing import from `creation/ground-placement.ts` to `wilds-build-scenery.ts`. That module imports construction geometry, expanding the compiler worker's shared dependency graph.

The deployed compiler entry loaded, but its `importScripts()` dependency URLs omitted the deployment query used by the page. Shared chunk requests returned HTTP 404; the same files returned HTTP 200 with the opened page's `?dpl=` value. A real browser worker failed before handling a compilation request. Opening a saved draft or selecting an existing object invokes that compiler, explaining failures without a new prompt. Local builds without deployment routing did not expose this failure.

`scripts/worker-deployment-plugin.mjs` now binds Webpack's final script URLs to the opened deployment. Worker entries and their imported dependencies carry the same deployment ID. The original Trusted Types conversion remains in place. The query is added after Next's filename encoding, avoiding an encoded question mark in the filename. Builds without a deployment ID retain ordinary local URLs. Landscape features and background compilation remain intact.

The Build panel now places conversation replies, construction costs and status in one scrolling response box. The fixture planner uses the requesting actor's ID, so fixture ownership matches the session.

## Verification

`pnpm release:check` passed: 4,372 tests passed, zero failed, one existing skip; architecture lock, type checking, Receiz integration/conformance, lint, secret scan, production build and local doctor completed. SDK, MCP and AI skills remain at 128.0.0.

A Chrome production-browser probe deliberately rejected untagged worker chunk requests. Both the compiler and proposal workers loaded with the required deployment query and reported no worker startup errors. The compiler produced a ready mesh with 864 position values. The proposal worker returned its expected unavailable response because the isolated browser had no live planner authorization; this is not a live AI-generation qualification.

Using the actual production CreationSession and compiler worker, synthetic fixtures successfully compiled a new room, reopened its saved draft, selected an existing object and compiled an expansion. An unchanged existing object returned its expected `creation_evolution_unchanged` validation response rather than a startup failure. The panel contained one `Creation response` region; its reply, material quote and status shared one visible box. No construction was admitted to a live account.

## Exploration changes already in `49cdf68`

The scenery clearance index was reconstructed for every query because the render projection supplied a mutable array. The projection now creates an immutable owned copy and reuses its index. For 120 pads and eight batches of 4,000 queries, index builds fell from 32,000 to one; observed batch times fell from approximately 76–86 ms to 2.17–4.36 ms, with 6,648 matching hits before and after.

Historical retired scenery no longer forces a dense terrain mesh. A synthetic retired-scenery sample fell from 11,761 to 2,401 ground vertices and from 42,624 to 7,056 water vertices. Active buildings and retained positive laydown still receive grading. Trade requests now let the buyer enter the requested creature's name.

These CPU and geometry measurements do not establish zero latency on every device. The final production Chrome run, with synthetic local identity enabled, recorded:

| Scenario | Frames | Median / p95 | Maximum | Long tasks |
| --- | ---: | ---: | ---: | ---: |
| 30 seconds walking across a terrain region | 1,792 | 16.67 / 16.67 ms | 149.99 ms | 0 |
| 30 seconds ground movement after a camera turn | 1,806 | 16.67 / 16.67 ms | 66.66 ms | 1, 51 ms |
| 20 seconds confirmed active flight across a terrain region | 1,201 | 16.67 / 16.67 ms | 16.67 ms | 0 |

The ground samples retain isolated frame gaps; they do not support a freeze-free claim. The camera-turn sample begins after retrieving the renderer through its existing root, which also schedules the same scene again. The flight sample was taken after this instrumentation settled. Flight moved from approximately (5,027, 5,015) to (5,173, 5,095), and the live control reported flight energy falling from 80% to 45%. Its final renderer reported 67 draw calls, 189,257 triangles, 85 geometries, 16 textures and DPR 1.5. The world canvas drawing buffer was 1,920 × 1,080; the minimap uses its own separate canvas. Full browser results are recorded in the adjacent JSON evidence file. Original-account and mobile frame tracing remain unverified.

## Qualification limits

Production deployment verification after rollout remains outstanding. The isolated local identity fixture receives expected HTTP 401 responses from live Wallet endpoints and exercises no financial operations. Local doctor reports live API, checkout and webhooks as `needs-env`. Market publication remains a Profile-style signed advertisement; native purchase reservations and credit-card checkout are not qualified or completed by this worker fix. No Receiz server, database or package was changed.

## Profiler reference ledger

All required references were read: `threejs-debug-profiler/references/debug-profile-checklists.md`, `references/checklists/scene-debugging.md` and `references/checklists/performance-profile.md`. Checks used: asset/deployment URLs, worker startup, canvas buffer, renderer/loop ownership, scene visibility, input/camera operation, geometry pressure, frame intervals and long tasks. Mobile-input and reusable-prompt references were not applicable to this desktop diagnosis.
