# Wildz Kai Moment Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-visible deterministic Kai moment statement and a complete, accessible Kai Klok teaching popover to the Living Command Center.

**Architecture:** Keep arithmetic in `kai-klok-moment.ts`, place immutable normalized canonical teachings and pure statement derivation in `kai-klok-teachings.ts`, and render disclosure behavior in a focused `WildsKaiMomentInspector.tsx`. `WildsCommandCenter.tsx` supplies the verified moment and remains responsible only for cockpit composition.

**Tech Stack:** TypeScript, React 19, Next.js 15, existing CSS design system, Node test runner, Playwright browser verification.

## Global Constraints

- Preserve canonical proper names, sequence, colors, elements, geometry, formulas, and deterministic selection logic.
- Normalize explanatory prose to standard English by restoring ordinary `c` and `s/c` spelling.
- Add no dependency, network request, randomness, image, canvas, audio, or animation loop.
- Closed Command Center dimensions and existing camera, audio, gameplay, and controls remain unchanged.
- Beat indices are `00–35`, Step indices are `00–43`, and inner Pulse indices are `00–10`.
- The semantic grid is `17,424` pulses; continuous daily closure is `17,491.270421` pulses.
- The complete inspector must work on the first offline render.

---

### Task 1: Canonical teaching and expression engine

**Files:**
- Create: `src/features/play/kai-klok-teachings.ts`
- Create: `tests/wildz-kai-klok-teachings.test.ts`

**Interfaces:**
- Consumes: `KaiKlokMoment` from `deriveKaiKlokMoment()`.
- Produces: `KAI_HARMONIC_DAYS`, `KAI_HARMONIC_WEEKS`, `KAI_ETERNAL_MONTHS`, `KAI_CHAKRA_ARKS`, `KAI_MATH_TEACHINGS`, and `deriveKaiMomentExpression(moment)`.

- [ ] **Step 1: Write failing completeness and determinism tests**

Assert exact collection lengths `6`, `7`, `8`, and `6`; exact ordered names; unique IDs; required color/element/geometry/meaning fields; exact math constants; and byte-identical expressions for equal moments.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test`

Expected: compilation fails because `kai-klok-teachings.ts` does not exist.

- [ ] **Step 3: Implement immutable canonical teaching tables**

Define:

```ts
export type KaiTeaching = Readonly<{
  id: string;
  name: string;
  color: string;
  element: string;
  geometry: string;
  meaning: string;
}>;

export type KaiMomentExpression = Readonly<{
  day: KaiTeaching;
  week: KaiTeaching;
  month: KaiTeaching;
  ark: KaiTeaching;
  summary: string;
  full: string;
}>;
```

Use the normalized canonical content approved in the design specification. Derive indices from `moment.day`, `moment.week`, and `moment.month`; derive the daily ark from exact micro-pulse progress across the six daily arcs; return a bounded two-sentence summary and complete structured teaching.

- [ ] **Step 4: Run tests and verify pass**

Run: `pnpm test`

Expected: all tests pass, including the new canonical table suite.

### Task 2: Pure calendar and arc projection

**Files:**
- Modify: `src/features/play/kai-klok-moment.ts`
- Modify: `tests/wildz-kai-klok-moment.test.ts`

**Interfaces:**
- Consumes: exact integer micro-pulse state already calculated by `deriveKaiKlokMoment()`.
- Produces: `weekName`, `monthName`, `ark`, and `arkIndex` on `KaiKlokMoment`.

- [ ] **Step 1: Add failing projection boundary tests**

Test Genesis (`Awakening Flame`, `Aethon`, `Ignite`, index `0`) and verify valid values at day, week, month, and daily-ark boundaries.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test`

Expected: TypeScript reports the new fields do not exist.

- [ ] **Step 3: Add exact derived fields**

Add exported ordered name tuples and calculate:

```ts
const weekIndex = Math.floor((day - 1) / KAI_DAYS_PER_WEEK);
const weekName = KAI_WEEK_NAMES[weekIndex]!;
const monthName = KAI_MONTH_NAMES[month - 1]!;
const microPulsesInDay = modE(microPulses, KAI_N_DAY_MICRO);
const arkIndex = Math.min(5, Number((microPulsesInDay * 6n) / KAI_N_DAY_MICRO));
const ark = KAI_ARK_NAMES[arkIndex]!;
```

- [ ] **Step 4: Run tests and verify pass**

Run: `pnpm test`

Expected: projection tests and the full suite pass.

### Task 3: Accessible inspector component

**Files:**
- Create: `src/features/play/command-center/WildsKaiMomentInspector.tsx`
- Modify: `tests/wildz-command-center-ui.test.ts`

**Interfaces:**
- Consumes: `{ moment: KaiKlokMoment }`.
- Produces: a disclosure button, compact statement, and contained dialog with current moment, teaching collections, math, and coordinate legend.

- [ ] **Step 1: Add failing source contract tests**

Require `aria-expanded`, `aria-controls`, `role="dialog"`, Escape handling, focus restoration, “What this moment is saying,” all eight information groups, the caduceus KAI label, and the exact formulas.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test`

Expected: the inspector file is missing.

- [ ] **Step 3: Implement disclosure and teaching rows**

Create a client component with local `open` state, a trigger ref, an Escape listener active only while open, a close callback restoring trigger focus, native `details` disclosure rows, and no network effects. Render the summary below Eternal Pulse at all times and mount detailed content only while open.

- [ ] **Step 4: Run tests and verify pass**

Run: `pnpm test`

Expected: Command Center source contracts pass.

### Task 4: Command Center integration and responsive styling

**Files:**
- Modify: `src/features/play/command-center/WildsCommandCenter.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-command-center-ui.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `WildsKaiMomentInspector` and `model.moment`.
- Produces: unchanged closed telemetry footprint plus an anchored inspector layer.

- [ ] **Step 1: Add failing integration and closed-layout tests**

Require the inspector inside `.wilds-command-eternal`, absolute/fixed-contained popover positioning, dark background, safe mobile inset, bounded scrolling, visible focus, and reduced-motion rules.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm test`

Expected: source contracts fail before integration and CSS exist.

- [ ] **Step 3: Integrate and style**

Replace the existing Eternal Pulse text block with `WildsKaiMomentInspector`. Style the trigger as the existing telemetry block, clamp the summary to two lines, position the popover within `.wilds-neural-command`, and switch to a contained inset sheet below `560px`. Keep the closed DOM in normal flow identical in height to the current telemetry content.

- [ ] **Step 4: Run tests and verify pass**

Run: `pnpm test`

Expected: all render and command-center contracts pass.

### Task 5: Verification and release

**Files:**
- Modify only files required by verified defects found in this task.

**Interfaces:**
- Consumes: completed teaching engine and UI.
- Produces: a verified release commit on `main`.

- [ ] **Step 1: Run static and unit verification**

Run sequentially:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: every command exits `0` with no new warning.

- [ ] **Step 2: Verify in the mobile browser**

Open the existing Wildz game at the mobile test viewport, open the Command Center, verify the compact statement, open/scroll/close the inspector, exercise one teaching disclosure, press Escape, and inspect console errors. Confirm no white browser strip, clipped content, horizontal overflow, or closed-layout shift.

- [ ] **Step 3: Commit**

Stage only the Kai Moment Inspector implementation, plan, tests, and approved supporting changes. Leave `.superpowers/` untouched. Commit with:

```bash
git commit -m "feat: explain the living Kai moment"
```
