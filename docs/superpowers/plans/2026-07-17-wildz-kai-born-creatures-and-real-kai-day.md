# Wildz Kai-Born Creatures and Real Kai-Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seal the real Kai Klok birth moment into new creature identity, names, offspring inheritance, and balanced powers, use that moment to influence valid encounters, and drive a continuous six-Ark world day/night cycle with tasteful beat/Ark transitions.

**Architecture:** Add versioned pure projections for Kai creature birth, encounter affinity, and world expression. Generator-v1 cards retain their exact verifier while new generator-v2 cards seal a compact Kai Birth Profile and zero-sum stat shifts; the existing Kai scheduler feeds memoized Three.js atmosphere props and deduplicated audio/visual transition events.

**Tech Stack:** TypeScript 5.6, React 19, Next.js 15, Three.js 0.182, React Three Fiber 9, Node test runner, existing Wildz Web Audio runtime.

## Global Constraints

- Existing generator-v1 cards must remain byte-for-byte valid and unchanged.
- New cards use `variant.generatorVersion: 2` and fail closed on unknown or tampered Kai profile data.
- Kai stat changes must preserve the exact catalog total across health, power, guard, speed, and bond.
- No new network requests, packages, large models, textures, audio downloads, workers, or per-frame React state.
- World chapter, biome, settlement, and district colors remain the authored base beneath a bounded atmosphere overlay.
- `00:00:00` in the Kai day is sunrise; Ark order is Ignite, Integrate, Harmonize, Reflekt, Purify, Dream.
- Initial mount must not play a transition; duplicate, reload, and catch-up updates acknowledge at most the newest beat/Ark once.
- Card-back copy includes `Birth Pulse` and `Cadueus KAI` and translates geometry/meaning into creature language.
- V2 names are deterministic expressions of species plus birth geometry/meaning; offspring inherit recognizable signals from both parents and are then uniquely shaped and named by the child's own Kai birth moment.
- Audio settings, reduced motion, quality profiles, offline capture, movement, camera, persistence, multiplayer, and list virtualization remain intact.

---

## File Structure

- Create `src/features/play/kai-creature-birth.ts`: deterministic v2 Kai Birth Profile, palette, personality signals, geometry traits, and zero-sum stat shifts.
- Modify `src/features/play/living-card-offspring.ts` and related fusion/breeding paths: mix sealed parental signals before projecting the child's exact Kai birth moment.
- Create `src/features/play/kai-encounter-affinity.ts`: bounded deterministic affinity scoring and candidate selection over already-valid hotspots/cards.
- Create `src/features/play/WildsKaiAtmosphereGeometry.tsx`: low-count Ark geometry motifs and transition ripple presentation.
- Modify `src/features/play/kai-klok-moment.ts`: expose exact normalized Kai-day and within-Ark progress.
- Modify `src/features/play/kai-moment-expression.ts`: project continuous day phase, sun, sky, fog, light, shadow, particles, and transition key.
- Modify `src/features/play/card-variant.ts`: isolate v1 derivation and add v2 traits from a Kai Birth Profile.
- Modify `src/features/play/portable-card.ts`: discriminated v1/v2 manifest variants, v2 sealing, and version-specific verification.
- Modify `src/features/play/game-state.ts` and `src/features/play/hidden-hotspots.ts`: apply Kai affinity at search/capture time without bypassing spatial/habitat rules.
- Modify `src/features/play/living-card-dossier.ts` and `src/features/play/WildsCardBack.tsx`: deterministic birth narrative, personality, Cadueus KAI, and transparent stat shifts.
- Modify `src/features/play/WildsWorldCanvas.tsx` and `src/features/play/WildsAtmosphere.tsx`: consume the shared expression while preserving authored palettes.
- Modify `src/features/play/wilds-audio.ts`, `src/features/play/use-wilds-presentation.ts`, and `src/features/play/PlayCampaign.tsx`: synthesized Kai cues and deduplicated transition dispatch.
- Modify `app/globals.css`: card-back birth section and nonblocking/reduced-motion world transition styling where DOM styling is required.
- Add focused tests under `tests/` for birth profiles, v2 cards, encounter affinity, world expression, audio deduplication, UI contracts, and performance contracts.

---

### Task 1: Exact Kai-Day and Six-Ark World Projection

**Files:**
- Modify: `src/features/play/kai-klok-moment.ts`
- Modify: `src/features/play/kai-moment-expression.ts`
- Test: `tests/wildz-kai-klok-moment.test.ts`
- Test: `tests/wildz-kai-moment-expression.test.ts`

**Interfaces:**
- Produces: `KaiKlokMoment.dayProgress: number`, `KaiKlokMoment.arkProgress: number`.
- Produces: `projectKaiWorldExpression(moment): KaiWorldExpression` with `dayPhase`, `sun`, `sky`, `lighting`, `particles`, and `transitionKey`.
- Consumes: exact integer micro-pulse values already computed by `deriveKaiKlokMoment`.

- [ ] **Step 1: Write failing Kai-day boundary tests**

Add table-driven assertions that exact fixture moments project to normalized values and that the six Ark indices remain ordered. Assert `0 <= dayProgress < 1`, `0 <= arkProgress < 1`, and sunrise projection at the fixture representing day progress zero.

```ts
const moment = deriveKaiKlokMoment({ occurredAt: fixture.occurredAt, authority: "world" });
assert.ok(moment.dayProgress >= 0 && moment.dayProgress < 1);
assert.ok(moment.arkProgress >= 0 && moment.arkProgress < 1);
assert.equal(moment.arkIndex, fixture.arkIndex);
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx tsx --test tests/wildz-kai-klok-moment.test.ts tests/wildz-kai-moment-expression.test.ts`

Expected: FAIL because `dayProgress`, `arkProgress`, and expanded world-expression fields do not exist.

- [ ] **Step 3: Add exact normalized progress to `KaiKlokMoment`**

Compute from the existing integer `microPulsesInDay`, not wall-clock approximations:

```ts
const dayProgress = Number(microPulsesInDay) / Number(KAI_N_DAY_MICRO);
const arkPosition = dayProgress * KAI_ARK_NAMES.length;
const arkIndex = Math.min(KAI_ARK_NAMES.length - 1, Math.floor(arkPosition));
const arkProgress = arkPosition - arkIndex;
```

Return all three fields from `deriveKaiKlokMoment` and retain existing lattice math.

- [ ] **Step 4: Expand the pure world projection**

Define explicit bounded types and interpolate semantic targets:

```ts
export type KaiWorldExpression = {
  accent: string;
  dayPhase: "sunrise" | "morning" | "midday" | "afternoon" | "twilight" | "night";
  dayProgress: number;
  arkProgress: number;
  atmosphericInfluence: number;
  sun: { azimuth: number; elevation: number; intensity: number; color: string };
  sky: { tint: string; luminance: number; fogDensity: number };
  lighting: { hemisphere: number; fill: number; shadow: number };
  particles: { speed: number; opacity: number; geometrySides: number };
  transitionKey: { day: string; beat: string; ark: string };
};
```

Use a six-entry Ark target table and smooth interpolation. Keep night luminance above the gameplay readability floor and `atmosphericInfluence <= 0.18`.

- [ ] **Step 5: Run focused tests**

Run: `npx tsx --test tests/wildz-kai-klok-moment.test.ts tests/wildz-kai-moment-expression.test.ts`

Expected: PASS; consecutive sample points remain bounded without discontinuities larger than the asserted tolerance.

- [ ] **Step 6: Commit the projection**

```bash
git add src/features/play/kai-klok-moment.ts src/features/play/kai-moment-expression.ts tests/wildz-kai-klok-moment.test.ts tests/wildz-kai-moment-expression.test.ts
git commit -m "feat: project the real six-Ark Kai day"
```

---

### Task 2: Deterministic Kai Birth Profile and Balanced Traits

**Files:**
- Create: `src/features/play/kai-creature-birth.ts`
- Modify: `src/features/play/card-variant.ts`
- Test: `tests/wildz-kai-creature-birth.test.ts`

**Interfaces:**
- Consumes: `deriveKaiKlokMoment`, `deriveKaiMomentExpression`, catalog `CreatureForm`, and v2 seed material.
- Produces: `deriveKaiCreatureBirth(input): KaiCreatureBirthProfile`.
- Produces: `deriveCardVariantV2(seed, profile, form): CardVariantTraitsV2`.

- [ ] **Step 1: Write failing profile determinism and conservation tests**

Cover all six Arks and seven chakra geometry entries. Assert same inputs reproduce byte-identical output, different meaningful moments change at least geometry/palette/personality, and stat totals remain exact.

```ts
const profile = deriveKaiCreatureBirth({ form, moment, seed });
assert.equal(Object.values(profile.statShift).reduce((sum, value) => sum + value, 0), 0);
assert.equal(
  Object.values(profile.adjustedStats).reduce((sum, value) => sum + value, 0),
  Object.values(form.stats).reduce((sum, value) => sum + value, 0)
);
assert.equal(profile.cadueusKai, moment.coordinate);
```

- [ ] **Step 2: Run the new test and confirm failure**

Run: `npx tsx --test tests/wildz-kai-creature-birth.test.ts`

Expected: FAIL because the new module and types do not exist.

- [ ] **Step 3: Define the compact profile**

```ts
export type KaiCreatureBirthProfile = {
  version: 1;
  pulse: number;
  cadueusKai: string;
  chakra: KaiChakra;
  ark: KaiArkName;
  harmonic: { day: string; week: string; month: string };
  geometry: { day: string; week: string; month: string; ark: string; sides: number };
  emotionalSignals: readonly [string, string, string];
  characterTraits: readonly [string, string, string, string];
  palette: { primary: string; accent: string; glow: string };
  markings: { topology: string; density: number; motif: string };
  motion: { cadenceMs: number; gesture: string; posture: string };
  affinities: readonly string[];
  statShift: CreatureStats;
  adjustedStats: CreatureStats;
  fingerprint: string;
  name: { given: string; epithet: string; display: string };
  lineage?: { parentIds: readonly [string, string]; inheritedSignals: readonly string[] };
};
```

Use stable identifier tables sourced from the existing Kai teachings. Store identifiers and short signals, not duplicated long teaching text.

Derive the display name deterministically from the recognizable catalog species stem plus geometry, chakra, Ark meaning, and the profile fingerprint. Avoid random syllable soup and keep the result compact enough for current card layouts.

- [ ] **Step 4: Implement bounded palette and geometry projection**

Blend the catalog palette with the chakra accent using deterministic HSL conversion and bounded ratios. Select existing Heartbound-compatible marking/motion identifiers from geometry and semantic lanes. Clamp cadence and density to existing renderer limits.

- [ ] **Step 5: Implement zero-sum stat redistribution**

Rank favored stats from Ark/chakra/form compatibility, move at most 4 total points, clamp each shift to `[-3, 3]`, keep all final stats within existing global catalog extrema, and compensate deterministically until the sum is zero.

- [ ] **Step 6: Add v2 card traits without changing v1**

Retain `deriveCardVariant(seed, 1)` exactly. Add a separate v2 function and type extension containing `birthProfile`; do not branch inside the v1 math.

- [ ] **Step 7: Run focused tests**

Run: `npx tsx --test tests/wildz-kai-creature-birth.test.ts`

Expected: PASS across every Ark/chakra table entry and stat conservation case.

- [ ] **Step 8: Commit the birth projection**

```bash
git add src/features/play/kai-creature-birth.ts src/features/play/card-variant.ts tests/wildz-kai-creature-birth.test.ts
git commit -m "feat: derive proof-ready Kai creature births"
```

---

### Task 3: Version-2 Portable Cards and Offline Verification

**Files:**
- Modify: `src/features/play/portable-card.ts`
- Modify: `src/features/play/living-card-types.ts`
- Modify: `src/features/play/living-card-proof.ts`
- Test: `tests/play-game-state.test.ts`
- Test: `tests/wildz-kai-card-proof.test.ts`
- Test: `tests/wildz-full-vault-regression.test.ts`

**Interfaces:**
- Consumes: `deriveKaiCreatureBirth`, `deriveCardVariantV2`, and exact capture time.
- Produces: discriminated `PortableCardManifest["variant"]` v1/v2 union.
- Produces: `sealCollectedCard(input)` with its compatibility default unchanged at v1; actual new in-game capture paths explicitly request generator v2.

- [ ] **Step 1: Add failing legacy and v2 proof tests**

Create one explicit v1 fixture and one v2 card. Assert both verify, existing v1 traits remain exact, v2 contains a valid birth profile, and mutation of pulse, geometry, palette, stat shift, adjusted stats, fingerprint, or traits digest fails.

```ts
const legacy = sealCollectedCard({ ...basis, generatorVersion: 1 });
const born = sealCollectedCard({ ...basis, generatorVersion: 2 });
assert.equal(legacy.manifest.variant.generatorVersion, 1);
assert.equal(born.manifest.variant.generatorVersion, 2);
assert.equal(verifyPortableCard(legacy).ok, true);
assert.equal(verifyPortableCard(born).ok, true);
```

- [ ] **Step 2: Run focused proof tests and confirm failure**

Run: `npx tsx --test tests/wildz-kai-card-proof.test.ts tests/play-game-state.test.ts tests/wildz-full-vault-regression.test.ts`

Expected: FAIL because generator v2 is unsupported.

- [ ] **Step 3: Introduce the discriminated manifest variant**

Define `PortableCardVariantV1` with the current exact fields and `PortableCardVariantV2` with v2 traits/profile. Preserve serialized v1 field names and values.

- [ ] **Step 4: Route sealing by generator version**

Add `generatorVersion?: 1 | 2` while preserving the function's existing v1 default. Update only the real new-capture reducers/actions to pass `generatorVersion: 2`; migration, legacy admission, fixtures, and unrelated callers remain v1 unless explicit.

- [ ] **Step 5: Route verification by discriminator**

For v1, execute the current verifier unchanged, including exact catalog-stat validation. For v2, rederive the canonical moment from `capturedAt`, verify the pulse/coordinate, rederive profile and traits, require `manifest.stats` to equal `profile.adjustedStats`, require its total to equal the catalog total with bounded shifts, compare canonical JSON, then verify trait and manifest digests.

- [ ] **Step 6: Preserve birth identity through living admission/evolution**

Carry the v2 birth profile and adjusted stats into living-card admission without changing it during growth, evolution, fusion ancestry, import, or current-world updates.

- [ ] **Step 7: Run proof and vault regressions**

Run: `npx tsx --test tests/wildz-kai-card-proof.test.ts tests/play-game-state.test.ts tests/wildz-full-vault-regression.test.ts`

Expected: PASS; v1 fixtures remain valid and v2 mutations fail closed.

- [ ] **Step 8: Commit portable v2 cards**

```bash
git add src/features/play/portable-card.ts src/features/play/living-card-types.ts src/features/play/living-card-proof.ts tests/play-game-state.test.ts tests/wildz-kai-card-proof.test.ts tests/wildz-full-vault-regression.test.ts
git commit -m "feat: seal Kai birth profiles into portable cards"
```

---

### Task 4: Kai-Affinity Creature Encounters

**Files:**
- Create: `src/features/play/kai-encounter-affinity.ts`
- Modify: `src/features/play/hidden-hotspots.ts`
- Modify: `src/features/play/game-state.ts`
- Test: `tests/wildz-kai-encounter-affinity.test.ts`
- Test: `tests/play-game-state.test.ts`

**Interfaces:**
- Consumes: valid nearby hotspots/candidate forms and `KaiKlokMoment` derived from `searchedAt`.
- Produces: `selectKaiAffinedForm(input): CreatureForm` and affinity metadata used by the v2 birth profile while retaining the physical hotspot occurrence identity.

- [ ] **Step 1: Write failing deterministic selection tests**

Assert the result always belongs to the habitat-valid form set for that hotspot, identical hotspot/time/owner inputs reproduce the result, moment changes can change ranking before capture, and a nonzero baseline prevents an affinity hard lock. Assert position, cover radius, and occurrence ID never change.

- [ ] **Step 2: Run focused encounter tests and confirm failure**

Run: `npx tsx --test tests/wildz-kai-encounter-affinity.test.ts tests/play-game-state.test.ts`

Expected: FAIL because affinity selection is absent.

- [ ] **Step 3: Implement bounded scoring**

```ts
export function scoreKaiEncounter(form: CreatureForm, moment: KaiKlokMoment): number {
  const habitat = habitatAffinity(form.habitat, moment);
  const element = semanticAffinity(form.element, moment.chakra, moment.ark);
  const geometry = geometryAffinity(form, moment.sides);
  return 1 + Math.min(0.75, habitat + element + geometry);
}
```

Use the score only in deterministic weighted selection after spatial validity, over a bounded habitat-compatible form set. Do not create new coordinates or bypass captured/progression rules.

- [ ] **Step 4: Integrate at search time**

Derive the moment from `input.searchedAt` after the existing spatial hit has resolved. Preserve that hotspot's occurrence ID, position, cover, and capture ledger key; select its form from the bounded habitat-compatible set and store the chosen form in the encounter so later time changes cannot reroll it. Capture seals the exact `input.at` birth moment.

- [ ] **Step 5: Run game-state and affinity tests**

Run: `npx tsx --test tests/wildz-kai-encounter-affinity.test.ts tests/play-game-state.test.ts`

Expected: PASS with no spatial or duplicate-capture regression.

- [ ] **Step 6: Commit affinity encounters**

```bash
git add src/features/play/kai-encounter-affinity.ts src/features/play/hidden-hotspots.ts src/features/play/game-state.ts tests/wildz-kai-encounter-affinity.test.ts tests/play-game-state.test.ts
git commit -m "feat: let Kai moments shape valid encounters"
```

---

### Task 5: Creature Image, Story, Personality, and Card Back

**Files:**
- Modify: `src/features/play/heartbound-genome.ts`
- Modify: `src/features/play/heartbound-anime-genome.ts`
- Modify: `src/features/play/living-card-dossier.ts`
- Modify: `src/features/play/living-card-offspring.ts`
- Modify: `src/features/play/WildsCardBack.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `app/globals.css`
- Test: `tests/wildz-kai-card-dossier.test.ts`
- Test: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: sealed v2 `KaiCreatureBirthProfile` only; v1 uses the current legacy genome path.
- Produces: Kai-shaped Heartbound palette/marking/motion traits and `LivingCardDossier.birth`.

- [ ] **Step 1: Write failing dossier and render-contract tests**

Assert v2 dossier copy includes `Birth Pulse`, `Cadueus KAI`, geometry-derived creature imagery, personality signals, and stat-shift details. Assert deterministic output and that v1 copy does not claim a sealed v2 birth.

Add offspring fixtures asserting that the same two parents and child birth moment reproduce the same child, swapping parent order does not change the inheritance pool, both parents contribute at least one visible signal, a different child birth moment changes the child's name/profile, and stat totals remain conserved.

- [ ] **Step 2: Run focused UI/data tests and confirm failure**

Run: `npx tsx --test tests/wildz-kai-card-dossier.test.ts tests/wilds-render-contract.test.ts`

Expected: FAIL because the dossier has no birth projection.

- [ ] **Step 3: Apply birth traits to the genome**

For v2 cards, use the sealed palette, marking topology/density, aura, cadence, gesture, and posture as deterministic birth inputs before the existing Heartbound presentation signature is computed. Keep the catalog anatomy/archetype foundation recognizable.

Route the selected companion/world creature through its sealed asset variant/profile as well, so the live actor and card art share the same v2 palette and markings; v1 actors keep the current catalog/legacy path.

For offspring, canonicalize the two parent IDs, mix bounded palette/marking/personality/affinity signals from both sealed profiles, then use the child's own capture/birth moment as the final projection. The moment may transform inherited traits but must not erase either parent's contribution. Seal parent IDs and inherited signal identifiers into the child profile so verification can reproduce the result offline.

- [ ] **Step 4: Add deterministic emotional narrative**

Extend `LivingCardDossier`:

```ts
birth: {
  sealed: boolean;
  pulse: string;
  cadueusKai: string;
  title: string;
  passage: string;
  geometry: string[];
  statShift: string[];
};
```

Compose prose from catalog habitat/species/abilities plus the sealed profile signals. Do not insert raw full teaching paragraphs or horoscope claims.

Use the sealed v2 display name consistently on the card front, card back, drawer, selected companion, and dossier. Preserve catalog names for v1 cards and use the child name in offspring lineage prose.

- [ ] **Step 5: Render the birth section and proof details**

Place the compact birth passage after Character Story and exact shift/profile details in Full Visual DNA. Add responsive CSS that uses existing card-back spacing and scrolling.

- [ ] **Step 6: Run dossier/render tests**

Run: `npx tsx --test tests/wildz-kai-card-dossier.test.ts tests/wilds-render-contract.test.ts tests/wilds-creature-thumbnails.test.ts`

Expected: PASS; existing card back remains scrollable and v1/v2 claims remain truthful.

- [ ] **Step 7: Commit creature presentation**

```bash
git add src/features/play/heartbound-genome.ts src/features/play/heartbound-anime-genome.ts src/features/play/living-card-dossier.ts src/features/play/living-card-offspring.ts src/features/play/WildsCardBack.tsx src/features/play/WildsWorldCanvas.tsx app/globals.css tests/wildz-kai-card-dossier.test.ts tests/wilds-render-contract.test.ts
git commit -m "feat: express Kai births in creature art and story"
```

---

### Task 6: Continuous World Lighting and Ark Geometry

**Files:**
- Create: `src/features/play/WildsKaiAtmosphereGeometry.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsAtmosphere.tsx`
- Test: `tests/wildz-kai-world-ui.test.ts`
- Test: `tests/wildz-mobile-performance.test.ts`

**Interfaces:**
- Consumes: expanded `KaiWorldExpression` from Task 1.
- Produces: atmosphere props and low-count geometry motifs with no canonical state mutation.

- [ ] **Step 1: Write failing world UI/performance contracts**

Assert `WildsAtmosphere` consumes `KaiWorldExpression`, hardcoded `time: "day"` is removed from the audio projection, geometry count is quality-profile bounded, and no `useFrame` callback calls a React setter.

- [ ] **Step 2: Run focused world tests and confirm failure**

Run: `npx tsx --test tests/wildz-kai-world-ui.test.ts tests/wildz-mobile-performance.test.ts tests/wildz-kai-moment-expression.test.ts`

Expected: FAIL because atmosphere remains static daytime.

- [ ] **Step 3: Feed sky and fog from the shared expression**

Blend chapter fog with `expression.sky.tint` at `expression.atmosphericInfluence`. Set background/fog, sun position/color/intensity, hemisphere/fill levels, shadow strength, and shaft visibility from expression props.

- [ ] **Step 4: Add low-count Ark geometry motifs**

Render reusable primitive lines/points based on `particles.geometrySides`, capped by quality profile. Use refs for any continuous rotation; no React frame updates. At night, show subtle spiral/merkaba-like constellations while retaining readability.

- [ ] **Step 5: Preserve authored district colors**

Confirm environment material colors remain sourced from chapter/biome/settlement data. Limit Kai influence to sky, fog, lights, shafts, and particles.

- [ ] **Step 6: Run world and performance tests**

Run: `npx tsx --test tests/wildz-kai-world-ui.test.ts tests/wildz-mobile-performance.test.ts tests/wildz-kai-moment-expression.test.ts`

Expected: PASS; no new per-frame React state or unbounded particles.

- [ ] **Step 7: Commit world expression**

```bash
git add src/features/play/WildsKaiAtmosphereGeometry.tsx src/features/play/WildsWorldCanvas.tsx src/features/play/WildsAtmosphere.tsx tests/wildz-kai-world-ui.test.ts tests/wildz-mobile-performance.test.ts
git commit -m "feat: evolve the world through the real Kai day"
```

---

### Task 7: Tasteful Beat and Ark Transition Audio/Visuals

**Files:**
- Modify: `src/features/play/wilds-audio.ts`
- Modify: `src/features/play/use-wilds-presentation.ts`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Test: `tests/wilds-audio-director.test.ts`
- Test: `tests/wilds-presentation.test.ts`
- Test: `tests/wildz-kai-transition.test.ts`

**Interfaces:**
- Consumes: `KaiWorldExpression.transitionKey` and existing presentation audio settings.
- Produces: `kaiTransition(previous, next): "beat" | "ark" | null`, cues `kai-beat` and `kai-ark`, and a one-shot visual transition signal.

- [ ] **Step 1: Write failing transition-deduplication tests**

Cover initial mount, same key, beat change, Ark change, day rollover, skipped updates, and reload baseline. Ark outranks beat when both change.

```ts
assert.equal(kaiTransition(null, current), null);
assert.equal(kaiTransition(current, current), null);
assert.equal(kaiTransition(current, nextBeat), "beat");
assert.equal(kaiTransition(current, nextArk), "ark");
```

- [ ] **Step 2: Run focused audio/transition tests and confirm failure**

Run: `npx tsx --test tests/wildz-kai-transition.test.ts tests/wilds-audio-director.test.ts tests/wilds-presentation.test.ts`

Expected: FAIL because transition keys/cues are unsupported.

- [ ] **Step 3: Add synthesized cues**

Add `kai-beat` as a short soft sine/triangle breath and `kai-ark` as a short two-stage ceremonial voice using existing oscillator/gain primitives. Do not add assets or fetches.

- [ ] **Step 4: Deduplicate transition dispatch in `PlayCampaign`**

Use a ref initialized from the first expression. On later updates, compute the newest transition once, update the ref before playing, respect muted/unready audio through `presentation.playCue`, and expose a monotonically changing visual token for the world canvas only when needed.

- [ ] **Step 5: Add restrained visual acknowledgement**

Pass transition kind/token to the Ark geometry component. Use a ref-driven short opacity/scale breath; reduced motion uses color/opacity only. The effect is pointer-free and does not alter game state.

- [ ] **Step 6: Run transition and audio tests**

Run: `npx tsx --test tests/wildz-kai-transition.test.ts tests/wilds-audio-director.test.ts tests/wilds-presentation.test.ts`

Expected: PASS with no cue on initial mount or duplicates.

- [ ] **Step 7: Commit transitions**

```bash
git add src/features/play/wilds-audio.ts src/features/play/use-wilds-presentation.ts src/features/play/PlayCampaign.tsx src/features/play/WildsWorldCanvas.tsx tests/wilds-audio-director.test.ts tests/wilds-presentation.test.ts tests/wildz-kai-transition.test.ts
git commit -m "feat: celebrate Kai beat and Ark transitions"
```

---

### Task 8: Full Regression, Rendered QA, Rail Fix, and Final Integration Commit

**Files:**
- Modify if required by findings: files changed in Tasks 1-7
- Include existing completed rail fix: `src/features/play/WildzCreatureDrawer.tsx`, `app/globals.css`, `tests/wildz-card-rail-ui.test.ts`
- Test: all `tests/*.test.ts`

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: one production-ready integrated branch with the requested rail and Kai features committed.

- [ ] **Step 1: Run static checks**

Run: `pnpm typecheck && pnpm lint`

Expected: both exit 0 with no new warnings/errors.

- [ ] **Step 2: Run the full deterministic suite**

Run: `pnpm test`

Expected: all tests pass, including v1 vault/proof regressions and new v2/Kai contracts.

- [ ] **Step 3: Build production**

Run: `pnpm build`

Expected: optimized production build completes with valid types and all routes generated.

- [ ] **Step 4: Run rendered browser QA**

Use the Browser plugin against a fresh local production port. Verify:

- page identity, meaningful shell, no framework overlay, and healthy console
- first-open single-row horizontal rail and visible 40px trailing spacer
- a v2 card front uses sealed Kai color/style and the back shows Birth Pulse/Cadueus KAI/story/stat shift
- representative Ignite sunrise, Harmonize midday, Purify twilight, and Dream night projections remain readable
- an Ark transition produces one restrained acknowledgement
- no interaction, clipping, movement, district-color, or quality-profile regression

- [ ] **Step 5: Inspect final diff and repository status**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; `.superpowers/` remains untouched/untracked; only intended source, tests, CSS, and plan files are included.

- [ ] **Step 6: Commit remaining integration changes**

```bash
git add docs/superpowers/plans/2026-07-17-wildz-kai-born-creatures-and-real-kai-day.md src/features/play app/globals.css tests
git commit -m "feat: bring Kai-born creatures and the real Kai day to Wildz"
```

- [ ] **Step 7: Report verification evidence**

Report exact test/build totals, production URL and viewport, interaction path, console status, screenshots, commit hash, changed-file summary, and any remaining risk.
