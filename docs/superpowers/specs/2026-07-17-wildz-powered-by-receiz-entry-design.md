# Wildz Entry: Powered by Receiz and Living Motion

## Goal

Make the Wildz entry page feel quietly alive while adding an official, tasteful “Powered by Receiz” signature that links to `https://receiz.com`. The signature should feel like a maker’s seal: clearly intentional and trustworthy, but visually subordinate to the Wildz wordmark and entry actions.

## Composition

- Keep the existing Wildz wordmark, message, and explorer actions as the primary hierarchy.
- Add a centered “Powered by Receiz” link after all entry status content so it naturally occupies the bottom of the entry composition and never overlays a control.
- Use Receiz’s official 116 × 32 badge artwork as a local asset. The whole surrounding link is the hit target, with an accessible name of “Powered by Receiz”.
- Open Receiz in a new tab and include `rel="noopener noreferrer"`.
- Give the seal a restrained gold-white edge light and a very soft green ambient reflection so it belongs to Wildz without recoloring the official badge.

## Living Motion

The entry scene gains four low-amplitude, independently timed CSS layers:

1. A broad aurora glow drifts slowly through the existing forest gradient.
2. The existing dotted geometry field moves by only a few pixels while its opacity breathes.
3. A diffuse halo behind the Wildz wordmark expands and fades almost imperceptibly.
4. The Receiz seal carries a slow, soft glint and lift, becoming slightly clearer on hover or keyboard focus.

Buttons keep their current behavior and gain only a slightly smoother border, light, and transform transition. Motion must feel atmospheric rather than like a loading animation.

## Performance

- Use CSS pseudo-elements, gradients, opacity, and transforms only.
- Do not add canvas, JavaScript animation loops, React animation state, remote media, or new dependencies.
- Store the official Receiz SVG locally so the signature appears immediately and works offline.
- Keep animated surfaces visually soft and durations long to avoid distracting from interaction.

## Accessibility and Responsive Behavior

- Preserve a minimum 44px interactive area around the 116 × 32 badge.
- Add a visible keyboard focus ring that fits the gold-green Wildz palette.
- Under `prefers-reduced-motion: reduce`, stop all new drift, breathing, glint, and lift animation while retaining the static lighting composition.
- Keep the footer in normal document flow. Existing vertical scrolling and safe-area padding continue to handle short mobile viewports, restored-identity messages, and errors without clipping.
- The wordmark and actions remain readable and usable when motion is unavailable.

## Verification

- Add a focused source contract for the Receiz destination, official accessible label, secure external-link attributes, local badge asset, and reduced-motion coverage.
- Run the full test suite, lint, typecheck, and production build.
- Render the entry route at desktop and narrow mobile sizes, checking hierarchy, full-page scrolling, badge focus/hover treatment, subtle motion, and the reduced-motion state.
