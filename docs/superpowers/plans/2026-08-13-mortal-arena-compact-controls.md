# Mortal Arena Compact Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a compact, readable NPC Mortal Arena control tray that no longer compresses the 3D scene or top HUD.

**Architecture:** Keep the existing `MortalArenaExperience` three-zone DOM and all combat handlers unchanged. Correct the contextual controls from an accidental six-row implicit grid to an explicit three-column/two-row grid, then reduce the footer and trackpad dimensions using existing CSS only.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS Grid, Node test runner

## Global Constraints

- Apply changes only to the dedicated NPC Arena presented by `MortalArenaExperience`.
- Add no JavaScript, dependencies, assets, fonts, effects, DOM elements, or network work.
- Preserve haptics, pointer handling, accessibility labels, disabled states, safe areas, and deterministic combat inputs.
- Keep action names visible; secondary `<small>` copy may be hidden only on narrow portrait screens.
- Keep the portrait footer within 92–108px before any device safe-area inset.

---

### Task 1: Compact the Mortal Arena control tray

**Files:**
- Modify: `tests/mortal-arena-mobile-controls.test.ts`
- Modify: `app/globals.css:12796-12833`

**Interfaces:**
- Consumes: Existing `.mortal-arena-actions`, `.mortal-arena-trackpad`, `.mortal-arena-combat-zone`, and `.mortal-arena-context-actions` class names.
- Produces: An explicit 3×2 contextual-action grid and a compact responsive Arena footer. No TypeScript interface changes.

- [ ] **Step 1: Write the failing regression assertions**

Replace the portrait geometry assertions with checks that require:

```ts
assert.match(css, /\.mortal-arena-context-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)[^}]*grid-template-rows:\s*repeat\(2, minmax\(40px, 1fr\)\)/);
assert.match(css, /@media \(max-width: 430px\)[\s\S]*?\.mortal-arena-actions\s*\{[^}]*min-height:\s*104px/);
assert.match(css, /@media \(max-width: 430px\)[\s\S]*?\.mortal-arena-trackpad\s*\{[^}]*width:\s*72px;[^}]*height:\s*72px/);
assert.doesNotMatch(css, /\.mortal-arena-actions\s*\{[^}]*min-height:\s*146px/);
```

Keep the existing assertions that enforce the three zones, current combat mappings, safe-area padding, and visible primary labels.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/mortal-arena-mobile-controls.test.js
```

Expected: FAIL because the contextual area lacks explicit columns, the portrait footer remains 146px, and the trackpad remains 88px.

- [ ] **Step 3: Implement the minimal CSS correction**

In the base Arena rules:

```css
.mortal-arena-actions {
  grid-template-columns: minmax(78px, 102px) minmax(0, 1fr) minmax(120px, 168px) !important;
  min-height: 108px;
}

.mortal-arena-combat-zone {
  grid-template-rows: repeat(2, minmax(48px, 1fr));
}

.mortal-arena-context-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(40px, 1fr));
}

.mortal-arena-trackpad {
  width: 78px;
  height: 78px;
  min-height: 78px !important;
}
```

In `@media (max-width: 430px)`, use a 104px footer, a `72px` trackpad, a right zone between `108px` and `132px`, compact gaps/padding, and hide only contextual `<small>` copy. Preserve the visible `<strong>` action names.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same focused test commands from Step 2.

Expected: PASS with zero failures.

- [ ] **Step 5: Run related contract tests**

Run:

```bash
node --test .test-build/tests/mortal-arena-ui.test.js .test-build/tests/wildz-flagship-mobile-ui.test.js .test-build/tests/wilds-render-contract.test.js
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the implementation**

```bash
git add app/globals.css tests/mortal-arena-mobile-controls.test.ts
git commit -m "fix: compact mortal arena controls"
```

### Task 2: Verify the rendered NPC Arena

**Files:**
- Inspect only: `app/globals.css`
- Inspect only: `src/features/games/mortal-arena/MortalArenaExperience.tsx`

**Interfaces:**
- Consumes: The app's existing local development route and Arena entry flow.
- Produces: Browser evidence for mobile and desktop layout behavior; no repository files.

- [ ] **Step 1: Run static verification**

```bash
pnpm typecheck
pnpm test
git diff --check
```

Expected: all commands exit 0 with zero test failures and no whitespace errors.

- [ ] **Step 2: Start the local app and enter the NPC Arena**

Use the repository's `pnpm dev` command. Follow the existing app flow into the NPC Arena popover.

- [ ] **Step 3: Validate portrait mobile rendering**

At a 390×844 viewport, verify that the full top HUD is visible, the 3D scene owns the majority of the viewport, the footer remains near 104px plus safe-area padding, all six contextual action names fit in a 3×2 grid, and no control overlaps or clips.

- [ ] **Step 4: Exercise a combat interaction**

Activate an enabled Arena action such as Strike or Focus and verify a visible combat-state update while the layout remains stable.

- [ ] **Step 5: Validate desktop rendering and runtime health**

At a 1280×800 viewport, repeat the layout check. Confirm the intended page identity, meaningful DOM content, no framework error overlay, and no relevant console warnings or errors.

- [ ] **Step 6: Review the final diff**

```bash
git status --short
git diff HEAD^ -- app/globals.css tests/mortal-arena-mobile-controls.test.ts
```

Expected: only the scoped Arena CSS, its regression test, and workflow documentation are changed.
