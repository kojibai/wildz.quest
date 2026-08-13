# Mortal Arena Compact Controls Design

## Scope

This change applies only to the dedicated NPC Arena presented by `MortalArenaExperience`. It does not alter Wilds creature encounters, player-versus-player battles, world controls, simulation behavior, or Arena settlement logic.

## Problem

Commit `00f34d1` rebuilt the Arena footer into three control zones and raised its portrait minimum height to 146px. It also enlarged the trackpad to 88px and made the contextual column three rows of 42px controls. On short mobile viewports, that footer consumes too much of the fixed `100dvh` grid, compressing the 3D world and making the top HUD appear broken.

## Approved Layout

Retain the useful three-zone organization while reducing its vertical footprint:

- Keep movement on the left, primary combat in the center, and contextual actions on the right.
- Keep Strike visually dominant, with Guard and the named ability immediately available.
- Keep Dodge, Parry, Focus, Tag, Use, and Withdraw accessible without changing their behavior.
- Use a compact footer in the 92–108px range on portrait mobile screens, including safe-area padding.
- Reduce the trackpad and nested row heights proportionally while preserving readable labels and practical touch targets.
- Let the middle grid row reclaim the released height so the 3D scene and top HUD render normally.

## Visual and Performance Constraints

- CSS-only layout correction; no new JavaScript, dependencies, assets, fonts, effects, or network work.
- Preserve the existing gold, blue, violet, and danger materials.
- Preserve haptics, pointer handling, accessibility labels, disabled states, and deterministic combat inputs.
- Avoid additional animation, blur layers, shadows, or DOM elements.
- Respect `env(safe-area-inset-bottom)` without allowing it to compound into an oversized footer.

## Responsive Behavior

- Portrait mobile at 430px and below receives the compact tray.
- Wider screens retain the same three-zone structure with a modest maximum tray height.
- Short viewports must prioritize the arena scene over secondary label copy; secondary `<small>` text may be hidden selectively while action names remain visible.
- No control may overflow horizontally or force the footer into an additional implicit grid row.

## Regression Protection

Update the Mortal Arena mobile-controls test to assert:

- The portrait footer no longer uses a 146px minimum height.
- The compact height bound and smaller trackpad are present.
- Primary action labels remain visible.
- The three-zone layout and all current control mappings remain intact.

Run the focused Mortal Arena tests, the full typecheck/test suite appropriate to the change, and rendered browser verification on a mobile and desktop viewport. Browser QA must check the initial Arena screen, an actual combat action, layout clipping/overlap, framework overlays, and relevant console warnings/errors.
