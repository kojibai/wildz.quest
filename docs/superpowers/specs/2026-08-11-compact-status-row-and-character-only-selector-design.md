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

## Live Direction Compass

A slim, non-interactive compass ribbon occupies its own safe-area-aware lane at the top center. The explorer, mission, minimap, Kai/audio instruments, status row, and scan action shift down together so the compass never overlays an existing control.

The fixed center caret represents the explorer's live facing. Fifteen-degree ticks and cardinal labels slide beneath it using the same real movement heading as the world actor and minimap. Nearby authored world landmarks may appear as restrained markers only while their actual bearing is within the visible sixty-degree arc. The compass does not invent GPS data, own input, or become another button.

At narrow portrait and short-landscape sizes it stays 26 pixels tall, remains inside the safe viewport, and yields horizontally before it can collide with the identity or minimap homes. Its accessible status label reports the current cardinal and degrees; modal ownership hides it with the rest of the reference HUD.

## Event Bars

Nearby world-event bars remain below the three-control primary row. Their semantic targets remain at least 44 pixels high, but the visible pill surface is inset to a 36-pixel visual height with tighter vertical rhythm. Event name and distance remain fully readable on supported mobile widths: no ellipsis, clipping, or hidden distance text.

## Bottom-Right Companion Selector

The bottom-right companion control is exclusively for owned-character selection:

- pressing or clicking it toggles a compact active-character action panel; a second tap closes it without a separate close icon;
- Enter or Space opens the same active-character action panel;
- horizontal character cycling may remain because it only changes the selected owned character;
- an upward flick preserves the `0161317` Slate flow: it opens the single-row preview, which can then be pulled into the full roster;
- press and hold opens the same compact active-character action panel with a haptic acknowledgement;
- the control never opens the field-ability wheel;
- it never presents Grove Pulse, Bond, or any other field ability;
- a simple press never executes a field ability.

The compact panel shows the active creature's exact sealed name, portrait, level, XP, bond, element, and condition, plus real Bond, Recover, and View in Vault actions. Bond uses the existing authoritative training progression while naming the player-facing relationship outcome. The expanded roster continues to show only selectable living creatures from the admitted player Vault, using exact sealed names, portraits, stats, active state, and the existing authoritative `select-asset` path. Selecting a creature closes the roster and persists through reload as already qualified.

## Mobile Popover Scrolling

Card Vault, Kai Klok teaching, audio, living-world, and live-player surfaces each own one continuous native vertical pan. Their outer sheet is the only scroll container; nested card history, growth, Kai teaching, and chat regions expand into it on mobile rather than trapping or section-snapping the same touch gesture. The command sheet drops its transformed compositor layer after entry and only reapplies translation while the dedicated grabber is actively dragged.

The command-sheet grabber and title live in one premium chrome surface with a restrained mint/gold edge, integrated grip, proof-colored icon tile, and a clear close target. It must read as the top of the sheet rather than a detached strip.

## Capture Presentation

Capture logic and proof authority stay unchanged. The locked, sealing, and verifying states use one premium three-step proof treatment; the lower capture notice uses the same seal language; and the reward stage shows the exact sealed creature, five real stats, and a premium action that dismisses the reward and opens Card Vault.

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
- pointer click, press-and-hold, and keyboard activation on the bottom-right control open compact real character actions;
- upward flick opens the single-row Slate preview and preserves its existing pull-to-full expansion;
- pointer click and keyboard activation do not open an ability wheel or execute a field ability;
- Kai Klok source behavior and destination remain unchanged;
- selecting a real owned creature still updates exact name, portrait, world actor, active ID, and reload state;
- production browser checks pass at 320x568, 390x844, and 844x390 with no HUD collision, clipping, overflow, console error, or page error.
- the live compass follows real player movement heading, wraps cleanly through north, and preserves a separate collision-free lane at all required viewports.

## Out of Scope

This change does not redesign the Kai Klok, Command Center, creature generation, capture mechanics, combat, multiplayer behavior, or audio control/settings content. It does not create a replacement world field-ability control.
