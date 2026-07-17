# Wildz Powered by Receiz Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tasteful official “Powered by Receiz” signature and subtle living motion to the Wildz entry page while replacing the tagline with the approved single-line promise.

**Architecture:** Keep the entry component declarative: it renders the exact copy and one secure external link backed by a local official SVG. Put every atmospheric behavior in `app/globals.css` using pseudo-elements, gradients, opacity, and transforms, with a dedicated reduced-motion override and no JavaScript animation state.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Node test runner

## Global Constraints

- The exact tagline is: “Catch living creatures shaped by the moment. Train, evolve, breed & carry them anywhere. No two Wildz are ever the same.”
- Keep the tagline on one visual line across supported entry layouts by responsive sizing rather than wrapping.
- Link the official “Powered by Receiz” signature to `https://receiz.com` in a new tab with `rel="noopener noreferrer"`.
- Use the official 116 × 32 Receiz badge as a local asset and preserve its artwork.
- Use CSS pseudo-elements, gradients, opacity, and transforms only for new motion.
- Add no canvas, JavaScript animation loop, React animation state, remote media, dependency, or runtime network request.
- Under `prefers-reduced-motion: reduce`, stop every new drift, breathing, glint, and lift animation.
- Keep the signature in normal document flow with a minimum 44px interactive area.

---

### Task 1: Exact entry promise and official Receiz signature

**Files:**
- Modify: `tests/wildz-genesis-copy.test.ts`
- Modify: `src/features/identity/WildzGenesis.tsx`
- Create: `public/brand/powered-by-receiz.svg`

**Interfaces:**
- Consumes: Next.js `Image` and the existing `.wildz-genesis` entry composition.
- Produces: `.wildz-genesis-tagline` for responsive single-line styling and `.wildz-genesis-powered` as the accessible external-link surface used by Task 2.

- [ ] **Step 1: Write the failing source contract**

Replace the old tagline assertion in `tests/wildz-genesis-copy.test.ts` and add the signature assertions:

```ts
const exactTagline = "Catch living creatures shaped by the moment. Train, evolve, breed & carry them anywhere. No two Wildz are ever the same.";

assert.match(source, new RegExp(exactTagline.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(source, /className="wildz-genesis-tagline"/);
assert.match(source, /className="wildz-genesis-powered"/);
assert.match(source, /href="https:\/\/receiz\.com"/);
assert.match(source, /target="_blank"/);
assert.match(source, /rel="noopener noreferrer"/);
assert.match(source, /src="\/brand\/powered-by-receiz\.svg"/);
assert.match(source, /alt="Powered by Receiz"/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- --test-name-pattern="Genesis uses"`

Expected: FAIL because the old tagline is still present and the powered-by link does not exist.

- [ ] **Step 3: Add the official local badge**

Create `public/brand/powered-by-receiz.svg` with the official Receiz badge source:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="116" height="32" viewBox="0 0 116 32" role="img" aria-label="Powered by Receiz">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#f3f4f6"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="115" height="31" rx="16" fill="url(#g)" stroke="#d4d4d8"/>
  <circle cx="16" cy="16" r="3.5" fill="#16a34a"/>
  <text x="28" y="13" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="9" fill="#71717a" letter-spacing="0.08em">POWERED BY</text>
  <text x="28" y="23" font-family="Iowan Old Style, Palatino Linotype, Times New Roman, serif" font-size="14" fill="#111827">Receiz</text>
</svg>
```

- [ ] **Step 4: Render the exact tagline and signature**

In `src/features/identity/WildzGenesis.tsx`, replace the brand paragraph and add the link after all conditional status content:

```tsx
<p className="wildz-genesis-tagline">
  Catch living creatures shaped by the moment. Train, evolve, breed &amp; carry them anywhere. No two Wildz are ever the same.
</p>
```

```tsx
<a
  className="wildz-genesis-powered"
  href="https://receiz.com"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Powered by Receiz"
>
  <Image src="/brand/powered-by-receiz.svg" alt="Powered by Receiz" width={116} height={32} />
</a>
```

- [ ] **Step 5: Run the focused contract and verify it passes**

Run: `pnpm test -- --test-name-pattern="Genesis uses"`

Expected: PASS for the Genesis copy contract.

- [ ] **Step 6: Commit the functional entry signature**

```bash
git add tests/wildz-genesis-copy.test.ts src/features/identity/WildzGenesis.tsx public/brand/powered-by-receiz.svg
git commit -m "feat: add Receiz signature to Wildz entry"
```

---

### Task 2: Lightweight living atmosphere and accessible motion

**Files:**
- Create: `tests/wildz-genesis-living-entry.test.ts`
- Modify: `app/globals.css:113-190`

**Interfaces:**
- Consumes: `.wildz-genesis-tagline` and `.wildz-genesis-powered` from Task 1.
- Produces: CSS-only aurora, geometry, wordmark halo, seal glint, interactive transitions, and reduced-motion behavior.

- [ ] **Step 1: Write the failing motion and layout contract**

Create `tests/wildz-genesis-living-entry.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Genesis atmosphere stays lightweight, single-line, and motion-safe", () => {
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(css, /\.wildz-genesis-tagline\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.wildz-genesis-powered\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.wildz-genesis-powered:focus-visible/);
  assert.match(css, /@keyframes wildz-genesis-aurora/);
  assert.match(css, /@keyframes wildz-genesis-geometry/);
  assert.match(css, /@keyframes wildz-genesis-halo/);
  assert.match(css, /@keyframes wildz-genesis-seal/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.wildz-genesis-powered/s);
  assert.doesNotMatch(css, /\.wildz-genesis[^\n{]*\{[^}]*url\(https?:/s);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- --test-name-pattern="Genesis atmosphere"`

Expected: FAIL because the living-entry selectors and keyframes do not exist.

- [ ] **Step 3: Separate the content widths and make the tagline fit one line**

In `app/globals.css`, keep the actions at 560px while allowing the tagline to use the viewport:

```css
.wildz-genesis-brand {
  position: relative;
  z-index: 1;
  width: min(96vw, 940px);
}

.wildz-genesis-actions { position: relative; z-index: 1; width: min(100%, 560px); }
.wildz-genesis-tagline {
  width: 100%;
  margin: 0;
  color: rgba(248, 245, 233, .72);
  font-size: clamp(5.5px, 1.38vw, 15px);
  line-height: 1.5;
  letter-spacing: -.012em;
  white-space: nowrap;
}
```

- [ ] **Step 4: Add the CSS-only ambient layers and signature treatment**

Use `.wildz-genesis::after` for a broad transformed aurora, animate the existing dotted `::before`, add a halo with `.wildz-genesis-brand::before`, and style `.wildz-genesis-powered` as a 44px link surface with a clipped glint pseudo-element. Add smooth button transitions and these named long-duration keyframes:

```css
@keyframes wildz-genesis-aurora {
  50% { opacity: .82; transform: translate3d(2.5%, -1.5%, 0) scale(1.04); }
}
@keyframes wildz-genesis-geometry {
  50% { opacity: .18; transform: translate3d(5px, -4px, 0); }
}
@keyframes wildz-genesis-halo {
  50% { opacity: .72; transform: translate(-50%, -50%) scale(1.045); }
}
@keyframes wildz-genesis-seal {
  50% { box-shadow: 0 0 25px rgba(232, 213, 138, .14), 0 12px 32px rgba(0, 0, 0, .22); transform: translateY(-1px); }
}
```

The final selector must include `isolation: isolate`, local gradients only, `pointer-events: none` on decorative pseudo-elements, and `will-change` only on the four slowly animated surfaces.

- [ ] **Step 5: Add the reduced-motion override**

Place this near the Genesis styles so its scope is obvious:

```css
@media (prefers-reduced-motion: reduce) {
  .wildz-genesis::before,
  .wildz-genesis::after,
  .wildz-genesis-brand::before,
  .wildz-genesis-powered,
  .wildz-genesis-powered::after,
  .wildz-genesis-actions button {
    animation: none;
    transition: none;
  }
}
```

- [ ] **Step 6: Run focused and full static verification**

Run: `pnpm test -- --test-name-pattern="Genesis"`

Expected: all Genesis contracts PASS.

Run: `pnpm lint && pnpm typecheck`

Expected: both commands exit 0 without warnings or type errors.

- [ ] **Step 7: Run the production verification**

Run: `pnpm test && pnpm build`

Expected: the full test suite passes and Next.js completes its production build.

- [ ] **Step 8: Verify rendered entry behavior**

Start the app with `pnpm dev`, then use the existing Playwright workflow at desktop and a 375px-wide mobile viewport. Verify the exact tagline has one rendered line, the last entry content and Receiz badge are reachable by scrolling, the badge resolves from `/brand/powered-by-receiz.svg`, keyboard focus is visible, and emulated reduced motion produces `animation-name: none` on the new layers.

- [ ] **Step 9: Commit the living entry treatment**

```bash
git add tests/wildz-genesis-living-entry.test.ts app/globals.css
git commit -m "feat: bring the Wildz entry to life"
```
