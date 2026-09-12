# Place detail and foliage verification

## Scope

This pass replaces solid canopy/shrub forms with opaque individual leaves, and rectangular grass with six tapered blades. The factories retain the old per-instance triangle budgets: 144 for canopy/shrub, 80 for crowns, and 12 for grass. Materials remain instanced; leaves and grass are now double-sided. Equal triangle counts do not establish equal fragment cost.

Grove proportions vary continuously at fixed world coordinates. Terrain vertex colors follow the existing authoritative surface classification used by traversal (grass, soil, trail, rock, sand, shallow/deep water), using the terrain samples already available when building a streamed patch. No additional terrain query or encounter roll was introduced. This is a presentation improvement, not a new biome or creature-species system. Existing land, aquatic and climbing habitat selection remains unchanged.

The generated leaf-litter surface replaces the striped procedural terrain map. It uses world-anchored three-metre UVs and the existing sampler. A single cached, optional image decode happens after first paint; cancellation prevents updating a disposed texture. A failed load leaves a local fallback. There is no Suspense dependency, repeated polling, frame callback or new shader sampler. The 128-square map replaces a 64-square map: approximately 64 KiB more GPU storage including mipmaps, plus 64 KiB cached decoded pixels. Terrain vertex colors add three floats per existing vertex. These are small, explicit memory costs, not a claim of zero additional resource use.

The existing hemisphere and fill lights brighten daylight and make foreground forms more readable. Their count and shadow-map resolution are unchanged. No SDK, authoritative event, reward, custody, wallet, collision or construction behavior changed.

## Asset ledger

- Terrain surface: native image generator, prompt for top-down seamless moss, leaf litter, soil and small pebbles, no baked lighting. Source: `/Users/bjklock/.codex/generated_images/01a0931c-0600-7c90-857d-c24cabb39184/exec-5f7b13b0-b37f-46e5-a7c7-58876a897bdb.png`. Runtime: `public/wilds-forest-floor.webp`, 128 × 128, **7,108 bytes**. Sharp used only for downsampling and WebP encoding. Repeating microtexture remains; this does not make every square metre an independently authored asset.
- Foliage and grass: deterministic authored geometry factories, existing budgets and shared materials.
- Hero model: existing asset retained. External 3D generation is unavailable because the Tripo credential probe found no configured key. No generated hero is claimed.

## Validation

- Full suite: **2,349 tests, 211 suites, zero failures**. New checks cover grass normal validity and triangle count, stable/bounded grove proportions, and surface distinctions. Existing geometry tests cover every organic factory's count, finite attributes and deterministic output.
- Targeted ESLint passed.
- Production build passed; reported gameplay first-load JavaScript remained 1.34 MB (rounded). Existing SDK web-worker and unrelated lint warnings remain.

## Quality limits

This is not a 10/10 realism claim. The hero and creatures remain stylized; repeated prop families and broad atmospheric planes remain visible. A finite shared world kit cannot honestly be described as having no repetition. Distinct appearance also does not create new canonical gameplay consequences on its own.

### Screenshot critique (0–3 skill scale)

| Category | Score | Evidence / remaining gap |
| --- | --- | --- |
| Art direction | 2 | Cohesive forest palette, still visibly stylized |
| Hero/player | 1 | Primitive anatomy remains visible; character partially obscured near the arch |
| Obstacles/enemies | 1 | Creature silhouettes still use simple shared forms |
| Rewards/interactables | 2 | Resource rings and companions remain recognizable |
| World/environment | 2 | Connected leafy crowns, surface grain and stable grove proportions; repeated kit remains |
| Materials/textures | 2 | Leaf litter replaces striping; bark detail remains coarse |
| Lighting/render | 1 | Better fill, but broad light-shaft planes and flat distant sky remain |
| VFX/motion | 1 | Existing breeze and particles; no new premium motion system |
| UI/HUD | 2 | Readable touch controls, but upper HUD remains visually dense |
| Performance evidence | 2 | Production viewport comparison; no physical iPhone/GPU timing study |

Average **1.6/3**; the premium/showcase gate does **not** pass. This report deliberately does not equate a completed graphics slice with the user's full realism goal.

References applied: `threejs-aaa-graphics-builder/SKILL.md`, its visual scorecard, implementation blueprint, model/render recipes and performance-safe-visual-detail, material-lighting-quality, aaa-game-quality-gate and aaa-visual-scorecard checklists; `threejs-debug-profiler` and its performance checklist; image/3D generator skills for the asset route and credential gate.

## Production comparison

Chrome/macOS, identical saved synthetic profiles, keyboard sequence and viewport/buffer dimensions; 180 warmed frame intervals after movement. WebGL counters include shadow work. No page/shader errors or horizontal overflow in either final run.

| Viewport | Buffer | p95 before → final → repeat | Draws before → final → repeat |
| --- | --- | --- | --- |
| 390 × 844 | 487 × 1055 | 16.67 → 16.67 → 16.67 ms | 124.96 → 125.13 → 124.93 |
| 1280 × 800 | 1920 × 1200 | 16.67 → 16.67 → 16.67 ms | 194.19 → 206.73 → 194.19 |

The extra desktop work in the first final sample was not reproduced: the repeat returned exactly the baseline draw/triangle counts (194.19 / 108,256.18). The scene evolves with time; these are full-scene observations, not isolated GPU timings. Both samples are retained rather than reporting only the lower count. This establishes no sampled frame-interval regression, not a guarantee of identical GPU cost, zero hitches, or performance on a physical iPhone. Loading-time and network latency are not measured by this warmed comparison.

Evidence: `/tmp/wildz-art-visual-before.json`, `/tmp/wildz-art-visual-final.json`, `/tmp/wildz-art-visual-confirm.json`, and corresponding 390/1280 PNG screenshots; `/tmp/wildz-visual-tests.log`, `/tmp/wildz-visual-build.log`, `/tmp/wildz-visual-lint.log`.
