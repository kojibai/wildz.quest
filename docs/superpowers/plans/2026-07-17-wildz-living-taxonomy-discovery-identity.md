# Wildz Living Taxonomy and Discovery-Sealed Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proof-safe living taxonomy in which discovery permanently seals a lovable, family-coherent, individually unique creature identity, while gameplay uses its canonical colors and the entry page moves on the exact 5.236-second Kai Pulse.

**Architecture:** Preserve generator versions 1 and 2 byte-for-byte, then add a separate version-3 discovery identity pipeline. A pure taxonomy module produces family, species, name, anatomy, palette, behavior, and an identity digest; encounter state stores that identity at discovery, and capture only wraps the stored identity in a verified portable card. Renderers project identity from the sealed card or active encounter, while a shared CSS custom property synchronizes entry-page motion.

**Tech Stack:** TypeScript 5.6, React 19, Next.js 15, Three.js 0.182, React Three Fiber 9, Node test runner, pnpm.

## Global Constraints

- Discovery permanently seals the creature's real name and complete identity.
- Every newly discovered name is one pronounceable prefix/suffix word of at most seven letters.
- A sealed creature is never renamed by later Pulses, capture, evolution, trade, import, or multiplayer activity.
- Related creatures share family silhouette, locomotion, facial, palette, naming, ecological, and emotional anchors.
- Canonical body colors must remain saturated and bounded away from white and near-white values.
- Generator versions 1 and 2, existing Vaults, and existing proof fixtures remain byte-verifiable.
- Capture references an already sealed discovery identity and cannot regenerate it.
- All motion on the entry-page background and Powered by Receiz treatment uses `--kai-pulse-duration: 5.236s`.
- `prefers-reduced-motion: reduce` produces a deliberate static entry composition.
- Do not add dependencies.

---

## File Structure

- Create `src/features/play/living-taxonomy.ts`: family grammars, species generation, individual genome, compact name generation, palette validation, emotional traits, identity validation, and digesting.
- Modify `src/features/play/encounter-state.ts`: persist a discovery-sealed identity on hit encounters and preserve it during later searches/phases.
- Modify `src/features/play/game-state.ts`: generate identity at discovery, use its real name in battle, and capture the same identity.
- Modify `src/features/play/card-variant.ts`: add version-3 trait types without changing version-1 or version-2 algorithms.
- Modify `src/features/play/portable-card.ts`: add version-3 manifest sealing and verification while retaining `sealCollectedCard` behavior for versions 1 and 2.
- Modify `src/features/play/living-card-types.ts`: admit the version-3 variant into living-card manifests.
- Modify `src/features/play/living-card-proof.ts`: verify and admit version-3 identity without routing legacy cards through it.
- Modify `src/features/play/card-kai-appearance.ts`: retain legacy palette semantics and project canonical version-3 colors.
- Modify `src/features/play/WildsWorldCanvas.tsx`: render the discovered wild and captured companions from one identity projection.
- Modify `src/features/play/WildsCreatureActor.tsx`: accept individual appearance and behavior details without regenerating identity.
- Modify `src/features/games/mortal-arena/MortalArenaScene.tsx`: use the sealed identity projection for version-3 player creatures.
- Modify `src/features/play/hearttree/HearttreeScene.tsx`: use the sealed identity projection for version-3 expedition creatures.
- Modify `app/globals.css`: synchronize entry-page geometry, aurora, halo, seal, and glint with one 5.236-second variable.
- Test with focused living-taxonomy, discovery/capture, proof compatibility, rendering, and entry-motion suites.

---

### Task 1: Restore the immutable version-1/version-2 compatibility baseline

**Files:**
- Modify: `src/features/play/kai-creature-birth.ts`
- Modify: `src/features/play/card-kai-appearance.ts`
- Modify: `src/features/games/mortal-arena/MortalArenaScene.tsx`
- Modify: `src/features/play/hearttree/HearttreeScene.tsx`
- Modify: `tests/wildz-kai-creature-birth.test.ts`
- Remove: `tests/wildz-creature-gameplay-palette.test.ts`
- Test: `tests/wildz-kai-card-proof.test.ts`
- Test: `tests/wildz-legacy-kai-appearance.test.ts`
- Test: `tests/wildz-full-vault-regression.test.ts`

**Interfaces:**
- Consumes: existing `deriveKaiCreatureBirth`, `projectCardKaiAppearance`, and `sealCollectedCard` version-1/version-2 contracts.
- Produces: a green immutable legacy baseline on which version 3 can be added without changing old bytes.

- [ ] **Step 1: Run the compatibility failures before changing production code**

Run:

```bash
pnpm test
```

Expected: FAIL only in the currently exposed compatibility paths, including `wildz_restore_card_proof_invalid` and the two legacy appearance palette assertions.

- [ ] **Step 2: Restore the exact version-2 birth naming algorithm**

Restore the original Ark-name table and name derivation in `kai-creature-birth.ts`:

```ts
const ARK_NAMES: Record<KaiArkName, readonly string[]> = {
  Ignite: ["Emberroot", "Dawnward", "Firstflame"],
  Integrate: ["Flowheart", "Twinweave", "Riverbond"],
  Harmonize: ["Songbloom", "Kindredwave", "Heartvoice"],
  Reflekt: ["Mirrorgaze", "Stillspiral", "Crystalecho"],
  Purify: ["Truthcrown", "Brighttorus", "Shimmerwill"],
  Dream: ["Starremember", "Moonmerkaba", "Opaldream"]
};

const arkNames = ARK_NAMES[input.moment.ark];
const epithet = arkNames[(input.moment.sides + Math.floor(unit(input.seed, 8) * arkNames.length)) % arkNames.length]!;
const personal = generatedWord(input.seed, [6, 14, 30]);
const given = `${personal}${speciesForms[0]}`;
```

Return `name: { given, epithet, display: `${given} ${epithet}` }` exactly as version 2 did before this task.

- [ ] **Step 3: Restore legacy appearance palette behavior**

In `card-kai-appearance.ts`, restore:

```ts
const livingPalette = isLivingCardAsset(asset) ? currentLivingGenome(asset).palette : null;
const palette = {
  primary: livingPalette?.primary ?? variant.traits.palette.primary,
  accent: livingPalette?.accent ?? variant.traits.palette.accent,
  glow: livingPalette?.glow ?? variant.traits.palette.glow
};
```

Restore direct legacy palette use in Mortal Arena and Hearttree until Task 6 introduces a version-aware appearance projection.

- [ ] **Step 4: Restore legacy tests and remove the temporary cross-version expectation**

Restore the original version-2 naming assertion:

```ts
assert.match(first.name.display, /[A-Za-z]{8,}/);
```

Remove the temporary compact-name and canonical-palette tests that target version 2. Version-3 equivalents are added in later tasks.

- [ ] **Step 5: Verify the legacy baseline**

Run:

```bash
pnpm test
```

Expected: all 847 existing tests PASS with zero proof or palette compatibility failures.

- [ ] **Step 6: Commit the compatibility restoration**

```bash
git add src/features/play/kai-creature-birth.ts src/features/play/card-kai-appearance.ts src/features/games/mortal-arena/MortalArenaScene.tsx src/features/play/hearttree/HearttreeScene.tsx tests/wildz-kai-creature-birth.test.ts tests/wildz-creature-gameplay-palette.test.ts
git commit -m "fix: preserve legacy creature identity proofs"
```

---

### Task 2: Add pure family, species, and individual identity generation

**Files:**
- Create: `src/features/play/living-taxonomy.ts`
- Create: `tests/wildz-living-taxonomy.test.ts`

**Interfaces:**
- Consumes: `CreatureForm`, `KaiKlokMoment`, `canonicalPortableCardJson`, and `sha256PortableBasis`.
- Produces:
  - `LivingCreatureIdentityV3`
  - `LivingCreatureDiscoveryBasis`
  - `discoverLivingCreature(basis, occupiedNames?): LivingCreatureIdentityV3`
  - `validateLivingCreatureIdentity(identity): { ok: boolean; errors: string[] }`
  - `livingCreatureIdentityDigest(identity): string`

- [ ] **Step 1: Write failing taxonomy tests**

Create `tests/wildz-living-taxonomy.test.ts` with real corpus checks:

```ts
test("living taxonomy creates compact unique family-coherent creatures", () => {
  const identities = Array.from({ length: 2_048 }, (_, index) => discoverLivingCreature({
    encounterId: `encounter:${index}`,
    form: creatureForms[index % creatureForms.length]!,
    discoveredAt: new Date(Date.UTC(2026, 6, 17, 12, 0, index)).toISOString(),
    location: { x: index * 0.125, z: index * -0.25 },
    ownerScope: "receiz:taxonomy-corpus",
    moment: deriveKaiKlokMoment({ occurredAt: new Date(Date.UTC(2026, 6, 17, 12, 0, index)).toISOString(), authority: "world" })
  }));
  assert.equal(new Set(identities.map((identity) => identity.name.display)).size, identities.length);
  assert.equal(new Set(identities.map((identity) => identity.identityDigest)).size, identities.length);
  for (const identity of identities) {
    assert.match(identity.name.display, /^[A-Z][a-z]{1,6}$/);
    assert.equal(identity.name.display, `${identity.name.prefix}${identity.name.suffix}`);
    assert.equal(validateLivingCreatureIdentity(identity).ok, true);
    assert.ok(identity.palette.primary.lightness <= 68);
    assert.ok(identity.palette.primary.chroma >= 48);
  }
});
```

Add a family resemblance test comparing two members of one family against another family, an adjacent-Pulse test, a deterministic collision-lane test with `occupiedNames`, and an emotional-trait completeness test.

- [ ] **Step 2: Run the taxonomy test to verify it fails**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-living-taxonomy.test.js
```

Expected: FAIL because `living-taxonomy.ts` and its exports do not exist.

- [ ] **Step 3: Define the version-3 identity types and authored family grammars**

Implement these public shapes:

```ts
export type LivingCreatureIdentityV3 = {
  version: 3;
  encounterId: string;
  discoveredAt: string;
  discovery: { location: { x: number; z: number }; kaiPulse: number; ark: KaiArkName; geometry: string; ownerScope: string };
  family: { id: string; name: string; emotionalPromise: string; silhouette: string; locomotion: string; namingDialect: string };
  species: { id: string; name: string; branch: string; ecology: string; forms: readonly [string, string, string] };
  name: { given: string; epithet: string; display: string; collisionLane: number };
  anatomy: { body: CreatureRenderRecipe["body"]; detail: CreatureRenderRecipe["detail"]; surface: "fur" | "feather" | "scale" | "shell" | "energy"; head: number; torso: number; limb: number; asymmetry: number };
  palette: { primary: ColorTrait; secondary: ColorTrait; accent: ColorTrait; glow: ColorTrait; eye: ColorTrait };
  markings: { topology: string; placement: string; density: number; motif: string };
  personality: { temperament: string; contrast: string; favoriteActivity: string; comfortBehavior: string; curiosity: string; socialPreference: string; vulnerability: string };
  motion: { idleHabit: string; bondingGesture: string; cadenceMs: number; discovery: string; danger: string; rest: string; victory: string; injury: string; reunion: string };
  visualFingerprint: string;
  identityDigest: string;
};

export type ColorTrait = { css: string; hue: number; chroma: number; lightness: number };
```

Create six element-root family grammar groups with compatible body/detail/surface sets, emotional promises, naming onsets, habitats, behaviors, and bounded color ranges. Use the existing 250 catalog families as stable family IDs and the grammars as inheritance rules.

- [ ] **Step 4: Implement deterministic species, compact naming, palette, and emotional generation**

Use `sha256PortableBasis(canonicalPortableCardJson(basis))` as the seed. Generate names from family phoneme onsets and pronounceable consonant-vowel syllables. Check the normalized full name against `occupiedNames`; advance collision lanes from 0 through 63. Throw `wilds_discovery_name_exhausted` after lane 63.

Generate HSL colors with these exact body bounds:

```ts
const primary = colorTrait(hue, 62 + unit(seed, 12) * 22, 38 + unit(seed, 20) * 24);
const secondary = colorTrait((hue + 22 + unit(seed, 28) * 54) % 360, 54 + unit(seed, 36) * 30, 34 + unit(seed, 44) * 28);
```

Reject any primary with chroma below 48 or lightness above 68. Derive the complete emotional and motion fields from bounded authored vocabularies, and calculate `identityDigest` from the identity without its digest field.

- [ ] **Step 5: Run focused taxonomy tests**

Run the three commands from Step 2 again.

Expected: all living-taxonomy corpus, family resemblance, collision, Pulse, palette, and emotion tests PASS.

- [ ] **Step 6: Commit the taxonomy generator**

```bash
git add src/features/play/living-taxonomy.ts tests/wildz-living-taxonomy.test.ts
git commit -m "feat: add living creature taxonomy"
```

---

### Task 3: Seal identity at discovery and preserve it through encounter state

**Files:**
- Modify: `src/features/play/encounter-state.ts`
- Modify: `src/features/play/game-state.ts`
- Create: `tests/wildz-discovery-identity.test.ts`
- Modify: `tests/play-game-state.test.ts`

**Interfaces:**
- Consumes: `discoverLivingCreature`, `LivingCreatureIdentityV3`, `livingCreatureIdentityDigest`.
- Produces: `ActiveEncounterState.discoveryIdentity?: LivingCreatureIdentityV3` and a discovery-to-battle identity path.

- [ ] **Step 1: Write failing discovery persistence tests**

Add tests proving that a hit search contains a valid identity immediately, a later Pulse/search for the same hotspot preserves it byte-for-byte, battle uses its real name, and capture phases do not modify it:

```ts
assert.equal(first.encounter.phase, "battle_intro");
assert.ok(first.encounter.phase !== "idle" && first.encounter.discoveryIdentity);
const sealedAtDiscovery = canonicalPortableCardJson(first.encounter.discoveryIdentity);
const repeated = applyWildsInput(first, { type: "search-point", x, z, searchedAt: laterPulse, ownerReceizId });
assert.equal(canonicalPortableCardJson(repeated.encounter.phase === "idle" ? null : repeated.encounter.discoveryIdentity), sealedAtDiscovery);
```

- [ ] **Step 2: Run the discovery test to verify it fails**

Compile and run `wildz-discovery-identity.test.js` with the same focused test commands used in Task 2.

Expected: FAIL because encounter state has no `discoveryIdentity`.

- [ ] **Step 3: Extend encounter state and preserve identity**

Add:

```ts
discoveryIdentity?: LivingCreatureIdentityV3;
```

When `search-point` returns a hit, preserve `state.encounter.discoveryIdentity` only when its `encounterId` equals the hit hotspot ID. Otherwise call `discoverLivingCreature` with the hit form, hotspot ID, searched time, clamped location, owner scope, and world-authority Kai moment.

Pass the identity into `encounterFromSearch`; make that function copy it into the hit state and preserve it on subsequent states for the same hotspot.

- [ ] **Step 4: Use the discovered identity in battle copy**

Replace wild display-name sourcing with:

```ts
const wildName = state.encounter.discoveryIdentity?.name.display ?? wild.name;
```

Use `wildName` in `startWildBattle` and the emergence event. Do not mutate the identity when the encounter advances.

- [ ] **Step 5: Run discovery and existing game-state tests**

Expected: the new discovery tests and all `play-game-state` encounter tests PASS.

- [ ] **Step 6: Commit discovery-time sealing**

```bash
git add src/features/play/encounter-state.ts src/features/play/game-state.ts tests/wildz-discovery-identity.test.ts tests/play-game-state.test.ts
git commit -m "feat: seal creature identity at discovery"
```

---

### Task 4: Add proof-safe version-3 portable cards and capture by identity reference

**Files:**
- Modify: `src/features/play/card-variant.ts`
- Modify: `src/features/play/portable-card.ts`
- Modify: `src/features/play/living-card-types.ts`
- Modify: `src/features/play/living-card-proof.ts`
- Modify: `src/features/play/game-state.ts`
- Create: `tests/wildz-discovery-card-proof.test.ts`
- Modify: `tests/wildz-kai-card-proof.test.ts`

**Interfaces:**
- Consumes: `LivingCreatureIdentityV3` stored on encounter state.
- Produces:
  - `CardVariantTraitsV3`
  - version-3 `PortableCardVariant`
  - `sealDiscoveredCard(input): LegacyPortableCardAsset`
  - version-aware `verifyPortableCard` and `verifyLivingCard` behavior.

- [ ] **Step 1: Write failing proof and capture-integrity tests**

Cover exact identity preservation, rejection of a changed name/color/digest, missing discovery identity, legacy fixtures, and later-Pulse stability:

```ts
const card = sealDiscoveredCard({ identity, ownerReceizId, capturedAt, battleTranscriptDigest: "sha256:none" });
assert.equal(card.manifest.name, identity.name.display);
assert.equal(card.manifest.species, identity.species.name);
assert.deepEqual(card.manifest.variant.traits.discoveryIdentity, identity);
assert.equal(verifyPortableCard(card).ok, true);
```

- [ ] **Step 2: Run the proof test to verify it fails**

Expected: FAIL because version 3 and `sealDiscoveredCard` do not exist.

- [ ] **Step 3: Add version-3 variant types without widening old algorithms**

Define:

```ts
export type CardVariantTraitsV3 = {
  discoveryIdentity: LivingCreatureIdentityV3;
  palette: { primary: string; accent: string; glow: string };
  visualFingerprint: string;
};
```

Add a third discriminated-union member with `generatorVersion: 3`. Keep `variantSeedFor` restricted to versions 1 and 2; version 3 uses the stored `identityDigest` as its seed and never calls `deriveKaiCreatureBirth`.

- [ ] **Step 4: Implement `sealDiscoveredCard`**

Validate the identity first, require a non-empty owner and valid capture timestamp, set `encounterId` from the identity, set `name` and `species` from identity, and store the complete identity in traits. Calculate the asset ID, traits digest, manifest digest, and proof with existing canonical helpers.

- [ ] **Step 5: Verify version 3 from stored discovery facts**

In `verifyPortableCard`, branch on version 3 and require:

```ts
validateLivingCreatureIdentity(identity).ok
identity.identityDigest === livingCreatureIdentityDigest(identity)
manifest.encounterId === identity.encounterId
manifest.name === identity.name.display
manifest.species === identity.species.name
manifest.variant.seed === identity.identityDigest
manifest.variant.traits.visualFingerprint === identity.visualFingerprint
```

Verify traits and manifest digests as usual. Never re-run discovery generation during verification.

Extend living-card admission and verification with the same discriminated version-3 path.

- [ ] **Step 6: Capture only the stored identity**

In the `advance-encounter` capsule branch, require `encounter.discoveryIdentity` and call `sealDiscoveredCard`. If missing or invalid, return to `emerging` with the existing fail-closed event. Keep starter and legacy helpers on their existing generator versions.

- [ ] **Step 7: Run proof, game-state, and full legacy tests**

Run focused tests, followed by `pnpm test`.

Expected: version-3 discovery proofs PASS and all legacy Vault/proof fixtures remain green.

- [ ] **Step 8: Commit proof-safe capture**

```bash
git add src/features/play/card-variant.ts src/features/play/portable-card.ts src/features/play/living-card-types.ts src/features/play/living-card-proof.ts src/features/play/game-state.ts tests/wildz-discovery-card-proof.test.ts tests/wildz-kai-card-proof.test.ts
git commit -m "feat: capture discovery-sealed creatures"
```

---

### Task 5: Render canonical identity colors and embodied motion everywhere

**Files:**
- Modify: `src/features/play/card-kai-appearance.ts`
- Modify: `src/features/play/WildsCreatureActor.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/games/mortal-arena/MortalArenaScene.tsx`
- Modify: `src/features/play/hearttree/HearttreeScene.tsx`
- Modify: `src/features/play/WildsCreatureThumbnail.tsx`
- Create: `tests/wildz-creature-identity-rendering.test.ts`
- Modify: `tests/wildz-legacy-kai-appearance.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: version-3 discovery identity stored on cards and active encounters.
- Produces: `projectCreatureAppearance(asset)` and optional `identity` input on `WildsCreatureActor`.

- [ ] **Step 1: Write failing version-aware rendering tests**

Assert that versions 1 and 2 retain their original palette behavior, while version 3 projects exact identity colors and motion. Assert that world, Hearttree, Mortal Arena, and thumbnails use the shared projection rather than `variant.traits.palette` directly.

- [ ] **Step 2: Run rendering tests to verify they fail**

Expected: FAIL because version-3 appearance projection is absent and gameplay surfaces still read variant palettes independently.

- [ ] **Step 3: Add the shared version-aware projection**

Return:

```ts
type CreatureAppearance = {
  palette: { primary: string; secondary: string; accent: string; glow: string; eye: string };
  morphology: { head: number; torso: number; limb: number; asymmetry: number };
  motion: { cadenceMs: number; idleHabit: string; bondingGesture: string };
  identityToken: string;
};
```

For version 3, populate it from `discoveryIdentity`. For versions 1 and 2, delegate to the existing `projectCardKaiAppearance` behavior exactly.

- [ ] **Step 4: Make the actor express stored identity**

Add optional secondary, eye, asymmetry, idle-habit, and bonding-gesture props. Use identity fields to influence existing head, limb, aura, and body animation amplitudes without adding new render loops or unbounded geometry. Keep all base colors on `MeshStandardMaterial` and use glow only for authored emissive details.

- [ ] **Step 5: Route every gameplay surface through the projection**

Use shared appearance projection for captured creatures in the world, Hearttree, Mortal Arena, and thumbnails. For the active wild encounter, use `encounter.discoveryIdentity` directly before capture. Remove version-3 body-color fallbacks that can produce white, but retain legacy semantics for old cards.

- [ ] **Step 6: Run rendering, legacy appearance, and full tests**

Expected: all rendering tests PASS; legacy appearance remains byte- and palette-compatible.

- [ ] **Step 7: Commit canonical identity rendering**

```bash
git add src/features/play/card-kai-appearance.ts src/features/play/WildsCreatureActor.tsx src/features/play/WildsWorldCanvas.tsx src/features/games/mortal-arena/MortalArenaScene.tsx src/features/play/hearttree/HearttreeScene.tsx src/features/play/WildsCreatureThumbnail.tsx tests/wildz-creature-identity-rendering.test.ts tests/wildz-legacy-kai-appearance.test.ts tests/wilds-render-contract.test.ts
git commit -m "feat: render embodied creature identities"
```

---

### Task 6: Synchronize entry-page motion to the 5.236-second Pulse

**Files:**
- Modify: `app/globals.css`
- Create: `tests/wildz-genesis-pulse-motion.test.ts`
- Test: `tests/wildz-genesis-copy.test.ts`

**Interfaces:**
- Consumes: existing `.wildz-genesis` pseudo-elements, brand halo, and `.wildz-genesis-powered` animation hooks.
- Produces: one `--kai-pulse-duration: 5.236s` timing source.

- [ ] **Step 1: Write the failing CSS contract test**

```ts
test("Genesis background and Powered by motion share the exact Kai Pulse", async () => {
  const css = await readFile("app/globals.css", "utf8");
  assert.match(css, /\.wildz-genesis\s*\{[^}]*--kai-pulse-duration:\s*5\.236s/s);
  for (const selector of ["wildz-genesis::before", "wildz-genesis::after", "wildz-genesis-brand::before", "wildz-genesis-powered", "wildz-genesis-powered::after"]) {
    assert.match(css, new RegExp(`\\.${selector.replaceAll("::", "::")}\\s*\\{[^}]*animation:[^;}]*var\\(--kai-pulse-duration\\)`, "s"));
  }
  assert.match(css, /prefers-reduced-motion:[\s\S]*\.wildz-genesis-powered::after[\s\S]*animation:\s*none/);
});
```

- [ ] **Step 2: Run the CSS contract test to verify it fails**

Expected: FAIL because current durations are 9s, 10s, 11s, 16s, and 18s.

- [ ] **Step 3: Add one shared Pulse duration**

Add `--kai-pulse-duration: 5.236s` to `.wildz-genesis`. Replace each entry animation duration with `var(--kai-pulse-duration)`. Use negative animation delays and alternate direction to preserve layered motion while keeping boundary synchronization:

```css
.wildz-genesis::before { animation: wildz-genesis-geometry var(--kai-pulse-duration) ease-in-out infinite; }
.wildz-genesis::after { animation: wildz-genesis-aurora var(--kai-pulse-duration) ease-in-out infinite; animation-delay: calc(var(--kai-pulse-duration) * -.25); }
.wildz-genesis-brand::before { animation: wildz-genesis-halo var(--kai-pulse-duration) ease-in-out infinite; }
.wildz-genesis-powered { animation: wildz-genesis-seal var(--kai-pulse-duration) ease-in-out infinite; }
.wildz-genesis-powered::after { animation: wildz-genesis-glint var(--kai-pulse-duration) ease-in-out infinite; }
```

Keep the existing reduced-motion block disabling every animated layer.

- [ ] **Step 4: Run Genesis tests**

Expected: Pulse-motion and existing copy/motion-safety tests PASS.

- [ ] **Step 5: Commit Pulse-synchronized entry motion**

```bash
git add app/globals.css tests/wildz-genesis-pulse-motion.test.ts
git commit -m "feat: sync Genesis motion to Kai Pulse"
```

---

### Task 7: Make every standalone card page resolve and render its verified card

**Files:**
- Create: `src/lib/receiz/wildz-public-card-resolver.ts`
- Create: `src/features/play/use-public-card-publisher.ts`
- Modify: `app/api/cards/[assetId]/route.ts`
- Modify: `app/cards/[assetId]/page.tsx`
- Modify: `src/features/play/WildsCardPage.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Create: `tests/wildz-standalone-card-rendering.test.ts`
- Modify: `tests/wildz-public-card-session.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: verified portable cards, the existing authenticated `POST /api/cards/[assetId]`, the durable public repository, and SDK public-card recovery.
- Produces:
  - `resolvePublicWildsCard(input): Promise<PublicWildsCardRecord | null>`
  - `usePublicCardPublisher(assets, connected): PublicCardPublicationState`
  - server-resolved `initialRecord` for `WildsCardPage`.

- [ ] **Step 1: Write failing standalone-page tests**

Add tests proving that a newly sealed verified card is queued for publication by the owning connected session, the server route and page use one public resolver, the server component passes an actual verified record into the card page, and the client renders `WildsCardScene` immediately from `initialRecord`:

```ts
assert.match(routePage, /const record = await resolvePublicWildsCard/);
assert.match(routePage, /<WildsCardPage assetId=\{parsed\.assetId\} initialRecord=\{record\}/);
assert.match(cardPage, /initialRecord: PublicWildsCardRecord \| null/);
assert.match(cardPage, /useState<PortableCardAsset \| null>\(initialRecord\?\.asset \?\? null\)/);
assert.match(campaign, /usePublicCardPublisher\(state\.inventory, network\.proofSessionConnected\)/);
```

Add a resolver unit test with a fake repository and SDK adapter proving durable projection wins, SDK recovery is the fallback, invalid cards are rejected, and unavailable cards return `null` rather than an invalid shaped record.

- [ ] **Step 2: Run standalone-card tests to verify they fail**

Compile the test build, patch imports, and run `wildz-standalone-card-rendering.test.js` plus `wildz-public-card-session.test.js`.

Expected: FAIL because there is no shared resolver, no publication hook, and no server-provided record.

- [ ] **Step 3: Extract a shared server-only public-card resolver**

Implement:

```ts
export async function resolvePublicWildsCard(input: {
  assetId: string;
  adapter: ReceizCommerceAdapter;
  requestOrigin: string;
}): Promise<PublicWildsCardRecord | null> {
  const repository = createReceizWildzPublicRepository({ adapter: input.adapter });
  let repositoryFailure: unknown = null;
  try {
    const { state } = await repository.load();
    const projected = state.cards[input.assetId];
    if (projected && verifyAnyWildsCard(projected).ok) {
      return createPublicWildsCardRecord(projected, input.requestOrigin, state.updatedAt);
    }
  } catch (cause) {
    repositoryFailure = cause;
  }
  const recovered = await resolveSdkPublicWildzCard(input.assetId, {
    adapter: input.adapter,
    requestOrigin: input.requestOrigin
  });
  if (recovered && verifyAnyWildsCard(recovered).ok) {
    return createPublicWildsCardRecord(recovered, input.requestOrigin, new Date().toISOString());
  }
  if (repositoryFailure) throw repositoryFailure;
  return null;
}
```

Keep this module server-only and free of browser storage access.

- [ ] **Step 4: Use the resolver in both the API and server page**

Replace duplicated GET recovery logic with `resolvePublicWildsCard`. In `app/cards/[assetId]/page.tsx`, parse the parameter, construct the anonymous adapter, resolve the record directly, and pass it to the client component. Use the resolved creature name/species in metadata when available. Do not call the app's own HTTP API from the server component.

- [ ] **Step 5: Render the initial verified card without a loading shell**

Change the client signature to:

```ts
export function WildsCardPage({ assetId, initialRecord }: {
  assetId: string;
  initialRecord: PublicWildsCardRecord | null;
})
```

Initialize `asset` from `initialRecord?.asset`. Only issue the client GET when there is no initial record, allowing recovery after a transient server failure. Replace direct `traits.potential` access with a version-aware helper so version-3 cards cannot throw during Overview rendering.

- [ ] **Step 6: Publish every verified owned card after the proof session connects**

Implement a bounded publisher hook that:

- receives the current verified inventory and an exact connected-proof-session boolean;
- sorts by asset ID;
- publishes at most one card at a time through `registerPublicWildsCard`;
- remembers successful `asset.id:proof.digest` keys for the mounted session;
- retries failures only when the proof digest or connection state changes;
- aborts state updates on unmount;
- never treats publication failure as loss of the local card.

Mount it in `PlayCampaign` using the existing proof-session connection state. This guarantees newly captured and restored cards become resolvable without requiring an export or profile-publication detour.

- [ ] **Step 7: Run route, publisher, and render tests**

Expected: the server-provided card renders immediately, compact routes redirect to the canonical page, unregistered cards are published from their owning session, and public resolution never reads private browser inventory.

- [ ] **Step 8: Commit standalone card rendering**

```bash
git add src/lib/receiz/wildz-public-card-resolver.ts src/features/play/use-public-card-publisher.ts app/api/cards/[assetId]/route.ts app/cards/[assetId]/page.tsx src/features/play/WildsCardPage.tsx src/features/play/PlayCampaign.tsx tests/wildz-standalone-card-rendering.test.ts tests/wildz-public-card-session.test.ts tests/wilds-render-contract.test.ts
git commit -m "fix: render every standalone Wildz card"
```

---

### Task 8: Complete regression, visual, and production verification

**Files:**
- Modify only files required by failures proven in this task.
- Record artifacts under: `output/playwright/`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified release evidence and no unaddressed compatibility regressions.

- [ ] **Step 1: Run static verification**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: all commands exit 0; the complete suite reports zero failures.

- [ ] **Step 2: Run the production build**

```bash
pnpm build
```

Expected: production build exits 0. If the repository runtime guard reports an active development server, do not kill it implicitly; identify the owning process and obtain user approval before stopping it, then rerun the build.

- [ ] **Step 3: Verify the browser path**

Open the active local URL, confirm the correct Wildz app, check console/page errors, and capture:

- entry page showing the synchronized background and Powered by treatment;
- an active discovered creature before capture;
- the same named creature after capture;
- desktop and mobile gameplay views.

Expected: no console/page errors, nonblank canvas with color variance, canonical creature color remains saturated, and the discovery/capture name is identical.

- [ ] **Step 4: Inspect runtime diagnostics and interaction**

Confirm canvas CSS/drawing-buffer sizes, renderer diagnostics, discovery interaction, battle transition, capture, and identity persistence across a later Pulse. Confirm reduced-motion disables entry animation.

- [ ] **Step 5: Review final diff and proof boundaries**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors, no generated test/build artifacts staged, and no unrelated user changes included.
