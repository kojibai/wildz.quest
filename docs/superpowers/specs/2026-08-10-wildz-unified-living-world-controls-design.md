# Wildz Unified Living-World Controls Design

Approved visual direction on 2026-08-10. This specification defines the first bounded sub-project in the full-game completion program: replace the unfinished stacked bottom deck and overlapping HUD with one edge-to-edge living-world control shell. It preserves every current function while changing where and how those functions are reached.

## Product intent

Wildz is a living companion adventure first. The world remains the visual foundation at every moment; controls feel embedded in that world instead of attached as a separate application panel. A new mobile player can move and act immediately with either thumb, while an expert can cycle companions, select abilities, and open systems without latency or hand repositioning.

This sub-project is successful when the player sees the full world from edge to edge, every persistent control has a stable non-overlapping home, the active creature button shows the creature's real sealed individual name, and all secondary functions expand from a small number of meaningful sources.

## Non-negotiable rules

1. The world canvas fills the entire playable viewport in portrait and landscape.
2. No opaque or full-width bottom panel, deck background, footer, or second toolbar may reduce the world canvas.
3. Controls overlay the world individually. Glass or material backing exists only underneath the touched control or its expanded surface.
4. Every persistent HUD element has one declared home and collision boundary.
5. The active companion displays `activeCard.manifest.name`, the proof-sealed individual name. Family, form, species, or catalog names never replace it.
6. Existing gameplay and application functions remain reachable: identity/profile, mission, map, live state, sharing, audio, camp, walk/run, Field Guide, Satchel, Trail Pack, Card Vault, movement, field power, companion cycling, roster selection, and abilities.
7. Secondary functions remain collapsed until the player requests them. Expansion originates spatially from the control that owns the function.
8. Direct tapping of visible world actors and terrain remains the normal interaction model. No generic Interact button returns.
9. Primary movement and companion actions remain usable without opening a menu.
10. Touch, pointer, keyboard, reduced-motion, safe-area, offline, and unavailable-haptics behavior remain supported.

## Resting layout

The resting state contains only the information and controls needed during ordinary exploration.

### Top safe-zone homes

- Top-left: compact proof-bound explorer identity. It may show the explorer portrait, short identity label, level, and vitality, but must not duplicate companion or mission information.
- Top-center: compact current mission/progress control. It opens mission detail and yields horizontally before colliding with either corner.
- Top-right: minimap and heading. Map expansion originates here.
- Right edge below the minimap: one collapsed world-status fan for live connection, sharing, and audio. Only the most important current state is visible while collapsed.

These controls use a shared HUD layout solver driven by viewport bounds, safe-area insets, text scale, and the measured bounding boxes of adjacent controls. Components may not independently choose arbitrary top offsets.

### Bottom thumb-zone homes

- Bottom-left: the movement control, overlaid directly on the world. Camp and walk/run are a small two-item fan anchored above or beside movement, never a separate rail.
- Bottom-center: a minimal Wildz world-tools pill. It is the sole resting entry point for Field Guide, Satchel, Trail Pack, and Card Vault.
- Bottom-right: the active companion command. It displays the creature artwork, the real individual name, active field-power identity, and tasteful previous/next portrait peeks.

The three homes share one responsive layout contract but have no common visual chassis. Empty space between them shows the live world.

## Active companion command

The command is the physical source for every companion-specific action.

- Tap: use the equipped field power against the current direct world target or context.
- Horizontal swipe: cycle the eligible living companion carousel. One swipe advances one deterministic detent; longer controlled travel may cross additional detents. Portraits and the visible individual name update continuously at detents.
- Upward swipe: pull out the creature roster. The roster grows upward from the companion command without introducing a bottom background.
- Hold: open the ability wheel around the thumb after the declared hold threshold.
- Hold and slide: move across named ability sectors with progressive visual, audio, and haptic detents; release commits the selected ability.
- Return to center, cancel, lost pointer capture, visibility loss, or Escape: cancel without accidental power use.

The real name source is always `PortableCardAsset.manifest.name`. Family or species may appear only as subordinate detail inside the expanded roster or dossier.

## Companion roster expansion

The roster is a compact upward-growing glass surface anchored to the companion command.

- Preview snap exposes the nearest eligible cards and their real names without covering the movement zone.
- Expanded snap provides horizontal browsing, deterministic sort, current condition, level/bond, and memorial handling.
- Selecting a card updates the active command immediately and collapses to preview or resting state.
- The active creature stays centered or visibly selected; adjacent choices remain partially visible to communicate horizontal continuity.
- The surface is height-bounded by the top safe zone and scrolls internally when necessary.

## World-tools fan and panels

The bottom-center pill owns non-immediate game systems.

- Tap or short upward pull: fan out Field Guide, Satchel, Trail Pack, and Card Vault as four thumb-sized controls.
- Selecting a tool opens its existing panel or experience without changing its underlying data or authority rules.
- The fan collapses after selection, outside tap, Escape, trainer challenge, combat transition, or another exclusive surface opening.
- Badges remain available but cannot enlarge the resting pill or create a permanent second row.
- Mission, map, profile, and live/audio do not move into this fan because each already has a semantically correct home.

## Movement and quick utilities

Movement preserves the current camera-relative analog behavior, walking/running modes, and render-clock input loop.

- The movement target remains at least 68×68 CSS pixels and uses the current 78-pixel portrait target when room permits.
- Camp and walk/run expand from the movement home and remain at least 44×44 CSS pixels.
- Their expansion cannot overlap the creature roster, world-tools fan, or event text.
- Movement continues while the other thumb uses the active companion command when the platform supports multiple pointers.

## Overlay coordination

One `WorldOverlayDirector` owns exclusive and concurrent overlay state. It replaces independent component positioning and mutually unaware open states.

The director tracks:

- viewport class, orientation, safe-area insets, and text scale;
- resting, preview, expanded, and modal states for every anchor;
- measured collision rectangles for top and bottom homes;
- the active pointer owner and multi-touch compatibility;
- trainer, encounter, combat, map, mission, command-panel, and system-overlay priority;
- dismissal causes and focus restoration.

Only these concurrent combinations are allowed:

- movement plus one companion gesture;
- movement plus passive HUD;
- passive HUD plus one bottom fan;
- passive HUD plus one creature roster snap.

Trainer challenge, VS transition, active combat, map, and full panels dismiss bottom expansions before taking focus. The living world remains mounted beneath non-combat overlays.

## Responsive behavior

### Portrait phones

- World fills the viewport.
- Bottom-left, bottom-center, and bottom-right anchors respect home-indicator and side safe areas.
- At 320 pixels wide, the center pill may reduce to an icon/three-dot control but cannot disappear.
- Companion real name truncates with an ellipsis visually while the complete name remains available to assistive technology.

### Short landscape phones

- World remains full-height.
- Movement and companion anchors sit at the lower corners.
- The center tools pill uses the free horizontal space between them.
- Top-center mission yields or compresses before overlapping identity or minimap.
- Expanded surfaces favor horizontal fans and shallow sheets so gameplay remains visible.

### Tablet and desktop

- Thumb homes remain spatially consistent instead of turning into a conventional desktop toolbar.
- Pointer hover and keyboard focus add affordances without changing the mobile interaction hierarchy.
- Maximum sizes prevent controls from becoming oversized.

## Visual language

- Surfaces use restrained dark living glass, thin proof-colored borders, and localized blur.
- Empty screen regions remain unpainted so the world is visible.
- Color is never the only carrier of state; icon, label, shape, motion, and accessible text reinforce it.
- Motion uses short physical expansion from the owning anchor. No unrelated panel slides in from a different edge.
- Haptics are progressive and optional: light detent, medium lock/selection, strong commit or danger. Missing vibration is silent and harmless.
- Reduced-motion mode replaces blooms and travel with immediate opacity/scale state changes.

## Data and authority boundaries

The redesign changes presentation and interaction routing only.

- Portable card manifests, identity proofs, card conditions, progression, inventory, custody, and Receiz authority remain unchanged.
- Existing Field Guide, Satchel, Trail Pack, Vault, mission, map, live, profile, and audio data sources remain authoritative.
- Companion eligibility and ordering continue through the existing deterministic carousel model.
- The active command must never synthesize a display name from family metadata.
- Opening, closing, previewing, or cancelling an overlay performs no gameplay or authority mutation.

## Error and recovery behavior

- Offline and reconnecting modes keep local controls and panels available where existing rules permit.
- A failed secondary-panel load leaves the world and its controls mounted, announces the failure, and restores focus to the originating control.
- Orientation change, resize, background/resume, or lost pointer capture cancels ambiguous gestures and recomputes layout without changing the active creature.
- If collision measurement fails, anchors fall back to conservative safe-zone coordinates rather than stacking.
- No expanded surface may trap focus or block Escape/close behavior.

## Verification contract

### Automated

- Pure overlay-state tests cover exclusivity, concurrent movement/companion input, dismissals, focus restoration, and orientation cancellation.
- Source/render tests prove the real name comes from `manifest.name` and family/species are never substituted.
- Gesture tests preserve tap, swipe, upward pull, hold-slide, cancellation, and detent behavior.
- Responsive CSS/layout tests prohibit a full-width bottom background and enforce declared anchors, safe areas, and minimum targets.
- Existing command-panel, drawer, movement, trainer, Arena, persistence, and authority suites continue to pass.

### Browser

Verify 320×568, 360×800, 390×844, 430×932, 844×390, 768×1024, and 1440×900.

For every required viewport:

1. confirm the canvas fills the playable viewport and no footer reduces it;
2. measure top and bottom control rectangles for overlap and clipping;
3. move while using a companion power;
4. cycle companions and verify the real visible names;
5. pull preview and expanded roster states;
6. hold-slide every ability sector and cancel safely;
7. open and close every world tool;
8. enter and leave a trainer challenge and combat;
9. rotate/resize with an expansion open;
10. repeat with reduced motion, 200% text, offline state, unavailable vibration, and keyboard navigation.

Capture resting, roster-preview, roster-expanded, ability-wheel, world-tools-fan, panel-open, landscape, trainer, and active-combat screenshots plus console/page errors, nonblank pixels, renderer calls, triangles, and input-response evidence.

## Automatic failures

The sub-project is not complete if any of the following remains:

- a persistent bottom background or second toolbar;
- any reduction of the world canvas caused by controls;
- family/species text presented as the active creature's individual name;
- HUD elements without a declared home or overlapping at a required viewport;
- a preserved function becoming unreachable;
- movement and companion input becoming mutually exclusive on multi-touch devices;
- an expanded surface opening from an unrelated location;
- controls below minimum target size;
- accidental activation across gesture modes;
- keyboard, reduced-motion, offline, text-scale, or missing-haptic failure;
- new console/page errors or regression of deterministic gameplay and proof authority.

## Scope boundary and sequence

This specification completes the shared control shell, not the entire content transformation. It is deliberately first because every world, arena, settlement, raid, rift, and activity consumes this interaction layer. After this shell passes its release gate, subsequent specifications apply the same world-class bar to:

1. Verdant exploration, ecology, wild encounters, and capture;
2. Arena of Echoes campaigns, tournaments, hazards, and spectators;
3. Hearttree Sanctum traversal, rituals, relationships, and consequences;
4. Prism Arcade racing, rhythm, seasonal score play, and social comparison;
5. settlements, residents, schedules, crafting, commerce, and visible change;
6. raids, bosses, rifts, cooperative roles, and aftermath;
7. PvP, social play, progression, collection, profile, and remaining surfaces;
8. location-wide bespoke art, animation, audio, and final full-game qualification.

Each later sub-project must preserve this control contract and end with active mobile browser evidence. The overall game is not called best-ever or complete until every location family clears the shared visual, gameplay, performance, accessibility, and content-density gates.
