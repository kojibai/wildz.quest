# Compact Status Row and Character-Only Selector Design

## Objective

Clarify the world HUD without changing the Kai Klok or audio control. The three top-right status controls become one compact horizontal row, nearby event bars become visually slimmer beneath it, and the bottom-right companion control becomes exclusively a character selector.

This design supersedes only the companion-command gesture behavior and status-control geometry described in the earlier Vault Roster and Balanced World HUD design. Vault authority, real sealed names, roster contents, and all other approved behavior remain unchanged.

## Kai Klok

The Kai Klok is out of scope. Its placement, appearance, content, click behavior, and Command Center destination remain exactly as they are now.

## Top-Right Status Row

The three existing top-right controls are:

1. living-world status;
2. live explorers;
3. share invite.

They render in one horizontal primary row beneath the minimap, never as a two-row or triangular cluster. Their order stays status, live, share. Nearby world-event bars such as Crystal Burrow or Wayfinder Distress render as full-width rows beneath this primary control row. The primary row respects top/right safe areas and remains clear of the minimap, mission control, play path, and viewport edge.

At compact mobile widths, the visible circular surfaces shrink enough to avoid overlap. The semantic hit areas remain at least 44 by 44 CSS pixels. Icons and state indicators remain centered and readable, and focus styling follows the full safe hit area.

The “Everyone live now” roster is an expanded surface. While open, it stacks above the Kai Klok, audio control, event bars, and all resting HUD controls. Its close control and contents remain interactive, and closing it restores the normal resting layer order.

## Audio Control

The audio control remains beside the Kai Klok and keeps its current size, icon size, settings sheet, and behavior. Its interactive hit area remains at least 44 by 44 CSS pixels, and the audio sheet remains centered and viewport-bounded.

## Event Bars

Nearby world-event bars remain below the three-control primary row. Their semantic targets remain at least 44 pixels high, but the visible pill surface is inset to a 36-pixel visual height with tighter vertical rhythm. Event name and distance remain fully readable on supported mobile widths: no ellipsis, clipping, or hidden distance text.

## Bottom-Right Companion Selector

The bottom-right companion control is exclusively for owned-character selection:

- pressing or clicking it opens the compact Slate roster preview;
- Enter or Space opens the same compact roster preview;
- horizontal character cycling may remain because it only changes the selected owned character;
- an upward flick opens the expanded roster with full character stats;
- press and hold opens that same expanded roster;
- the control never opens the field-ability wheel;
- it never presents Grove Pulse, Bond, or any other field ability;
- a simple press never executes a field ability.

The opened roster continues to show only selectable living creatures from the admitted player Vault, using exact sealed names, portraits, stats, active state, and the existing authoritative `select-asset` path. Selecting a creature closes the roster and persists through reload as already qualified.

Field abilities are not moved to another world-HUD control in this change. Combat abilities remain available through their existing combat surfaces.

## Accessibility and Ownership

- All top-right, event-bar, and audio hit targets remain at least 44 by 44 CSS pixels even when status/event visuals are slimmer.
- The bottom-right control is labelled as a character selector, not as an ability command.
- Opening the roster preserves its existing focus entry, containment, Escape, exclusive-owner cancellation, and origin restoration.
- The three top-right controls retain their existing modal/input ownership gating.
- Reduced motion, 200% text, safe areas, and short landscape must not introduce overlap or clipping.

## Verification Contract

Implementation is complete only after strict red-green tests prove:

- the top-right status, live, and share controls use a single-row layout at mobile and short-landscape sizes;
- nearby world-event bars remain below that three-control row;
- the opened “Everyone live now” roster is visually and interactively above Kai Klok and audio;
- their semantic targets remain at least 44 by 44 pixels;
- the audio control and icon remain unchanged;
- event bars retain 44-pixel semantic targets, use a 36-pixel visible pill, and show complete name and distance text;
- pointer click and keyboard activation on the bottom-right control open the compact character roster;
- upward flick and press-and-hold open the expanded character roster;
- pointer click and keyboard activation do not open an ability wheel or execute a field ability;
- Kai Klok source behavior and destination remain unchanged;
- selecting a real owned creature still updates exact name, portrait, world actor, active ID, and reload state;
- production browser checks pass at 320x568, 390x844, and 844x390 with no HUD collision, clipping, overflow, console error, or page error.

## Out of Scope

This change does not redesign the Kai Klok, Command Center, creature generation, Card Vault, capture, combat, multiplayer behavior, or audio settings sheet. It does not create a replacement world field-ability control.
