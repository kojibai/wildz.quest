# Creation surface and starter-home increment — 2026-10-06

The intended outcome remains freely composed, realistic, usable creations with source-carried consequences. This increment expands the visual/compiler foundation. It does not establish arbitrary imaginable geometry or mechanics, zero latency, global admission, or commerce.

## Implemented behavior

A pristine creation conversation queues an editable personal home-and-bed prompt using the player's display name and the physical placement coordinates. It suggests a walk-in doorway, roof, clear interior, usable bed and selected finite resources. Saved drafts, selected-object evolution, existing operations and conversation history are preserved. Prompt text alone never allocates lots or admits an object.

The planner now requests coherent human-scale construction, separately functional habitat/bed nodes, supported parts and recognizable grips/working parts. Only the installed Receiz proposal transport is used. The deterministic compiler remains responsible for actual resource costs, capabilities and physical overlap. Planner instructions cannot ensure an admitted, usable home by themselves.

Cylinders and ellipsoids extend the existing declarative grammar. Fixed tessellation, analytic volume and outward normalized vertices produce repeatable sealed plans. Conservative bounding-box colliders remain intentionally more restrictive than the curved visual surface; ellipsoids advertise no flat walkable top, and cylinder landing surfaces fit inside their ellipse. Existing definitions retain their source bytes and geometry. Custom polygon extrusions, arbitrary imported assets and new material/behavior laws remain unqualified.

Creation and ghost renderers share metric texture mapping. Mapping uses a fixed tangent basis per triangle to keep curved UVs nondegenerate. Geometry remains derived from verified buffers without altering their proof. The renderer accounts for 32 bytes per vertex including UVs; the low-tier paced upload ceiling is 96 KiB so the existing largest pages still fit. Residency continues to use nearby selection, support pins and the existing measured draw/triangle ceilings.

One lazy library per scene shares materials across pages. The empty scene performs no map requests. Registered timber and stone use local diffuse, OpenGL normal and roughness maps; authored hay fibres and immediate fallbacks do not require network availability. Low quality uses256px maps; other tiers use512px. Surface maps load asynchronously outside frame callbacks, retain coherent fallbacks on failure and dispose late/partial downloads. Texture resolution changes released the previous library in browser inspection. Shared library allocation is explicitly capped, independently of page count.

All12 texture derivatives total1,363,124bytes. The existing Sharp tool reproduces them, with original and derivative SHA-256 hashes in the public manifest. No package or lockfile changed. The service worker caches only known public map filenames after first use; private creation artifacts remain network-only. Unseen offline materials retain the procedural fallback.

## Sourcing and reference ledger

- Timber/stone: hybrid; CC0 Poly Haven surfaces plus compiler-generated geometry. Wood Floor Deck by Dimitrios Savva; Rock Boulder Dry by Dimitrios Savva and Rico Cilliers.
- Hay: authored procedural fibre surface; selected hay remains the actual construction resource.
- Player/creatures/UI: existing assets retained.
- Paid image/3D generation: not used because the human explicitly restricts this work to existing Receiz and free open-source assets/tools. No private credential probe was needed; missing credentials are not the sourcing reason.
- Public credits: /materials/creation/CREDITS.md and About. Asset license: https://polyhaven.com/license. Build-time selection used https://github.com/Poly-Haven/Public-API. No remote asset API runs during gameplay.
- Required graphics references read: visual-scorecard.md, implementation-blueprint.md, model-recipes.md, render-recipes.md, performance-safe-visual-detail.md, material-lighting-quality.md, aaa-game-quality-gate.md, aaa-visual-scorecard.md.
- threejs-3d-generator and threejs-image-generator skills were read before sourcing decisions. The user's free-tools restriction governs provider selection.

## Verification and limits

Tests for the new starter, material library, curved grammar and offline path first failed before their implementations. Final complete suite:3,061tests,3,060passed,one existing skip,zero failures. TypeScript passed. Lint zero errors with the same two existing warnings. Receiz architecture lock887runtimefiles passed and integration check returned ok. Build and final production preview details are appended after completion.

Development-only /test-fixtures/creation-materials uses synthetic resources, real compilation/component initialization and real render geometry/materials. It displays a shelter, actual doorway, separate functional-size bed node and separate low-mass tool assembly. It grants no world admission or use authority. Exterior:10drawcalls,2,102triangles,10textures,8.08MiB shared surface maps at512px. Interior:8calls,1,382triangles. At256px, shared maps were2.08MiB and texture count remained10 after the old library was released. Saved interior evidence: /private/tmp/wildz-creation-material-interior.jpg.

The creation conversation fixture displayed the queued personal home prompt. Replacing it with a garden prompt and reloading preserved the exact edited draft; no resource allocation or generation occurred. Evidence: /private/tmp/wildz-creation-starter-editable.jpg. The selected browser's viewport override did not resize the hidden material tab; no phone rendering or hardware performance claim is made.

The isolated scene has improved material detail and curved secondary forms, but its building forms remain primarily simple proxy geometry. The game does not meet the premium/showcase scorecard gate. No full-game active-play material performance baseline, phone GPU sample, p95 latency or zero-regression claim is available.

The application parent still lacks a qualified creation runtime/source reducer. A fresh receiz.sdk.capabilities.probe for wildz.quest reported no scopes, missing World write credentials and missing delegated world-command/subject-runtime authority in this tool session. This does not prove that a separately authenticated player lacks authority. Actual admission, separately created beds in the contextual sleep HUD, equipment use, creature work execution, independent-client contention, custody and global transfer remain gates. They must be connected to the existing source law rather than fabricated from a preview.

## Production preview verification

Final production build passed. The preview is running at http://localhost:3107/ in managed session51251. Root returned200; the bundled wood map returned200; the development qualification route returned404. The existing explorer, position, body state and saved creation draft survived the production reload and application of the waiting local update. The actual390px-wide HUD retains its one-row icon selectors and the new shelter guidance. Prompt font remained14px for this fine-pointer browser. Browser error log was empty. Production conversation evidence: /private/tmp/wildz-creation-production-conversation.jpg. Existing wallet-authority rejections remain in server logs and were not attributed to this graphics change.

No live AI-generated source was admitted, no global write or sale was performed, and the isolated material scene is not represented as a usable world object.
