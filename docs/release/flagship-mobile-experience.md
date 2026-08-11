# Wildz flagship mobile experience — release evidence

This qualification covers the rebuilt living-world controls and one complete trainer path. It does not represent every Wildz location as premium. The machine-readable source of truth is `output/playwright/task-8-browser-evidence.json`; this document deliberately points each release claim to a JSON record or named artifact.

## Evidence key

| ID | Machine-readable record or artifact |
| --- | --- |
| E1 | `commands` — six exact executable Playwright CLI commands with matching saved-script and result SHA-256 values; stale historical commands are excluded |
| E2 | `fullSevenStateMatrix.constituent.records` — seven complete state rows including 28 panel captures, constituent geometry, modal ownership, focus, Escape, and restoration |
| E3 | `fullSevenStateMatrix.constituent.records[*].resting` and `imageSignalStats.constituent.rows` — canvas/display/drawing-buffer, DPR, renderer, target, collision, overflow, and pixel-variance measurements |
| E4 | `interactionRecovery.twoTouch`, `touchCancel`, and `lostCapture` |
| E5 | `interactionRecovery.keyboardOnly`, `text200`, and `reducedMotion` |
| E6 | `interactionRecovery.offline`, `lifecycle`, and `audio` |
| E7 | `interactionRecovery.performance120Frames` |
| E8 | `drawerHaptics.variants` |
| E9 | `trainerSevenStateMatrix.constituent` plus `trainerTransitionSeven.constituent` — physically reached trainer challenge/combat/result/return and one live transition resized through all seven viewports |
| E10 | `cleanProduction` — final rebuilt listener-before-navigation console, page-error, request-failure, and HTTP status capture |
| E11 | `automatedGates` |
| E12 | `externalAssetSourcing` |
| E13 | `claimIndex` |
| E14 | Tracked bundle `docs/release/evidence/final-integration/`: manifest `final-integration-evidence-manifest.json` (SHA-256 `37acd7c96e2947eaeedce80d939017c9ff8e69b866da0007bb1fd7fcc375eebf`), replay script (SHA-256 `0cbc544102b97e5268f89a33f11e24a18446dbc311dd9f5fea9666254af314f9`), structured result (SHA-256 `0a7fd11f3c8589cd406a473a0fbf4ce751239f733363221f02cfcd48cd27fa9c`), executable validator `validate-final-integration-evidence.mjs` (SHA-256 `6283dbc3f61b54826672eaf7a4e4ad9e878b5392c9c070d277e3515f72ada9de`), five hashed screenshots, and tracked final report — recorded product-commit/build-ID metadata, listener-before-navigation, modal lifetime, ability, owner-cancellation, and gate evidence |

## Release outcome

- The world-tool sheet is now the stage-level exclusive modal owner: identity, mission, map, multiplayer, world-status, movement, companion, and tools homes cannot retain focus or receive same-frame actions. This passed for Field Guide, Foraging Satchel, Trail Pack, and Card Vault at all seven viewports (28/28 panel rows), including stale-status collapse and focus restoration. [E2]
- The focused panel-owned action evidence is a same-execution schema-v3 pair: its retained script produced the recorded Command Center→map and Living Story→trainer result and both final screenshots. Every command, result, artifact, and release-document hash in the v4 evidence bundle was revalidated after capture; stale `-r3` signal-stat rows are not retained. [E1, E9, E13]
- Every final panel capture contains no top, bottom, companion, movement, or tools control painted above the modal. [E2]
- Seven production viewports render a full-viewport canvas with zero overflow and no collisions among interactive homes. All interactive targets meet 44 px; the D-pad meets 68 px. Each row records DPR, drawing buffer, draw calls, triangles, geometries, textures, safe bounds, and nonblank/color-variance evidence. [E3]
- Real two-touch CDP input moved the player while the companion command independently reached its ability state; `touchCancel` and `lostpointercapture` both returned the D-pad and companion command to settled states. [E4]
- A complete physically reached Nahl Vey route records challenge, transition, full combat, safe-retreat result, and world return. Challenge/combat/result/return were measured at all seven viewports; one real pre-covenant transition was paused after it became visible, resized through all seven viewports, resumed, and completed through a real Flee/Continue return. The discovered 844×390 challenge overflow was fixed under regression coverage; the final sheet is `[386,8,440,374]`, fully in viewport, with a 44×44 close target. [E9]
- The final clean production profile attached listeners before navigation and observed zero console errors, console warnings, page errors, request failures, and HTTP responses ≥400 after controls became visible and a five-second settling window completed. [E10]
- The rebuilt flagship slice is production-capable, but content breadth and authored audio still prevent a whole-game showcase claim. [E12, scorecard and automatic failures below]
- The proof explorer now opens the real profile, and Card Vault opens the real Market without restoring the removed chassis. Both returned to the mounted world in the final 390×844 production replay. [E14]
- Companion ability selection is causal by keyboard and pointer: the final replay selected named abilities and changed authoritative energy, XP, bond, and event state through each selected ability's real reducer action. Keyboard commit and cancel restored the connected companion control. [E14]
- Profile and Market now retain shell-modal ownership for their complete open lifetime. Profile held the world inert and `aria-hidden`; repeated keyboard input and two companion action attempts left recorded world state unchanged, focus stayed trapped, and Escape restored the identity origin. Market separately proved world inertness/`aria-hidden`, focus containment, Escape restoration to the persistent world-tools origin, local unavailable presentation, and zero `/api/market/listings` requests; the replay did not attempt background Market actions. The ability listbox owned real DOM focus and its `aria-activedescendant`; pointer and keyboard paths changed the selected named ability. [E14]
- The focused ability composite now consumes all four arrow keys without producing explorer movement: production position remained exactly X -2, Z -1 while every arrow changed `aria-activedescendant`. Claiming Profile ownership from an A-open wheel synchronously removed the wheel, cancelled its focus RAF and any owned pointer capture, and kept focus inside the inert-gated modal; normal commit and Escape still restore companion focus. [E14]
- E14 capture metadata records product commit `c26ae652894db84868c0343c108c048aa32d0fb4`, build ID `pVMRsX8Mh21tHuB69B34C`, `http://127.0.0.1:49816/`, Chromium 152 at 390×844. Validation proves the product commit is an ancestor of this release evidence and optionally compares a present local `.next/BUILD_ID`; a fresh checkout cannot independently attest the untracked captured `.next` artifact without rebuilding. Precise machine claims are `.listenerEvidence`, `.profile`, `.market`, `.keyboardAbility`, `.pointerAbility`, and `.ownerCancellation`. Profile's exact twelve-Tab sequence wrapped the four visible labels three times. `manifest.capturePathMap` resolves every raw path-bearing result field to its tracked copy, and the exact validation command checks independent literal expectations plus all nine tracked artifact hashes, byte sizes, modes, and Git membership. [E14]

## Skill-loading ledger

| Discipline | Loaded guidance | Applied result | Evidence |
| --- | --- | --- | --- |
| Gameplay systems | `threejs-gameplay-systems` | Deterministic gestures, cancellation, trainer phases, mobile combat inputs | E4, E9 |
| AAA graphics | `threejs-aaa-graphics-builder` | Composited visual review and honest ten-category scorecard | E2, E9, scorecard below |
| UI | `threejs-game-ui-designer` | Full-screen modal ownership, responsive sheets, focus trap, thumb controls | E2, E3, E5 |
| Debug/profile | `threejs-debug-profiler` | Recovery, frame sample, clean console/network profile | E4, E6, E7, E10 |
| QA/release | `threejs-qa-release` and Playwright | Production browser matrix and retained artifacts | E1–E11 |
| 3D generator | `threejs-3d-generator` | Loaded; no generation because the provider probe returned blank/inconclusive values | E12 |
| Image generator | `imagegen` / image workflow | Existing project-bound Lanternforge portrait and emblem retained | E12 |
| Audio generator | `threejs-audio-generator` | Loaded; the blank/inconclusive provider probe left the existing Web Audio fallback as the qualified path | E12 |

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
TRIPO_API_KEY=
GEMINI_API_KEY=
ELEVENLABS_API_KEY=
```

The literal blank output is classified **inconclusive/empty**, not “missing.” Chosen sources are hybrid. Hero/player: the deterministic Kai Pulse explorer. World/sky/background: the procedural Three.js world. Materials/textures/decals: existing runtime materials plus the Lanternforge emblem. The Lanternforge Keeper uses `public/game/trainers/lanternforge-keeper-portrait.webp` and `public/game/trainers/lanternforge-emblem.webp`. No new 3D model was generated during this qualification because provider availability could not be established from the blank probe; the external generation lane was therefore offline-only for this run. [E12]

Audio uses the existing gesture-unlocked, settings-aware Web Audio runtime for companion detents, trainer recognition, impacts, danger/results, and scene ambience. No external audio file is claimed because the ElevenLabs probe was blank/inconclusive; external audio sourcing was offline-only for this run, and authored spatial audio remains a release gap. [E6, E12]

## Unified-control and accessibility matrix

| Route/state | Objective result | Evidence |
| --- | --- | --- |
| Seven-viewport complete state matrix | 7/7 resting, simultaneous input, roster, every ability sector plus cancel, tools, four panels, map, mission, status, and orientation recovery pass. Horizontal cycle correctly no-ops because the acquired second card is retired; a visible sealed-name change remains unqualified | E2, E3 |
| Four command panels | 28/28 rows in-bounds, stage-exclusive, focus-contained, Escape/restoration pass | E2 |
| Seven viewport fit | 7/7 full-canvas, zero-overflow, zero interactive collision, target-floor and safe-bound rows pass | E3 |
| Real two-touch | Pointer IDs 41/42 moved world and activated companion concurrently, then settled | E4 |
| Cancellation | `touchCancel` and `lostpointercapture` reset ownership and knob transform | E4 |
| Keyboard-only | Tab reached semantic homes, opened Field Guide, focused its close control, and restored trigger focus | E5 |
| 200% text | Root font computed to 32 px with zero overflow and controls inside 390×844 | E5 |
| Reduced motion | Media query matched; fan animation was `none`; transitions were `0s` | E5 |
| Offline | Local map dialog remained usable with three canvases and zero overflow; the deliberately offline atlas failure is recorded as expected | E6 |
| Lifecycle | Frozen→active CDP approximation returned visible with two canvases and zero overflow | E6 |
| Audio | Status settings reported sound ready; mute and unmute states both changed | E6 |
| Haptic absence/failure | Missing, non-callable, and throwing `navigator.vibrate` variants all opened the drawer and kept the page alive | E8 |
| Trainer/combat/result/return | Physical travel plus challenge, one live seven-resize transition, covenant, Arena, safe retreat settlement, Continue, and world return pass; renderer budget failures remain disclosed below | E9 |
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

Retained panel artifacts are `output/playwright/unified-controls-{field-guide,foraging-satchel,trail-pack,card-vault}-{320x568,360x800,390x844,430x932,844x390,768x1024,1440x900}-r4.png`. Trainer challenge/transition/combat/result/return artifacts use the same seven-size `-r4.png` contract. The fresh final frame is `unified-controls-clean-console-390x844.png`. All retained final artifact hashes are under `artifactHashes`. [E2, E9, E10]

Desktop and mobile composited screenshots were visually inspected at rendered pixel level; the world, sheets, trainer challenge, Arena, result, and return frames are visibly nonblank. [E2, E9, E10]

## Performance and automated verification

- The warm 120-frame representative sample recorded 29.51 ms average, 33.89 fps average, 33.4 ms p95, and 58 ms maximum. [E7]
- The trainer transition measured 344 calls and 120,918 triangles and was over the configured renderer budget at all seven sizes. Challenge/combat/result also exceeded the draw-call budget at 844×390 and 1440×900. The trainer resize replay emitted 22 `GL_INVALID_OPERATION` vertex-buffer warnings; the separate clean resting profile remained clean. These are release residuals, not erased by the clean profile. [E9, E10]
- `pnpm test` passed 1,058/1,058 across 109 suites; `pnpm typecheck` passed; `pnpm lint` exited zero with no warnings; `pnpm build` passed with the known `snarkjs` dynamic web-worker warnings. [E11, E14]
- `pnpm release:check` passed: 1,058/1,058 tests, typecheck, Receiz v118 check, conformance 15/15, warning-free lint, secret scan across 745 text files, optimized 561 kB `/` first load, and doctor compatibility. [E11, E14]

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
| Performance evidence | 1 | Evidence is objective and retained, but 33.89 fps average, seven transition budget failures, six wide-view challenge/combat/result failures, and 22 GL vertex-buffer warnings are below production target | E3, E7, E9, E10 |

Average: **2.0 / 3**.

Automatic failures remaining:

1. The evidence covers one complete trainer route, not every arena, settlement, raid, resident, or trainer. [E9]
2. Externally authored encounter audio remains unqualified because the ElevenLabs credential probe was blank/inconclusive. [E12]
3. Only the retained Lanternforge trainer imagery is identified as bespoke generated trainer art; the full cast is not equivalently evidenced. [E12]
4. The player-facing capture path produced a second retired card. Horizontal cycle correctly no-opped at all seven sizes, so a visible sealed-name cycle remains unqualified. [E2]
5. Trainer transition renderer budget fails at all seven sizes; challenge/combat/result exceed budget at 844×390 and 1440×900, and the trainer resize run emits 22 GL vertex-buffer warnings. [E7, E9]
6. The core matrix records one cancelled Next.js card preload (`net::ERR_ABORTED`); it caused no console/page error or failed user action, but the route is not claimed network-clean. [E2]
7. The final integration replay had no real retired-card QA profile, so memorial browser replay was not fabricated; memorial ownership, focus containment, Escape, and cleanup are qualified by automated lifecycle contracts only. [E14]

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
| Performance/latency | 6.0 | 5.8 | 10 | E7, E9, E10 |
| Responsive/accessibility | 4.0 | 8.8 | 10 | E2, E3, E5 |
| Progression/replay | 8.2 | 8.4 | 10 | E9 |
| Social/live reliability | 5.5 | 6.4 | 10 | E6, E10 |
| Content breadth/polish | 6.8 | 6.9 | 10 | E9, E12 |

Flagship-slice average: **7.74 / 10**, up from **5.24 / 10**. Whole-game observed readiness remains **6.9 / 10** because one strong route is not evidence of world-wide authored parity. [E9, E12, automatic failures above]

## Next highest-value work

1. Re-run the same active-combat/result/return evidence contract for every trainer and location family. [Gap: E9 covers one route]
2. Give every arena and settlement a distinct art, encounter, and interaction identity, then add them to the retained visual matrix. [Gap: E9]
3. Re-probe provider availability and replace fallback cues with authored spatial audio when a usable credential is confirmed. [Gap: E12]
4. Optimize the trainer/Arena draw-call path and eliminate the vertex-buffer warnings before restoring a premium performance score. [Gap: E7, E9]
5. Provide a reachable second non-retired companion in the fresh-player loop and re-run visible sealed-name cycle evidence. [Gap: E2]
