# Wildz Entry Hierarchy Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Wildz entry promise into a deliberate two-line hierarchy and make the `Powered by Receiz` seal smaller and more clearly separated as a footer signature.

**Architecture:** Keep the existing entry component and CSS-only atmosphere. Split the current paragraph into a main line and a subordinate line inside a small copy wrapper, then reduce only the rendered badge artwork while preserving its 44px interactive link target and homepage destination.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Node test runner

## Global Constraints

- Main line copy must be exactly: “Catch living creatures shaped by the moment.”
- Subtext copy must be exactly: “Train, evolve, breed & carry them anywhere. No two Wildz are ever the same.”
- The main line and subtext must remain exactly two centered visual lines without clipping at supported desktop and mobile widths.
- Keep the badge destination at `https://receiz.com`; `/conformance` is a technical trust destination rather than the universal powered-by landing page.
- Render the official local badge artwork at 96 × 26 while preserving a minimum 44px link target.
- Add approximately 20px more separation above the Receiz link.
- Preserve secure external-link attributes, the existing subtle motion, keyboard focus, reduced-motion behavior, and normal-flow scrolling.
- Add no JavaScript animation, remote asset, dependency, or runtime network request.

---

### Task 1: Two-line promise and quieter footer seal

**Files:**
- Modify: `tests/wildz-genesis-copy.test.ts`
- Modify: `tests/wildz-genesis-living-entry.test.ts`
- Modify: `src/features/identity/WildzGenesis.tsx`
- Modify: `app/globals.css:150-260`

**Interfaces:**
- Consumes: the existing `.wildz-genesis-brand`, `.wildz-genesis-powered`, official local SVG, secure Receiz homepage link, and reduced-motion rules.
- Produces: `.wildz-genesis-copy`, `.wildz-genesis-tagline`, and `.wildz-genesis-subtext` as the exact two-line hierarchy; a 96 × 26 rendered badge inside the existing 44px link surface.

- [ ] **Step 1: Write the failing copy and layout contracts**

In `tests/wildz-genesis-copy.test.ts`, replace the combined tagline assertion with separate exact-copy and structure assertions:

```ts
const mainLine = "Catch living creatures shaped by the moment.";
const subtext = "Train, evolve, breed & carry them anywhere. No two Wildz are ever the same.";
assert.match(source, new RegExp(mainLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(source, new RegExp(subtext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(source, /className="wildz-genesis-copy"/);
assert.match(source, /className="wildz-genesis-tagline"/);
assert.match(source, /className="wildz-genesis-subtext"/);
assert.match(source, /width=\{96\}\s+height=\{26\}/);
```

In `tests/wildz-genesis-living-entry.test.ts`, rename the test to `Genesis atmosphere stays lightweight, two-line, and motion-safe` and add:

```ts
assert.match(css, /\.wildz-genesis-copy\s*\{[^}]*gap:\s*6px/s);
assert.match(css, /\.wildz-genesis-tagline\s*\{[^}]*white-space:\s*nowrap/s);
assert.match(css, /\.wildz-genesis-subtext\s*\{[^}]*white-space:\s*nowrap/s);
assert.match(css, /\.wildz-genesis-powered\s*\{[^}]*margin-top:\s*clamp\(18px,\s*3vh,\s*28px\)/s);
assert.match(css, /\.wildz-genesis-powered img\s*\{[^}]*width:\s*96px;[^}]*height:\s*26px/s);
```

- [ ] **Step 2: Run the tests and verify the new contracts fail**

Run: `pnpm test`

Expected: FAIL in the Genesis copy and living-entry contracts because the component still contains one combined paragraph and the badge still renders at 116 × 32 without the new margin.

- [ ] **Step 3: Split the entry copy and reduce the badge artwork**

Replace the combined paragraph in `src/features/identity/WildzGenesis.tsx` with:

```tsx
<div className="wildz-genesis-copy">
  <p className="wildz-genesis-tagline">Catch living creatures shaped by the moment.</p>
  <p className="wildz-genesis-subtext">Train, evolve, breed & carry them anywhere. No two Wildz are ever the same.</p>
</div>
```

Keep the existing `href="https://receiz.com"`, `target="_blank"`, `rel="noopener noreferrer"`, and accessible labels. Change only the badge rendering dimensions:

```tsx
<Image src="/brand/powered-by-receiz.svg" alt="Powered by Receiz" width={96} height={26} />
```

- [ ] **Step 4: Implement the approved hierarchy and footer spacing**

Replace the old single tagline declaration and refine the badge sizing in `app/globals.css`:

```css
.wildz-genesis-copy {
  display: grid;
  width: 100%;
  justify-items: center;
  gap: 6px;
}
.wildz-genesis-tagline,
.wildz-genesis-subtext {
  width: 100%;
  margin: 0;
  white-space: nowrap;
}
.wildz-genesis-tagline {
  color: rgba(248, 245, 233, .92);
  font-size: clamp(12px, 1.6vw, 18px);
  font-weight: 780;
  line-height: 1.35;
  letter-spacing: -.018em;
}
.wildz-genesis-subtext {
  color: rgba(248, 245, 233, .6);
  font-size: clamp(7px, 1vw, 12px);
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: -.008em;
}
```

Within `.wildz-genesis-powered`, set `min-width: 120px`, retain `min-height: 44px`, use `padding: 6px 10px`, and add:

```css
margin-top: clamp(18px, 3vh, 28px);
```

Set the nested image dimensions to:

```css
.wildz-genesis-powered img { position: relative; z-index: 1; width: 96px; height: 26px; }
```

- [ ] **Step 5: Run the full suite and verify it passes**

Run: `pnpm test`

Expected: 0 failures, including both Genesis contracts.

- [ ] **Step 6: Run static and production verification**

Run: `pnpm lint`

Expected: exit 0 with no ESLint errors.

Run: `pnpm typecheck`

Expected: exit 0 with no TypeScript errors.

Run: `pnpm build`

Expected: Next.js completes the optimized production build successfully.

- [ ] **Step 7: Verify the rendered hierarchy**

Run the production app and inspect the entry route in the existing Playwright workflow at 1440 × 900 and 375 × 667. Confirm:

```text
- the main line renders as one line
- the subtext renders as one line
- the two copy lines have visibly distinct size, weight, and opacity
- neither line exceeds the viewport
- the badge artwork renders at 96 × 26 inside a link at least 44px tall
- the badge sits at least 18px farther below the preceding grid gap
- keyboard focus remains visible
- reduced-motion reports animation-name: none for every new entry layer
```

- [ ] **Step 8: Commit the refinement on main**

```bash
git add tests/wildz-genesis-copy.test.ts tests/wildz-genesis-living-entry.test.ts src/features/identity/WildzGenesis.tsx app/globals.css
git commit -m "refine Wildz entry hierarchy"
```
