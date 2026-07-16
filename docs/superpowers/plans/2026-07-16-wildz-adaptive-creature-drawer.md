# Wildz Adaptive Creature Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed paged creature rail with a flush-closing, height-adaptive active-creature drawer above the permanent D-pad row.

**Architecture:** Put responsive drawer math in a pure module and interaction/rendering in a memoized client component. `WildzSocialDeck` owns only composition and trigger mapping. The collection uses bounded virtual windows: horizontal rail, vertical two-column grid, and horizontal eight-card book spreads.

**Tech Stack:** React 19, TypeScript, CSS Grid/Flexbox, Pointer Events, CSS Scroll Snap, Node test runner.

## Global Constraints

- Only the creature selector collapses; D-pad/action controls and six-button toolbar never move.
- Closed content height is exactly zero and flush to the D-pad row.
- Book mode shows two columns by four rows.
- No previous/next buttons or manual page labels.
- Selecting a creature closes the drawer.
- The complete logical collection remains reachable without duplicates.
- Keep large restored Vaults outside movement/camera render dependencies.

---

### Task 1: Pure drawer projection and virtual windows

**Files:**
- Create: `src/features/play/creature-drawer.ts`
- Create: `tests/wildz-creature-drawer.test.ts`

**Interfaces:**
- Produces: `CreatureDrawerMode`, `CreatureDrawerSnap`, `creatureDrawerMetrics(viewportHeight)`, `creatureDrawerMode(height, metrics)`, `settleCreatureDrawer(height, velocityY, metrics)`, and `creatureBookWindow(items, page, overscanPages)`.

- [ ] **Step 1: Write failing tests for all four states and collection boundaries**

```ts
test("drawer projection has zero-height closed state and an eight-card book spread", () => {
  const metrics = creatureDrawerMetrics(844);
  assert.equal(metrics.closed, 0);
  assert.equal(creatureDrawerMode(0, metrics), "closed");
  assert.equal(creatureDrawerMode(metrics.rail, metrics), "rail");
  assert.equal(creatureDrawerMode(metrics.grid, metrics), "grid");
  assert.equal(creatureDrawerMode(metrics.book, metrics), "book");
  assert.deepEqual(creatureBookWindow(Array.from({ length: 19 }, (_, i) => i), 2, 1).visible, [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
});

test("velocity and distance settle to a named snap", () => {
  const metrics = creatureDrawerMetrics(844);
  assert.equal(settleCreatureDrawer(metrics.rail + 10, -0.8, metrics), "grid");
  assert.equal(settleCreatureDrawer(12, 0.9, metrics), "closed");
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test -- tests/wildz-creature-drawer.test.ts`

Expected: FAIL because `creature-drawer.ts` does not exist.

- [ ] **Step 3: Implement the pure model**

```ts
export type CreatureDrawerMode = "closed" | "rail" | "grid" | "book";
export type CreatureDrawerSnap = CreatureDrawerMode;
export type CreatureDrawerMetrics = Record<CreatureDrawerSnap, number>;

export function creatureDrawerMetrics(viewportHeight: number): CreatureDrawerMetrics {
  const available = Math.max(320, viewportHeight - 170);
  return { closed: 0, rail: 104, grid: Math.min(272, available * 0.52), book: Math.min(456, available) };
}

export function creatureDrawerMode(height: number, metrics: CreatureDrawerMetrics): CreatureDrawerMode {
  if (height < metrics.rail * 0.45) return "closed";
  if (height < (metrics.rail + metrics.grid) / 2) return "rail";
  if (height < (metrics.grid + metrics.book) / 2) return "grid";
  return "book";
}
```

Implement settling against the ordered named snaps and return a bounded current/adjacent page window with eight items per book spread.

- [ ] **Step 4: Run and verify GREEN**

Run: `pnpm test -- tests/wildz-creature-drawer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/creature-drawer.ts tests/wildz-creature-drawer.test.ts
git commit -m "feat: model adaptive creature drawer states"
```

### Task 2: Drawer component and fixed control boundary

**Files:**
- Create: `src/features/play/WildzCreatureDrawer.tsx`
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-card-rail-ui.test.ts`

**Interfaces:**
- Consumes: pure drawer functions from Task 1, `PortableCardAsset[]`, progress, sort order, and `onSelectCard(assetId)`.
- Produces: `WildzCreatureDrawer` with `aria-expanded`, pointer/tap/keyboard behavior, and zero-height closed content.

- [ ] **Step 1: Replace old rail assertions with failing drawer behavior assertions**

```ts
assert.match(social, /<WildzCreatureDrawer/);
assert.match(drawer, /aria-expanded=\{mode !== "closed"\}/);
assert.match(drawer, /settleCreatureDrawer/);
assert.match(drawer, /onSelectCard\(assetId\);[\s\S]*setSnap\("closed"\)/);
assert.doesNotMatch(drawer, /Previous card rail page|Next card rail page|Page \{/);
assert.match(css, /\.wildz-creature-drawer\.is-closed\s*\{[^}]*height:\s*0/s);
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm test -- tests/wildz-card-rail-ui.test.ts`

Expected: FAIL because the social deck still renders `WildzPagedCardRail`.

- [ ] **Step 3: Implement `WildzCreatureDrawer`**

Use local snap/drag state, a ref for pointer velocity, a stable callback ref for selection, and a resize listener for metrics. Render:

```tsx
<section className={`wildz-creature-drawer mode-${mode} ${mode === "closed" ? "is-closed" : ""}`} style={{ "--wildz-drawer-height": `${height}px` } as CSSProperties}>
  <button aria-controls="wildz-creature-drawer-content" aria-expanded={mode !== "closed"} className="wildz-creature-drawer-handle" onClick={toggle} {...pointerHandlers}>...</button>
  <div id="wildz-creature-drawer-content" className="wildz-creature-drawer-content">{modeContent}</div>
</section>
```

Rail maps only a bounded horizontal window, grid maps a bounded two-column vertical window, and book maps current/adjacent eight-card spreads. On selection call `onSelectCard(assetId)` and set the snap to `closed`.

- [ ] **Step 4: Recompose `WildzSocialDeck`**

Put the drawer before `.wildz-bottom-play-controls`; keep the latter and `.wildz-social-actions` outside the animated-height element. Remove the old rail import.

- [ ] **Step 5: Add responsive drawer CSS**

```css
.wildz-social-deck { grid-template-rows: auto auto auto; height: auto; overflow: visible; }
.wildz-creature-drawer { position: relative; height: var(--wildz-drawer-height); min-height: 0; overflow: visible; transition: height 220ms cubic-bezier(.2,.8,.2,1); }
.wildz-creature-drawer.is-closed { height: 0; }
.wildz-creature-drawer-content { height: 100%; overflow: hidden; }
.wildz-creature-drawer.mode-grid .wildz-creature-window { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); overflow-y: auto; }
.wildz-creature-drawer.mode-book .wildz-creature-book { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; }
.wildz-creature-spread { display: grid; min-width: 100%; grid-template-columns: repeat(2,minmax(0,1fr)); grid-template-rows: repeat(4,minmax(0,1fr)); scroll-snap-align: start; }
```

Position the handle on the seam immediately above the fixed D-pad row. In reduced motion, remove the height transition.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `pnpm test -- tests/wildz-creature-drawer.test.ts tests/wildz-card-rail-ui.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/play/WildzCreatureDrawer.tsx src/features/play/WildzSocialDeck.tsx app/globals.css tests/wildz-card-rail-ui.test.ts
git commit -m "feat: add adaptive active creature drawer"
```

### Task 3: Toolbar trigger swap and rendered interaction proof

**Files:**
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Modify: `tests/wilds-v3-ui-integration.test.ts`

**Interfaces:**
- Consumes: existing `onOpenDeck` and `onOpenVault` callbacks.
- Produces: archive button → Trail Pack and active-creature thumbnail → Vault.

- [ ] **Step 1: Add failing trigger mapping assertions**

```ts
assert.match(social, /aria-label="Open Trail Pack[^"]*"[\s\S]*className="wildz-action-vault"[\s\S]*onClick=\{onOpenDeck\}/);
assert.match(social, /aria-label="Open card vault"[\s\S]*className="wildz-action-companion"[\s\S]*onClick=\{onOpenVault\}/);
```

- [ ] **Step 2: Run RED, swap handlers/labels, then run GREEN**

Run before and after: `pnpm test -- tests/wilds-v3-ui-integration.test.ts`

Expected before: FAIL. Expected after: PASS.

- [ ] **Step 3: Rendered browser verification**

Verify closed, rail, grid, and book states; drag cancellation; selection auto-close; permanent controls; automatic collection continuation; and both swapped toolbar triggers on desktop and mobile.

- [ ] **Step 4: Commit**

```bash
git add src/features/play/WildzSocialDeck.tsx tests/wilds-v3-ui-integration.test.ts
git commit -m "feat: swap Vault and Trail Pack toolbar triggers"
```
