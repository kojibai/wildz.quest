# Profile Vault Gallery and Scoped Game Zoom Design

## Goal

Every explorer Profile displays every card that explorer has published from their Vault as real Wildz card artwork. Selecting a card opens its complete two-sided card experience without leaving the Profile. Browser zoom gestures are suppressed across gameplay and game UI, while the dedicated world map retains its intentional custom map zoom.

## Product behavior

### Profile card gallery

- Replace the Profile's metadata-only Public Vault tiles with a responsive card gallery.
- Each gallery item uses the published card image endpoint for the exact asset ID. It must never synthesize artwork from the public name or use placeholder creature art.
- Preserve the public Vault's published order and show the active companion state when the public profile exposes it.
- The gallery supports all published cards up to the existing 120-card public-profile limit.
- Cards load progressively so one slow or unavailable public record cannot block the rest of the Profile.
- An unavailable image remains a labeled card entry with the exact published name and a restrained “Proof unavailable” state.

### Complete card viewer

- Activating a gallery card opens a focused viewer inside the Profile overlay.
- The viewer resolves the full verified `PortableCardAsset` for the selected public asset ID through the same-origin `/api/cards/[assetId]` endpoint.
- The current explorer's own Profile may use the already-admitted local inventory asset immediately, but it must still match the published asset ID.
- The viewer reuses the existing `WildsCard`, `WildsCardBack`, and front/back scene behavior so the front artwork, stats, abilities, dossier, lineage, and proof are the actual card surfaces.
- Tap, Enter, Space, or a deliberate horizontal swipe flips the selected card. The viewer has explicit “Show front” / “Show back” accessible state text without adding a redundant close icon to each card face.
- Closing the viewer returns focus to the exact gallery card that opened it.
- Escape closes the focused card viewer before it closes the outer Profile overlay.
- While the viewer is open, gallery controls behind it are inert and hidden from assistive technology.

### Loading and failure states

- Opening a card announces “Resolving verified card…” until the full public record arrives.
- A failed or malformed public-card response produces an inline “Verified card unavailable” state for that selection. It does not invent a card back and does not prevent selecting another card.
- Changing selection aborts the previous request so stale data cannot replace the newly selected card.
- Closing the Profile aborts outstanding gallery-detail work through normal component cleanup.

## Data and trust boundaries

- `PublicWildzProfile.vault` remains the public index: asset ID, display name, proof digest, public visibility, status, and optional listing price.
- The gallery image source is `/api/cards/[assetId]/image` for the exact encoded public ID.
- The full viewer accepts only a record that passes the existing `parsePublicWildsCardRecord` validation and whose `assetId`, `asset.id`, and public profile card ID all match.
- The owner-local fast path receives admitted `PortableCardAsset[]` from `WildzApp`, filters by the public profile's asset IDs, and never exposes non-public inventory in another explorer's Profile.
- Remote profiles resolve only published public-card records; no local private Vault fallback is used for them.

## Component design

### `WildzProfileSheet`

- Accepts optional admitted owner assets for the owner-local fast path.
- Owns selected asset ID, detail loading/error state, request cancellation, and focus restoration.
- Continues to own the existing Profile identity, sharing, stats, and impact sections unchanged.

### `WildzProfileVaultGallery`

- New focused component for the responsive image gallery and its selected-card viewer.
- Receives public cards and optional admitted owner assets through a narrow interface.
- Keeps gallery rendering lightweight by using card image responses instead of mounting every full SVG card and dossier simultaneously.
- Mounts one full `WildsCardScene` only for the selected card.

### `WildzApp`

- Passes the current admitted inventory only when rendering the current explorer's own Profile.
- Remote Profile rendering continues to receive public profile data only.

## Responsive and accessibility behavior

- Mobile uses two compact card columns when space permits and one column only at the narrowest supported width; wider overlays expand naturally.
- Image cards preserve the real card aspect ratio and never crop the card face.
- Every gallery button has a minimum 44×44 interactive target and an accessible label containing the exact card name.
- The selected viewer traps focus within its own controls, supports Escape, and restores a connected enabled origin.
- Reduced-motion mode removes decorative flip easing while keeping the front/back state change.
- Profile scrolling remains native vertical scrolling with `touch-action: pan-y` and momentum scrolling.

## Scoped no-zoom behavior

- Keep the document viewport user-scalable for standalone pages and accessibility outside active gameplay.
- Add a gameplay gesture boundary that prevents browser double-tap and pinch zoom over the live world, gameplay HUD, controls, and game-owned popovers.
- Native vertical scroll surfaces retain `touch-action: pan-y`, which allows scrolling but does not hand pinch or double-tap zoom to the browser.
- The world map canvas remains `touch-action: none` and keeps its existing custom pan/zoom implementation. The global gesture rule must not disable or replace map zoom.
- Do not add document-wide `touchstart` cancellation or a global `maximum-scale=1`; those would break native scrolling and accessibility outside gameplay.

## Tests

- Behavioral projection test: owner assets are admitted only when their IDs are present in the public Vault index.
- Public resolver test: accepts a verified exact-ID public record; rejects malformed and mismatched records; stale requests cannot win.
- Component contract test: the Profile renders the gallery, uses exact image URLs, mounts only one full card scene, and passes owner assets only for the local Profile.
- Interaction test: selecting a card opens its full front/back viewer; Escape closes it; focus returns to the origin.
- Failure test: one unavailable card does not block other cards.
- Gesture test: gameplay and game UI reject browser zoom gestures; Profile scroll remains vertical; the world map retains its custom zoom boundary.
- Full repository tests, typecheck, lint, production build, and mobile browser verification are required before completion.

## Non-goals

- Do not publish private Vault cards merely to make them visible in Profile.
- Do not render all full dossiers simultaneously.
- Do not redesign the standalone card page or Card Vault.
- Do not change world-map pan/zoom semantics.
- Do not disable browser zoom across unrelated standalone pages.
