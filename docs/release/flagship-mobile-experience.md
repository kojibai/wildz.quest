# Wildz Flagship Mobile Experience — Release Evidence

This document records reproducible evidence for the flagship mobile-world rebuild and its release qualification. It distinguishes the rebuilt flagship slice from the broader game so that a strong interaction pass is never mistaken for complete world-class content coverage.

## Runtime quality and progressive loading

- Production build: `pnpm build` passed on 2026-08-10 after stopping the guarded development runtime.
- Initial `/` app manifest: 23 JavaScript chunks, 2,001.1 KB raw and 544.5 KB gzip, measured from the deduplicated `/layout` + `/page` entries in `.next/app-build-manifest.json`.
- Planning baseline: 836 KB first-load JavaScript. The comparable compressed manifest measurement is 291.5 KB lower (34.9%).
- Noncritical chunks: world map, landmark/Hearttree shell, settlement, ecology, raid, trainer challenge, and Mortal Arena are loaded with `next/dynamic`; trainer and Arena modules begin preloading as soon as a trainer challenge opens.
- Live 390 × 844 production Chromium evidence: medium quality, DPR 1.25, 85 renderer calls (53.1% of the 160-call budget), 57,416 triangles (31.9% of the 180,000-triangle budget), 122 geometries, and 3 textures, all within budget. A 120-frame warm sample averaged 16.62 ms / 60.15 fps, with 16.7 ms p95 and 16.8 ms maximum.
- Runtime governor: bounded 120-frame window; one-tier downshift after 120 slow visible frames; one-tier recovery after 600 healthy visible frames; 30-second transition cooldown; hidden frames excluded; device base recomputed on resize, orientation, and reduced-motion changes.

Ignored browser evidence:

- `output/playwright/unified-controls-resting-390x844.png`
- `output/playwright/unified-controls-tools-fan-390x844.png`
- `output/playwright/unified-controls-roster-preview-390x844.png`
- `output/playwright/unified-controls-roster-expanded-390x844.png`
- `output/playwright/unified-controls-ability-wheel-390x844.png`
- `output/playwright/unified-controls-trainer-390x844.png`
- `output/playwright/unified-controls-combat-390x844.png`

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

The required external audio provider was unavailable, so no generated MP3 is claimed. The audio generation path was offline only; the game instead uses its existing gesture-unlocked, settings-aware Web Audio runtime for this pass.

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
| Mortal Arena mobile combat | Pass with a balance caveat | Real D-pad traversal reached Lanternforge Keeper; challenge, 1.1-second covenant hold, active controls, deterministic loss, permanent retirement, committed reward/result, and return to world were browser-tested. A new missing-`navigator.vibrate` crash was fixed before final replay. The first hard encounter can retire a lone starter within seconds, which is mechanically intentional but severe first-session tuning. |
| Adaptive runtime | Pass | Quality governor, dynamic chunks, renderer budgets, orientation response |
| Signature presentation | Partial | One authored trainer identity and synthesized cues; full location cast and externally authored audio remain open |
| QA/release | Pass with disclosed content failures | Tests, types, lint, build, release gate, device matrix, lifecycle, offline recovery, and clean-console production bootstrap pass. Full-game authored content and audio breadth remain below the premium gate. |

### Unified-control preservation matrix

| Route/state | Browser evidence | Result |
| --- | --- | --- |
| Resting world HUD | Real explorer name, mission, map, status, movement, two quick utilities, tools, and active companion all share the world stage | Pass |
| Mission and map | Each opens from its stable top home; Escape closes and restores focus; world stays mounted | Pass |
| World status | One trigger owns live/share, audio, Kai, and living-world status; Escape restores focus | Pass |
| World tools | Field Guide, Foraging Satchel, Trail Pack, and Card Vault open from the fan with one expansion owner; every overlay measures exactly to the viewport, moves focus inside, occludes the world, closes with Escape, and restores trigger focus | Pass |
| Companion tap/cycle/drawer | Tap action, fast horizontal cycle, fast upward preview, handle expansion, and tasteful adjacent portraits exercised | Pass |
| Companion hold-slide | Timed hold opened the wheel; sector traversal emitted detents; center/cancel preserved selection; directional release committed the selected real ability | Pass |
| Concurrent touch and cancellation | CDP two-touch moved while a companion action spent energy; `touchCancel` stopped both command and D-pad ownership without stuck motion | Pass |
| Trainer/combat exclusivity | Trainer challenge dismisses expansions; covenant gates controls; active Arena owns input; result commits before return | Pass |
| Keyboard | Tab reaches every semantic home; ArrowUp opens roster preview; Escape closes and returns focus | Pass |
| Audio | A visible settings label unlocks sound and toggles mute without relying on the visually hidden checkbox | Pass |
| Recovery | Resize/orientation cancels drawers; offline map stays local; frozen→active lifecycle restores; missing vibration capability is safe | Pass |

Reference ledger (yes/no/path/failure): gameplay systems yes / deterministic gesture and combat routes / no gameplay workflow failure; UI yes / seven viewports and four UI checklists / no fit failure after landscape correction; debug/profile yes / diagnostics, frame sample, lifecycle / visibility-state emulation itself was unsupported, so frozen→active CDP plus source tests were used; AAA graphics yes / ten-category scorecard and automatic gates / premium gate fails on content breadth and authored audio; QA/release yes / production browser, recovery, accessibility, artifacts / no remaining runtime crash; audio yes / runtime matrix and credential probe / external generation unavailable because the credential was blank.

### Responsive browser matrix

All measurements are composited production-browser output. `overflow` means horizontal document overflow; `overlap` means bounding-box collision among movement, companion command, and command dock.

| Viewport | World canvas | Primary controls | Overflow | Overlap | Result |
| --- | ---: | ---: | --- | --- | --- |
| 320×568 | 320×568 | command ≥72; d-pad ≥68 | None | None | Pass |
| 360×800 | 360×800 | command ≥79; d-pad ≥68 | None | None | Pass |
| 390×844 | 390×844 | command ≥86; d-pad ≥68 | None | None | Pass |
| 430×932 | 430×932 | command ≥94; d-pad ≥68 | None | None | Pass |
| 844×390 landscape, before overhaul | 844×166 | two stacked control rows | None | World compressed | Fail |
| 844×390 landscape, final | 844×390 | floated command and d-pad homes | None | Map/status overlap area 0 | Pass |
| 768×1024 | 768×1024 | floating semantic homes | None | None | Pass |
| 1440×900 | 1440×900 | floating semantic homes | None | None | Pass |

Screenshots:

- Resting matrix: `output/playwright/unified-controls-resting-320x568.png`, `unified-controls-resting-360x800.png`, `unified-controls-resting-390x844.png`, `unified-controls-resting-430x932.png`, `unified-controls-resting-844x390.png`, `unified-controls-resting-768x1024.png`, and `unified-controls-resting-1440x900.png`
- Expansion states: `output/playwright/unified-controls-tools-fan-390x844.png`, `unified-controls-field-guide-390x844.png`, `unified-controls-satchel-390x844.png`, `unified-controls-trail-pack-390x844.png`, `unified-controls-card-vault-390x844.png`, `unified-controls-panel-open-390x844.png`, `unified-controls-world-status-390x844.png`, `unified-controls-roster-preview-390x844.png`, `unified-controls-roster-expanded-390x844.png`, and `unified-controls-ability-wheel-390x844.png`
- Trainer and active combat: `output/playwright/unified-controls-trainer-390x844.png` and `unified-controls-combat-390x844.png`
- Machine-readable browser ledger: `output/playwright/task-8-browser-evidence.json` records the exact production URL, commands/actions, all panel and seven-viewport measurements, haptic capability variants, focus/Escape results, console counts, and screenshot paths.

### Verification evidence

- Build: optimized Next.js production build passed. First load for `/` is 557 kB in the final build. Build warnings are the known dynamic `web-worker` dependency inside `snarkjs`; lint has zero errors and two disclosed exhaustive-deps warnings (`cancelPointer` and `completeGenesis`).
- Automated: 1,040 tests passed; typecheck passed; lint exited zero; `pnpm release:check` passed, including Receiz conformance 15/15, secret scan, build, and doctor.
- Console/auth/page error: initial qualification found two automatic `401 Unauthorized` session writes. Root-cause tracing separated missing session GET, remote HTTP failure, thrown connection, non-canonical success, and missing proof-session sealing configuration. Valid local proofs now receive cache-disabled logical `unavailable` with no cookie and no upstream call when sealing is unconfigured; malformed or nonce-mismatched admission remains 401. Final clean production result: page error 0, console errors 0, console warnings 0.
- Desktop and mobile: the full matrix above was rendered, measured, and screenshot. The 844×390 failure was repaired and remeasured from a 166 px canvas to a full 390 px canvas.
- Canvas pixel evidence: composited screenshots, not the discarded WebGL back buffer, were measured with `signalstats`. Mobile world Y range 16–235 / YAVG 61.454; landscape 16–235 / YAVG 64.347; active combat 24–230 / YAVG 55.486. All are visibly nonblank with meaningful luminance and saturation ranges.
- Performance evidence: at 390×844 the medium profile used DPR 1.25, 85 draw calls, 57,416 triangles, 122 geometries, and 3 textures, below the 160-call and 180,000-triangle budgets. The 120-frame warm sample averaged 16.62 ms / 60.15 fps, p95 16.7 ms, maximum 16.8 ms. Runtime quality can only recover up to the device base tier.
- Accessibility/recovery: semantic buttons and dialog/status roles are source-contracted; all four command sheets move focus into the modal close control, Escape closes them, and focus returns to the tools trigger at 390×844, 844×390, and 768×1024; keyboard Tab/ArrowUp/Escape were browser-tested; reduced motion computes `animation-name: none`, animation duration `0s`, and transition duration `0s`; 200% text adjustment leaves chrome inside the viewport with zero document overflow; offline map opening retains three mounted canvases and zero overflow; CDP frozen→active lifecycle recovery retained two canvases and zero overflow; pointer cancellation stops both companion and movement gestures; missing, non-callable, and throwing `navigator.vibrate` capabilities are safe in the creature drawer, world, card-save feedback, and Arena.

### External asset sourcing

Credential probe output:

```text
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

Chosen sources:

No external assets were downloaded for 3D generation because that provider path was offline only; the image-generator outputs and existing project assets are the only externally dispositioned visual sources claimed here.

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

1. Several un-upgraded locations remain close to a primitive-dominant procedural visual language and do not yet meet the bespoke density of the strongest environments.
2. External authored encounter audio is blocked; the current fallback is responsive and functional but not showcase audio.
3. Only the Lanternforge Keeper received a bespoke generated identity in this pass; the full trainer and arena cast is not equivalently authored.
4. The first hard trainer can permanently retire a lone starter within seconds after covenant entry. The consequence is correctly disclosed and committed, but first-session difficulty/onboarding is below showcase tuning.

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
| Social/live reliability | 5.5 | 6.4 | 10 | Safe reconnecting mode and clean logical unavailability work; live canonical authority still needs deployment credentials |
| Content breadth/polish | 6.8 | 6.9 | 10 | This pass upgrades a flagship path, not every arena, settlement, raid, resident, or trainer |

Flagship-slice average: **7.88 / 10**, up from **5.24 / 10**. Whole-game observed readiness is **6.9 / 10** because the strongest interaction system is not yet matched by world-wide authored content, audio, and trainer/location coverage. This is materially advanced and mobile-first, but it is not yet honest to call the entire game equal to the best game experiences ever created.

### Next highest-value location work

1. Add an explicit first-trainer teaching/practice covenant or tuned opponent so a new lone starter learns guard/flee before permanent retirement is likely.
2. Apply the location-quality contract to every arena, settlement, Hearttree space, Prism activity, raid, and rift.
3. Give each trainer family a bespoke portrait/emblem/entrance/audio identity and distinct tactical behavior.
4. Replace fallback cues with authored spatial audio once the provider is available.
5. Run the same active-combat and return-to-world matrix for every location family, not only the flagship path.
