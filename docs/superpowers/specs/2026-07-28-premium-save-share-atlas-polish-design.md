# Premium Save, Share, and Atlas Polish

**Date:** 2026-07-28  
**Status:** Approved for implementation

## Objective

Make Wildz feel immediate and valuable at its most important interaction points without broadening the redesign:

- Saving a verified card should feel tactile, premium, and unmistakably successful.
- The selected card artifact should usually be ready before the user presses Save or Send.
- The top share control should open the native system share sheet instead of behaving like a copy button.
- Rotating the popover world atlas should remain smooth while live presence refreshes.
- Creature and player nameplates must remain behind game sheets and popovers.

The implementation must remain surgical, avoid artificial delays, preserve proof correctness, and reuse existing visual language.

## Scope

### In scope

- The `Save verified card` action in the Wilds Vault.
- Shared pressed-state feedback for actionable Wilds buttons.
- Card preparation reuse between Save and Send.
- The multiplayer invite share control.
- The popover atlas render and live-presence update boundaries.
- World-space label layering while overlays are open.
- Focused unit, render-contract, and rendered interaction tests.

### Out of scope

- Redesigning the Vault, multiplayer sheet, or atlas layout.
- Pre-generating every card in the collection.
- Persisting prepared proof artifacts across browser sessions.
- Changing proof formats, ownership semantics, publication requirements, or Receiz SDK behavior.
- Adding a third-party animation, haptic, caching, or state-management dependency.

## 1. Premium Save Interaction

### Interaction states

The card save control has explicit `idle`, `preparing`, `saving`, `success`, and `error` presentation states.

1. **Idle:** `Save verified card`.
2. **Preparing:** `Preparing proof…` with a rotating seal treatment.
3. **Saving:** `Sealing verified card…` with a restrained emerald glow and traveling gold highlight.
4. **Success:** `Card secured` with a resolved checkmark, a single foil sweep over the selected card, and a very small number of gold light motes.
5. **Error:** Return the control to an actionable retry state and show concise failure copy without celebratory motion.

The animation follows the real preparation and download promise. There is no minimum loading duration and no timeout inserted to make the sequence appear longer. If the artifact is already prepared, the interaction advances directly from press feedback to the real download and success resolve.

### Copy

- Preparing: `Creating your portable, verified card proof…`
- Saving: `Sealing your verified collectible…`
- Success: `Card secured. Your verified collectible is ready to keep or share.`
- Failure: retain the underlying useful error where safe, prefixed by a clear retry-oriented card-save message.

Success remains visible long enough to be perceived through the normal UI state lifecycle, but the implementation must not delay the download or completion promise. Repeated saves after success remain available.

### Tactile feedback

All enabled Wilds buttons receive a consistent pressed treatment:

- Approximately 2px of downward travel.
- Small compression.
- Darker lower edge or inset depth.
- Short spring-like release.
- Equivalent visible activation for keyboard use.

The save action may add supported-device haptics:

- A short tick on activation.
- A distinct restrained success pattern after the actual download is triggered.
- A small double pulse on failure.

Haptics use progressive enhancement only. Unsupported browsers must silently continue with visual feedback. Haptics must never gate, delay, or change the save result.

### Motion accessibility

With reduced motion enabled:

- Remove the foil sweep, light motes, traveling highlight, and spring overshoot.
- Preserve pressed depth, explicit working text, success color, icon resolution, and status copy.
- Do not remove functional progress or error communication.

## 2. Prepared Card Artifact Pipeline

### Existing redundant work

The current Save and Send paths can independently repeat:

- Anonymous public-card availability verification.
- SVG card rendering.
- Canvas PNG conversion.
- Portable proof embedding.
- Native Receiz proof-object creation.

This creates avoidable latency and duplicate server/CPU work.

### Preparation boundary

Introduce one reusable card-artifact preparation operation that returns the exact downloadable native artifact:

- Artifact bytes.
- MIME type.
- Filename.
- The exact card fingerprint used to create it.

Save and Send consume this same prepared result. The preparation function owns public availability verification, PNG rendering, proof embedding, native proof-object creation, and required verification.

### Cache identity and correctness

Cache entries are keyed by an exact immutable fingerprint derived from the portable card proof/revision content, not only the asset ID. A changed, transformed, evolved, or otherwise revised card cannot reuse a stale artifact.

The cache is:

- In-memory and bounded to the current UI lifecycle.
- Promise-aware so concurrent Save and Send actions join the same in-flight preparation.
- Invalidated or ignored when the selected card fingerprint changes.
- Cleared after a rejected preparation so a later action can retry.

No proof validation or publication requirement is bypassed.

### Prewarming policy

When the selected card becomes stable and is eligible to save, begin preparing that card in the background. Only the current selected card is prewarmed.

- Do not prepare the entire inventory.
- Do not restart work when unrelated component state changes.
- If selection changes, allow safe underlying work to finish only when cancellation is not supported, but discard the stale result from the active selection path.
- Do not show a failure merely because speculative prewarming failed; surface an error only after an explicit Save or Send action also fails.

On click:

- Use the completed cached artifact immediately.
- Join the existing promise if preparation is still in flight.
- Start preparation normally if no valid entry exists.

The actual browser download remains user-initiated. Prewarming prepares bytes but does not trigger a download.

## 3. Native Invite Sharing

The top multiplayer share icon becomes a true share action.

1. Create or reuse the correct invite-room URL without copying as a side effect.
2. Call `navigator.share` with a concise Wildz title, invitation text, and the URL when supported.
3. Let the operating system provide destination apps and its own Copy option.
4. Treat `AbortError` from dismissing the share sheet as a neutral cancellation with no error notice.
5. When native sharing is unavailable, copy the invite URL and show a clear fallback confirmation.
6. When both share and clipboard operations fail, show an actionable browser-share fallback message.

The button label and accessible name change from copy-oriented language to `Share Wildz invite`.

## 4. Popover Atlas Camera Performance

### Observed architectural cause

The atlas refreshes live presence approximately every second. The refreshed projection object is currently passed through dependencies used to construct the organic terrain geometry. This can rebuild thousands of vertices and recompute surface normals even when only live-player data changed, briefly competing with OrbitControls camera rotation on the main thread.

### Render isolation

Split the atlas inputs into stable and dynamic domains:

- **Stable scene:** center region, terrain nodes, geography, routes, landmarks, static labels, and materials.
- **Dynamic scene:** exact live players, player clusters, trainers when changed, current position, and selection/drop state.

Terrain geometry must depend only on terrain inputs. Live-presence refreshes must update player instance matrices without reconstructing terrain, routes, landmarks, or static labels.

Use stable references and memoized scene units where they reduce actual work. Avoid memoization that obscures correctness or adds more comparison cost than the work it saves.

### Refresh discipline

- Prevent overlapping atlas presence requests.
- Ignore stale responses after a newer request completes or the atlas closes.
- Keep the Canvas and OrbitControls mounted while the atlas remains open.
- Preserve camera position while dynamic data updates.
- Avoid allocating static Three.js geometry or materials during routine presence refreshes.

If rendered profiling still identifies decorative animation as a material interaction cost, reduce only nonessential decorative work while OrbitControls is active and restore it immediately after interaction. This is a fallback optimization, not the first-line fix.

## 5. World Label Layering

World-space names currently use Three.js HTML overlays. The active creature label lacks an explicit bounded z-index range, which can place it above normal game UI.

Define clear layer ownership:

- 3D canvas and world labels occupy the world layer.
- HUD controls occupy the interaction layer.
- Sheets, popovers, notices, dialogs, and modal experiences occupy the overlay layer.

Every world-space label receives an explicit low z-index range. The active creature name, remote-player nameplates, trainer nameplates, and equivalent non-critical world annotations must never render above game overlays.

When the multiplayer roster is open:

- Hide the active creature label.
- Hide remote-player and trainer nameplates.
- Keep the 3D world rendered behind the sheet.

Apply the same world-label suppression pattern to other full covering overlays where an existing overlay-state class is available. Battle telemetry retains its existing special handling and must not be unintentionally lowered during active battle presentation.

## 6. Error Handling and Concurrency

- Disable duplicate explicit Save clicks while the current save action is resolving.
- Save and Send may share prepared bytes, but each retains its own visible action state.
- A canceled share sheet is not an error.
- Cache rejections are removed so retries are possible.
- Object URLs are revoked after download as today.
- Component unmounts must not attempt visible state updates.
- Atlas requests stop or become inert after close.
- No speculative work may download, navigate, open a share sheet, or show a blocking error.

## 7. Testing and Verification

### Automated tests

Add focused coverage for:

- Exact fingerprint cache reuse.
- One preparation request shared by concurrent consumers.
- Cache invalidation after card revision changes.
- Failed preparation removal and retry.
- Save using a prepared artifact without repeating proof creation.
- Send reusing the same prepared artifact.
- Native share invocation payload.
- Share cancellation behavior.
- Clipboard fallback behavior.
- Save state copy and accessibility attributes.
- Reduced-motion class/state behavior.
- Atlas terrain geometry dependencies excluding live presence.
- No overlapping atlas refresh requests.
- Active creature and remote labels staying below or hidden behind the multiplayer roster.

Preserve the existing proof-object and anonymous-publication tests.

### Rendered validation

Validate the flow:

`Open Vault -> select card -> prepared artifact becomes available -> press Save -> immediate real download -> premium success state`

Also validate:

- Save failure and retry.
- Rapid Save taps.
- Send after preparation.
- Native share and copy fallback.
- Desktop and mobile button press feedback.
- Reduced motion.
- Atlas camera rotation across multiple live-presence refresh intervals.
- Opening `Everyone live now` while the active creature and remote labels are positioned behind it.
- No relevant console errors or framework overlays.

### Performance acceptance

- Live-presence refresh must not rebuild terrain geometry.
- Save and Send must not create duplicate proof artifacts for the same exact selected card during one UI lifecycle.
- No artificial delay is introduced.
- Atlas camera rotation should remain visually continuous through presence refreshes on the existing supported quality profile.

## 8. Implementation Boundaries

Prefer small focused additions:

- A reusable prepared-card artifact helper/cache near the existing card export boundary.
- Minimal action-state additions in `WildsInventory`.
- A side-effect-free invite-link creator in the multiplayer controller plus share behavior in `WildsMultiplayer`.
- Stable/dynamic projection boundaries in `WildsWorldMap` and `WildsAtlasCanvas`.
- Explicit world/UI layer rules in the existing Wilds CSS.

Do not introduce a global event bus, application-wide animation system, service worker artifact cache, or unrelated component refactor.
