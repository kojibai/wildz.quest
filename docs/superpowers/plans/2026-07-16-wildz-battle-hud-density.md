# Wildz Battle HUD Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that battle creature names never overlap or hide the HP/life value at any supported width.

**Architecture:** Preserve the existing `WildsWorldCanvas` markup and strengthen the nameplate CSS contract: the name owns a shrinkable grid track, the value owns a non-shrinking max-content track, and the meter stays on a second row. Verify with a source-contract regression and rendered mobile QA.

**Tech Stack:** React 19, Next.js 15, TypeScript, CSS Grid, Node test runner.

## Global Constraints

- Do not change battle arithmetic or state.
- Preserve the full accessible name and exact HP/life value.
- Keep the meter on its own full-width row.
- Support desktop, mobile, long names, and text enlargement.

---

### Task 1: Collision-proof battle nameplates

**Files:**
- Create: `tests/wildz-battle-world-stat-ui.test.ts`
- Modify: `app/globals.css`
- Verify: `src/features/play/WildsWorldCanvas.tsx`

**Interfaces:**
- Consumes: `.wilds-battle-world-stat > span`, `strong`, and `small` markup already rendered by `WildsWorldCanvas`.
- Produces: a CSS layout contract in which the value cannot shrink behind the name.

- [ ] **Step 1: Write the failing regression test**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("battle life values own a non-shrinking track beside an ellipsized name", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wilds-battle-world-stat > span\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+max-content/s);
  assert.match(css, /\.wilds-battle-world-stat strong\s*\{[^}]*min-width:\s*0;[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /\.wilds-battle-world-stat small\s*\{[^}]*min-width:\s*max-content;[^}]*white-space:\s*nowrap/s);
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `pnpm test -- tests/wildz-battle-world-stat-ui.test.ts`

Expected: FAIL because the current value track is `auto` and the value has no explicit non-shrinking width contract.

- [ ] **Step 3: Implement the minimal CSS contract**

```css
.wilds-battle-world-stat > span {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: baseline;
  gap: 5px;
}
.wilds-battle-world-stat strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wilds-battle-world-stat small {
  min-width: max-content;
  white-space: nowrap;
}
```

- [ ] **Step 4: Run the focused test and typecheck**

Run: `pnpm test -- tests/wildz-battle-world-stat-ui.test.ts && pnpm typecheck`

Expected: PASS with zero failures and zero TypeScript errors.

- [ ] **Step 5: Verify desktop and mobile rendering**

Open the world, enter a wild battle, inspect both world stat pills at desktop and mobile widths, and confirm long names ellipsize while exact life values remain visible.

- [ ] **Step 6: Commit**

```bash
git add tests/wildz-battle-world-stat-ui.test.ts app/globals.css
git commit -m "fix: keep battle life values clear of creature names"
```
