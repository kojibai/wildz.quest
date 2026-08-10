# Wildz Flagship Mobile Experience — Release Evidence

This document records reproducible evidence for the flagship mobile-world rebuild and its release qualification. It distinguishes the rebuilt flagship slice from the broader game so that a strong interaction pass is never mistaken for complete world-class content coverage.

## Runtime quality and progressive loading

- Production build: `pnpm build` passed on 2026-08-10 after stopping the guarded development runtime.
- Initial `/` app manifest: 23 JavaScript chunks, 2,001.1 KB raw and 544.5 KB gzip, measured from the deduplicated `/layout` + `/page` entries in `.next/app-build-manifest.json`.
- Planning baseline: 836 KB first-load JavaScript. The comparable compressed manifest measurement is 291.5 KB lower (34.9%).
- Noncritical chunks: world map, landmark/Hearttree shell, settlement, ecology, raid, trainer challenge, and Mortal Arena are loaded with `next/dynamic`; trainer and Arena modules begin preloading as soon as a trainer challenge opens.
- Live 390 × 844 WebKit evidence: medium quality, DPR 1.25, 123 renderer calls (76.9% of the 160-call budget), approximately 73,834 triangles (41.0% of the 180,000-triangle budget), all within budget.
- Runtime governor: bounded 120-frame window; one-tier downshift after 120 slow visible frames; one-tier recovery after 600 healthy visible frames; 30-second transition cooldown; hidden frames excluded; device base recomputed on resize, orientation, and reduced-motion changes.

Ignored browser evidence:

- `output/playwright/contextual-world-mobile.png`
- `output/playwright/trainer-challenge-mobile-clean.png`
- `output/playwright/trainer-transition-mobile.png`
- `output/playwright/mortal-arena-zones-active-mobile.png`

## Signature trainer visual and audio pass

### Asset generation

- Image mode: built-in image generator; final project assets converted to optimized WebP.
- `public/game/trainers/lanternforge-keeper-portrait.webp`: 768 × 768, 76 KB. Prompt: original androgynous Lanternforge Keeper bust; lantern shoulder armor; technical expedition coat; glowing geometric identity seal; emerald, charcoal, antique gold, and ember palette; premium stylized 3D; no text, watermark, franchise resemblance, creature, or weapon.
- `public/game/trainers/lanternforge-emblem.webp`: 512 × 512, 35 KB. Prompt: one symmetrical diamond Kai seal nested in an angular lantern; brushed brass and luminous glass; ember light with emerald rim; no text, people, extra symbols, border, or watermark.

### Audio matrix and blocker

Credential probe on 2026-08-10:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

The required external audio provider was unavailable, so no generated MP3 is claimed. The game instead uses its existing gesture-unlocked, settings-aware Web Audio runtime for this pass.

| Category | Event | Runtime cue | Duration | Loop | Group |
| --- | --- | --- | ---: | --- | --- |
| UI | Companion carousel/ability detent | `companion-detent` synthesized 720→880 Hz sine | 0.08 s | No | effects |
| Encounter | Trainer recognized/challenge opened | `trainer-challenge` synthesized 196→880 Hz triangle | 0.68 s | No | effects |
| Combat | Strike impact | Existing `battle-hit` recorded/synth fallback | 0.20 s | No | effects |
| Combat | Danger, victory, defeat | Existing error/boss action/defeat cues | Event-specific | No | effects |
| Ambience | World and arena beds | Existing scene-directed runtime programs | Scene lifetime | Yes | ambience/music |

Runtime integration preserves user-gesture unlock, master/effects/ambience/music settings, mute, scene switching, visibility cleanup, and no per-frame SFX. Remaining audio gap: replace the two new synthesis voices with authored recordings when `ELEVENLABS_API_KEY` is available.

Reference ledger:

- `threejs-audio-generator/SKILL.md`
- `threejs-audio-generator/references/audio-workflows.md`
- `imagegen/SKILL.md`

## Release qualification

### Skill-loading ledger

| Discipline | Loaded guidance | Applied result |
| --- | --- | --- |
| Gameplay systems | `threejs-gameplay-systems` references | Deterministic companion gestures, encounter phases, combat inputs, and persistent consequences |
| AAA graphics | `threejs-aaa-graphics-builder` quality gate and visual scorecard | Renderer budgets, composited-pixel inspection, visual score, automatic failures |
| UI | `threejs-game-ui-designer` HUD, game-UI, and responsive-fit checklists | Direct interaction, safe areas, thumb zones, compact landscape overlay |
| Debug/profile | `threejs-debug-profiler` workflow | Draw-call, triangle, DPR, adaptive-quality, console, and nonblank-frame evidence |
| QA/release | `threejs-qa-release` checklists | Device matrix, production build, recovery/accessibility checks, release gate |
| Image generator | `imagegen` | Original Lanternforge portrait and emblem integrated as optimized WebP |
| Audio generator | `threejs-audio-generator` and audio workflows | Provider probe; settings-aware synthesized fallback because the external credential was missing |
| 3D generator | `threejs-3d-generator` route considered | No external 3D output claimed; existing runtime geometry retained because both 3D-generation credentials were missing |

Reference ledger: game-director, gameplay-systems, AAA graphics, UI, debug/profile, QA/release, image generator, audio generator, and 3D generator guidance were used or explicitly dispositioned above.

### Phase ledger

| Phase | Status | Evidence |
| --- | --- | --- |
| Startup and immediate entry | Pass | Local world starts reliably; explorer selection and gender gate removed |
| Kai Pulse identity | Pass | Account-creation Kai Pulse deterministically drives the proof-bound explorer, including outfit colors and materials |
| Companion command | Pass | Tap, horizontal cycle, swipe-up preview, hold-slide abilities, keyboard alternatives, detent haptics |
| Contextual world | Pass | Visible terrain and trainers own their interactions; redundant Interact/navigation chrome removed |
| Trainer encounter | Pass | Challenge sheet, VS transition, combat ownership, result, rematch/review/return states |
| Mortal Arena mobile combat | Pass | Movement, primary combat, and survival/context zones; active covenant tested |
| Adaptive runtime | Pass | Quality governor, dynamic chunks, renderer budgets, orientation response |
| Signature presentation | Partial | One authored trainer identity and synthesized cues; full location cast and externally authored audio remain open |
| QA/release | Pass with disclosed automatic failures | Tests, types, lint, build, release gate, device matrix pass; production unauthenticated session probes still log two 401 page errors |

### Responsive browser matrix

All measurements are composited WebKit output. `overflow` means horizontal document overflow; `overlap` means bounding-box collision among movement, companion command, and command dock.

| Viewport | World canvas | Primary controls | Overflow | Overlap | Result |
| --- | ---: | ---: | --- | --- | --- |
| 320×568 | 320×358 | command 72×72; d-pad 68×68 | None | None | Pass |
| 360×800 | 360×590 | command 79×79; d-pad 78×78 | None | None | Pass |
| 390×844 | 390×634 | command 86×86; d-pad 78×78 | None | None | Pass |
| 430×932 | 430×718 | command 94×94; d-pad 78×78 | None | None | Pass |
| 844×390 landscape, before fix | 844×166 | two stacked control rows | None | None, but world compressed | Fail |
| 844×390 landscape, final | 844×390 | floated 94×94 command, 68×68 d-pad, 258×52 dock | None | None | Pass |
| 768×1024 | 768×800 | 98 px control region | None | None | Pass |
| 1440×900 | 1440×676 | 98 px control region | None | None | Pass |

Screenshots:

- Mobile world: `output/playwright/flagship-world-390x844.png`
- Final landscape: `output/playwright/flagship-world-844x390-fixed.png`
- Trainer challenge: `output/playwright/lanternforge-challenge-mobile.png`
- VS transition: `output/playwright/lanternforge-transition-mobile.png`
- Active combat: `output/playwright/mortal-arena-zones-active-mobile.png`
- Production mobile: `output/playwright/flagship-production-mobile.png`
- Composited canvas frames: `output/playwright/flagship-canvas-mobile.png`, `flagship-canvas-desktop.png`, and `flagship-canvas-landscape.png`

### Verification evidence

- Build: optimized Next.js production build passed. First load for `/` is 555 kB in the final build. Build warnings are the known dynamic `web-worker` dependency inside `snarkjs` and one pre-existing `completeGenesis` hook-dependency warning.
- Automated: 1,009 tests passed; typecheck passed; lint passed; `pnpm release:check` passed, including the Receiz conformance suite.
- Console: production world loads and remains playable. Page error evidence is two `401 Unauthorized` requests to `/api/auth/wildz/session` for an unauthenticated local identity before reconnecting/practice fallback; no render crash occurs. This remains an automatic failure for a premium release claim.
- Desktop and mobile: the full matrix above was rendered, measured, and screenshot. The 844×390 failure was repaired and remeasured from a 166 px canvas to a full 390 px canvas.
- Canvas pixel evidence: composited screenshots, not the discarded WebGL back buffer, were downsampled to 64×64. Mobile Y range 11–230 with YAVG 58.56; desktop 11–230 with YAVG 49.61; landscape 8–230 with YAVG 56.80. All are visibly nonblank with meaningful luminance range.
- Performance evidence: at 390×844 the medium profile used DPR 1.25, 123 draw calls and approximately 73,834 triangles, below the 160-call and 180,000-triangle budgets. Runtime quality can only recover up to the device base tier.
- Accessibility/recovery: semantic buttons and dialog/status roles are source-contracted; companion keyboard focus and ArrowUp preview were browser-tested; reduced motion reports true and suppresses declared effects; 200% WebKit text adjustment produces no page overflow; offline companion activation leaves the world mounted; unavailable `navigator.vibrate` does not throw.

### External asset sourcing

Credential probe output:

```text
TRIPO_API_KEY=missing
GEMINI_API_KEY=missing
ELEVENLABS_API_KEY=missing
```

Chosen sources:

| Surface | Source and disposition |
| --- | --- |
| Hero/player | Existing deterministic Kai Pulse explorer generator; no external identity image, because the explorer itself is the proof object |
| Trainer | Built-in image generator output, project-bound as the Lanternforge Keeper portrait and emblem |
| World/sky/background | Existing authored procedural Three.js world; external 3D generator blocked by missing Tripo and Gemini credentials |
| Materials/textures/decals | Existing runtime materials plus the generated emblem texture; no external model/texture pack claimed |
| Audio | Existing Web Audio programs and synthesized fallback; real audio asset generation blocked by missing ElevenLabs credential |

### Ten-category AAA visual scorecard

Scale: 0 absent, 1 prototype, 2 production-capable, 3 showcase. This is the observed rebuilt slice, not a legacy or brand score.

| Category | Score | Evidence |
| --- | ---: | --- |
| Art direction | 2 | Coherent emerald/charcoal/gold identity and restrained proof language; broader biome identity is still uneven |
| Hero/player | 2 | Deterministic Kai Pulse explorer and companion silhouettes are recognizable; close-up animation fidelity is below showcase |
| Obstacles/enemies | 2 | Trainer and Arena rivals read clearly and telegraph actions; most opponents still reuse a limited presentation vocabulary |
| Rewards/interactables | 2 | Direct trainers, terrain rings, mission state, and result rewards are legible; environmental affordance variety remains limited |
| World/environment | 2 | Layered world, landmarks, ecology, and purposeful combat space exist; not every arena/place has bespoke authored density |
| Materials/textures | 2 | Consistent stylized materials and generated emblem; surface variation and decals need a full location-wide pass |
| Lighting/render | 2 | Strong silhouette separation and readable day/scene lighting; lighting is not yet cinematic in every location |
| VFX/motion | 2 | VS transition, combat feedback, companion wheel, and haptic detents; fewer signature effects outside the flagship path |
| UI/HUD | 3 | Direct world interaction, compact HUD, thumb command, drawer, safe areas, and full landscape reflow are release-strong |
| Performance evidence | 3 | Measured renderer budgets, adaptive governor, progressive chunks, nonblank pixels, responsive matrix |

Average: **2.2 / 3**. The slice clears production-capable quality but does not clear the AAA showcase gate because automatic failures remain.

Automatic failures:

1. Two unauthenticated production session probes surface as console/page errors before the safe local fallback.
2. Several un-upgraded locations remain close to a primitive-dominant procedural visual language and do not yet meet the bespoke density of the strongest environments.
3. External authored encounter audio is blocked; the current fallback is responsive and functional but not showcase audio.
4. Only the Lanternforge Keeper received a bespoke generated identity in this pass; the full trainer and arena cast is not equivalently authored.

### Experience rating versus the best current game experiences

The benchmark column is an experiential ceiling of 10, independent of age, franchise, sales, or legacy. Baseline is the pre-overhaul experience; rebuilt is the browser-played flagship path.

| Experience category | Baseline | Rebuilt | Ceiling | Observed reason |
| --- | ---: | ---: | ---: | --- |
| First-session immediacy | 4.5 | 8.5 | 10 | Identity creates directly into play; no gender/explorer gate |
| Movement and camera | 5.5 | 7.8 | 10 | Camera-relative analog travel and responsive framing; movement feel lacks top-tier animation nuance |
| Thumb controls | 3.8 | 8.6 | 10 | Large separated zones, safe areas, landscape overlay |
| Interaction discoverability | 4.0 | 8.2 | 10 | Tap visible actors/terrain; remaining environmental verbs need broader affordances |
| Companion UX | 3.5 | 8.8 | 10 | Portrait command, peeks, swipe cycle, drawer, hold-slide wheel, haptics |
| Combat readability | 4.2 | 8.1 | 10 | Purposeful movement/combat/survival zones and readable labels |
| Combat depth | 6.8 | 7.6 | 10 | Deterministic guard, focus, swap, flee, abilities, consequences; encounter variety is limited |
| Encounter transitions | 3.2 | 8.3 | 10 | Challenge, VS, combat, result, review, rematch, return share one director |
| Identity/personalization | 5.5 | 9.0 | 10 | Kai Pulse proof object affects outfit color, material, hair, complexion, accessory, trail, and signature |
| World art density | 6.4 | 7.0 | 10 | Stronger foreground/readability, but not all regions are bespoke |
| Arena/place distinctiveness | 5.8 | 7.0 | 10 | Purposeful flagship combat space; complete location-wide upgrade remains open |
| Narrative/objectives | 6.2 | 6.8 | 10 | Cleaner mission focus and trainer framing; authored narrative breadth mostly unchanged |
| Audio/haptics | 4.5 | 7.3 | 10 | Immediate detents and encounter cue; authored spatial audio remains below benchmark |
| Performance/latency | 6.0 | 8.4 | 10 | Budgeted render, dynamic chunks, adaptive quality, direct gesture response |
| Responsive/accessibility | 4.0 | 8.8 | 10 | Seven-viewport matrix, keyboard alternatives, reduced motion, 200% text, safe areas |
| Progression/replay | 8.2 | 8.4 | 10 | Deep proof-backed consequences and deterministic replay were preserved |
| Social/live reliability | 5.5 | 5.8 | 10 | Safe reconnecting mode works; local unauthenticated 401 probes remain noisy |
| Content breadth/polish | 6.8 | 6.9 | 10 | This pass upgrades a flagship path, not every arena, settlement, raid, resident, or trainer |

Flagship-slice average: **7.85 / 10**, up from **5.24 / 10**. Whole-game observed readiness is **6.9 / 10** because the strongest interaction system is not yet matched by world-wide authored content, audio, and trainer/location coverage. This is materially advanced and mobile-first, but it is not yet honest to call the entire game equal to the best game experiences ever created.

### Next highest-value location work

1. Eliminate unauthenticated session 401 console noise without weakening proof admission.
2. Apply the location-quality contract to every arena, settlement, Hearttree space, Prism activity, raid, and rift.
3. Give each trainer family a bespoke portrait/emblem/entrance/audio identity and distinct tactical behavior.
4. Replace fallback cues with authored spatial audio once the provider is available.
5. Run the same active-combat and return-to-world matrix for every location family, not only the flagship path.
