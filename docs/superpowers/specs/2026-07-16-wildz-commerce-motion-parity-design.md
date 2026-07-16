# Wildz Commerce Motion Parity Design

## Goal

Make a restored Vault of roughly 100 cards feel as light as a starter Vault while matching the current Receiz Commerce Wildz camera and living-world boss HUD. The complete collection must remain sortable and horizontally scrollable. Every successful explorer or Identity Seal login must establish a canonical same-origin Receiz ID session. A fully verified legacy player Vault must restore its complete state into an artifact-scoped Wildz session without leaving Wildz or claiming account authority that the artifact does not contain.

Reference: `kojibai/receiz-commerce` `main` at `adaaa4305fc7c249c484656576ee07b2454846f5`.

## Findings

- `WildsExplorer.tsx` is byte-for-byte identical to the Commerce reference. The visible gait regression is frame starvation, not a different authored walk cycle.
- The standalone social deck maps every restored card into a complex SVG thumbnail inside the component tree that also receives movement and camera updates. Movement dispatches every 45 ms, so a 98-card Vault creates avoidable reconciliation work during play.
- Standalone camera behavior drifted from Commerce by enabling OrbitControls damping and changing the target from `[0, .55, 0]` to `[0, .35, -.65]`.
- Standalone mobile boss pills wrap horizontally. Commerce stacks them vertically at the lower-left.
- The regression came from treating an external Receiz OIDC cookie as the admission gate. Key-backed identities can authenticate directly with the official v104 signed continuation flow. A legacy proof-sealed player Vault carries exact recovery authority for its embedded Wildz state, but—without an Identity Seal or v104 owner-continuity binding—it does not cryptographically establish a canonical Receiz account. Redirecting to an unrelated browser account could still conflict with the identity carried by the uploaded Vault.
- The already-committed Vault fix reused the prior service-worker release identifier, so installed PWAs can retain the old client shell unless the identifier is bumped.

## Selected Design

### Vault performance

Use the current Commerce Vault boundary instead of a custom virtual list. Commerce never mounts the complete collection in the live movement tree: it pages four cards on compact/mobile screens and eight on wider screens through the shared `inventoryPageSize` and `clampInventoryPage` helpers, and mounts the complete detailed Vault only while its sheet is open.

Apply that same 4/8-card paging to the standalone world rail while retaining its approved styling and rarity/newest/oldest sort control. Every card remains reachable across the page controls and swipe gesture. Move the paged rail into a memoized boundary whose inputs are limited to collection data, progression data, sort order, page, and stable card actions. Camera heading, movement mode, world position, and live frame state must not invalidate card rendering. Cache each generated SVG thumbnail by its stable proof/asset identity.

The detailed Card Vault sheet continues to use the same Commerce pagination helpers and mounts only when opened.

### Movement and camera

Keep the Commerce-authored explorer skeleton and walk cycle unchanged. Restore Commerce locomotion exactly: emit movement only on the steady 45 ms hold cadence, use the 42% analog radius, and restore walk/run scales of `1.0`/`1.25`. Restore the Commerce camera contract exactly: FOV `42`, position `[4.6, 5.8, 7.2]`, damping disabled, target `[0, .55, 0]`, the same distance/polar-angle bounds, one-finger rotate, and two-finger dolly/rotate.

Keep camera-relative analog movement and pointer capture. Remove any duplicate hidden control tree that is not part of the visible interaction path so only one D-pad owns movement input.

### Living-world boss HUD

Restore the Commerce mobile layout: a lower-left rail with `flex-direction: column`, left alignment, and the existing compact pill sizing. Mode, boss/event, and ecology pills stack rather than wrap. The expanded sheet remains centered and clear of the bottom controls.

### Receiz proof login and shared-world activation

Treat key-backed identity entry and verified legacy Vault recovery as two explicit proof-native entrances to the Wildz session pipeline:

1. Verify or create the SDK identity and atomically persist any staged Vault restore.
2. A key-backed identity receives a short-lived same-origin nonce, builds the official v104 `ReceizIdContinueRequest`, and sends that signed request to the Wildz same-origin proxy. The proxy forwards it server-to-server to Receiz and issues a local proof session only from the canonical bound account returned by Receiz.
3. A legacy proof-sealed player Vault is exact-byte bearer recovery authority for its embedded Wildz player and cards. Official Receiz verification plus local player/card/byte verification creates only a short-lived pending admission. The browser commits the complete restore to IndexedDB before exchanging that pending admission for an artifact-scoped Wildz session.
4. The legacy Vault principal is derived from the verified artifact, while its carried handle is presentation data. Canonical account-scoped profile, market, proof-object, ownership, and settlement writes require Identity Seal/key authority (or a future owner-bound Vault continuity proof); a legacy Vault cannot self-assert those rights. Its artifact-scoped principal can still participate in shared-world and multiplayer paths.
5. Store only encrypted, purpose-separated, scoped `HttpOnly` cookies. Never send private key material, Vault bytes, generated access tokens, or canonical account claims into browser application state.
6. Keep gameplay mounted from committed local state, but gate network hooks until the matching final proof session exists. Normal entry never redirects to `receiz.com` and never depends on a different browser account.

The legacy OIDC routes remain isolated compatibility surfaces and are not part of fresh, Identity Seal, or Vault entry. Durable v104 shared-world/publication writes use a separately provisioned server-only `RECEIZ_CONNECT_ACCESS_TOKEN`; it is not a player-login environment variable. No third-party database is introduced.

### PWA delivery

Bump the service-worker release identifier so installed clients fetch the new shell instead of retaining the pre-fix cached build.

## Failure Handling

- An empty Vault renders an empty first page.
- Resize and orientation changes switch safely between the Commerce 4-card and 8-card page sizes.
- Sort changes reset the rail to its first page.
- Pointer cancel, lost capture, visibility change, and blur stop movement immediately.
- Failed proof verification preserves the active identity and makes no partial Vault mutation. A foreign legacy browser session cannot replace or block the artifact-scoped actor recovered from the Vault.
- A canonical-world bootstrap is idempotent and rejects publication conflicts instead of forking world history.
- Reduced-motion behavior remains unchanged.

## Verification

- Unit-contract tests prove Commerce camera parameters, vertical boss stacking, one visible D-pad path, 4/8-card Vault paging, full logical count, and all three sort orders.
- A 100-card regression fixture exercises repeated movement while mounting at most the active Commerce-sized page.
- Mobile WebKit verification covers: restore the real 98-card Vault, enter the world, drag the D-pad, rotate and pinch the camera, scroll to the end of the card rail, change sort order, and open the boss HUD.
- Login tests cover direct fresh explorer and Identity Seal canonical continuation, legacy Vault pending-to-final admission after local commit, nonce/session binding, actor mismatch, exact 98-card restore, account-only mutation rejection for a legacy Vault, and the absence of external login navigation.
- Desktop and mobile screenshots confirm the boss rail and controls do not overlap.
- The complete release check, production build, output-trace check, and clean-worktree review must pass before the release commit.
