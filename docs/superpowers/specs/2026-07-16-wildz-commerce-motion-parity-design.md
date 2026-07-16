# Wildz Commerce Motion Parity Design

## Goal

Make a restored Vault of roughly 100 cards feel as light as a starter Vault while matching the current Receiz Commerce Wildz camera and living-world boss HUD. The complete collection must remain sortable and horizontally scrollable. Every successful explorer, Identity Seal, or identity-bearing Vault login must also finish with a live Receiz session and enter the shared world.

Reference: `kojibai/receiz-commerce` `main` at `adaaa4305fc7c249c484656576ee07b2454846f5`.

## Findings

- `WildsExplorer.tsx` is byte-for-byte identical to the Commerce reference. The visible gait regression is frame starvation, not a different authored walk cycle.
- The standalone social deck maps every restored card into a complex SVG thumbnail inside the component tree that also receives movement and camera updates. Movement dispatches every 45 ms, so a 98-card Vault creates avoidable reconciliation work during play.
- Standalone camera behavior drifted from Commerce by enabling OrbitControls damping and changing the target from `[0, .55, 0]` to `[0, .35, -.65]`.
- Standalone mobile boss pills wrap horizontally. Commerce stacks them vertically at the lower-left.
- A locally restored identity can currently enter gameplay before the Receiz OIDC cookie exists. That actor is classified as practice, and an empty canonical world also reports `local_practice` until its first authenticated publication.
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

### Receiz login and shared-world activation

Treat fresh explorer selection, verified Identity Seal restore, and verified identity-bearing Vault restore as three entrances to one login pipeline:

1. Verify or create the local SDK identity and persist any staged Vault restore.
2. Automatically start the existing Receiz OIDC/PKCE flow with the expected actor as the username hint. Do not show a separate Connect prompt.
3. On callback, store the user token only in the existing scoped HttpOnly cookie.
4. Re-read `/api/auth/receiz/me`, require the connected Receiz actor to match the locally verified actor, and only then complete entry into gameplay.
5. If the canonical world has no published revision, use that authenticated user session to perform the first idempotent world bootstrap publication before reporting `receiz_live`.

The generated user access token is never copied into an environment variable or browser storage. `RECEIZ_CONNECT_ACCESS_TOKEN` remains an optional dedicated scheduler credential for unattended world pulses; it is not the normal login credential. Local practice remains available only as an explicit offline/recovery state.

### PWA delivery

Bump the service-worker release identifier so installed clients fetch the new shell instead of retaining the pre-fix cached build.

## Failure Handling

- An empty Vault renders an empty first page.
- Resize and orientation changes switch safely between the Commerce 4-card and 8-card page sizes.
- Sort changes reset the rail to its first page.
- Pointer cancel, lost capture, visibility change, and blur stop movement immediately.
- OIDC cancellation, actor mismatch, and token-exchange failure preserve the verified local identity and staged Vault without entering the canonical world under the wrong actor.
- A canonical-world bootstrap is idempotent and rejects publication conflicts instead of forking world history.
- Reduced-motion behavior remains unchanged.

## Verification

- Unit-contract tests prove Commerce camera parameters, vertical boss stacking, one visible D-pad path, 4/8-card Vault paging, full logical count, and all three sort orders.
- A 100-card regression fixture exercises repeated movement while mounting at most the active Commerce-sized page.
- Mobile WebKit verification covers: restore the real 98-card Vault, enter the world, drag the D-pad, rotate and pinch the camera, scroll to the end of the card rail, change sort order, and open the boss HUD.
- Login tests cover fresh explorer, Identity Seal, and identity-bearing Vault redirects; matching callback resume; actor mismatch; offline preservation; and first-login canonical-world bootstrap.
- Desktop and mobile screenshots confirm the boss rail and controls do not overlap.
- The complete release check, production build, output-trace check, and clean-worktree review must pass before the release commit.
