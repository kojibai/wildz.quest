# Vault Roster and Balanced World HUD Design

## Objective

Make the world HUD feel like one intentional mobile game interface. Remove the top-right status toggle, place its essential functions directly and tastefully on the world, and turn the bottom-right companion control into the sole entry point for selecting a creature the player actually owns.

## Resting HUD

The resting world keeps the scene visually dominant and gives every persistent control one semantic home:

- Top left remains the proof-bound explorer identity home.
- Top center remains mission progress.
- Top right contains the minimap. Compact live/network and social indicators attach beneath the minimap without a generic ellipsis or status drawer.
- The Kai clock becomes a small, always-visible left-side instrument. Sound sits directly beside it as a peer control. Both use stable 44-by-44-pixel minimum targets, safe-area spacing, and icon-first labels that remain accessible.
- Bottom left remains movement.
- Bottom center remains world tools.
- Bottom right remains the sole companion command and sole closed-state roster trigger.

The old top-right status toggle and its fan are removed. Essential status information is visible at rest; interactions that require a larger surface open their existing focused experience directly.

## Companion Command

The closed bottom-right control shows only the active companion:

- its actual Vault portrait;
- its exact `manifest.name` rather than family, species, or fallback naming;
- its selected field ability;
- its position within the selectable living roster.

It does not show decorative previous/next creature peeks, placeholders, undiscovered creatures, remote creatures, or creatures unavailable to the active Vault session.

Existing gestures remain:

- tap uses the selected field ability;
- horizontal swipe cycles through selectable owned creatures;
- upward swipe opens the roster preview;
- hold-and-slide opens and selects abilities;
- keyboard and assistive-technology equivalents remain available.

## Vault Roster Drawer

The drawer is anchored to and visually grows from the bottom-right companion command. It has two responsive states:

- Preview is a thumb-reachable horizontal roster for fast selection.
- Expanded is a bounded, scrollable collection view for inspection and sorting.

The drawer source is a single derived roster from the active player's admitted `state.inventory`. A selectable entry must be present in that Vault inventory and must not be retired. No secondary catalogue, family list, nearby-world list, multiplayer list, or placeholder collection may contribute entries.

Retired creatures are excluded from the active selector and remain available through the existing Memorial/Vault experience.

Every roster entry presents:

- real `manifest.name` and verified state;
- creature portrait;
- level and XP with a compact progress treatment;
- bond;
- current condition;
- element and species/form context;
- active-selection state;
- a short-lived “New” treatment for a newly captured creature.

Selecting a creature dispatches the existing authoritative `select-asset` game intent, immediately updates the companion command, provides safe haptic and visual confirmation, and closes the preview. A selection must never mutate the Vault independently of game state.

The existing Card Vault selection surface uses that same intent and remains fully functional. Selecting a living card from either Card Vault or the world roster must update the same `selectedAssetId`, bottom-right portrait/name, world companion, and battle leader, then persist across reload.

## Newly Captured Creature Flow

After a successful capture and reward settlement:

1. The new card is committed to the admitted player Vault.
2. The derived living roster updates from that same inventory state.
3. The new creature appears in the roster with its real sealed name and a temporary “New” marker.
4. The player can select it immediately.
5. Reload and continuity restoration preserve the creature and its real name.

If Vault admission or capture settlement has not completed, the creature does not appear early as an optimistic placeholder.

## Visual and Motion Language

The drawer uses the living-world material language rather than dashboard cards: restrained translucent depth, creature-derived accent color, clear selection rings, compact meters, and short spring-like movement. It must preserve scene visibility and avoid covering the active play path unnecessarily.

Opening, snapping, selecting, and closing have immediate feedback with no artificial latency. Haptics use the shared exception-safe adapter. Reduced-motion mode removes nonessential animation while retaining state clarity.

## Accessibility and Input

- Every interactive target is at least 44 CSS pixels; the movement control keeps its larger existing floor.
- The roster is a correctly labelled list with position, total, active, new, and unavailable/retired semantics where applicable.
- Keyboard focus enters the opened drawer, remains contained while it is modal at narrow sizes, and returns to the connected companion command on close.
- Pointer cancellation, lost capture, resize, orientation change, Escape, and exclusive modal ownership safely close or cancel interaction without activating a creature.
- Real names and stat labels fit at 320-pixel portrait width and short landscape without clipping.

## State and Component Boundaries

- `PlayCampaign` remains the source of authoritative inventory, progress, condition, and selection state.
- A pure roster projection derives living selectable creatures and presentation stats from those inputs.
- `WildzWorldControls` passes only the derived Vault roster and existing intents to the companion command and drawer.
- `WildsCompanionCommand` owns compact command gestures, not Vault business rules.
- `WildzCreatureDrawer` owns roster presentation, sorting, focus, and snap interaction, not inventory mutation.
- The balanced HUD layout owns placement only; live/network, social, Kai, and audio behavior remain in their existing domain components.

## Failure and Empty States

- Empty Vault: the companion command is disabled and the drawer explains how to restore or capture a creature.
- One living creature: no misleading carousel peeks or cycle gesture; roster still opens for stats.
- All creatures retired: the active selector is empty and directs the player to Memorial/Vault without treating a retired card as selectable.
- Disconnected proof session: already admitted local cards remain visible according to current continuity rules; no remote or unverified card is synthesized.
- Long names or high stats: content wraps or truncates intentionally without changing target height or overlapping the world controls.

## Verification Contract

Implementation is complete only after:

- tests first fail, then pass for admitted-inventory-only projection, retired exclusion, exact real names, new capture appearance, immediate selection, and one-creature/empty cases;
- behavioral tests and production replay prove Card Vault selection and world-roster selection converge on the same active asset and survive reload;
- source and runtime tests prove the top status toggle is absent and Kai plus sound have persistent left-side homes;
- mobile browser evidence covers 320x568, 360x800, 390x844, 430x932, 844x390, 768x1024, and 1440x900;
- preview and expanded roster states show no clipping, collision, page overflow, or target below 44 pixels;
- a real capture produces a newly named selectable roster entry, selection updates the bottom-right command, and reload preserves it;
- tap, horizontal cycle, upward drawer gesture, hold-slide abilities, keyboard, pointer cancel, lost capture, Escape, resize, and reduced-motion paths pass;
- console, page, and failed-request logs remain clean during the qualified local flow.

## Out of Scope

This change does not redesign combat, alter creature generation, rename sealed cards, change Vault authority, or move retired creatures out of the Memorial/Vault domain. It changes the world HUD placement, roster projection, roster presentation, and selection experience only.
