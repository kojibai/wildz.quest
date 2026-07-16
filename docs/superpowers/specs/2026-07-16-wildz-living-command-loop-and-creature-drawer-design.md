# Wildz Living Command Loop and Creature Drawer Design

## Objective

Make the bottom gameplay system feel faster, denser, more premium, and more connected to the living world. Keep the existing six-button toolbar and preserve the Vault's proven restore, sort, export, listing, ownership, and verification behavior. Upgrade the six panels into compact living-world action sheets, replace the fixed creature rail with a height-adaptive active-creature drawer above the D-pad row, and prevent battle nameplates from ever covering their HP/life value.

The experience should produce a clear loop:

**notice a world change → understand its meaning → choose an action → see the gameplay consequence → carry that consequence into the next panel and future play**

The design aims for long-term engagement through clarity, meaningful choices, visible consequences, companion attachment, and continuity. It does not use artificial browser zoom, manipulative timers, or UI-only rewards that have no effect on game state.

## Current Context

- `WildzSocialDeck` currently renders a fixed-height creature rail, D-pad/action row, and six-button toolbar as one bottom surface.
- The archive icon opens Card Vault. The active-creature thumbnail opens Trail Pack.
- The creature rail uses explicit 4/8-card pagination, arrow buttons, page labels, and swipe-to-change-page behavior.
- Field Guide, Satchel, Trail Pack, and Vault use `WildsCommandDock` sheets. Profile and Market use the shell overlay.
- Vault already contains complete restore/export/list/select functionality and must retain it.
- The six panels expose useful information, but they do not yet share a compact action hierarchy or consistently show how one choice affects the rest of play.
- Battle world nameplates place the creature name and HP value in the same constrained top row; long names can crowd or cover the life value.

## Scope

### Included

- Keep all six toolbar buttons in their existing bottom row.
- Swap only the two requested trigger mappings:
  - the active-creature thumbnail opens **Card Vault**;
  - the archive icon opens **Trail Pack**.
- Give all six panels a shared compact premium action-sheet structure.
- Preserve and visually tighten all existing Vault functions.
- Connect panel actions to existing authoritative gameplay state so consequences are real, not decorative.
- Add the adaptive active-creature drawer above the permanent D-pad row.
- Replace manual creature pages with automatic virtualized scrolling and preloading.
- Make battle creature names and HP/life values collision-proof.

### Not Included

- Reordering or hiding the other four toolbar buttons.
- Replacing Receiz ownership, verification, export, restore, market, or settlement rules.
- Creating a separate full-screen command center.
- Moving or collapsing the D-pad/action row or six-button toolbar.
- Browser-level zoom or transforms that make text blurry or reduce usable hit targets.
- A new currency, artificial streak timer, or reward system unrelated to existing Wildz state.

## Permanent Bottom Layout

The bottom system has three independent layers:

1. **Active-creature drawer** — the only collapsible layer.
2. **D-pad and immediate play actions** — always visible and stationary.
3. **Six-button toolbar** — always visible and stationary.

When the creature drawer is closed, its height is zero and its lower edge is flush with the top edge of the D-pad row. A narrow grab seam belongs visually to the fixed row, so there is no empty drawer shell, padding, or blank card region above the controls.

Opening or closing the creature drawer must not translate, resize, or delay the D-pad or toolbar. The world viewport grows and shrinks only by the drawer's current visible height.

## Adaptive Active-Creature Drawer

### Interaction

- Tap the grab seam to open to the last non-zero snap height.
- Tap it again, tap the downward affordance, or drag down to close.
- Drag upward or downward directly from the seam to control height continuously.
- Release settles to the nearest snap point using drag distance and velocity.
- Selecting a creature dispatches the existing active-asset selection, confirms the selected state, and closes the drawer fully.
- Escape closes the drawer when keyboard focus is inside it.
- Reduced-motion mode changes height without spring animation.

### Snap States

The exact pixel heights are responsive and derived from the available play viewport, but the semantic states remain stable:

1. **Closed** — zero-height creature content, flush to the D-pad row.
2. **Rail** — one compact horizontal row for fast thumb-driven selection.
3. **Grid** — a two-column continuous vertical collection showing as many complete rows as the chosen height allows.
4. **Book** — the maximum useful height, showing four rows of two creatures (eight per spread) with horizontal page snapping.

During a continuous drag, the layout changes only at named thresholds. It never oscillates between modes near a threshold. Card identity, selection, sort order, and the first visible creature are preserved when changing modes.

### Automatic Collection Navigation

- Remove previous/next arrow buttons and manual page labels from the active-creature selector.
- Rail mode uses horizontal scroll snapping and a virtual window around the visible cards.
- Grid mode uses a virtualized two-column vertical list.
- Book mode groups the same ordered collection into eight-card spreads and uses horizontal mandatory scroll snapping.
- Approaching the end of the current virtual window prepares the following window before it becomes visible. Scrolling naturally reveals it; the user never presses a page-change control.
- The preceding window remains available so reversing direction is immediate.
- Sort changes retain the current active creature when it still exists and otherwise start at the first creature.
- Empty, one-card, and partial final-spread states remain valid and do not create phantom cards.

The logical collection stays continuous across modes. “Infinite” means automatic windowing through the complete Vault without a manual page boundary; it does not duplicate cards or wrap the last card back to the first.

### Compact Creature Card

Each selector card prioritizes:

- artwork and verified state;
- creature name;
- level and current bond;
- element or role;
- a clear selected/active state.

Owner, trade, export, proof details, and long metadata move to Card Vault. The selector is intentionally optimized for quick active-creature choice.

## Six Living-World Action Sheets

All six buttons keep their existing toolbar positions. Their panels share one compact structure:

1. **Compressed header** — icon, title, one live status, close control.
2. **Consequence strip** — the most important current world effect or risk.
3. **Primary action** — one context-sensitive action that operates on real gameplay state.
4. **Dense content** — existing panel content with reduced visual footprint.
5. **World response** — a short confirmation of what changed and where that change matters next.

Panels remain separate surfaces. They share state and cross-link through real outcomes rather than becoming tabs inside a full-screen dashboard.

### Card Vault — Creature Thumbnail

Vault keeps all current behavior: complete collection count, search/sort, detail selection, active-leader choice, listing, export, restore, and proof-safe Receiz handling.

Enhancements:

- compress the title, count, search, and sort controls into a sticky compact header;
- use smaller artwork, tighter grid gaps, shorter labels, and denser metadata rows;
- keep a minimum accessible hit area even when the visible control is compact;
- show the active creature and current Trail Pack membership without duplicating Trail Pack editing;
- make “Set active” update the creature drawer and battle/exploration leader immediately;
- surface verification or authority limitations beside the unavailable action instead of in a remote message;
- preserve collection position after returning from details or an action.

Vault data, proofs, ownership rules, and export/restore boundaries do not change for visual density.

### Trail Pack — Archive Icon

Trail Pack remains the leader plus two bonded supports. The panel shows the current synergy, role coverage, companion moods, and the exact gameplay effects those choices currently provide.

- Changing the leader updates the active creature everywhere.
- Changing a support updates the authoritative support slots.
- Existing synergy projections become explicit modifiers consumed by the relevant existing gameplay operations, such as scouting, capture assistance, recovery, or battle support, rather than display-only percentages.
- The response row states the consequence in plain language, for example which exploration or recovery behavior changed.

### Field Guide — Book Icon

Field Guide prioritizes the current nearby discovery opportunity rather than leading with the complete index.

- Show the next relevant habitat signal, discovered/undiscovered state, and what action can advance it.
- Selecting a discovery lead updates the active exploration target used by world hints and scanning.
- Completed discoveries update the Guide, Profile totals, and any existing progression rewards through the same domain event.
- The full species index remains available below the current lead in a denser grid.

### Profile — People Icon

Profile becomes the memory of consequences rather than a disconnected statistics card.

- Keep identity, sharing, publication state, reputation, discoveries, wins, traits, and verified Vault authority actions.
- Add a compact recent-impact sequence derived from admitted gameplay events: discoveries, battles, pack changes, trades, and meaningful world participation.
- Profile reflects results created elsewhere; it does not independently fabricate achievements or reputation.
- Authority-sensitive actions remain gated by verified Receiz identity or the appropriate proof scope.

### Market — Waveform Icon

Market keeps its current verified listing, checkout, retry, ownership-admission, and failure semantics.

- Use a denser listing row with creature identity, price, seller, and ownership state visible together.
- Show how a listing or purchase affects the player's Vault before confirmation.
- Successful settlement changes the authoritative owner, updates the Vault, removes unavailable creatures from active selection and Trail Pack slots, and records the consequence in Profile history.
- Pending, failed, expired, and recovered settlements stay explicit and never imply ownership before Receiz admission.

### Satchel — Package Icon

Satchel becomes the bridge between exploration rewards and usable preparation.

- Compress current resources and progression counters into dense rows.
- Prioritize currently usable crafting, recovery, fusion, or progression actions supported by existing domain systems.
- Every action spends or changes authoritative state through the existing reducer/domain boundary.
- The response shows the immediate resource change and the gameplay surface affected next.
- Unsupported resources remain informational rather than receiving fake action buttons.

## Cross-Panel Gameplay Loop

The panels connect through shared authoritative events:

1. Field Guide points to a live habitat opportunity.
2. The player chooses a creature in the adaptive drawer and configures Trail Pack support.
3. Exploration, battle, or capture consumes those actual choices and produces outcomes.
4. Satchel receives earned resources and offers supported preparation actions.
5. Vault receives captured or restored creatures and remains the source of collection truth.
6. Market can transfer admitted ownership; the collection, drawer, and Trail Pack reconcile immediately.
7. Profile records admitted consequences and long-term identity progress.

Each mutation has one domain owner. Panels project and invoke that state; they do not maintain competing copies. A cross-panel result is applied atomically so the toolbar badge, open sheet, drawer, and world HUD cannot disagree.

## Premium Compact Density

The interface should feel “zoomed out” by information design, not by shrinking the entire application.

- Reduce redundant headings, explanatory copy, outer padding, card padding, gaps, and decorative empty space.
- Prefer one-line status rows, compact segmented controls, and progressive detail.
- Use smaller visible buttons and thumbnails while preserving at least a 44-by-44 CSS-pixel interactive target where touch input requires it.
- Keep essential body text legible and do not reduce it below the app's accessible compact scale.
- Use sticky sheet headers and local content scrolling so primary actions remain reachable.
- Avoid nested card chrome; rely on spacing, dividers, alignment, and restrained emphasis.
- Mount or render only the open sheet's heavy content.
- Keep the world visible behind modal sheets where the current interaction allows it.

## Battle HP/Life Collision Rule

Battle world stats use a fixed two-track header:

- the name occupies `minmax(0, 1fr)` and truncates with an ellipsis;
- the HP/life value occupies an intrinsic non-shrinking column;
- the two elements never use overlapping absolute positioning;
- the value remains visible at every supported width and text scale;
- the meter stays on its own full-width row below the header.

Long names, localized text, maximum HP values, mobile width, and browser text enlargement must all preserve the HP/life value. The accessible label retains the full untruncated name and exact value.

## State, Error, and Recovery Behavior

- A panel action remains pending until its authoritative operation resolves.
- Failure preserves the prior state and reports the failure inside the initiating sheet.
- Closing and reopening a sheet preserves safe presentation state such as scroll position, but not stale pending authority.
- If a selected or support creature leaves the Vault through an admitted ownership change, selection reconciles to the next valid owned creature and invalid support slots clear.
- An empty Vault closes the creature drawer to zero height and exposes a Vault action from the creature-thumbnail toolbar button.
- Offline-capable actions use the existing local continuity path; network-required actions identify that requirement without inventing success.

## Accessibility and Input

- The grab seam is a real button with `aria-expanded`, `aria-controls`, and an explicit active-creature label.
- Pointer dragging, touch dragging, tap toggling, keyboard activation, Escape, and focus restoration are supported.
- Drawer layout changes do not reorder the logical card sequence or corrupt tab order.
- Book spreads expose logical collection position without requiring visible page controls.
- Scroll regions have labels and do not trap vertical page gestures when they cannot scroll further.
- Reduced-motion users receive direct state changes without springs or parallax.
- Panel status changes use a restrained live region and do not repeatedly announce scrolling content.

## Performance

- Virtualize the creature selector and detailed Vault collection so large restored Vaults do not mount every complex card at once.
- Preload the next and previous logical windows based on intersection proximity, not a timer.
- Keep drag height in local presentation state and avoid dispatching gameplay state on every pointer move.
- Commit only the final drawer snap state and creature selection where persistence is useful.
- Memoize compact creature rows and keep movement/camera updates outside their render dependencies.
- Preserve the current requirement that a roughly 100-card Vault remains as responsive as a starter Vault.

## Testing and Acceptance

### Contract and unit coverage

- Trigger mapping proves creature thumbnail → Vault and archive icon → Trail Pack.
- Drawer state projection covers closed, rail, grid, and book modes at responsive heights.
- Layout transitions preserve active identity, sort order, and first visible creature.
- Virtual windows never duplicate or skip cards, including empty and partial final spreads.
- Selecting a creature updates the active asset and closes the drawer.
- Admitted ownership removal reconciles drawer selection and Trail Pack membership.
- Panel actions mutate the same authoritative state used by gameplay and expose their consequences.
- Existing Vault restore/export/list/proof tests remain unchanged and green.
- Battle stat layout reserves a non-shrinking HP/life column.

### Rendered interaction coverage

- Closed drawer is visually flush with the D-pad row with no empty creature shell.
- D-pad and six-button toolbar do not move while the drawer is dragged.
- Tap, slow drag, fast flick, cancel, and reduced-motion behavior settle correctly.
- Rail scrolls horizontally, grid scrolls vertically, and book mode snaps horizontally in eight-card spreads.
- The next collection window is rendered before the user reaches its boundary.
- A creature can be selected near the beginning, middle, and end of a large Vault; each selection closes the drawer.
- All six action sheets fit more meaningful content in the first viewport without clipped text or undersized touch targets.
- Vault import, export, sort, selection, listing, and restore remain usable in the compact design.
- Long creature names and maximum HP/life values do not overlap on desktop or mobile.
- Console, framework overlay, focus, scroll containment, and responsive checks pass.

## Success Criteria

- The permanent controls are always available and visually stable.
- Active-creature selection is faster than the current manual paging flow at every Vault size.
- No manual next/previous page action is required in the creature selector.
- Every panel's main action produces or clearly leads to a real gameplay consequence.
- Consequences remain consistent across the world, drawer, panels, Vault, and Profile.
- The compact sheets show materially more useful information in the first viewport without sacrificing legibility, touch access, or proof safety.
- The battle HP/life value is never hidden by a creature name.
