# Wildz v105 Frictionless Vault Continuity Design

## Objective

Make a verified imported Vault feel identical to a Vault created inside Wildz while preserving complete Receiz ID continuity across compatible Receiz applications. Import must never destroy and repaint the gameplay surface, duplicate the collection into a second UI, or weaken Receiz proof authority.

The same slice upgrades the existing Identity Seal download into a beautiful login-capable Receiz ID Card. The card is intentionally a bearer account credential: possession of its verified identity authority grants access. It has no password requirement. The UI must state that consequence plainly without adding friction to use.

## Authority model

`@receiz/sdk@105.0.0` remains the only identity-artifact authority. Wildz uses the official identity primitives and their current `receiz.account.state.v3` portable-state envelope:

- `createReceizIdIdentity` creates a new Receiz identity and its chosen normalized username;
- `readReceizIdentityArtifact` reads Receiz Key, Identity Record, Identity Seal, and compatible identity-bearing image bytes;
- `projectReceizIdentityAccount` verifies the carried account-state proof and projects the owner coordinate;
- `appendReceizIdentityArtifactTrailerToPng` carries the exact SDK identity artifact inside the rendered ID Card or full Vault.

Wildz does not rewrite SDK key-file fields, synthesize portable-state verification, treat a projection as proof, or add a parallel account database. The existing encrypted IndexedDB repository remains local proof memory for already-admitted identity and owner state.

## Bearer account rule

The Receiz ID Card and an identity-bearing full Vault are owner credentials. They are not public profile images.

- No passphrase is required by Wildz for newly created bearer identities.
- Possession of either artifact can restore the carried Receiz identity in a compatible Receiz app.
- The save action presents a concise, unavoidable warning: the saved image is the account and giving it away gives account access.
- Public profile sharing remains a separate non-login surface.
- Wildz never uploads or publishes the private artifact merely because it was rendered or downloaded.

## Artifact forms

### Receiz ID Card

The ID Card uses dedicated premium identity artwork and carries:

1. the exact v105 identity authority and its verified `receiz.account.state.v3` snapshot;
2. the complete Wildz V3 player payload for the same owner: character, play state, settings, personal events, canonical cursor, and receipts;
3. every verified Wildz card currently in the owner's active Vault;
4. the existing identity-to-player-Vault binding that proves the player payload and Vault digest belong to the carried identity.

The visual face emphasizes the username, display name, Receiz ID status, bearer nature, and portable continuity. It does not enumerate or render the whole card collection.

### Full Vault image

The full Vault keeps its collection artwork and carries the same identity, player payload, verified card set, and owner binding as the ID Card. The difference between the two artifacts is presentation and intended use, not authority or continuity completeness.

### Card-only Vault

A card-only Vault has no account authority. It may add verified cards to the active identity only after explicit confirmation and applicable ownership rules. It cannot replace the current Receiz ID or import another identity's player progress.

## Progress and ownership boundaries

Player progress is tied to the Receiz ID.

- A player payload whose owner coordinate matches the verified active or embedded identity may restore complete progress.
- A player payload for a different Receiz ID fails closed before storage mutation.
- A foreign identity-bearing artifact activates its own embedded identity and its own progress; it does not merge that progress into the previous identity.
- A foreign card-only artifact cannot silently claim cards. General bearer-card ownership transfer remains a separate authority-backed shipping slice.
- Historical card provenance remains immutable and is not rewritten merely because a compatible artifact transported the card.

## Username creation

Fresh Wildz users choose a username before creating their explorer. Wildz normalizes the input to the v105 username rules and passes it to `createReceizIdIdentity`; the resulting SDK identity, not component state, is the username authority.

The automatically bootstrapped placeholder identity may be replaced only while the account is still at fresh genesis with no created character or meaningful player progress. Existing verified or restored identities retain their SDK-carried username. Wildz may later expose a display alias, but it must never present a local alias as a rewritten canonical Receiz username.

If remote Receiz continuation rejects a username or identity admission, the local proof remains explicit local continuity and the UI must not claim global registration succeeded.

## Frictionless import architecture

### Root cause removed

Today `restoreEpoch` is included in the `PlayCampaign` React key. Every committed import therefore destroys and recreates the world canvas, presentation hooks, command sheets, drawer, and Vault. This is the primary blank/repaint and latency source.

The new lifecycle keys gameplay only by identity key and actor. A same-owner import does not remount gameplay. `PlayCampaign` already receives the committed restore result inside the mounted import action and adopts the returned play state, character settings, movement mode, audio settings, and card order in place.

An actual identity change still remounts the owner-scoped gameplay tree because the security and persistence scope changed.

### One collection projection

Commerce Vault metadata is inspection context, not a second gameplay collection. After verification, compatible Wildz cards enter the normal bounded, paged Vault inventory. The in-game `Receiz continuity` gallery and its additional image/card DOM are removed. Optional source metadata may remain in the restore result for audit or future dossier use, but it does not create another collection shelf or localStorage-backed render path.

### Painted-state preservation

The current world remains mounted and painted while bytes are read, SDK identity/account state is verified, Wildz proofs are checked, and the owner-state transaction commits. The import button alone shows tactile busy feedback. Only a successfully committed result can update gameplay state. A rejection leaves the current world and Vault unchanged.

The normal inventory pagination, memoized card components, thumbnail path, and prepainted card faces apply equally to imported and locally created cards.

## Data flow

### Save Receiz ID Card

1. Snapshot the currently committed owner state.
2. Create and verify the V3 player payload for the active Receiz ID.
3. Render the identity-card PNG basis.
4. Embed the complete portable Vault proof into that PNG basis.
5. Append the exact SDK identity artifact trailer.
6. Append and verify the existing identity/player-Vault binding.
7. Download the final bytes without publishing or wrapping them in a weaker format.

### Save full Vault

The flow is identical except that the PNG basis is the Vault collection artwork.

### Restore

1. Read the selected bytes once.
2. Inspect the artifact through the existing codec.
3. Verify SDK identity and account-state proof where present.
4. Verify every Wildz card, player digest, Vault digest, and identity binding.
5. Enforce the Receiz ID progress boundary.
6. Commit identity and owner state atomically in IndexedDB.
7. Hot-adopt same-owner committed state or remount only for a real identity change.

## Error behavior

- Invalid identity, portable-state, player, card, Vault, or binding proof changes nothing.
- Different-owner player progress is rejected with an explicit Receiz ID mismatch message.
- Duplicate conflicting versions of one card fail closed; exact duplicates deduplicate.
- Unsupported Commerce domain objects never enter Wildz inventory.
- Download failure leaves identity and gameplay unchanged.
- A local identity that has not completed remote continuation is never presented as globally admitted.

## Performance requirements

- Same-owner import must not change the `PlayCampaign` component key.
- Same-owner import must not recreate the Three.js canvas, camera, audio graph, command dock, or creature drawer.
- Imported cards must use the same 4/8-card bounded pagination as locally created cards.
- No second Vault gallery or unbounded imported image list may mount.
- Verification work completes before one atomic state adoption; there is no progressive partial inventory paint.
- The screen remains painted throughout import, including on mobile Safari.
- Importing a 97-card fixture must yield the same post-commit component structure as starting with the equivalent 97-card owner state.

## Verification

Automated coverage must prove:

- ID Card bytes round-trip through `readReceizIdentityArtifact` and `projectReceizIdentityAccount`;
- the carried account state is verified and the username matches the SDK identity;
- ID Card and full Vault restore identical identity, player state, settings, history, and card IDs;
- same-owner import preserves the gameplay key and hot-adopts the result;
- different-owner progress fails before mutation;
- a 97-card import adds no duplicate Commerce gallery and remains bounded by normal pagination;
- invalid or duplicate-conflicting artifacts leave existing owner state unchanged;
- cold reload after restore reopens the exact committed owner state;
- typecheck, complete compiled tests, v105 repository checker, production build, and mobile browser interaction checks pass before the implementation commit.

## Explicitly deferred

This slice does not implement general bearer-card ownership transfer between different Receiz IDs, global username mutation for an existing verified identity, public profile redesign, market settlement availability, or cloud storage outside verified Receiz rails. Those remain separate authority or product slices.
