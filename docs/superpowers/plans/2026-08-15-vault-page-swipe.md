# Vault Page Swipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore one-page-at-a-time finger swiping across the existing four-card compact Vault pages without changing any other Vault behavior or presentation.

**Architecture:** Keep the existing pointer-event pagination in `WildsInventory`. Move swipe direction into the pure inventory-pagination policy, finish gestures from the pointer-up coordinates before releasing capture, and declare `touch-action: pan-y` on the page surface so vertical sheet scrolling and horizontal book swipes remain distinct.

**Tech Stack:** React 19, Next.js 15, TypeScript, CSS, Node test runner

## Global Constraints

- Compact Vault pages continue to show exactly four creature cards.
- Existing previous/next buttons and page dots remain unchanged.
- A deliberate horizontal gesture turns exactly one clamped page; taps and vertical scrolling retain their current behavior.
- No layout, artwork, animation, copy, page size, sorting, filtering, or creature-detail behavior changes.
- Add no dependencies and perform no unrelated refactoring.

---

### Task 1: Repair the Existing Vault Page Gesture

**Files:**
- Modify: `src/features/play/inventory-pagination.ts`
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `app/globals.css`
- Test: `tests/inventory-pagination.test.ts`
- Test: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `shouldCaptureInventorySwipe(start, current): boolean` and `clampInventoryPage(page, itemCount, pageSize): number`
- Produces: `inventorySwipePageDelta(start, end): -1 | 0 | 1`, where a left swipe returns `1`, a right swipe returns `-1`, and an incomplete or vertical gesture returns `0`

- [ ] **Step 1: Write the failing swipe-direction and rendered-surface tests**

Extend `tests/inventory-pagination.test.ts` with the import and behavior below:

```ts
import { inventorySwipePageDelta } from "../src/features/play/inventory-pagination";

test("Vault book swipes turn one page without stealing taps or vertical scrolling", () => {
  const start = { x: 100, y: 100 };

  assert.equal(inventorySwipePageDelta(start, { x: 40, y: 102 }), 1);
  assert.equal(inventorySwipePageDelta(start, { x: 160, y: 98 }), -1);
  assert.equal(inventorySwipePageDelta(start, { x: 140, y: 101 }), 0);
  assert.equal(inventorySwipePageDelta(start, { x: 155, y: 180 }), 0);
});
```

Extend the existing Vault pagination contract in `tests/wilds-render-contract.test.ts` to require the page surface to use the pure delta policy and `.wilds-inventory-page` to declare `touch-action: pan-y`.

- [ ] **Step 2: Run the focused tests and verify the new behavior fails**

Run the test build, then:

```bash
node --test --test-name-pattern='Vault book swipes|renders a paged portable card vault' .test-build/tests/inventory-pagination.test.js .test-build/tests/wilds-render-contract.test.js
```

Expected: FAIL because `inventorySwipePageDelta` and the `touch-action: pan-y` contract are absent.

- [ ] **Step 3: Implement the minimal gesture policy**

Add this pure function beside `shouldCaptureInventorySwipe` in `src/features/play/inventory-pagination.ts`:

```ts
export function inventorySwipePageDelta(
  start: Readonly<{ x: number; y: number }>,
  end: Readonly<{ x: number; y: number }>
): -1 | 0 | 1 {
  if (!shouldCaptureInventorySwipe(start, end)) return 0;
  return end.x < start.x ? 1 : -1;
}
```

- [ ] **Step 4: Finish the pointer gesture before releasing capture**

In `src/features/play/WildsInventory.tsx`, import `inventorySwipePageDelta`. Change `endSwipe` to accept the pointer-up `{ x, y }`, compute the page delta before releasing pointer capture, and then call the existing clamped `changePage`. Remove the temporary `data-swipe-x` and `data-swipe-y` writes and cleanup because pointer-up now supplies the authoritative final coordinates. Keep `shouldCaptureInventorySwipe` in pointer-move solely for deliberate horizontal capture, and keep `suppressCardClick` so the completed swipe cannot select a creature.

The completion call becomes:

```tsx
onPointerUp={(event) => endSwipe(
  event.currentTarget,
  event.pointerId,
  { x: event.clientX, y: event.clientY }
)}
```

- [ ] **Step 5: Preserve vertical scrolling on the page surface**

Add only this rule to `app/globals.css` beside the inventory grid rules:

```css
.wilds-inventory-page { touch-action: pan-y; }
```

- [ ] **Step 6: Run focused and full automated verification**

Run the focused Node tests from Step 2, then run:

```bash
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```

Expected: all commands pass with no new warnings or formatting errors.

- [ ] **Step 7: Verify the real compact Vault interaction**

Start the app on an unused local port. In the in-app browser, open the Vault with more than four creatures and verify:

1. The region announces `Vault page 1 of N`.
2. A left finger/pointer swipe over the four-card grid announces page 2.
3. A right swipe returns to page 1.
4. A short tap still changes the selected creature.
5. A primarily vertical gesture does not change the page.
6. Page dots and previous/next buttons still work, with no relevant console warnings or errors.

- [ ] **Step 8: Commit the surgical feature**

```bash
git add docs/superpowers/plans/2026-08-15-vault-page-swipe.md src/features/play/inventory-pagination.ts src/features/play/WildsInventory.tsx app/globals.css tests/inventory-pagination.test.ts tests/wilds-render-contract.test.ts
git commit -m "Fix Vault page swiping"
```
