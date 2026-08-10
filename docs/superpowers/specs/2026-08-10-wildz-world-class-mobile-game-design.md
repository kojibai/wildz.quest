# Wildz World-Class Mobile Game Redesign

## Status

Approved direction on 2026-08-10. This specification defines the flagship-first redesign of Wildz into a premium, mobile-first living game world. It preserves Wildz identity, living creatures, progression, deterministic gameplay, and proof-native authority while replacing the current interaction hierarchy, trainer-battle presentation, location quality bar, mobile performance model, and release qualification.

The first implementation slice covers the uninterrupted journey from world exploration through a trainer battle and back into the changed world. The systems established by that slice become shared foundations for wild battles, Mortal Arena, raids, bosses, PvP, landmarks, settlements, and future games. This is the first phase of a complete program, not a reduction of the requested whole-game scope.

## Product outcome

Wildz should feel immediately understandable under two thumbs, technically advanced without looking complicated, responsive before remote services answer, and authored rather than procedurally sparse. The playable world must dominate the screen. Interface appears when it helps the next decision and recedes when the player is moving, watching, or fighting.

The redesign succeeds when a new mobile player can enter the world, understand movement, change their active creature, use a creature field power, recognize and challenge a trainer, complete a cinematic real-time fight, understand the result, and resume exploration without confusion, visible latency, clipped UI, or a disconnected modal transition.

## Existing baseline and reasons for change

The initial audit found systemic issues rather than one isolated responsive defect:

- portrait exploration exposes roughly seventeen interactive targets before combat;
- trainer and world navigation compete with status, progression, utility, collection, audio, and social controls;
- Mortal Arena compresses six equal-weight controls into one portrait-width row and removes their labels below 430 px;
- the initial production route loads approximately 836 KB of JavaScript before route-specific assets;
- unauthenticated local play repeatedly requests unauthorized session endpoints;
- development mode is blocked by a Content Security Policy that rejects the framework refresh runtime;
- the quality profile is selected from initial width and hardware hints rather than adapting to runtime measurements and orientation changes;
- location shells contain substantial systems, but player-facing hierarchy, authored identity, feedback, and mobile fit are inconsistent.

These findings establish a provisional baseline only. Final current-versus-rebuilt scores require the complete playtest matrix defined below.

## Delivery strategy

Implementation proceeds flagship-first.

1. Rebuild the complete mobile journey from exploration to trainer encounter, battle, result, and world return.
2. Extract the proven interaction, encounter, feedback, responsive, performance, and location contracts.
3. Apply those contracts to wild encounters, Mortal Arena, raids, bosses, PvP, Hearttree, Prism Arcade, settlements, and remaining world surfaces.
4. Qualify every place against the same location and release gates.

This order provides one coherent reference experience early and avoids producing a second generation of inconsistent one-off interfaces.

## Interaction principles

### Direct world interaction

Visible world objects are directly tappable.

- Tap a trainer to converse, inspect, or challenge.
- Tap a wild creature to inspect, approach, bond, or trigger the relevant contextual action.
- Tap terrain to move, scan, forage, or reveal an authored contextual marker.
- Tap a landmark to inspect or enter when the player is in range.

A generic persistent `Interact` button is not part of the world shell. If a target requires a special action, a compact prompt appears beside the target. It must not replace movement, the companion command, or the playable scene with a modal action bar.

### Persistent mobile hierarchy

The default exploration shell retains only:

- compact active-creature vitality and level;
- the current objective;
- orientation or map access;
- left-thumb movement;
- the active companion command under the right thumb;
- a minimal route to secondary functions.

Social, collection, crafting, profile, market, and progression surfaces remain available through a compact drawer or command menu. They do not occupy equal persistent weight with movement and the next world action.

### Active companion command

The right-thumb control is a living creature surface, not a generic button. It shows a small, tasteful portrait of the selected creature, its name or affinity, and the equipped field power. Neighboring eligible creature portraits peek behind the active portrait so the next and previous selection are visible without opening a menu.

The control supports four gestures:

- **Tap:** use the selected creature's equipped field power.
- **Horizontal swipe:** cycle the previous or next eligible creature into the active slot. The incoming portrait enlarges and previews its name and field power before release.
- **Upward swipe:** open the partial roster drawer. Continued pulling expands the detailed creature manager.
- **Hold and slide:** open the active creature's ability wheel, move across detented options, and release to equip or use the selected power.

Horizontal, vertical, hold, and tap recognition use one shared pointer-state machine with explicit thresholds, pointer capture, cancellation, and direction locking. The gesture engine must prevent a drawer pull from switching creatures, a short swipe from using an ability, or ordinary world scrolling from capturing the companion control.

### Roster drawer

The partial drawer presents eligible active creatures, portraits, current field powers, and party order. The player can tap to activate, swipe to browse, and drag to reorder. Pulling higher reveals stats, condition, loadout, and the full creature dossier. Pulling down returns to the exact prior world or combat state.

Opening the drawer does not require a server response. Exploration continues rendering and simulating while the partial drawer is open; releasing the movement thumb returns movement to neutral. During active competitive combat, the full roster drawer is unavailable unless the rules explicitly enter a safe or tactical-slow state. The rendered scene and underlying session remain preserved in every case.

### Haptic, visual, and audio language

Feedback is layered and consistent:

- a soft engagement tick when hold recognition opens a wheel;
- subtle detent ticks when the thumb crosses selectable options;
- a stronger confirmation pulse when a selection is released;
- a distinct cancellation pattern when the thumb returns to center or leaves the valid region;
- a magnetic snap and haptic tick when the active creature changes;
- synchronized portrait motion, label change, field-power highlight, and audio chirp.

Haptics and audio are enhancements, never the sole state indicator. Reduced-motion, muted, unsupported-vibration, and assistive-technology paths retain equivalent visual and semantic confirmation.

## Purposeful combat zones

Real-time combat uses stable thumb roles across trainer fights, Mortal Arena, raids, bosses, and compatible PvP encounters.

- Left thumb owns free movement and directional modifiers.
- The largest right-thumb target owns the primary strike.
- Guard and the active combat ability remain adjacent and reachable.
- Focus, swap, flee, items, and advanced actions become contextual gestures, compact secondary targets, or hold states rather than six equal buttons in a single row.
- Vitality, Break or guard pressure, opponent intent, and the current combat objective remain readable without obscuring the fighters.

Combat controls keep labels when players are learning. Expert compact modes may reduce labels only after the gesture and icon language has been taught. Portrait and landscape layouts may reposition zones, but their roles and relative reach remain consistent.

## Trainer-battle sequence

Trainer combat is one uninterrupted five-beat experience.

### 1. Recognition

Before interaction, the trainer has a distinctive silhouette, readable nameplate, level, affinity or roster hint, and challenge status. The player understands why this person matters without opening a menu.

### 2. Challenge

Tapping the trainer opens a fast in-world sheet with authored dialogue, stakes, estimated difficulty, roster choice, and available actions such as battle or talk. The world remains visible. Repeat encounters may compress dialogue while first meetings retain their identity.

### 3. Cinematic transition

A short authored transition moves the camera, reveals the arena, presents the trainer and creatures, and hides necessary asset preparation. The normal target is 0.8–1.2 seconds. It must be skippable on repeats without losing state or orientation.

### 4. Combat

The purposeful combat zones, readable opponent tells, responsive camera, hit pause, restrained VFX, spatial audio, haptics, and tactical arena features produce the fight. NPCs use legal deterministic inputs and do not receive hidden timing or rule advantages.

### 5. Consequence

The result visibly updates creature growth or condition, trainer memory, rewards, arena path, and the next world objective before returning control at the encounter location. Results are not presented as a detached stat card with no world consequence.

The same sequence language adapts to wild encounters, bosses, raids, PvP, and landmark trials while preserving their distinct stakes and presentation.

## Location quality contract

A place is complete only when it satisfies all eight layers below.

1. **Landmark silhouette:** recognizable in the world, map, thumbnail, and low-power mode.
2. **Signature interaction:** at least one mechanic that specifically belongs to the location.
3. **People and ecology:** NPCs, creatures, schedules, relationships, and reactive behaviors.
4. **Progression arc:** arrival, discovery, mastery, replay variation, and meaningful rewards.
5. **Audio identity:** ambience, musical motif, spatial cues, interactions, and state transitions.
6. **Visual storytelling:** materials, props, motion, lighting, weather, history, and transformation.
7. **Mobile performance:** authored levels of detail, stable frame pacing, fast entry, and uninterrupted layout.
8. **Persistent consequence:** visible memory of victories, choices, discoveries, damage, and recovery.

The contract applies to every arena, biome, settlement, landmark, activity space, and boss realm. A renamed shell, flat procedural clearing, static NPC card, generic reward panel, primitive-dominated scene, or glow-only reskin is an automatic failure.

Initial place families include:

- Verdant Heartlands: exploration, ecology, capture, routes, weather, roaming trainers, and biome-specific creature behavior.
- Arena of Echoes: practice, trainer variants, ranked stages, tournaments, hazards, spectators, and remembered victories.
- Hearttree Sanctum: traversal, restoration, environmental trials, rituals, relationships, and permanent consequences.
- Prism Arcade: racing, rhythm, score attack, short sessions, seasonal rules, and social comparison.
- Living settlements: distinct districts, residents, schedules, requests, crafting, social memory, commerce, and visible change.
- Rifts and boss realms: authored approaches, escalating hazards, cooperative roles, phase transformations, unique rewards, and aftermath.

## Shared architecture

### Gesture engine

A reusable gesture engine owns pointer capture, tap/hold thresholds, axis locking, velocity, detents, cancellation, accessibility alternatives, and feedback events. Components consume semantic gestures instead of implementing overlapping pointer rules independently.

### Active companion controller

One controller owns the selected creature, peek portraits, optimistic local switching, field-power selection, roster drawer state, party order, and persistence proposals. World, battle, and overlay projections subscribe to the same active selection.

### Responsive game shell

The shell owns safe areas, thumb zones, HUD density, portrait and landscape composition, text enlargement, reduced motion, screen-reader landmarks, and secondary navigation. Feature surfaces provide content and semantic actions; they do not independently invent viewport behavior.

### Encounter director

The director owns recognition, challenge, preloading, cinematic transition, arena entry, combat phase, result, persistence proposal, and world return. It exposes declared hooks for trainer, wild, boss, raid, PvP, and landmark encounter types.

### Location modules

Each place declares its stable identity, environment kit, signature interactions, NPC and ecology set, progression arc, audio scene, quality tiers, persistent consequences, and verification fixtures. Shared rendering and gameplay systems remain reusable while authored content remains location-specific.

### Feedback bus

Deterministic gameplay and semantic UI events publish to one feedback bus. Camera response, animation, haptics, audio, VFX, hit pause, and accessible announcements consume the same event with platform-appropriate intensity.

### Performance governor

Quality selection adapts to measured frame timing, memory pressure, pixel density, thermal or visibility signals where available, orientation, and runtime failures. It chooses authored geometry, texture, effect, shadow, animation, and resolution tiers. It must be able to improve or reduce quality after startup.

### Persistence boundary

Player input updates local presentation immediately. Deterministic gameplay produces domain events. Persistence and proof workflows consume those events through the existing save scheduler and outbox boundaries. Remote verification or publication does not block gesture feedback.

The primary data flow is:

`thumb input -> immediate local state -> animation/haptic/audio feedback -> deterministic gameplay event -> persistence/outbox -> verified world projection`

## Error handling and recovery

- Missing network or proof services cannot freeze movement, selection, combat controls, or drawers.
- Unauthorized or unavailable remote sessions use bounded backoff and do not generate duplicate retry loops.
- Failed synchronization becomes a compact, retryable player status with diagnostic evidence rather than repeated console noise.
- Interrupted deterministic battles resume from a valid snapshot or resolve through an explicit encounter rule.
- Failed hero-asset loads fall back to authored lower-detail representations that preserve silhouette and gameplay readability.
- Orientation changes, resizing, backgrounding, pointer cancellation, and navigation cannot strand gesture or combat state.
- Error boundaries distinguish recoverable surface failure from world-session failure and preserve the last known safe state.

## Performance and accessibility targets

- Pressed-state visual feedback appears within one rendered frame.
- Hold recognition and drawer movement begin within 100 ms.
- Opening, switching, selecting, and initial local feedback require zero network round trips.
- Capable phones target stable 60 FPS; lower-power devices receive an authored stable 30 FPS tier.
- Supported layouts span 320 px portrait through phone landscape, tablet, and desktop without clipped controls or unreadable state.
- Primary touch targets are at least 44 CSS pixels and respect platform safe areas.
- The first route and gameplay assets are progressively loaded; the current approximately 836 KB first-load route is reduced through code and asset splitting.
- Development and production run without blocking Content Security Policy errors or repeated unauthorized request spam.
- Text enlargement, reduced motion, muted audio, unavailable haptics, keyboard, controller, and screen-reader paths retain the complete decision model.

## Comparative experience rating

The current and rebuilt game receive independent 0–10 scores in:

- first-session clarity;
- world exploration;
- combat depth and responsiveness;
- mobile controls;
- camera quality;
- creature identity and animation;
- arena and location craftsmanship;
- art direction and materials;
- VFX and motion;
- audio and haptics;
- narrative delivery;
- progression and rewards;
- social and multiplayer experience;
- accessibility;
- performance and stability;
- replay value;
- emotional impact;
- originality and cohesion.

Comparisons use direct experience standards: premium mobile production and responsiveness, console-quality exploration, top-tier action feedback, strong creature attachment, excellent touch interaction, and seamless cross-platform polish. Wildz receives no credit merely for system count, architectural ambition, novelty claims, or legacy assumptions. Only understandable, playable, responsive, memorable, and visibly finished behavior contributes to the score.

## Verification matrix

Release qualification requires browser playthroughs and evidence for:

- first launch and explorer selection;
- movement, direct world tapping, companion cycling, ability selection, and roster drawer behavior;
- trainer recognition, challenge, transition, combat, result, and world return;
- wild combat, Mortal Arena, raids, bosses, compatible PvP, and failure or restart paths;
- every landmark and location family against the eight-layer contract;
- collection, progression, crafting, market, profile, social, and major overlay access;
- phone portrait at 320, 360, 390, and 430 widths; representative phone landscape, tablet, and desktop layouts;
- text enlargement, reduced motion, keyboard, controller where supported, screen reader, audio-muted, and haptics-unavailable modes;
- offline entry, remote-service failure, unauthorized sessions, background and resume, orientation change, interrupted persistence, and asset fallback;
- production build, typecheck, tests, console and page errors, nonblank canvas pixels, renderer diagnostics, frame timing, input responsiveness, and before-and-after screenshots.

The final report includes the experience rating, the game director's ten-category visual scorecard, performance evidence, phase and asset-sourcing ledgers, automatic failures remaining, and a prioritized gap list. No world-class, premium, complete, or release-ready claim is allowed while an automatic failure remains.

## Out of scope for the first implementation slice

The first slice does not finish every location simultaneously. It establishes and verifies the shared systems through the trainer-battle journey. Applying those systems and authoring the full content of every place follows as explicit subsequent phases in the same program. Existing Receiz authority, custody, ownership, market fail-closed behavior, and verified artifact rules remain unchanged unless a later approved specification explicitly changes them.
