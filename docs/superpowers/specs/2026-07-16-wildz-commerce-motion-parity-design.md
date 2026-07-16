# Wildz Commerce Motion Parity Design

## Goal

Make a restored Vault of roughly 100 cards feel as light as a starter Vault while matching the current Receiz Commerce Wildz camera and living-world boss HUD. The complete collection must remain sortable and horizontally scrollable.

Reference: `kojibai/receiz-commerce` `main` at `adaaa4305fc7c249c484656576ee07b2454846f5`.

## Findings

- `WildsExplorer.tsx` is byte-for-byte identical to the Commerce reference. The visible gait regression is frame starvation, not a different authored walk cycle.
- The standalone social deck maps every restored card into a complex SVG thumbnail inside the component tree that also receives movement and camera updates. Movement dispatches every 45 ms, so a 98-card Vault creates avoidable reconciliation work during play.
- Standalone camera behavior drifted from Commerce by enabling OrbitControls damping and changing the target from `[0, .55, 0]` to `[0, .35, -.65]`.
- Standalone mobile boss pills wrap horizontally. Commerce stacks them vertically at the lower-left.
- The already-committed Vault fix reused the prior service-worker release identifier, so installed PWAs can retain the old client shell unless the identifier is bumped.

## Selected Design

### Card rail performance

Keep the full sorted collection as the rail's logical data set, but render only the visible horizontal range plus a small overscan. Preserve total scroll width with leading and trailing spacers so every card remains reachable by touch, trackpad, and keyboard. Recalculate the window from scroll position and container width, not from player movement.

Move the rail into a memoized boundary whose inputs are limited to collection data, progression data, sort order, and stable card actions. Camera heading, movement mode, world position, and live frame state must not invalidate the card window. Cache each generated SVG thumbnail by its stable proof/asset identity.

No pagination is introduced in the world rail. The Card Vault sheet retains its existing paginated detailed view.

### Movement and camera

Keep the Commerce-authored explorer skeleton and walk cycle unchanged. Restore the Commerce OrbitControls contract exactly: damping disabled, target `[0, .55, 0]`, the same distance/polar-angle bounds, one-finger rotate, and two-finger dolly/rotate.

Keep camera-relative analog movement and pointer capture. Remove any duplicate hidden control tree that is not part of the visible interaction path so only one D-pad owns movement input.

### Living-world boss HUD

Restore the Commerce mobile layout: a lower-left rail with `flex-direction: column`, left alignment, and the existing compact pill sizing. Mode, boss/event, and ecology pills stack rather than wrap. The expanded sheet remains centered and clear of the bottom controls.

### PWA delivery

Bump the service-worker release identifier so installed clients fetch the new shell instead of retaining the pre-fix cached build.

## Failure Handling

- An empty Vault renders an empty rail without invalid scroll math.
- Resize and orientation changes recompute the visible card window.
- Sort changes reset the rail to its first card and recompute the window.
- Pointer cancel, lost capture, visibility change, and blur stop movement immediately.
- Reduced-motion behavior remains unchanged.

## Verification

- Unit-contract tests prove Commerce camera parameters, vertical boss stacking, one visible D-pad path, bounded card mounting, full logical count, and all three sort orders.
- A 100-card regression fixture exercises repeated movement without mounting all 100 thumbnails.
- Mobile WebKit verification covers: restore the real 98-card Vault, enter the world, drag the D-pad, rotate and pinch the camera, scroll to the end of the card rail, change sort order, and open the boss HUD.
- Desktop and mobile screenshots confirm the boss rail and controls do not overlap.
- The complete release check, production build, output-trace check, and clean-worktree review must pass before the release commit.
