# Wildz Live Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, Kai-Klok-driven neural Command Center that makes the Wildz world feel alive, routes into real gameplay actions, and replaces the duplicate globe utility without changing closed-state gameplay.

**Architecture:** Port the canonical Kai Klok state machine and chakra geometry into one pure module, then project current game facts as ranked consequences within that Kai moment. Render the projection in a lightweight externally-triggered item inside the existing command-sheet lifecycle, with CSS-only neural geometry and heartbeat animation derived from Kai beat/step/chakra data. `PlayCampaign` remains the composition root and supplies existing authoritative actions; the Command Center owns no gameplay truth and defines no competing phase machine.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, existing Wildz reducer/domain modules, CSS, Node test runner, existing Receiz v105 adapter.

## Global Constraints

- Add no npm package, API key, external runtime, second renderer, database, or parallel game state.
- Port the canonical Kai Klok fixed-point moment calculation and exact chakra color/geometry tables already present in the local Kai-Turah sources.
- Online shared play uses admitted world cursor time; offline play uses the same local canonical function and identifies local authority.
- Kai moment data may shape presentation and explicit replayable world bias, but cannot change proof validity, bearer ownership, settlement, irreversible lifecycle law, competitive damage formulas, or manufacture rewards.
- The camera and movement code must remain unchanged.
- The existing audio and music must remain unchanged.
- The minimap remains the sole direct atlas entry.
- Closed-state gameplay must not mount the cockpit or subscribe movement/camera state to cockpit presentation.
- Kai Klok is the only system state machine; the Command Center may derive priority and consequence signals but no second semantic phase.
- Priority, Kai-derived palette/topology/cadence, and causal ids must be deterministic for the same admitted snapshot.
- Reduced-motion mode removes rhythmic/spatial animation while preserving state hierarchy and color meaning.

---

## File Structure

- Create `src/features/play/kai-klok-moment.ts`: canonical fixed-point Kai moment, chakra colors, gate names, and polygon geometry metadata.
- Create `src/features/play/command-center/director.ts`: pure priority/state-machine projection.
- Create `src/features/play/command-center/WildsCommandCenter.tsx`: neural cockpit rendering only.
- Modify `src/features/play/WildsCommandDock.tsx`: support externally requested items that do not render a bottom-dock button.
- Modify `src/features/play/PlayCampaign.tsx`: derive input facts, route existing actions, replace the globe trigger, and provide the external Command Center item.
- Modify `src/components/icons.tsx`: expose one existing Lucide command/radar icon if the current icon set lacks a suitable command mark.
- Modify `app/globals.css`: neural cockpit, Kai moment tokens, heartbeat, mobile layout, and reduced-motion rules.
- Create `tests/wildz-kai-klok-moment.test.ts`: canonical fixture parity.
- Create `tests/wildz-command-center-director.test.ts`: deterministic ranking/state transitions.
- Create `tests/wildz-command-center-ui.test.ts`: source/render contracts and integration boundaries.
- Modify `tests/wilds-render-contract.test.ts`: minimap-only atlas entry and Command Center trigger contract.

---

### Task 1: Canonical Kai Klok Moment and Geometry

**Files:**
- Create: `src/features/play/kai-klok-moment.ts`
- Create: `tests/wildz-kai-klok-moment.test.ts`

**Interfaces:**
- Produces: `deriveKaiKlokMoment(input: { occurredAt: string; authority: "admitted" | "world" | "local" }): KaiKlokMoment`
- Produces: `KAI_CHAKRA_GEOMETRY`, `KaiKlokMoment`, `KaiChakra`, and `KaiWeekday`.
- Consumes: no network and no React.

- [ ] **Step 1: Write canonical fixture tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { deriveKaiKlokMoment, KAI_CHAKRA_GEOMETRY } from "../src/features/play/kai-klok-moment";

test("Kai Klok moment is deterministic at the genesis anchor", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "admitted" });
  assert.deepEqual(moment, {
    authority: "admitted", pulse: 0, beat: 0, stepIndex: 0,
    stepPctAcrossBeat: 0, weekday: "Solhara", chakra: "Root",
    year: 1, month: 1, day: 1, week: 1,
    coordinate: "Y1·M1·D1·00:00:00·KAI0",
    accent: "#CC3F3F", hue: 0, sides: 4, gate: "Earth Gate"
  });
});

test("chakra geometry uses the canonical Kai tables", () => {
  assert.deepEqual(KAI_CHAKRA_GEOMETRY.Heart, {
    accent: "#2CCB99", hue: 140, sides: 8, gate: "Air Gate"
  });
  assert.equal(KAI_CHAKRA_GEOMETRY.Crown.sides, 16);
});

test("the same admitted time always produces identical moment state", () => {
  const input = { occurredAt: "2026-07-16T22:00:00.000Z", authority: "admitted" as const };
  assert.deepEqual(deriveKaiKlokMoment(input), deriveKaiKlokMoment(input));
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: FAIL because `src/features/play/kai-klok-moment.ts` does not exist.

- [ ] **Step 3: Implement the canonical local engine**

Implement a focused port from `/Users/bjklock/Kai-Turah/phi/src/utils/kai_pulse.ts`, `/Users/bjklock/Kai-Turah/phi/src/components/sigil/theme.tsx`, and `/Users/bjklock/Kai-Turah/phi/src/components/KaiSigil/constants.ts`:

```ts
export const KAI_GENESIS_TS = 1715323541888 as const;
export const KAI_N_DAY_MICRO = 17_491_270_421n;
export const KAI_BASE_DAY_MICRO = 17_424_000_000n;
export const KAI_PULSES_PER_STEP_MICRO = 11_000_000n;
export const KAI_PULSES_PER_BEAT_MICRO = 484_000_000n;
export const KAI_STEPS_PER_BEAT = 44 as const;
export const KAI_DAYS_PER_WEEK = 6 as const;
export const KAI_DAYS_PER_MONTH = 42 as const;
export const KAI_MONTHS_PER_YEAR = 8 as const;
export const KAI_DAYS_PER_YEAR = 336 as const;
const INV_T_NUM = BigInt("190983005625052575897706582817180941139845410097118568932275689");
const INV_T_DEN = 10n ** 60n;

export type KaiWeekday = "Solhara" | "Aquaris" | "Flamora" | "Verdari" | "Sonari" | "Kaelith";
export type KaiChakra = "Root" | "Sacral" | "Solar Plexus" | "Heart" | "Throat" | "Third Eye" | "Crown";

export const KAI_CHAKRA_GEOMETRY = {
  Root: { accent: "#CC3F3F", hue: 0, sides: 4, gate: "Earth Gate" },
  Sacral: { accent: "#E86428", hue: 24, sides: 6, gate: "Water Gate" },
  "Solar Plexus": { accent: "#E6B844", hue: 48, sides: 5, gate: "Fire Gate" },
  Heart: { accent: "#2CCB99", hue: 140, sides: 8, gate: "Air Gate" },
  Throat: { accent: "#00D5AA", hue: 190, sides: 12, gate: "Will Gate" },
  "Third Eye": { accent: "#6B4AC0", hue: 260, sides: 14, gate: "Light Gate" },
  Crown: { accent: "#C25AA4", hue: 300, sides: 16, gate: "Ether Gate" }
} as const;

export type KaiKlokMoment = {
  authority: "admitted" | "world" | "local";
  pulse: number;
  beat: number;
  stepIndex: number;
  stepPctAcrossBeat: number;
  weekday: KaiWeekday;
  chakra: KaiChakra;
  year: number;
  month: number;
  day: number;
  week: number;
  coordinate: string;
  accent: string;
  hue: number;
  sides: number;
  gate: string;
};

const WEEKDAYS: readonly KaiWeekday[] = ["Solhara", "Aquaris", "Flamora", "Verdari", "Sonari", "Kaelith"];
const DAY_TO_CHAKRA: Record<KaiWeekday, KaiChakra> = {
  Solhara: "Root", Aquaris: "Sacral", Flamora: "Solar Plexus",
  Verdari: "Heart", Sonari: "Throat", Kaelith: "Crown"
};
const abs = (value: bigint) => value < 0n ? -value : value;
const modE = (value: bigint, divisor: bigint) => { const result = value % divisor; return result >= 0n ? result : result + divisor; };
const floorDivE = (value: bigint, divisor: bigint) => { const quotient = value / divisor; const remainder = value % divisor; return remainder === 0n || value >= 0n ? quotient : quotient - 1n; };
const mulDivRoundHalfEven = (value: bigint, numerator: bigint, denominator: bigint) => {
  const sign = (value < 0n ? -1n : 1n) * (numerator < 0n ? -1n : 1n);
  const product = abs(value) * abs(numerator);
  const quotient = product / denominator;
  const remainder = product % denominator;
  const rounded = remainder * 2n > denominator || (remainder * 2n === denominator && (quotient & 1n) === 1n) ? quotient + 1n : quotient;
  return sign * rounded;
};

export function deriveKaiKlokMoment(input: { occurredAt: string; authority: "admitted" | "world" | "local" }): KaiKlokMoment {
  const epochMs = Date.parse(input.occurredAt);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== input.occurredAt) throw new Error("wilds_kai_moment_time_invalid");
  const microPulses = mulDivRoundHalfEven(BigInt(epochMs - KAI_GENESIS_TS), INV_T_NUM, INV_T_DEN);
  const pulse = Number(floorDivE(microPulses, 1_000_000n));
  const pulsesInGrid = modE(microPulses, KAI_N_DAY_MICRO) % KAI_BASE_DAY_MICRO;
  const beat = Number(pulsesInGrid / KAI_PULSES_PER_BEAT_MICRO);
  const pulsesInBeat = pulsesInGrid - BigInt(beat) * KAI_PULSES_PER_BEAT_MICRO;
  const stepIndex = Number(pulsesInBeat / KAI_PULSES_PER_STEP_MICRO);
  const pulsesInStep = pulsesInBeat - BigInt(stepIndex) * KAI_PULSES_PER_STEP_MICRO;
  const stepPctAcrossBeat = (stepIndex + Number(pulsesInStep) / Number(KAI_PULSES_PER_STEP_MICRO)) / KAI_STEPS_PER_BEAT;
  const dayIndex = floorDivE(microPulses, KAI_N_DAY_MICRO);
  const weekday = WEEKDAYS[Number(modE(dayIndex, BigInt(WEEKDAYS.length)))]!;
  const chakra = DAY_TO_CHAKRA[weekday];
  const year = Number(floorDivE(dayIndex, BigInt(KAI_DAYS_PER_YEAR))) + 1;
  const month = Number(modE(floorDivE(dayIndex, BigInt(KAI_DAYS_PER_MONTH)), BigInt(KAI_MONTHS_PER_YEAR))) + 1;
  const day = Number(modE(dayIndex, BigInt(KAI_DAYS_PER_MONTH))) + 1;
  const week = Math.floor((day - 1) / KAI_DAYS_PER_WEEK) + 1;
  const coordinate = `Y${year}·M${month}·D${day}·${String(beat + 1).padStart(2, "0")}:${String(stepIndex + 1).padStart(2, "0")}·P${pulse}`;
  return { authority: input.authority, pulse, beat, stepIndex, stepPctAcrossBeat, weekday, chakra, year, month, day, week, coordinate, ...KAI_CHAKRA_GEOMETRY[chakra] };
}
```

Do not use the simplified weekday-based `KaiNow.ts`; use the eternal six-day fixed-point path from `kai_pulse.ts`. Preserve BigInt Euclidean-floor behavior and ties-to-even conversion.

- [ ] **Step 4: Run canonical tests**

Run:

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-kai-klok-moment.test.js
```

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the canonical engine**

```bash
git add src/features/play/kai-klok-moment.ts tests/wildz-kai-klok-moment.test.ts
git commit -m "feat: add canonical Wildz Kai Klok moment"
```

---

### Task 2: Deterministic Command Projection

**Files:**
- Create: `src/features/play/command-center/director.ts`
- Create: `tests/wildz-command-center-director.test.ts`

**Interfaces:**
- Consumes: `KaiKlokMoment` from Task 1.
- Produces: `projectWildsCommandCenter(input: WildsCommandCenterInput): WildsCommandCenterModel`.
- Produces: `WildsCommandAction`, `WildsCommandPriority`, moment authority, and stable `causalId`.

- [ ] **Step 1: Write failing ranking and determinism tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { projectWildsCommandCenter } from "../src/features/play/command-center/director";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment";

const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "admitted" });
const base = {
  moment, connected: true, worldRevision: 18, energy: 80,
  creature: { assetId: "wilds:one", name: "Onyxcoil", life: "alive" as const, health: 90, maxHealth: 100, fatigue: 10 },
  battle: null, mission: { title: "Find the signal", progress: 40, reward: "Bond memory" },
  nearby: { landmark: null, ecology: null, boss: null, livePlayer: null },
  pendingReward: false, acknowledgedTransitionIds: [] as string[]
};

test("critical creature consequence outranks every opportunity", () => {
  const model = projectWildsCommandCenter({
    ...base,
    creature: { ...base.creature, health: 4, fatigue: 96 },
    nearby: { ...base.nearby, boss: { id: "boss:one", name: "Glass Titan" } }
  });
  assert.equal(model.now.urgency, "critical");
  assert.equal(model.now.category, "squad");
  assert.equal(model.now.action?.type, "open-trail-pack");
});

test("identical snapshots reproduce the exact neural model", () => {
  assert.deepEqual(projectWildsCommandCenter(base), projectWildsCommandCenter(base));
});

test("offline state disables only network actions", () => {
  const model = projectWildsCommandCenter({ ...base, connected: false, nearby: { ...base.nearby, livePlayer: { id: "p2", name: "@ally" } } });
  assert.equal(model.connection, "offline");
  assert.equal(model.priorities.find((item) => item.category === "multiplayer")?.action, null);
  assert.ok(model.priorities.some((item) => item.action?.type === "open-mission"));
});
```

- [ ] **Step 2: Run and verify missing director failure**

Use the Task 1 compile pipeline. Expected: FAIL because the director module does not exist.

- [ ] **Step 3: Implement typed state and stable ranking**

```ts
export type WildsCommandAction =
  | { type: "open-mission" }
  | { type: "open-field-guide" }
  | { type: "open-satchel" }
  | { type: "open-trail-pack" }
  | { type: "open-vault" }
  | { type: "open-map" }
  | { type: "activate-context" };

export type WildsCommandPriority = {
  id: string;
  category: "squad" | "battle" | "world" | "mission" | "multiplayer" | "system";
  urgency: "calm" | "opportunity" | "warning" | "critical";
  title: string;
  consequence: string;
  score: number;
  action: WildsCommandAction | null;
};

export type WildsCommandCenterModel = {
  connection: "online" | "offline";
  causalId: string;
  isNew: boolean;
  moment: KaiKlokMoment;
  palette: { primary: string; hue: number; sides: number; gate: string };
  now: WildsCommandPriority;
  priorities: WildsCommandPriority[];
};
```

Build candidate priorities in small pure functions. Sort by descending `score`, then fixed category order, then `id`. Derive `causalId` with existing `sha256PortableBasis(canonicalPortableCardJson({...}))`, including moment pulse, world revision, `now.id`, and consequence-bearing inputs. Copy palette, sides, gate, and cadence directly from the Kai moment. Urgency may illuminate a secondary consequence current but cannot replace Kai state, palette, geometry, or timing.

- [ ] **Step 4: Run director tests**

Expected: all director tests pass and repeat runs produce byte-identical serialized models.

- [ ] **Step 5: Commit the director**

```bash
git add src/features/play/command-center/director.ts tests/wildz-command-center-director.test.ts
git commit -m "feat: project deterministic Wildz neural command state"
```

---

### Task 3: Shared Kai World Moment Expression

**Files:**
- Create: `src/features/play/kai-moment-expression.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsAtmosphere.tsx`
- Modify: `src/features/play/wilds-world-record.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Create: `tests/wildz-kai-world-expression.test.ts`

**Interfaces:**
- Consumes: `KaiKlokMoment` from Task 1.
- Produces: `projectWildsKaiMomentExpression(moment): WildsKaiMomentExpression`.
- Adds optional `kaiExpression?: WildsKaiMomentExpression` props to world/atmosphere rendering; defaults preserve the current look until PlayCampaign supplies the expression.
- Adds `observedAt: string` to the world snapshot response so connected clients derive the current shared Kai coordinate from server-observed time; this timestamp is display/world-expression authority, not event admission.

- [ ] **Step 1: Write failing deterministic expression tests**

```ts
test("Kai geometry deterministically shapes the living world", () => {
  const moment = deriveKaiKlokMoment({ occurredAt: "2024-05-10T06:45:41.888Z", authority: "admitted" });
  const expression = projectWildsKaiMomentExpression(moment);
  assert.equal(expression.chakra, "Root");
  assert.equal(expression.geometrySides, 4);
  assert.equal(expression.routeColor, "#CC3F3F");
  assert.equal(expression.coordinate, "Y1·M1·D1·00:00:00·KAI0");
  assert.deepEqual(expression, projectWildsKaiMomentExpression(moment));
});

test("moment expression cannot encode rewards damage ownership or settlement", () => {
  const source = readFileSync("src/features/play/kai-moment-expression.ts", "utf8");
  assert.doesNotMatch(source, /reward|damage|ownerReceizId|settlement|proofDigest/);
});

test("world snapshots carry an exact server-observed moment anchor", () => {
  const parsed = parseWildsWorldSnapshotResponse({ ok: true, mode: "receiz_live", observedAt: "2026-07-16T22:00:00.000Z", projection: initialWildsWorldProjection() });
  assert.equal(parsed.observedAt, "2026-07-16T22:00:00.000Z");
});
```

- [ ] **Step 2: Run and verify missing expression failure**

Expected: compile failure because `kai-moment-expression.ts` does not exist.

- [ ] **Step 3: Implement the pure expression**

```ts
export type WildsKaiMomentExpression = {
  pulse: number;
  coordinate: string;
  chakra: KaiChakra;
  gate: string;
  geometrySides: number;
  primaryColor: string;
  fogColor: string;
  routeColor: string;
  particleColor: string;
  emphasisIndex: number;
  progress: number;
};

export function projectWildsKaiMomentExpression(moment: KaiKlokMoment): WildsKaiMomentExpression {
  const emphasisIndex = (moment.beat * KAI_STEPS_PER_BEAT + moment.stepIndex) % moment.sides;
  return {
    pulse: moment.pulse,
    coordinate: moment.coordinate,
    chakra: moment.chakra,
    gate: moment.gate,
    geometrySides: moment.sides,
    primaryColor: moment.accent,
    fogColor: `hsl(${moment.hue} 28% 9%)`,
    routeColor: moment.accent,
    particleColor: `hsl(${moment.hue} 92% 78%)`,
    emphasisIndex,
    progress: moment.stepPctAcrossBeat
  };
}
```

- [ ] **Step 4: Apply expression without rebuilding the scene**

Pass the expression through `WildsWorldCanvas` and `WildsScene`. Use it for existing background/fog material values, Sparkles color, and bounded route/landmark material accents. Add one memoized `KaiGeometryField` that renders at most `geometrySides` lightweight line/ring motifs and updates props in place. Do not key the Canvas, add a Canvas, replace camera props, edit `CameraRig`, or allocate per-frame React state.

Update `worldSnapshot()` to return `{ ...selectWildsWorldSnapshot(...), observedAt: new Date().toISOString() }`. Extend parsing to require canonical ISO `observedAt`, store it beside the projection, and refresh it through the existing 2-second world snapshot loop. Do not add another polling loop.

- [ ] **Step 5: Run expression, renderer, camera, and movement tests**

Run the new test plus `wilds-render-contract`, `arena-movement`, reference HUD, D-pad, and camera-related tests. Expected: all pass and camera source diff is empty.

- [ ] **Step 6: Commit world expression**

```bash
git add src/features/play/kai-moment-expression.ts src/features/play/WildsWorldCanvas.tsx src/features/play/WildsAtmosphere.tsx src/features/play/wilds-world-record.ts src/features/play/use-wilds-world.ts src/lib/receiz/wilds-world-server.ts tests/wildz-kai-world-expression.test.ts
git commit -m "feat: make the Wildz world express Kai moments"
```

---

### Task 4: External Command-Sheet Entry

**Files:**
- Modify: `src/features/play/WildsCommandDock.tsx`
- Create: `tests/wildz-command-center-ui.test.ts`

**Interfaces:**
- Adds `dockVisible?: boolean` to `WildsCommandItem`, defaulting to `true`.
- Preserves `requestedKey` and focus restoration for externally triggered items.

- [ ] **Step 1: Write the failing source contract**

```ts
test("Command Center can use the sheet lifecycle without adding a seventh dock button", async () => {
  const source = await readFile("src/features/play/WildsCommandDock.tsx", "utf8");
  assert.match(source, /dockVisible\?: boolean/);
  assert.match(source, /items\.filter\(\(item\) => item\.dockVisible !== false\)/);
  assert.match(source, /items\.find\(\(item\) => item\.key === activeKey\)/);
});
```

- [ ] **Step 2: Run and verify failure**

Expected: FAIL because `dockVisible` is absent.

- [ ] **Step 3: Extend the dock without altering existing items**

Add `"commandCenter"` to `WildsCommandKey`, add `dockVisible?: boolean`, and map only `items.filter((item) => item.dockVisible !== false)` in the `<nav>`. Keep `activeItem` lookup over all items. When an external item closes and has no dock trigger ref, restore focus to the element recorded before the request opened; add `returnFocusRef` captured from `document.activeElement` in the request effect.

- [ ] **Step 4: Run UI contract and existing dock tests**

Run the new test plus `wilds-render-contract` and every existing command-dock test. Expected: 0 failures.

- [ ] **Step 5: Commit sheet support**

```bash
git add src/features/play/WildsCommandDock.tsx tests/wildz-command-center-ui.test.ts
git commit -m "feat: support external Wildz command sheets"
```

---

### Task 5: Living Neural Cockpit Renderer

**Files:**
- Create: `src/features/play/command-center/WildsCommandCenter.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-command-center-ui.test.ts`

**Interfaces:**
- Consumes: `{ model: WildsCommandCenterModel; onAction(action: WildsCommandAction): void }`.
- Produces no state beyond presentation and acknowledgement callback.

- [ ] **Step 1: Add failing render/CSS contracts**

Assert the component exposes `data-kai-chakra`, Kai pulse/beat/step/chakra telemetry, Now/Squad/World/Mission sections, a polite live region for changed priorities, and CSS for `wilds-neural-spine`, Kai moment tokens, heartbeat keyframes, small-screen flow, `prefers-reduced-motion`, and `visibility`/paused state.

- [ ] **Step 2: Run and verify missing component failure**

Expected: compile failure for missing `WildsCommandCenter`.

- [ ] **Step 3: Render one coherent cockpit**

```tsx
export function WildsCommandCenter({ model, onAction }: {
  model: WildsCommandCenterModel;
  onAction: (action: WildsCommandAction) => void;
}) {
  return <div
    className="wilds-neural-command"
    data-kai-authority={model.moment.authority}
    data-kai-chakra={model.moment.chakra}
    style={{
      "--kai-accent": model.palette.primary,
      "--kai-hue": String(model.palette.hue),
      "--kai-sides": String(model.palette.sides)
    } as React.CSSProperties}
  >
    <div aria-hidden="true" className="wilds-neural-spine"><i /><i /><i /></div>
    <header className="wilds-command-telemetry">
      <span>{model.moment.coordinate}</span>
      <span>{model.moment.chakra} · {model.moment.gate}</span>
      <span>{model.moment.authority === "local" ? "Local continuity" : "Shared world coordinate"}</span>
    </header>
    <section className="wilds-command-now" aria-labelledby="wilds-command-now-title">
      <span>Now · {model.now.urgency}</span><h4 id="wilds-command-now-title">{model.now.title}</h4>
      <p>{model.now.consequence}</p>
      {model.now.action ? <button onClick={() => onAction(model.now.action!)} type="button">Act now</button> : null}
    </section>
    <div className="wilds-command-branches">
      {(["squad", "world", "mission"] as const).map((category) => <section className={`wilds-neural-branch is-${category}`} key={category}>
        <span aria-hidden="true" className="wilds-neural-path" />
        <h4>{category}</h4>
        {model.priorities.filter((item) => item.category === category).slice(0, 2).map((item) => <article key={item.id}><strong>{item.title}</strong><p>{item.consequence}</p>{item.action ? <button onClick={() => onAction(item.action!)} type="button">Open</button> : null}</article>)}
      </section>)}
    </div>
    <p aria-live="polite" className="sr-only">{model.isNew ? `${model.now.title}. ${model.now.consequence}` : ""}</p>
  </div>;
}
```

Use pseudo-elements and composited opacity/transform for the central double-beat and causal travel. Derive cadence/offset variables from Kai beat, step, step progress, and polygon sides; do not derive rhythm from urgency and do not schedule React timers. Add `animation-play-state: paused` when the sheet is not visible and remove all rhythm in reduced motion.

- [ ] **Step 4: Run component contracts and CSS checks**

Expected: all Command Center UI tests pass; existing global render contracts remain green.

- [ ] **Step 5: Commit renderer**

```bash
git add src/features/play/command-center/WildsCommandCenter.tsx app/globals.css tests/wildz-command-center-ui.test.ts
git commit -m "feat: render living Wildz neural cockpit"
```

---

### Task 6: PlayCampaign Integration and Real Action Routing

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/components/icons.tsx`
- Modify: `tests/wilds-render-contract.test.ts`
- Modify: `tests/wildz-command-center-ui.test.ts`

**Interfaces:**
- Consumes: world cursor, current PlayState, living-card revision, existing nearby projections, multiplayer state, current mission, existing `activatePulse`, `setMapOpen`, and `setRequestedCommand`.
- Produces: no new authoritative state.

- [ ] **Step 1: Write failing integration contracts**

Assert:

```ts
assert.match(campaign, /key:\s*"commandCenter"/);
assert.match(campaign, /dockVisible:\s*false/);
assert.match(campaign, /projectWildsCommandCenter/);
assert.match(campaign, /deriveKaiKlokMoment/);
assert.match(campaign, /setRequestedCommand\("commandCenter"\)/);
assert.doesNotMatch(campaign, /className="wilds-map-trigger"[\s\S]{0,300}<Icons\.globe/);
assert.match(campaign, /case "open-map"[\s\S]*setMapOpen\(true\)/);
```

- [ ] **Step 2: Run and verify failure**

Expected: source contract fails because the globe utility still opens the map and no command item exists.

- [ ] **Step 3: Derive the moment and neural model**

Use the validated `livingWorld.observedAt` as world-observed `occurredAt` while connected; otherwise use a local canonical moment updated only at the next calculated pulse boundary. Build one `WildsKaiMomentExpression` and pass the same object to `WildsWorldCanvas` and `WildsCommandCenterInput`. Do not create separate world/cockpit clocks. Project current living-card health/fatigue from the active asset's current revision; legacy cards receive a non-critical healthy baseline only when no living revision exists.

- [ ] **Step 4: Route every command action into existing operations**

```ts
const handleCommandAction = (action: WildsCommandAction) => {
  switch (action.type) {
    case "open-mission": setRequestedCommand("mission"); return;
    case "open-field-guide": setRequestedCommand("fieldGuide"); return;
    case "open-satchel": setRequestedCommand("satchel"); return;
    case "open-trail-pack": setRequestedCommand("deck"); return;
    case "open-vault": setRequestedCommand("vault"); return;
    case "open-map": setMapOpen(true); return;
    case "activate-context": activatePulse(); return;
  }
};
```

Create a hidden external item:

```tsx
{
  key: "commandCenter",
  label: "Living Command Center",
  icon: <Icons.pulse size={21} />,
  status: `${commandModel.moment.chakra} · Kai ${commandModel.moment.pulse}`,
  dockVisible: false,
  content: <WildsCommandCenter model={commandModel} onAction={handleCommandAction} />
}
```

Replace the globe utility with an icon-only button that requests `commandCenter`; keep its exact class footprint and add `data-kai-chakra`, `aria-expanded`, a dynamic accessible label, and one-change consequence pulse class. Do not alter `WildsWorldCanvas`, `CameraRig`, D-pad, trackpad, or movement state.

- [ ] **Step 5: Run focused integration tests and typecheck**

Run Command Center tests, render contract, reference HUD tests, `pnpm typecheck`. Expected: all pass.

- [ ] **Step 6: Commit integration**

```bash
git add src/features/play/PlayCampaign.tsx src/components/icons.tsx tests/wilds-render-contract.test.ts tests/wildz-command-center-ui.test.ts
git commit -m "feat: connect Wildz gameplay to the neural command center"
```

---

### Task 7: Offline Continuity, Acknowledgement, and Replay

**Files:**
- Modify: `src/features/identity/wildz-player-vault.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/command-center/director.ts`
- Create: `tests/wildz-command-center-continuity.test.ts`

**Interfaces:**
- Adds an optional backwards-compatible presentation field to player continuity: `commandCenter?: { acknowledgedTransitionIds: string[] }`.
- Does not place game facts or ownership state in presentation continuity.

- [ ] **Step 1: Write failing round-trip and replay tests**

Prove old Vaults restore with an empty acknowledgement list, new Vaults preserve at most the newest 64 ids, acknowledgement changes only `isNew`, and replaying the same admitted Kai moment plus PlayState returns the same causal id/model.

- [ ] **Step 2: Run and verify failure**

Expected: continuity type/restore assertions fail because the field is absent.

- [ ] **Step 3: Implement bounded acknowledgement continuity**

Normalize the optional field during restore, reject malformed ids, deduplicate, and cap to 64. Append only after the Command Center has opened and the current priority has been presented. Never acknowledge on trigger animation alone.

- [ ] **Step 4: Run continuity, Vault export/restore, and replay suites**

Expected: new tests pass and all existing V3 Vault compatibility tests remain green.

- [ ] **Step 5: Commit continuity**

```bash
git add src/features/identity/wildz-player-vault.ts src/features/play/PlayCampaign.tsx src/features/play/command-center/director.ts tests/wildz-command-center-continuity.test.ts
git commit -m "feat: preserve Wildz command consequence acknowledgement"
```

---

### Task 8: Full Verification and Mobile Release Gate

**Files:**
- Modify only if verification exposes a scoped defect.

**Interfaces:**
- Verifies the complete feature; produces no new API.

- [ ] **Step 1: Run the full compiled test suite**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test --test-reporter=dot .test-build/tests/*.test.js
```

Expected: 0 failed, 0 cancelled.

- [ ] **Step 2: Run production checks**

```bash
pnpm typecheck
pnpm build
```

Expected: TypeScript exits 0 and Next reports a successful optimized production build.

- [ ] **Step 3: Verify in the in-app browser at mobile size**

Start the built app and verify:

- minimap opens the full atlas;
- former globe slot opens Command Center only;
- Command Center first paint is complete, never blank;
- Kai telemetry/color/geometry match the projected moment;
- successive canonical Kai moment fixtures render their exact chakra color, polygon geometry, beat, step, and cadence;
- calm, opportunity, warning, critical, and offline gameplay facts illuminate distinct consequence paths without changing Kai state;
- Now/Squad/World/Mission actions route into existing systems;
- close restores focus and leaves gameplay controls unchanged;
- reduced motion removes travel/heartbeat;
- document hidden pauses animation;
- no console errors, React warnings, failed requests, or white Safari root flashes occur.

- [ ] **Step 4: Inspect performance boundaries**

Confirm no new dependency in lockfile, no second canvas in the sheet, no polling interval, no camera/movement diff, and no Command Center content mounted while closed.

- [ ] **Step 5: Commit verification-only fixes if required**

If verification exposed a defect, stage the exact implementation and regression-test files changed in that step and commit them with `git commit -m "fix: close Wildz command center release gaps"`. Do not create an empty commit when verification needs no fix.
