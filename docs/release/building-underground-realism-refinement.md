# Building, underground worlds, and material refinement

## Delivered behavior

- Placed components retain identity, material contributions and work through predecessor-bound move/rotation revisions. Reach, ownership, support, space and stale-head checks apply to adjustment admission and replay.
- Touch or mouse dragging moves a piece on a 0.5 m grid. The curved on-screen handle rotates in quarter turns; the vertical handle adjusts height in 0.5 m increments. Valid releases save immediately. Unsupported placements remain unchanged and explain why. Keyboard arrows on the handles remain available.
- The build tray opens directly from Build, is draggable and minimizable, and shrinks while manipulating a piece. Mobile mode removes redundant quick tools while retaining movement. Material/progress details remain available through More.
- Digging creatures can admit entrances, connected tunnels and 10 m rooms, including mountain terrain. Networks support branching, sloped routes and construction inside their own spaces. Dry-route, ancestry, ownership, reach and depth checks remain authoritative. Network depth is bounded to 48 m below its entrance; horizontal projection streams nearby regions.
- Burrow sources are retained through the existing world command, checkpoint, owned additions, outbox and Vault paths. Exact immutable admitted sources reuse validation; rendering and movement consume cached physical projections. Restoring interior construction includes its walkable supports, while exterior movement excludes underground structures.
- The legacy `/api/wilds/excavation` preflight route has not been promoted into a fictional hosted commit API. Playable digging follows the current source-object command admission architecture already used by continuous construction. This supersedes the earlier assumption that the unused V123 excavation scaffolding was the only available gameplay path; it does not claim a new hosted excavation service was deployed.
- Caves use metre-scaled limestone texture coordinates, baked contact tint, shallow wall relief and bounded ceiling mineral detail. Cave surfaces are batched by role. Mountains, field rocks, arena stone, bark, foliage and creature surface grain share bounded material resources; water has restrained luminance. Terrain and water geometry/texture cleanup was tightened.
- Developers have a source entry point, a tested trail experience and a guide: [creature-compatible experiences](../developers/creature-experiences.md). This is not a separately published npm creature SDK or cross-application certification.

## Verification evidence

The full suite passed 2,191 tests, including deterministic face geometry and canonical identity aliases. Targeted lint and TypeScript checks passed. The final production build passed. Existing SDK optional-dependency and unrelated lint warnings remain.

Browser verification used the real service and hooks through the development-only builder fixture, plus the actual game at desktop and phone sizes. Observed: pointer drag saved X 20 → 20.5; a curved-handle sweep saved 90° rotation; an unsupported foundation lift was rejected; panel dragging/minimization worked; digging admitted an entrance and connected room; checkpoint restoration retained them. Real world movement changed player coordinates without rebuilding the site runtime or index. Review caught and fixed native pointer-cancel cleanup and stale drag-click suppression.

| Measured scene | Draw calls | Triangles | Textures | Notes |
| --- | ---: | ---: | ---: | --- |
| Outdoor baseline, 1280×720, high, DPR 1.5 | 132 | 95,254 | 5 | Same stationary player/camera used for comparison |
| Outdoor after materials, same configuration | 132 | 95,254 | 9 | 117 geometries in both settled samples |
| Actual mobile game, 390×844, medium, DPR 1.25 | 106 | 74,626 | 9 | Within the existing 160-call / 180k-triangle budget |
| Entrance + room cave fixture after relief/mineral detail | 3 | 3,160 | 2 | Floor/wall/ceiling batches; no portal in this view |

The generated material is a 512×512 WebP, 90,438 bytes. The shared rock texture plus three 128×128 natural surface maps have bounded residency. Material refinements add texture sampling; unchanged draw counts are not proof of identical GPU frame times. No physical-phone GPU percentile benchmark or exhaustive long-network restore benchmark was collected. Zero latency on every device and world size is not claimed. Screenshots and browser interaction evidence were inspected inline in the task.

## Graphics reference ledger

All paths below are under `/Users/bjklock/.codex/skills/threejs-aaa-graphics-builder/` unless stated otherwise.

| Read | Reference | Failure reason |
| --- | --- | --- |
| Yes | `SKILL.md` | — |
| Yes | `references/visual-scorecard.md` | — |
| Yes | `references/implementation-blueprint.md` | — |
| Yes | `references/model-recipes.md` | — |
| Yes | `references/render-recipes.md` | — |
| Yes | `references/checklists/material-lighting-quality.md` | — |
| Yes | `references/checklists/performance-safe-visual-detail.md` | — |
| Yes | `references/checklists/aaa-game-quality-gate.md` | — |
| Yes | `references/checklists/aaa-visual-scorecard.md` | — |
| Yes | `../threejs-3d-generator/SKILL.md` | Provider credential absent |
| Yes | `../threejs-image-generator/SKILL.md` | Built-in image generator used as fallback |

The director credential probe returned these literal empty values (not SET values):

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

## Asset sourcing ledger

| Surface | Method | Output or decision |
| --- | --- | --- |
| Cave/mountain/rock limestone | Hybrid: built-in image generation + existing geometry | `public/textures/wilds-limestone.webp`; original generated image: `/Users/bjklock/.codex/generated_images/01a07f02-9ee5-7e83-909e-dd0aa793875c/exec-98660867-2222-4e6d-a1f1-204c823664db.png` |
| Bark, leaves, creature grain | Shared procedural material maps | `wilds-natural-material.ts`; deterministic small neutral detail preserves existing proof-derived palette and anatomy |
| Cave shape and mineral fringe | Authored procedural geometry | `wilds-cave-geometry.ts`; bounded relief and merged ceiling details, no per-frame generation |
| Explorer face/body | Deterministic authored geometry | SHA-256 identity projection controls jaw, cheeks, eyes, brows, nose, lips, ears, proportions and freckles. One merged face mesh; reduced remote detail. Articulated body refined with connected limb joins and rounded footwear. |
| Cloth, leather, fur, scales | Built-in image generation, atlas cropped to four 256×256 WebPs | Original: `/Users/bjklock/.codex/generated_images/01a07f02-9ee5-7e83-909e-dd0aa793875c/exec-41fa5b1a-7674-4687-bc5d-8b62c05c9580.png`. Total 86,956 bytes. Shared asynchronous loading; no gameplay suspension. |
| Terrain, water, construction | Existing authored projection plus material refinement | No extra external asset needed for these supporting surfaces; same geometry/authority contracts retained |

## Visual assessment

This is a material and interaction refinement, not a certification that the whole game is photorealistic or showcase quality. Scores below concern the observed views only; unobserved enemy/reward coverage is not inferred.

```text
Visual scorecard:
- Art direction: before 2 / after 2 - evidence: coherent creature-world palette and authored landmarks retained.
- Hero/player: before 1 / after 2 - evidence: unique identity-derived facial geometry, refined articulated torso and joints, fabric/leather surfaces. Still stylized rather than photorealistic.
- Obstacles/enemies: before 1 / after 1 - evidence: observed terrain/landmark obstacles remain simple; no new enemy-family pass.
- Rewards/interactables: before 1 / after 1 - evidence: existing ring/portal language; cave portal now uses a compact constant-size control.
- World/environment: before 1 / after 2 - evidence: connected, enclosed, textured cave spaces plus terrain/mountain material detail.
- Materials/textures: before 1 / after 2 - evidence: generated limestone, metre-scaled cave UVs, bark/leaf/skin detail and restrained water emission.
- Lighting/render: before 2 / after 2 - evidence: existing lighting retained, cave contact tint and physical material roles refined.
- VFX/motion: before 2 / after 2 - evidence: existing motion retained; gesture preview follows snapped touch transforms.
- UI/HUD: before 2 / after 2 - evidence: direct gesture manipulation and compact movable mobile tray, movement retained.
- Performance evidence: before 1 / after 2 - evidence: desktop comparison, phone viewport budget, cave batching counts, browser and automated checks.
Average: before 1.4 / after 1.8
Automatic failures remaining: simple/primitive-dominant hero and landmark silhouettes, repeated reward forms; no physical-device frame-time certification.
```

A showcase pass would require anatomy-compatible hero assets, richer landmark silhouettes and reward families, then visual and frame-time qualification across representative physical phones. The current changes improve those observed materials without claiming that broader art-production work has been completed.

## Explorer detail follow-up

Each explorer face is derived from its canonical identity coordinate (trainer IDs for NPCs), independent of time, camera and restore. Creature anatomy and sealed palette remain authoritative. Fur/feather and scale/shell surfaces use the matching shared neutral detail map; energy forms retain neutral grain. Face geometry is memoized and disposed when replaced. The development-only `/test-fixtures/explorer-detail` view uses the real explorer component to compare three identities from the front. Desktop front views and live mobile gameplay were inspected.

The earlier comparison table predates the face geometry changes and must not be read as their unchanged-cost measurement. A fresh mobile low-tier sample after the character changes reported 102 draw calls, 62,214 triangles and 11 textures, within its configured budget. This is a different adaptive quality tier, not a like-for-like speed comparison. An independent review found no actionable correctness/performance defects in this follow-up.
