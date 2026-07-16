# Wildz Adaptive Audio and Creature Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a CC0-only adaptive musical world, the Receiz signature cue, complete action sound coverage, and a slim three-state creature drawer that never overlaps the movement control.

**Architecture:** Pure scene projection and selection logic feed a Web Audio director with separate music, ambience, and effects buses. A checked-in admission manifest is the only path from downloaded audio to runtime. Drawer geometry remains independent of content rendering and exposes closed, preview, and expanded snaps through color, light, dots, chevron, and haptics.

**Tech Stack:** TypeScript 5.6, React 19, Web Audio API, Next.js 15, Node test runner, CSS, PWA Cache API.

## Global Constraints

- Ship external recordings only when the exact file is CC0 or public domain and permits commercial use without attribution or future royalty.
- Preserve the existing Wildz visual design, button geometry, and control layout.
- Use the Receiz-owned `kai_turah_tone.mp3` as the signature commerce/proof cue.
- Audio must unlock from a user gesture, honor all four volume controls and mute, degrade safely, and remain playable offline after admission.
- Closed drawer content must remain fully visible, slim, and outside the D-pad footprint at every supported mobile safe area.
- Do not add a runtime audio, state, physics, or UI dependency.

---

### Task 1: Licensed Audio Admission Gate

**Files:**
- Create: `src/features/play/wilds-audio-catalog.ts`
- Create: `public/audio/wildz/catalog.json`
- Create: `scripts/audit-wildz-audio.mjs`
- Test: `tests/wilds-audio-catalog.test.ts`

**Interfaces:**
- Produces: `WildsAudioAsset`, `WILDS_AUDIO_ASSETS`, and `assertCommercialAudioCatalog(catalog): void`.
- The catalog records `id`, `kind`, `path`, `sourcePage`, `license`, `licenseUrl`, `sha256`, `loop`, and `roles`.

- [ ] **Step 1: Write the failing catalog test**

```ts
test("admits only locally stored CC0 or public-domain audio", () => {
  assert.doesNotThrow(() => assertCommercialAudioCatalog(WILDS_AUDIO_ASSETS));
  assert.ok(WILDS_AUDIO_ASSETS.every((asset) => asset.path.startsWith("/audio/wildz/")));
  assert.ok(WILDS_AUDIO_ASSETS.every((asset) => /^(CC0-1.0|Public-Domain|Receiz-Owned)$/.test(asset.license)));
  assert.ok(WILDS_AUDIO_ASSETS.every((asset) => /^[a-f0-9]{64}$/.test(asset.sha256)));
});
```

- [ ] **Step 2: Verify the test fails**

Run: `pnpm test`
Expected: FAIL because `wilds-audio-catalog.ts` does not exist.

- [ ] **Step 3: Implement the manifest validator and audit command**

```ts
export type WildsAudioAsset = {
  id: string; kind: "music" | "ambience" | "effect" | "signature";
  path: `/audio/wildz/${string}`; sourcePage: string;
  license: "CC0-1.0" | "Public-Domain" | "Receiz-Owned";
  licenseUrl: string; sha256: string; loop: boolean; roles: readonly string[];
};
export function assertCommercialAudioCatalog(items: readonly WildsAudioAsset[]) {
  for (const item of items) {
    if (!/^(CC0-1.0|Public-Domain|Receiz-Owned)$/.test(item.license)) throw new Error(`Blocked license: ${item.id}`);
    if (!/^[a-f0-9]{64}$/.test(item.sha256)) throw new Error(`Missing digest: ${item.id}`);
  }
}
```

The Node audit reads `public/audio/wildz/catalog.json`, hashes every referenced file with SHA-256, rejects missing files, non-allowlisted licenses, duplicate IDs, remote runtime URLs, and digest mismatches, then exits nonzero.

- [ ] **Step 4: Admit the first catalog**

Copy `../receiz/public/assets/chimes/kai_turah_tone.mp3` to `public/audio/wildz/signature/kai_turah_tone.mp3`. Download and audition the CC0 candidates named in the approved spec from OpenGameArt and Kenney, retain only musically and technically suitable files, normalize to mobile-ready `.mp3` or `.ogg`, compute digests, and record the exact source and CC0 deed URLs in `catalog.json`.

- [ ] **Step 5: Verify and commit**

Run: `node scripts/audit-wildz-audio.mjs && pnpm test`
Expected: catalog audit passes and all tests pass.

```bash
git add public/audio/wildz src/features/play/wilds-audio-catalog.ts scripts/audit-wildz-audio.mjs tests/wilds-audio-catalog.test.ts
git commit -m "feat: admit commercial-safe Wildz audio catalog"
```

### Task 2: Adaptive Scene Projector and Director

**Files:**
- Create: `src/features/play/wilds-audio-scene.ts`
- Create: `src/features/play/wilds-audio-director.ts`
- Test: `tests/wilds-audio-director.test.ts`

**Interfaces:**
- Produces: `projectWildsAudioScene(input): WildsAudioScene` and `selectWildsAudioProgram(scene, memory): WildsAudioProgram`.
- `WildsAudioScene` includes biome, district, landmark, weather, time, activity, threat, combat phase, vitality band, memorial state, and reduced-motion preference.

- [ ] **Step 1: Write failing deterministic transition tests**

```ts
test("the center Mortal Arena outranks district ambience during combat", () => {
  const scene = projectWildsAudioScene({ position: { x: 0, z: 0 }, landmarkId: "arena-of-echoes", districtId: null, activity: "combat", threat: 1, combatPhase: "final", vitalityBand: "critical", memorial: false, weather: "clear", time: "day", biome: "heartwood", reducedMotion: false });
  assert.equal(selectWildsAudioProgram(scene, { activeProgramId: null, enteredAt: 0, recent: [] }, 9_000).id, "mortal-arena-final");
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test`
Expected: FAIL on missing scene/director modules.

- [ ] **Step 3: Implement priority, hysteresis, and repetition control**

```ts
const PRIORITY = ["retirement", "victory-sacrifice", "combat-final", "boss", "combat", "landmark", "district", "biome"] as const;
export function selectWildsAudioProgram(scene: WildsAudioScene, memory: WildsAudioMemory, now = Date.now()): WildsAudioProgram {
  const candidates = programsFor(scene).sort((a, b) => b.priority - a.priority);
  const next = candidates.find((candidate) => !memory.recent.slice(-2).includes(candidate.id)) ?? candidates[0];
  if (memory.activeProgramId && now - memory.enteredAt < 4_000 && next.priority <= activePriority(memory)) return programById(memory.activeProgramId);
  return next;
}
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm test`
Expected: all director tests pass, including district, weather, battle escalation, retirement, and memorial de-escalation.

```bash
git add src/features/play/wilds-audio-scene.ts src/features/play/wilds-audio-director.ts tests/wilds-audio-director.test.ts
git commit -m "feat: direct adaptive Wildz score"
```

### Task 3: Buffered Web Audio Runtime

**Files:**
- Create: `src/features/play/wilds-audio-runtime.ts`
- Modify: `src/features/play/wilds-audio.ts`
- Modify: `src/features/play/use-wilds-presentation.ts`
- Test: `tests/wilds-audio-runtime.test.ts`

**Interfaces:**
- Produces: `createWildsAudioDirectorRuntime(factory, fetcher)` with `unlock`, `setSettings`, `setScene`, `play`, `preload`, and `destroy`.
- Preserves `WildsAudioCue` and `normalizeWildsAudioSettings` for callers.

- [ ] **Step 1: Write failing bus and crossfade tests**

```ts
test("crossfades programs without stopping effects", async () => {
  const runtime = createWildsAudioDirectorRuntime(fakeFactory, fakeFetch);
  await runtime.unlock();
  await runtime.setScene(arenaScene);
  runtime.play("battle-hit");
  await runtime.setScene(memorialScene);
  assert.equal(fakeContext.startedEffects, 1);
  assert.deepEqual(fakeContext.musicRamps.at(-1), { from: "mortal-arena", to: "memorial", seconds: 2.4 });
});
```

- [ ] **Step 2: Implement decoded-buffer cache and three gain buses**

```ts
export type WildsAudioDirectorRuntime = {
  unlock(): Promise<void>;
  preload(assetIds: readonly string[]): Promise<void>;
  setScene(scene: WildsAudioScene): Promise<void>;
  play(cue: WildsAudioCue): void;
  setSettings(settings: WildsAudioSettings): void;
  destroy(): Promise<void>;
};
```

Reuse oscillator voices only as a decode/network fallback. Loop music and ambience with equal-power fades, reuse decoded buffers, cap simultaneous effects, and suspend work while muted or hidden.

- [ ] **Step 3: Wire world state into the hook**

`useWildsPresentation` accepts `audioScene: WildsAudioScene`, updates it without recreating the context, preloads only the current program plus its likely transition, and plays the Receiz signature for seal, commercial settlement, and proof-finalization cues.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: all tests and typecheck pass.

```bash
git add src/features/play/wilds-audio-runtime.ts src/features/play/wilds-audio.ts src/features/play/use-wilds-presentation.ts tests/wilds-audio-runtime.test.ts
git commit -m "feat: play adaptive Wildz music and effects"
```

### Task 4: World Scene Integration and Offline Audio Cache

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `public/sw.js`
- Test: `tests/wilds-audio-integration.test.ts`

**Interfaces:**
- Consumes: `projectWildsAudioScene` and the director runtime.
- Produces: live audio changes from player position, district, landmark, ecology, boss, weather, encounter, and Arena state.

- [ ] **Step 1: Add a failing source-contract test**

```ts
test("campaign projects the complete audio scene", async () => {
  const source = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
  for (const field of ["activeLandmarkId", "activeSettlement", "weather", "activeBoss", "encounter"]) assert.match(source, new RegExp(field));
  assert.match(source, /projectWildsAudioScene/);
});
```

- [ ] **Step 2: Project and pass the scene**

Memoize a single `WildsAudioScene` from existing campaign truth. Do not create parallel gameplay state. Update the service worker to cache the manifest and admitted files on first successful request with a version derived from catalog digests.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck && node scripts/audit-wildz-audio.mjs`
Expected: all commands pass.

```bash
git add src/features/play/PlayCampaign.tsx public/sw.js tests/wilds-audio-integration.test.ts
git commit -m "feat: make Wildz locations sound alive"
```

### Task 5: Wordless Three-State Drawer Affordance

**Files:**
- Modify: `src/features/play/creature-drawer.ts`
- Modify: `src/features/play/WildzCreatureDrawer.tsx`
- Modify: `app/globals.css`
- Test: `tests/creature-drawer.test.ts`
- Test: `tests/wildz-creature-drawer-ui.test.ts`

**Interfaces:**
- Produces: `CreatureDrawerSnap = "closed" | "preview" | "expanded"`, `creatureDrawerMetrics(viewportHeight, safeBottom)`, and `drawerHapticPattern(previous, next)`.

- [ ] **Step 1: Replace four visual modes with three deliberate snaps in tests**

```ts
test("closed remains visible and every snap has deliberate separation", () => {
  const metrics = creatureDrawerMetrics(844, 34);
  assert.ok(metrics.closed >= 30);
  assert.ok(metrics.preview - metrics.closed >= 72);
  assert.ok(metrics.expanded - metrics.preview >= 140);
});
```

- [ ] **Step 2: Implement geometry and state projection**

```ts
export type CreatureDrawerSnap = "closed" | "preview" | "expanded";
export function creatureDrawerMetrics(viewportHeight: number, safeBottom = 0) {
  const usable = Math.max(520, viewportHeight - safeBottom);
  return { closed: 32, preview: Math.min(132, usable * .18), expanded: Math.min(438, usable * .52) } as const;
}
export function drawerHapticPattern(previous: CreatureDrawerSnap, next: CreatureDrawerSnap) {
  return previous === next ? [] : next === "expanded" ? [9, 28, 14] : [9];
}
```

- [ ] **Step 3: Render the combined no-copy cue**

The handle contains an active-creature color edge, three state dots with exactly one active, a directional chevron, and a one-time upward light sweep stored under `wildz:drawer-affordance-seen:v1`. Pointer drag previews height continuously; release snaps and calls `navigator.vibrate` when available. Accessible names remain for assistive technology but no visible instructional copy is added.

- [ ] **Step 4: Remove overlap**

Anchor the fully visible closed handle above the D-pad rail using normal drawer height instead of `transform: translate(50%, 50%)`. Add safe-area-aware bottom spacing, a 44px pointer hit area around the slim 24px visual capsule, and z-index ordering that never consumes or clips the handle.

- [ ] **Step 5: Verify responsive behavior and commit**

Run: `pnpm test && pnpm typecheck`
Expected: drawer logic, source contracts, and typecheck pass.

Verify in WebKit at 390x844 and 430x932: closed handle is whole, does not cover the D-pad, all three snaps are obvious, drag/tap work, and no extra deck height is introduced.

```bash
git add src/features/play/creature-drawer.ts src/features/play/WildzCreatureDrawer.tsx app/globals.css tests/creature-drawer.test.ts tests/wildz-creature-drawer-ui.test.ts
git commit -m "fix: clarify creature drawer without overlap"
```
