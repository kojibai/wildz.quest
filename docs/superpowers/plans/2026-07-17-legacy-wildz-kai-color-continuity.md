# Legacy Wildz Kai Color Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore authoritative colors and recovered Kai characteristics for legacy Wildz across gameplay and card backs without mutating their sealed proof.

**Architecture:** Add one pure compatibility projector that returns the current authoritative palette plus either the sealed v2 birth profile or a deterministic recovered v1 profile. World actors and dossiers consume the same projection, while the Three.js actor keeps colors readable during the darkest Kai phase through bounded material emissiveness rather than added lights.

**Tech Stack:** TypeScript, React 19, React Three Fiber, Three.js, Node test runner

## Global Constraints

- Never rewrite a legacy card manifest, digest, generator version, name, species, stats, or sealed palette.
- Recover the Kai moment from verified `capturedAt`, use the sealed variant seed for individuality, and preserve the stored `kaiPulse` as the historical pulse reference.
- Current living genome palette takes precedence over the sealed variant palette; catalog color is only a no-asset fallback.
- Recovered v1 morphology, markings, cadence, geometry, emotional signals, and traits are read-time projections only.
- A legacy card back says “Recovered Birth Pulse,” keeps `birth.sealed === false`, and never claims v2 proof semantics or stat shifts.
- Preserve color visibility at night with existing material emissive channels only; add no point lights, draw calls, state, timers, or per-frame React work.
- Keep the existing v1 and v2 verification paths byte-compatible and isolated.

---

### Task 1: Pure legacy Kai appearance projection

**Files:**
- Create: `src/features/play/card-kai-appearance.ts`
- Create: `tests/wildz-legacy-kai-appearance.test.ts`

**Interfaces:**
- Consumes: `PortableCardAsset`, `deriveKaiKlokMoment`, `deriveKaiCreatureBirth`, `currentLivingGenome`, the sealed variant seed/pulse, and catalog form identity.
- Produces: `projectCardKaiAppearance(asset: PortableCardAsset): CardKaiAppearance`, where `CardKaiAppearance` contains `source`, `historicalPulse`, `profile`, and `palette`.

- [ ] **Step 1: Write the failing projection contract**

Create `tests/wildz-legacy-kai-appearance.test.ts` with v1 and v2 fixtures. Assert that a legacy card projects `source === "recovered"`, retains its exact original palette and historical pulse, produces deterministic Kai geometry/morphology from capture time and seed, and remains byte-identical before/after projection. Assert that a v2 card returns `source === "sealed"` and its exact stored birth profile.

```ts
const before = canonicalPortableCardJson(legacy);
const first = projectCardKaiAppearance(legacy);
const second = projectCardKaiAppearance(legacy);
assert.equal(first.source, "recovered");
assert.equal(first.historicalPulse, legacy.manifest.variant.kaiPulse);
assert.deepEqual(first.palette, legacy.manifest.variant.traits.palette);
assert.deepEqual(first, second);
assert.equal(first.profile.palette.primary, legacy.manifest.variant.traits.palette.primary);
assert.equal(canonicalPortableCardJson(legacy), before);

const sealedAppearance = projectCardKaiAppearance(kaiBorn);
assert.equal(sealedAppearance.source, "sealed");
assert.deepEqual(sealedAppearance.profile, kaiBorn.manifest.variant.traits.birthProfile);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test`

Expected: FAIL because `card-kai-appearance.ts` and `projectCardKaiAppearance` do not exist.

- [ ] **Step 3: Implement the pure projector**

Create `src/features/play/card-kai-appearance.ts`:

```ts
export type CardKaiAppearance = {
  source: "sealed" | "recovered";
  historicalPulse: string;
  profile: KaiCreatureBirthProfile;
  palette: CardVariantTraits["palette"];
};

export function projectCardKaiAppearance(asset: PortableCardAsset): CardKaiAppearance {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_kai_appearance_form_unknown");
  const variant = asset.manifest.variant;
  const livingPalette = isLivingCardAsset(asset) ? currentLivingGenome(asset).palette : null;
  const palette = {
    primary: livingPalette?.primary ?? variant.traits.palette.primary,
    accent: livingPalette?.accent ?? variant.traits.palette.accent,
    glow: livingPalette?.glow ?? variant.traits.palette.glow
  };
  if (variant.generatorVersion === 2) {
    return { source: "sealed", historicalPulse: variant.kaiPulse, profile: variant.traits.birthProfile, palette };
  }
  const moment = deriveKaiKlokMoment({ occurredAt: asset.manifest.capturedAt, authority: "admitted" });
  const recovered = deriveKaiCreatureBirth({ form, moment, seed: variant.seed });
  return {
    source: "recovered",
    historicalPulse: variant.kaiPulse,
    profile: { ...recovered, palette: { ...palette } },
    palette
  };
}
```

- [ ] **Step 4: Run the full suite and verify the projector passes**

Run: `pnpm test`

Expected: 0 failures; existing v1/v2 proof tests remain green.

---

### Task 2: Recovered card-back moment without false proof claims

**Files:**
- Modify: `tests/wildz-kai-card-dossier.test.ts`
- Modify: `src/features/play/living-card-dossier.ts`

**Interfaces:**
- Consumes: `projectCardKaiAppearance` from Task 1.
- Produces: legacy dossier birth copy, coordinate, geometry, and personality derived from the recovered profile while keeping `sealed: false` and `statShift: []`.

- [ ] **Step 1: Strengthen the failing legacy dossier test**

Extend `legacy dossier does not claim a sealed Kai birth profile`:

```ts
assert.match(dossier.birth.pulse, /^Recovered Birth Pulse /);
assert.match(dossier.birth.cadueusKai, /^Y/);
assert.ok(dossier.birth.geometry.length >= 4);
assert.equal(dossier.birth.statShift.length, 0);
assert.ok(dossier.personality.traits.length >= 4);
```

- [ ] **Step 2: Run the suite and verify the dossier test fails**

Run: `pnpm test`

Expected: FAIL because the legacy dossier still says “Historical capture pulse” and contains no recovered coordinate or geometry.

- [ ] **Step 3: Project both sealed and recovered dossier language**

In `projectLivingCardDossier`, call `projectCardKaiAppearance(asset)` once. Use its profile for personality traits. Preserve the current v2 birth block when `source === "sealed"`; for `source === "recovered"`, return:

```ts
{
  sealed: false,
  pulse: `Recovered Birth Pulse ${appearance.historicalPulse}`,
  cadueusKai: appearance.profile.cadueusKai,
  title: `Remembered ${title(appearance.profile.ark)} geometry`,
  passage: `${asset.manifest.name} keeps its original verified colors and character seal. Its capture time recovers the ${title(appearance.profile.geometry.ark).toLowerCase()} and ${title(appearance.profile.markings.topology).toLowerCase()} geometry that surrounded that historical pulse without rewriting the card's proof.`,
  geometry: [appearance.profile.geometry.day, appearance.profile.geometry.week, appearance.profile.geometry.month, appearance.profile.geometry.ark, `${appearance.profile.geometry.sides}-sided living motif`],
  statShift: []
}
```

- [ ] **Step 4: Run the suite and verify dossier compatibility passes**

Run: `pnpm test`

Expected: 0 failures and `birth.sealed` remains false for v1.

---

### Task 3: Gameplay palette authority and nighttime color floor

**Files:**
- Modify: `tests/wildz-kai-world-ui.test.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsCreatureActor.tsx`

**Interfaces:**
- Consumes: `projectCardKaiAppearance` from Task 1.
- Produces: active/support actor props from the authoritative current palette and recovered/sealed profile; bounded body and accent emissiveness.

- [ ] **Step 1: Write the failing gameplay source contract**

Add assertions to `tests/wildz-kai-world-ui.test.ts`:

```ts
assert.match(canvas, /projectCardKaiAppearance/);
assert.match(canvas, /appearance\.palette\.primary/);
assert.match(canvas, /appearance\.palette\.accent/);
assert.match(canvas, /appearance\.profile\.morphology/);
assert.match(actor, /const bodyColorFloor = pose === "capture" \? 0\.2 : 0\.11/);
assert.match(actor, /emissiveIntensity=\{bodyColorFloor\}/);
assert.match(actor, /emissive=\{accent\} emissiveIntensity=\{0\.07\}/);
```

- [ ] **Step 2: Run the suite and verify the gameplay contract fails**

Run: `pnpm test`

Expected: FAIL because gameplay still reads manifest palettes directly and the actor has the older emissive floor.

- [ ] **Step 3: Use the shared appearance for active and support companions**

Import `projectCardKaiAppearance` in `WildsWorldCanvas.tsx`. Memoize one projection for the active asset and the support list. Pass `appearance.palette.primary`, `appearance.palette.accent`, `appearance.profile.fingerprint`, `appearance.profile.morphology`, and `appearance.profile.motion.cadenceMs` to `WildsCreatureActor`. Keep catalog color fallback only when no asset exists.

- [ ] **Step 4: Preserve color at night without new lighting work**

In `WildsCreatureActor.tsx`, define:

```ts
const bodyColorFloor = pose === "capture" ? 0.2 : 0.11;
```

Use it for the main body `meshStandardMaterial` emissive intensity. Give the accent-colored face material `emissive={accent}` and `emissiveIntensity={0.07}`. Do not add lights or meshes.

- [ ] **Step 5: Run full static verification**

Run: `pnpm test`

Expected: 0 failures.

Run: `pnpm lint`

Expected: exit 0.

Run: `pnpm typecheck`

Expected: exit 0.

Run: `pnpm build`

Expected: optimized production build completes successfully.

- [ ] **Step 6: Verify rendered gameplay and entry UI**

Use the production app and existing Playwright flow to verify the two-line entry at 1440 × 900 and 375 × 667. Enter or restore gameplay with a v1 fixture when locally available; otherwise inspect a deterministic rendered actor harness/screenshot. Confirm original body/accent colors remain visible under night lighting, the legacy dossier shows recovered geometry without a v2 seal claim, and no new console or performance regressions appear.

- [ ] **Step 7: Commit all verified in-scope work on main**

```bash
git add app/globals.css src/features/identity/WildzGenesis.tsx src/features/play/card-kai-appearance.ts src/features/play/living-card-dossier.ts src/features/play/WildsWorldCanvas.tsx src/features/play/WildsCreatureActor.tsx tests/wildz-genesis-copy.test.ts tests/wildz-genesis-living-entry.test.ts tests/wildz-legacy-kai-appearance.test.ts tests/wildz-kai-card-dossier.test.ts tests/wildz-kai-world-ui.test.ts
git commit -m "fix: restore legacy Wildz Kai colors"
```
