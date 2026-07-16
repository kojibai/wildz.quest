# Wildz Genesis Entry Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace visible Kai Pulse entry copy with the approved one-line product promise while preserving internal character generation.

**Architecture:** Keep the change presentation-only in `WildzGenesis`; do not alter the deterministic character data contract. Use a source contract test plus responsive CSS to guarantee the approved text and mobile single-line layout.

**Tech Stack:** React 19, Next.js 15, TypeScript, CSS, Node test runner.

## Global Constraints

- Subtitle is exactly “Catch, grow, own, and cash out creatures you can take anywhere.”
- Visible Kai Pulse copy is removed; internal identity generation remains unchanged.
- The subtitle stays on one line at a 390 px mobile viewport without horizontal overflow.

---

### Task 1: Genesis copy and responsive presentation

**Files:**
- Modify: `src/features/identity/WildzGenesis.tsx`
- Modify: `app/globals.css`
- Test: `tests/wildz-genesis-copy.test.ts`

**Interfaces:**
- Consumes: the existing `WildzGenesis` JSX and `.wildz-genesis-brand p` style.
- Produces: approved visible subtitle and `Shaping your explorer` reveal status.

- [ ] **Step 1: Write the failing source contract test**

```ts
test("Genesis communicates portable ownership without visible Kai Pulse jargon", () => {
  const source = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");
  assert.match(source, /Catch, grow, own, and cash out creatures you can take anywhere\./);
  assert.match(source, /Shaping your explorer/);
  assert.doesNotMatch(source, />[^<]*Kai Pulse[^<]*</);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx tsx --test tests/wildz-genesis-copy.test.ts`

Expected: FAIL because the approved subtitle and reveal copy are absent.

- [ ] **Step 3: Apply the approved copy and one-line CSS**

```tsx
<p>Catch, grow, own, and cash out creatures you can take anywhere.</p>
```

```css
.wildz-genesis-brand p {
  white-space: nowrap;
  font-size: clamp(10px, 2.85vw, 17px);
}
```

Replace both gender-button helper lines with `Start your adventure` and the reveal status with `Shaping your explorer`.

- [ ] **Step 4: Verify focused behavior**

Run: `npx tsx --test tests/wildz-genesis-copy.test.ts tests/wildz-shell.test.ts`

Expected: all focused tests pass.

- [ ] **Step 5: Verify the mobile layout**

At a 390 × 844 viewport, assert that the subtitle element has one client rect and `scrollWidth <= clientWidth`.

- [ ] **Step 6: Include the files in the final release commit**

Stage these files with the complete continuity release after all repository checks pass.
