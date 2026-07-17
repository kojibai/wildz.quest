# Wildz Profile Identity Editing Design

## Outcome

Wildz creates a stable automatic Receiz ID before Genesis and never asks for a username on the entry screen. After entering the world, the owner edits their public username and profile picture from Profile through one compact edit state with explicit Save feedback.

## Authority model

The generated Receiz identity key and proof coordinate remain stable. A username is a globally unique Receiz claim attached to that identity, not a Wildz-only label. Claiming or changing it does not rewrite proofs, custody, cards, or history; a verified Receiz receipt appends the new claim to the proof graph. The profile picture is bounded presentation media and never identity authority.

Only the owner’s Profile exposes Edit. A public visitor sees the saved projection without edit controls. A username save is successful only after Receiz atomically admits the unique claim and Wildz independently verifies the returned canonical identity/receipt. Local state, public projection, and profile links update only after that admission. If the global claim rail is unavailable, Wildz fails closed and retains the prior username.

## Entry experience

`WildzGenesis` receives the already-created automatic Receiz ID. It removes the username input, username validation, and create-ID action. Female explorer, male explorer, and restore remain the only choices. The automatic ID is sufficient to create the explorer immediately.

Restored Identity Seals and identity-bearing Vaults continue to replace the active identity according to their existing verified authority. Card-only Vaults continue to add cards without changing identity.

## Profile experience

The owner Profile header contains one wordless Edit icon. Activating it reveals, within the existing header footprint:

- a username field initialized from the current Receiz username, with debounced availability feedback;
- a circular picture control that opens the platform image picker;
- Save and Cancel icon controls with pressed, pending, success, and error feedback.

Availability is informative only; Save performs the authoritative atomic claim so a race can never create duplicate owners. States are checking, available, taken, unavailable, and unchanged. The saved picture is rendered with `next/image` when present; otherwise the existing initials avatar remains. Inputs are keyboard and screen-reader accessible. The image is decoded before save, constrained to PNG/JPEG/WebP, resized to a bounded square representation, and rejected with an inline error when invalid or too large.

## State and data flow

Add an owner-profile presentation record to the existing owner-scoped continuity snapshot rather than a new storage system. It contains the last verified Receiz username claim plus optional admitted media reference and digest. It is serialized with the player/Vault continuity so the same verified profile presentation travels with the account proof object and survives offline reload.

`WildzApp` derives its local public profile from the owner continuity presentation. `WildzProfileSheet` receives owner-only edit callbacks. Username availability is checked against the existing Receiz global identity rail. Save validates the input, requests an atomic username claim through the v106 `continueReceizId` authority path, requires the canonical response to equal the requested username, records the returned proof-graph receipt, uploads any changed picture through Receiz media, then commits the verified presentation through the existing atomic continuity boundary. It finally refreshes the public profile projection. A public-projection failure retains the globally admitted identity claim but clearly reports the profile as unpublished.

Public URLs use the last verified global username. The permanent key/proof coordinate and latest verified Receiz claim remain the server authority for ownership and write admission. Wildz never treats a local availability read or public-profile absence as a reservation.

## Error behavior

- Invalid or already claimed username: no state change; show bounded inline guidance.
- Availability race: the atomic claim returns conflict; retain the prior verified username.
- Claim response without a matching canonical username and proof receipt: reject it as unavailable.
- Invalid or oversized image: no state change; retain the last saved picture.
- Local persistence failure after a verified global claim: recover the admitted claim on the next identity reconciliation and show recovery pending rather than rolling it back.
- Remote public-profile publication failure: the verified global claim remains valid, but Profile clearly remains local/unpublished.
- Repeated Save: one pending operation and one idempotent result.

## Verification

Tests prove that Genesis contains no username field, an automatic identity can create either explorer, only the owner sees editing, availability is never treated as reservation, two competing claims admit at most one owner, mismatched/unreceipted claim responses fail closed, username/image validation fails closed, profile presentation survives cold reload and Vault round-trip, public visitors receive only sanitized presentation fields, button feedback is visible, and existing identity/card/proof continuity remains unchanged.

Production verification includes tests, typecheck, lint, the Receiz v106 checker and conformance suite, and a production build. No camera, audio, world controls, or atlas design changes are part of this slice.
