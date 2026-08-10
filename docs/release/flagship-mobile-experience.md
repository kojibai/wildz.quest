# Wildz flagship mobile experience — release evidence

This qualification covers the rebuilt living-world controls and one complete trainer path. It does not represent every Wildz location as premium. The machine-readable source of truth is `output/playwright/task-8-browser-evidence.json`; this document deliberately points each release claim to a JSON record or named artifact.

## Evidence key

| ID | Machine-readable record or artifact |
| --- | --- |
| E1 | `commands` — exact executable Playwright CLI commands, saved scripts, and script SHA-256 values |
| E2 | `panelMatrix.rows` — 12 panel rows with constituent geometry, hit tests, inert/ARIA state, focus containment, Escape, restoration, and screenshot paths |
| E3 | `sevenViewportGeometry` — exact canvas, overflow, and command-centering measurements |
| E4 | `interactionRecovery.twoTouch`, `touchCancel`, and `lostCapture` |
| E5 | `interactionRecovery.keyboardOnly`, `text200`, and `reducedMotion` |
| E6 | `interactionRecovery.offline`, `lifecycle`, and `audio` |
| E7 | `interactionRecovery.performance120Frames` |
| E8 | `drawerHaptics.variants` |
| E9 | `trainerCombat.navigation` and `trainerCombat.states` |
| E10 | `cleanProduction` — listener-before-navigation console, page-error, request-failure, and HTTP status capture |
| E11 | `automatedGates` |
| E12 | `externalAssetSourcing` |
| E13 | `claimIndex` |

## Release outcome

- The world-tool sheet is now the exclusive modal owner: every non-modal control home becomes inert and ARIA-hidden, the tools trigger becomes disabled and ARIA-hidden, pointer hit tests resolve to modal content, programmatic focus is contained, Tab and Shift+Tab wrap, Escape closes, and prior focus/home state restores. This passed for Field Guide, Foraging Satchel, Trail Pack, and Card Vault at 390×844, 844×390, and 768×1024. [E2]
- The four phone captures and eight representative landscape/tablet captures contain no companion, movement, or tools control painted above the modal. [E2]
- Seven production viewports render a canvas exactly equal to the viewport with zero horizontal document overflow; the bottom command center is centered within 0.008 px. [E3]
- Real two-touch CDP input moved the player while the companion command independently reached its ability state; `touchCancel` and `lostpointercapture` both returned the D-pad and companion command to settled states. [E4]
- A complete trainer route used visible D-pad travel, opened Nahl Vey’s challenge and transition, held the 1.1-second covenant, entered the full-screen mobile Arena, used the safe Flee hold, showed the sealed “Retreat survived” result, and returned to the world at X11/Z18. [E9]
- The final clean production profile attached listeners before navigation and observed zero console errors, console warnings, page errors, request failures, and HTTP responses ≥400 after controls became visible and a five-second settling window completed. [E10]
- The rebuilt flagship slice is production-capable, but content breadth and authored audio still prevent a whole-game showcase claim. [E12, scorecard and automatic failures below]

## Skill-loading ledger

| Discipline | Loaded guidance | Applied result | Evidence |
| --- | --- | --- | --- |
| Gameplay systems | `threejs-gameplay-systems` | Deterministic gestures, cancellation, trainer phases, mobile combat inputs | E4, E9 |
| AAA graphics | `threejs-aaa-graphics-builder` | Composited visual review and honest ten-category scorecard | E2, E9, scorecard below |
| UI | `threejs-game-ui-designer` | Full-screen modal ownership, responsive sheets, focus trap, thumb controls | E2, E3, E5 |
| Debug/profile | `threejs-debug-profiler` | Recovery, frame sample, clean console/network profile | E4, E6, E7, E10 |
| QA/release | `threejs-qa-release` and Playwright | Production browser matrix and retained artifacts | E1–E11 |
| 3D generator | `threejs-3d-generator` | Loaded; no generation because Tripo and Gemini credentials were missing | E12 |
| Image generator | `imagegen` / image workflow | Existing project-bound Lanternforge portrait and emblem retained | E12 |
| Audio generator | `threejs-audio-generator` | Loaded; Web Audio fallback retained because ElevenLabs credential was missing | E12 |

## Reference ledger

Gameplay workflows, the AAA visual scorecard and quality gates, UI patterns plus game-UI/HUD/responsive checklists, debug/performance/mobile checklists, QA visual/playtest/release checklists, and audio workflows were loaded before qualification. Their applied browser evidence is indexed by phase in E2–E10.

## Phase ledger

| Phase | Status | Evidence |
| --- | --- | --- |
| Gameplay systems | Done for the flagship route | E4, E9 |
| External asset sourcing | Done with credential blockers disclosed | E12 |
| AAA graphics | Qualified, not showcase across the full game | E2, E9, scorecard below |
| UI | Done for unified living-world controls | E2, E3, E5 |
| Debug/profile | Done for the tested production route | E4, E6, E7, E10 |
| QA/release | Done when all automated gates below are green | E11 |

## External asset sourcing

Credential probe output:

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

Chosen sources are hybrid. Hero/player: the deterministic Kai Pulse explorer. World/sky/background: the procedural Three.js world. Materials/textures/decals: existing runtime materials plus the Lanternforge emblem. The Lanternforge Keeper uses `public/game/trainers/lanternforge-keeper-portrait.webp` and `public/game/trainers/lanternforge-emblem.webp`. No new 3D model was generated because both 3D provider credentials were missing. [E12]

Audio uses the existing gesture-unlocked, settings-aware Web Audio runtime for companion detents, trainer recognition, impacts, danger/results, and scene ambience. No external audio file is claimed because `ELEVENLABS_API_KEY=MISSING`; authored spatial audio remains a release gap. [E6, E12]

## Unified-control and accessibility matrix

| Route/state | Objective result | Evidence |
| --- | --- | --- |
| Four command panels | 12/12 phone/landscape/tablet rows exact-viewport, in-bounds, exclusive, focus-contained, Escape/restoration pass | E2 |
| Seven viewport fit | 7/7 full-canvas, zero-overflow rows pass | E3 |
| Real two-touch | Pointer IDs 41/42 moved world and activated companion concurrently, then settled | E4 |
| Cancellation | `touchCancel` and `lostpointercapture` reset ownership and knob transform | E4 |
| Keyboard-only | Tab reached semantic homes, opened Field Guide, focused its close control, and restored trigger focus | E5 |
| 200% text | Root font computed to 32 px with zero overflow and controls inside 390×844 | E5 |
| Reduced motion | Media query matched; fan animation was `none`; transitions were `0s` | E5 |
| Offline | Local map dialog remained usable with three canvases and zero overflow; the deliberately offline atlas failure is recorded as expected | E6 |
| Lifecycle | Frozen→active CDP approximation returned visible with two canvases and zero overflow | E6 |
| Audio | Status settings reported sound ready; mute and unmute states both changed | E6 |
| Haptic absence/failure | Missing, non-callable, and throwing `navigator.vibrate` variants all opened the drawer and kept the page alive | E8 |
| Trainer/combat/result/return | Physical travel, challenge, transition, covenant, Arena, safe retreat settlement, Continue, world return pass | E9 |
| Clean production console/network | 0 errors, warnings, page errors, failed requests, and HTTP errors | E10 |

## Responsive browser geometry

| Viewport | Canvas | Overflow | Command center X delta | Evidence |
| --- | --- | ---: | ---: | --- |
| 320×568 | 320×568 | 0 | 0 px | E3 |
| 360×800 | 360×800 | 0 | 0.0078125 px | E3 |
| 390×844 | 390×844 | 0 | 0 px | E3 |
| 430×932 | 430×932 | 0 | 0 px | E3 |
| 844×390 | 844×390 | 0 | 0 px | E3 |
| 768×1024 | 768×1024 | 0 | 0 px | E3 |
| 1440×900 | 1440×900 | 0 | 0 px | E3 |

Retained panel artifacts are `output/playwright/unified-controls-{field-guide,satchel,trail-pack,card-vault}-{390x844,844x390,768x1024}.png`. Trainer artifacts are `unified-controls-trainer-settled-390x844.png`, `unified-controls-trainer-390x844.png`, `unified-controls-trainer-transition-390x844.png`, `unified-controls-combat-390x844.png`, `unified-controls-result-390x844.png`, and `unified-controls-return-390x844.png`. The fresh final frame is `unified-controls-clean-console-390x844.png`. [E2, E9, E10]

Desktop and mobile composited screenshots were visually inspected at rendered pixel level; the world, sheets, trainer challenge, Arena, result, and return frames are visibly nonblank. [E2, E9, E10]

## Performance and automated verification

- The warm 120-frame sample recorded 16.555833 ms average, 60.40167 fps average, 16.8 ms p95, and 16.8 ms maximum. [E7]
- `pnpm test` passed 1,040/1,040; `pnpm typecheck` passed; `pnpm lint` exited zero with the two disclosed pre-existing exhaustive-deps warnings; `pnpm build` passed with a 557 kB `/` first load and the known `snarkjs` dynamic web-worker warnings. [E11]
- `pnpm release:check` passed after the production browser/server closed: 1,040 tests, Receiz conformance 15/15, secret scan, lint/type validation, optimized build, and doctor compatibility all completed successfully. [E11]

## Ten-category AAA visual scorecard

Scale: 0 absent, 1 prototype, 2 production-capable, 3 showcase. This scores the browser-observed rebuilt slice, not franchise history or legacy. Panel and trainer/combat screenshots are the visual evidence. [E2, E9]

| Category | Score | Observed reason | Evidence |
| --- | ---: | --- | --- |
| Art direction | 2 | Cohesive emerald, charcoal, gold, and proof language; biome identity is not equally bespoke everywhere | E2, E9 |
| Hero/player | 2 | Explorer and companion silhouettes are readable; close-up animation is below showcase | E9 |
| Obstacles/enemies | 2 | Trainer/rival hierarchy reads clearly; opponent presentation breadth is limited | E9 |
| Rewards/interactables | 2 | Trainer prompt, result rewards, and direct controls are legible; environmental verb breadth remains limited | E9 |
| World/environment | 2 | Layered world and purposeful Arena exist; this qualification does not prove every place has bespoke density | E9 |
| Materials/textures | 2 | Consistent stylized materials and trainer imagery; location-wide surface variation is not showcase | E2, E9, E12 |
| Lighting/render | 2 | Silhouettes remain readable in world and Arena; cinematic lighting is not proved across all locations | E9 |
| VFX/motion | 2 | Transition, combat state, modal motion, and reduced-motion fallback are coherent; signature effects breadth is limited | E5, E9 |
| UI/HUD | 3 | Full-screen world, thumb homes, exclusive panels, focus containment, and responsive reflow are release-strong | E2, E3, E5 |
| Performance evidence | 3 | Seven-view geometry, 120-frame sample, and clean production capture are objective and retained | E3, E7, E10 |

Average: **2.2 / 3**.

Automatic failures remaining:

1. The evidence covers one complete trainer route, not every arena, settlement, raid, resident, or trainer. [E9]
2. Externally authored encounter audio remains blocked by the missing ElevenLabs credential. [E12]
3. Only the retained Lanternforge trainer imagery is identified as bespoke generated trainer art; the full cast is not equivalently evidenced. [E12]

## Experience rating versus the best current game experiences

The ceiling is an experience benchmark of 10, independent of age, brand, sales, or legacy. The rebuilt scores reflect the tested flagship route and retained artifacts; categories outside that route stay conservative. [E2–E10]

| Experience category | Baseline | Rebuilt | Ceiling | Evidence |
| --- | ---: | ---: | ---: | --- |
| First-session immediacy | 4.5 | 8.5 | 10 | E10 |
| Movement and camera | 5.5 | 7.8 | 10 | E4, E9 |
| Thumb controls | 3.8 | 8.6 | 10 | E2–E4 |
| Interaction discoverability | 4.0 | 8.2 | 10 | E2, E9 |
| Companion UX | 3.5 | 8.8 | 10 | E4, E8 |
| Combat readability | 4.2 | 8.1 | 10 | E9 |
| Combat depth | 6.8 | 7.6 | 10 | E9 |
| Encounter transitions | 3.2 | 8.3 | 10 | E9 |
| Identity/personalization | 5.5 | 9.0 | 10 | E9, E12 |
| World art density | 6.4 | 7.0 | 10 | E9 |
| Arena/place distinctiveness | 5.8 | 7.0 | 10 | E9 |
| Narrative/objectives | 6.2 | 6.8 | 10 | E9 |
| Audio/haptics | 4.5 | 7.3 | 10 | E6, E8, E12 |
| Performance/latency | 6.0 | 8.4 | 10 | E7, E10 |
| Responsive/accessibility | 4.0 | 8.8 | 10 | E2, E3, E5 |
| Progression/replay | 8.2 | 8.4 | 10 | E9 |
| Social/live reliability | 5.5 | 6.4 | 10 | E6, E10 |
| Content breadth/polish | 6.8 | 6.9 | 10 | E9, E12 |

Flagship-slice average: **7.88 / 10**, up from **5.24 / 10**. Whole-game observed readiness remains **6.9 / 10** because one strong route is not evidence of world-wide authored parity. [E9, E12, automatic failures above]

## Next highest-value work

1. Re-run the same active-combat/result/return evidence contract for every trainer and location family. [Gap: E9 covers one route]
2. Give every arena and settlement a distinct art, encounter, and interaction identity, then add them to the retained visual matrix. [Gap: E9]
3. Replace fallback cues with authored spatial audio after the provider credential is available. [Gap: E12]
