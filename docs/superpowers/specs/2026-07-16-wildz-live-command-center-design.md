# Wildz Live Command Center Design

## Objective

Make Wildz feel like a living world whose state keeps moving and whose consequences remain visible. Replace the duplicated globe utility with a Command Center trigger while making the top-right minimap the sole direct atlas entry. The Command Center must turn existing authoritative game state into clear, current decisions without changing the gameplay surface, adding a parallel game state, or making mobile play heavier.

The intended loop is:

**world changes → Command Center reprioritizes → player chooses → authoritative gameplay changes → consequence remains visible**

## Approved Experience

The Command Center is a live tactical director, not a static dashboard and not a notification inbox. It ranks information into four compact sections:

1. **Now** — the single highest-value decision available at this moment.
2. **Squad** — active creature and Trail Pack readiness, including health, fatigue, injury, death risk, recovery, rest, heal, flee, and switch consequences already supported by game state.
3. **World** — nearby ecology, landmarks, arena activity, bosses, live-player opportunities, signals, and time-sensitive world changes.
4. **Mission** — current objective, progress, next useful action, and earned or endangered consequence.

The current world continues to move while the center is closed. When relevant state changes, the trigger responds with restrained motion and a semantic urgency state. Opening the center always projects the newest local state immediately and reconciles network-backed state when available.

## Surface and Navigation

- The top-right minimap is the atlas button. It keeps live position and heading and opens the existing world map through the same map state used by the globe action today.
- The globe utility is replaced in the exact same footprint by a Command Center icon button.
- The trigger has no permanent text. Its accessible label identifies the highest current priority.
- A restrained ring/pulse appears only when the highest-ranked priority materially changes. It does not blink continuously.
- The Command Center opens inside the existing command-sheet system, preserving the current dark surface, close gesture, focus handling, safe areas, and reduced-motion behavior.
- The existing bottom controls remain visually and spatially unchanged.
- Existing mission, Field Guide, Satchel, Trail Pack, and Vault sheets remain directly available. Command Center may route to them; it does not duplicate their full content.

## Visual System: The Living Neural Cockpit

The Command Center must look like the Wildz world's nervous system and feel substantially more powerful than an ordinary game menu. Its visual reference is a high-consequence mission-control cockpit: precise, layered, responsive, and alive. It must not imitate a real government interface, use official insignia, or imply access to real-world systems.

The composition uses one vertical **neural spine** connecting the four tactical sections. Squad, World, and Mission branch from that spine as causal systems rather than separate dashboard cards. When authoritative state changes, a restrained light pulse travels from the source branch toward Now; the Now decision then changes rank, consequence, or available action. This makes cause and effect visible without explanatory paragraphs.

Visual vocabulary:

- deep near-black green/blue glass already present in Wildz;
- fine mint signal paths and warm gold decision energy;
- amber warning and restrained red critical state;
- exact micro-telemetry, timestamps/revisions, readiness bands, and causal markers;
- thin topographic and neural textures rendered in CSS, not heavy imagery;
- one dominant Now decision surrounded by quieter supporting systems;
- asymmetric but disciplined cockpit geometry that feels engineered rather than card-stacked;
- live points and line segments that illuminate only when their underlying state changes.

The sheet should create a “wow” first impression in the first viewport, but information remains legible within one glance. Decorative telemetry cannot imply data the game does not possess. Mobile uses the same nervous-system composition in a single vertical flow; it does not shrink a desktop control room into unreadable miniature panels.

The central spine carries a slow organic double-pulse: one primary beat, one softer echo, then rest. Branch nodes respond with low-amplitude, phase-offset luminance so the system reads as a connected living organism rather than synchronized blinking. Real authoritative events temporarily change the pulse: opportunities broaden it, warnings tighten it, critical survival state accelerates it within a bounded accessible range, and successful actions send a causal wave through every changed branch. Reduced-motion mode keeps the complete hierarchy and replaces travel and rhythmic variation with steady illumination.

The heartbeat is rendered with composited CSS opacity/transform only. It pauses whenever the Command Center is closed, the document is hidden, or the device requests reduced motion. No timer drives gameplay, no pulse fabricates activity, and no decorative node claims a state that does not exist.

## Tactical Director

A pure projection module derives a `WildsCommandCenterModel` from existing state. It has no timers and owns no game truth.

Each candidate priority contains:

- a stable id and category;
- urgency: calm, opportunity, warning, or critical;
- a short title and consequence;
- a supported primary action;
- an optional destination sheet or world action;
- the authoritative state revision or local causal basis that produced it.

Ranking is deterministic. Critical creature survival and unresolved battle consequences outrank expiring world events; active mission blockers outrank ordinary nearby opportunities; opportunities outrank informational state. Equal-priority candidates use stable category and id ordering so the UI never jitters between choices.

The director never invents an action. If the existing domain layer cannot perform an action, the center reports the condition without rendering a false button.

## Now

The first viewport contains one primary decision card. It answers three questions visually:

- What changed?
- What happens if the player acts or waits?
- What is the one useful action now?

Examples include healing or resting a critically damaged creature, switching a threatened fighter, joining a nearby ecology event, entering the Mortal Arena, responding to a live challenge, following a hot creature signal, or advancing a blocked mission step.

Activating the action dispatches the same existing gameplay input or opens the existing specialized sheet. Pending, admitted, rejected, and offline-queued results remain explicit.

## Squad

Squad projects the active creature and support cards from the Vault and living-card state. It shows concise readiness bands and durable consequence rather than decorative scores.

- Critical/death-risk state must be unmistakable before a dangerous action.
- Rest, heal, switch, and flee are shown only where their existing rules permit them.
- A transferred, retired, dead, or otherwise non-playable bearer card is removed from actionable squad choices during reconciliation.
- Actions update the same creature history, appearance, XP, health, and lifecycle records used elsewhere.

## World

World ranks nearby and global activity already projected by Wilds systems:

- landmark entrances and district activities;
- ecology sites and aftermath;
- Mortal Arena availability;
- global bosses and raids;
- nearby/live player interactions;
- creature signals and discoveries;
- relevant map destinations.

Location actions use existing Rift, landmark, raid, multiplayer, and discovery operations. The section may open the clean full-screen atlas but does not render its own map or destination panels.

## Mission

Mission reuses the existing active mission and progression model. It shows progress, next objective, reward/consequence, and one supported route into action. The current mission sheet remains the full detail surface.

## Consequence Memory

The Command Center distinguishes new state from previously acknowledged state without creating a second gameplay ledger.

- The game records only lightweight acknowledgement ids in player continuity.
- Actual events, ownership, creature condition, XP, mission progress, and world history remain in their existing authoritative stores.
- Reopening the center does not erase consequences; it only removes the “new” emphasis after the player has seen the relevant revision.
- Offline actions append through the existing local-first game path and synchronize through existing Receiz rails when connectivity returns.

## Motion and Sound

- Trigger motion occurs once when the top priority changes and settles immediately.
- New priority rows enter through short opacity/position transitions; existing rows keep stable positions whenever their rank has not changed.
- Critical state uses color, iconography, and restrained weight, never flashing.
- Reduced-motion mode removes spatial animation.
- Existing audio remains unchanged. The Command Center may invoke existing gameplay cues only when the underlying game event already emits them; it adds no new soundtrack or audio dependency.
- A committed action sends one visible causal pulse from the action point through the neural spine to every section whose authoritative projection changed.
- Ambient life uses the low-cost neural heartbeat while the sheet is visible; its tempo and amplitude come from bounded urgency tokens rather than an independent animation state.

## Performance

- The director is a pure, memoized projection over already-loaded state.
- Closed Command Center content is not mounted.
- No polling loop is added. Network-backed world and multiplayer updates flow through existing snapshots and subscriptions.
- Rows use lightweight HTML/CSS and existing icons; no new 3D canvas, package, API key, or external dependency is introduced.
- Movement and camera state do not subscribe to Command Center presentation state.
- The mobile gameplay frame must remain unaffected while the center is closed.

## Accessibility

- The trigger is a real button with a current-priority accessible label and `aria-expanded` state.
- The sheet uses the existing dialog, focus, Escape, backdrop, drag-to-close, and focus-restoration behavior.
- Dynamic updates use a polite live region only for material priority changes and never announce every world tick.
- Urgency is never communicated by color alone.
- Every visible action has an explicit label and disabled explanation where appropriate.

## Error and Offline Behavior

- Local-only state renders immediately.
- Network-required actions explain disconnected state and never claim success.
- An interrupted action preserves the prior authoritative state and keeps the priority actionable.
- Stale network results are rejected by the existing causal/revision boundary and cannot overwrite newer local consequences.
- Empty or unavailable sections collapse without leaving blank panels; the Now decision always has a valid local fallback such as current mission or exploration guidance.

## Relationship to Existing Command Sheets

This design supersedes only the earlier exclusion of a separate Command Center in `2026-07-16-wildz-living-command-loop-and-creature-drawer-design.md`. It preserves that document's permanent bottom layout, six action sheets, drawer behavior, proof boundaries, and compact-density requirements.

The implementation extends `WildsCommandDock` so an externally triggered command item can participate in the same dialog lifecycle without adding a seventh bottom-dock button. Existing item keys and trigger mappings remain stable.

## Testing and Acceptance

### Unit and contract coverage

- Priority ranking is deterministic across survival, battle, mission, world, multiplayer, and informational candidates.
- Critical creature survival always outranks non-critical opportunities.
- Unsupported actions never appear as executable controls.
- Acknowledgement changes emphasis without mutating gameplay history.
- Offline actions use existing local-first inputs; network-only actions remain disabled and truthful.
- Command Center is externally requestable but does not add a bottom-dock button.
- Minimap and Command Center use distinct actions; no duplicate atlas utility remains.

### Rendered interaction coverage

- Minimap opens the atlas with pointer and keyboard input.
- Command trigger opens the sheet, exposes Now/Squad/World/Mission, and restores focus on close.
- A changed priority animates once and respects reduced motion.
- State changes while open reorder only when rank actually changes.
- No blank initial paint appears on open.
- Small mobile viewports retain safe-area spacing, complete text, and reachable actions.
- Camera and movement respond identically with the center closed.
- Neural branches illuminate only for genuine source-state changes and never fabricate activity.
- The first mobile viewport reads as one coherent tactical cockpit rather than a stack of generic cards.

### Release gates

- Full TypeScript, test, and production build gates pass.
- Mobile browser verification covers open/close, live update, action routing, focus, and no console errors.
- The gameplay bundle adds no external dependency and no second rendering engine.

## Success Criteria

- The game surface is less redundant because the minimap owns atlas navigation and the former globe slot owns tactical command.
- Opening Command Center immediately answers what matters, why it matters, and what the player can do.
- Creature condition, world activity, missions, multiplayer, and consequences feel connected to one living system.
- Every Command Center action changes or routes into real authoritative gameplay.
- Closed-state gameplay remains as responsive and visually unchanged as before.
