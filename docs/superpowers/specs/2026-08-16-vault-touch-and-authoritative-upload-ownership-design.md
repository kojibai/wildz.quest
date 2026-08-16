# Vault Touch Paging and Authoritative Upload Ownership Design

## Goal

Make the existing four-card Vault pages respond reliably to real finger swipes, and make every successful card or Vault-image upload an authoritative ownership transfer. Preserve the current Vault presentation, buttons, dots, card taps, vertical scrolling, identity activation, and ownership history.

## Approved Behavior

### Vault page gesture

- The compact Vault still renders four creature cards per page with the same layout, page dots, and previous/next buttons.
- A deliberate left swipe moves forward exactly one page; a deliberate right swipe moves back exactly one page.
- A tap still selects a creature.
- Primarily vertical movement still scrolls the Vault sheet.
- Paging remains clamped at the first and last pages.

### Upload ownership

- Uploading a complete single-card artifact or Vault image through the active Vault claims it for the connected Receiz identity before it enters the Vault.
- The complete artifact is verified against its carried ownership chain. A historical artifact whose card has since moved to another owner is rejected and cannot reclaim the card.
- A successful claim returns a newly sealed artifact whose signed witnessed Kai pulse carries the uploader as the appended ownership head. That witnessed artifact is the claim; the server only coordinates Record -> Seal and synchronizes its projection.
- The client verifies and restores those returned bytes, never the stale uploaded bytes, and downloads the new artifact for the owner.
- The prior owner keeps historical proof, but the transferred creature disappears from their active Vault immediately in another tab on the same device and within the next two-second ownership reconciliation on another device.
- Identity Seal activation remains a separate flow and is not converted into a bearer claim.
- An upload cannot claim ownership while the Receiz proof session is disconnected. It fails clearly instead of adding an unowned local copy.

## Implementation Boundary

### Reliable touch capture

Repair the existing pointer gesture in `WildsInventory`; do not replace pagination. Capture the pointer immediately on `pointerdown`, retain `touch-action: pan-y`, and evaluate the completed gesture with the existing 48-pixel horizontal-intent policy. Only an accepted horizontal swipe suppresses the following card click. Pointer cancellation and lost capture clear gesture state.

Immediate capture is required because a phone can hand an uncaptured pointer to the surrounding scroll sheet before the current 48-pixel threshold is reached. The horizontal-intent policy still prevents taps and vertical movement from turning pages.

### Authoritative upload claim

Keep the current upload control and import summary. Route each `merge-vault` upload through `/api/market/claims` while leaving `activate-identity` unchanged. The route and Receiz SDK transport the operation; the returned sealed artifact's witnessed Kai pulse remains the transfer authority:

1. The server resolves the authenticated actor and submits the complete artifact through the Receiz claim operation.
2. A stale carried ownership head is rejected with the existing stale-custody error.
3. The newly sealed artifact's signed Kai witness carries the new ownership head. The server derives the previous owner, head reference, history digest, and witnessed pulse from that verified artifact and publishes a non-authoritative active-Vault invalidation through Receiz v119 app state.
4. The client verifies the response digest, downloads the artifact, and restores only that response into the current Vault.
5. The existing ownership BroadcastChannel immediately reconciles other tabs on the same device.

The current explicit Profile claim action reuses the same lower-level client path and keeps its confirmation prompt.

### Cross-device reconciliation

Add a same-origin authenticated endpoint that accepts a bounded list of active Vault asset IDs. It resolves the schema-bound Receiz v119 app-state invalidation projection and returns only IDs whose synced witnessed claim differs from the cookie actor. It does not expose another player's identity or accept a client-supplied owner. The projection is transport, not proof authority; divergent or malformed rows fail closed.

While a proof session is connected and the document is visible, the shell checks that endpoint every two seconds for the current active Vault. It also checks immediately on focus or visibility restoration. Returned IDs pass through the existing `removeWildzAssetsFromActiveVault` helper and the normal durable Vault save scheduler. Historical receipts and proof history are untouched. An unavailable sync projection produces no local removal and retries on the next check.

### Receiz v119 authority boundary

- `@receiz/sdk`, `@receiz/ai-skills`, and `@receiz/mcp-server` stay pinned to `119.0.0`.
- Receiz MCP capability, doctor, projection, and ledger calls are diagnostic only; MCP never supplies the ownership verdict.
- Ownership changes only at the signed witnessed Kai pulse carried by the newly sealed artifact returned through the SDK's complete-artifact claim rail. The server, SDK, MCP, and UI remain beneath that artifact truth.
- The prior owner and sync cursor are derived from the returned artifact's verified carried continuity, never from a caller, server clock, or market row.
- The server publishes active-Vault invalidation through `client.appState.publish`, and the reconciliation endpoint reads it through `client.appState.resolve`. Neither operation becomes proof authority, deletes the retained artifact, or rewrites history.
- If that schema-bound projection is unavailable, malformed, or divergent, no card is removed locally.

## Failure and Race Behavior

- A stale artifact is rejected and never merged, even if its former owner still has it on disk.
- A successful response whose digest cannot be verified is rejected locally.
- A disconnected session cannot claim an upload.
- Concurrent reconciliation requests are coalesced so a slow request cannot create an overlapping poll loop.
- If ownership changes while the Vault is open, same-device broadcast wins immediately; cross-device polling is idempotent and safely observes the already-removed asset.
- A synchronization outage never guesses ownership or deletes a local card; reconciliation resumes when the verified projection is available.
- Fewer than two Vault pages, page boundaries, taps, diagonal gestures, cancellations, and vertical scrolling retain their current behavior.

## Verification

- Gesture tests require pointer capture on `pointerdown`, one-page left/right deltas, threshold rejection, vertical rejection, cancellation cleanup, and existing layout/CSS contracts.
- Upload tests prove ordinary Vault uploads use the claim endpoint, restore only returned bytes, keep Identity Seal activation separate, and surface stale-head rejection without merging.
- Route and policy tests prove reconciliation is authenticated, bounded, returns only invalidated active asset IDs, and fails closed when synchronization is unavailable.
- Shell tests prove immediate same-device removal, two-second visible polling, focus refresh, durable persistence, and no ownership-history deletion.
- Typecheck, lint, the full test suite, diff checks, and an in-app-browser compact Vault interaction complete verification with no relevant console errors.
