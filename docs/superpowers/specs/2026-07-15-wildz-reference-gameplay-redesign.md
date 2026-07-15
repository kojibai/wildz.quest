# Wildz Reference Gameplay Redesign

## Status

Approved direction on 2026-07-15. This specification replaces the current gameplay presentation while preserving the existing Wildz game rules, identity, collection, multiplayer, proof, and market systems.

## Product outcome

Wildz becomes a portrait-first, full-screen creature-exploration game whose visible composition faithfully follows the supplied mobile reference: a bright low-poly forest world, compact floating status clusters, a circular minimap, direct touch movement, creatures and players present in the world, and an embedded social-trade deck. It must feel like a game from first paint, never like a dashboard or commerce application.

The human explorer remains the player's identity. Sealcub is the default active companion and the primary creature shown alongside the explorer. The experience is branded Wildz and designed for `wildz.quest`.

## Reference contract

The supplied 852 × 1848 portrait image is the primary visual target. The implementation must reproduce its hierarchy, density, proportions, depth, softness, and interaction placement while using original Wildz branding and assets.

The defining visual rules are:

- A full-bleed, softly lit low-poly wilderness occupies the entire gameplay viewport.
- The scene uses elevated/isometric framing with a readable winding path, foreground occlusion, middle-distance activity, and misty background depth.
- UI uses charcoal translucent capsules with soft borders, restrained shadows, large rounded geometry, pale text, mint status color, and warm gold action emphasis.
- World information appears in small floating labels rather than large panels.
- The social market is a bottom deck inside gameplay, not a destination or separate route.
- Touch controls remain visually distinct from the bottom deck and never obscure the explorer, Sealcub, or the immediate path.

## Viewport composition

### Portrait mobile

The primary authored viewport is 390 × 844 CSS pixels, with safe-area support for modern phones. The layout scales continuously from 360 × 640 through 430 × 932 without horizontal scrolling or clipped controls.

The upper-left player capsule occupies approximately 42% of the viewport width. It contains the Wildz mark or explorer portrait, display name, verified state, level, and a compact companion/progression meter.

The upper-right status rail contains three compact elements: energy, XP, and mission progress. It must not exceed approximately 28% of viewport height.

The circular minimap sits below the status rail in the upper-right world area. It shows the current trail, the player heading, nearby creatures, players, landmarks, and activity points using the live world state.

The main world remains visually open through the center. The explorer and Sealcub occupy the lower-middle area so the player can see the path ahead. Nearby creatures and players use small dark nameplates with a verified marker when appropriate.

The D-pad is centered horizontally at the bottom of the gameplay area, immediately above the social deck. It is a translucent circular control with a tactile center and four directional intents. Its active direction has visible pressed feedback. It emits the existing movement intents rather than owning separate movement rules.

A large circular contextual action control sits at the lower-right of the gameplay area. Its icon, label, and warm-gold emphasis change according to the existing context system: Walk, Capture, Battle, Enter, Inspect, or Interact.

The bottom social deck rises from the lower edge and includes a drag handle, a horizontally scrollable row of nearby creature/player cards, and a six-item navigation rail. The deck's collapsed state shows navigation and one compact nearby card row; expansion reveals more details without navigating away from the world.

### Desktop and tablet

Desktop preserves the same game composition. It expands the visible forest and increases world depth instead of rearranging the interface into columns. HUD clusters remain near their portrait-relative anchors, the D-pad remains centered above the deck, and the bottom deck receives a bounded maximum width. Pointer and keyboard controls coexist with the touch interface.

## World and art direction

The current world systems remain authoritative, but the visible scene is rebuilt as a coherent stylized forest kit:

- winding dirt trails with soft edges and readable intersections;
- layered grass and ground variation;
- ponds, shore stones, lily pads, and small bridges or trail props;
- clustered low-poly conifers and broadleaf trees at multiple scales;
- flower patches, mushrooms, shrubs, grasses, stones, signs, and landmark props;
- atmospheric fog, softened distant silhouettes, ambient occlusion, contact shadows, and gentle depth-of-field treatment where performance permits;
- foreground trees and foliage used as cinematic framing without blocking controls;
- animated creatures with idle, roam, notice, and interaction states;
- explorer and Sealcub movement with grounded shadow, facing, idle motion, and readable selection/contact rings.

Generated or sourced visual assets must be original to Wildz and share one art direction. The reference is used for layout and aesthetic fidelity, not copied branding or proprietary character artwork.

## Explorer and Sealcub

The player's deterministically generated human explorer remains their visual identity. Sealcub is created as the default active companion for new players and restored when present in verified portable state.

The scene treats the explorer and Sealcub as a paired party:

- movement centers on the explorer while Sealcub follows with a short, eased offset;
- the top-left capsule displays both explorer identity and Sealcub progression;
- contextual interactions may originate from the explorer or Sealcub according to the existing game rule;
- selecting another owned creature changes the active companion without replacing the explorer;
- deterministic appearance and proof identity remain unchanged by the redesign.

## HUD and interaction model

HUD components read from existing state selectors and emit existing commands. They do not duplicate progression, movement, battle, capture, inventory, or market rules.

Required states include:

- normal exploration;
- movement pressed and path traversal;
- nearby creature/player discovery;
- capture or interaction available;
- battle/raid activity;
- mission milestone and reward feedback;
- low energy;
- expanded/collapsed social deck;
- loading, offline, unavailable, and retry states;
- safe-area and landscape fallback states.

Touch targets are at least 44 × 44 CSS pixels. HUD text must remain readable over light and dark world regions. Motion respects reduced-motion preferences. The first gameplay viewport must not require scrolling.

## Embedded social marketplace

The social market remains inseparable from gameplay. Nearby listings appear as collectible cards in the bottom deck and correlate with creatures or players visible in the scene when possible.

Each compact listing card includes the creature image, name, level, affinity, trait, owner identity, proof/verification status, price or trade value, and a Trade action. Selecting a listing expands a confirmation panel inside the deck. Buying, offering, listing, or trading never opens `/market` or replaces the world.

No ownership change occurs before a verified admitted Receiz settlement. Pending, failed, cancelled, capability-unavailable, and settled states are visually explicit. The active world remains interactive when the deck is collapsed.

## Identity restoration correction

Wildz must distinguish identity artwork from a portable sign-in artifact:

- An owner-exported Receiz Identity Record or Receiz Key containing the embedded key payload can restore identity authority locally.
- A public profile image labeled Identity Seal but lacking the private embedded payload cannot prove ownership and must not be accepted as account authority.
- Vault images continue restoring verified assets without restoring identity authority.

After a portable identity artifact is admitted, the genesis screen must visibly show the restored Receiz display name/handle and a success state before gender selection. The next generated explorer must use the restored key ID. If verified portable state contains a compatible Wildz character or Sealcub record, Wildz restores it; otherwise the player chooses gender and generates a new deterministic explorer for the restored identity.

Errors must be human-readable. A profile image without an embedded key payload should instruct the player to download their owner-only Identity Record or Receiz Key from Receiz rather than reporting an opaque SDK error.

## Architecture

The redesign is divided into independently testable layers:

1. **World presentation layer** — Three.js/R3F environment, camera, lighting, assets, creature actors, explorer/Sealcub party, and world labels.
2. **Gameplay projection layer** — selectors that translate existing game state into HUD, minimap, nearby-entity, contextual-action, and deck view models.
3. **Input layer** — D-pad, keyboard, pointer, and contextual action controls that emit the existing movement and action intents.
4. **HUD layer** — player capsule, status rail, mission progress, minimap, nameplates, feedback, and safe-area layout.
5. **Social deck layer** — nearby cards, navigation, vault, profile, activity, and market confirmation overlays inside the persistent game shell.
6. **Identity admission layer** — artifact inspection, clear classification, visible restore result, local identity persistence, and compatible portable-state restoration.

The existing domain engines and server routes remain the source of truth. Large presentation files should be split at these boundaries instead of extending the existing monolithic scene or campaign component.

## Performance and accessibility

The target is stable interactive rendering on current mobile Safari and Chromium-class browsers. The world uses instancing, bounded shadows, level-of-detail policies, compressed assets, and quality tiers. UI remains DOM-based where accessibility and text fidelity matter. The app must recover cleanly from WebGL context loss and expose an understandable fallback if 3D initialization fails.

Quality acceptance includes:

- no relevant console errors;
- no blank or near-blank canvas;
- readable first paint before all decorative assets finish loading;
- responsive checks at 360 × 640, 390 × 844, 430 × 932, 768 × 1024, and desktop;
- controls clear notches, home indicators, and browser chrome;
- keyboard operation for primary actions and visible focus states;
- reduced-motion support;
- performance evidence from a representative mobile viewport.

## Test strategy

Implementation follows test-first development. Automated coverage must verify:

- portable identity artifact classification and friendly failure for non-authoritative profile images;
- successful identity admission visibly changes the genesis view model and explorer identity basis;
- Sealcub is the default companion without replacing the explorer identity;
- HUD projections reflect real energy, XP, mission, nearby entity, and action state;
- D-pad directions emit the existing movement intents;
- contextual action labels and commands match game context;
- the social deck never navigates to a marketplace page;
- settlement states never claim ownership before admitted proof;
- responsive source contracts and PWA/offline boundaries remain intact.

Browser QA must exercise identity restore, gender selection, world entry, movement, contextual interaction, deck expansion, listing selection, and marketplace failure/success presentation. Visual QA compares the same 390 × 844 state against the supplied reference for hierarchy, proportion, spacing, density, and art-direction consistency.

## Release gates

The redesign is complete only when:

- the game preserves the current mechanics and saved-state boundaries;
- the rendered portrait view is recognizably faithful to the supplied reference at first glance;
- the explorer and Sealcub are visibly paired;
- the D-pad is horizontally centered immediately above the bottom deck;
- the marketplace remains an embedded social layer;
- portable Receiz identity restoration produces visible, verified continuity;
- automated tests, type checking, lint, production build, mobile browser interaction, canvas inspection, and visual QA pass;
- any remaining visual or performance gaps are explicitly documented rather than described as complete.

