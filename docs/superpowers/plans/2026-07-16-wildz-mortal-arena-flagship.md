# Wildz Mortal Arena Flagship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the literal center of the Wildz map into a production-grade, original, real-time 3D mortal creature arena with live PvP, instant NPC fallback, bosses, persistent checkpoints, and emotionally resonant canonical consequences.

**Architecture:** A fixed-step pure TypeScript simulation owns competitive state while React Three Fiber renders interpolated snapshots. Existing Wildz movement and action controls emit compact input frames. Match results flow through the shared lifecycle and artifact authorities; online play validates frames and snapshots, while offline campaign play generates pending receipts for later recomputation.

**Tech Stack:** TypeScript 5.6, React 19, React Three Fiber 9, Three.js 0.182, Next.js 15 route handlers, WebSocket-compatible multiplayer layer, Web Audio director, Node test runner.

## Global Constraints

- Mortal Arena is at world coordinate `{ x: 0, z: 0 }` and is the center map landmark.
- Preserve current Wildz HUD, buttons, movement trackpad, context action, card art, and mobile safe areas.
- Arena visuals, characters, stages, rules, names, music, animation, and trade dress must remain original Wildz work.
- Every Arena match is explicitly mortal after opt-in; zero Vitality produces irreversible retirement.
- Players can swap or flee before zero; warnings are graduated, unmissable, and do not pause competitive play.
- One active creature per side in v1, with one-to-three creature rosters.
- Live human matchmaking is preferred; a legal NPC is offered immediately when no suitable player is available.
- Competitive simulation must remain light, deterministic, replayable, and independent of renderer frame rate.
- No paid survival advantage and no purchase prompt in death, ritual, grief, or memorial flows.

---

### Task 1: Make the Mortal Arena the Center Landmark

**Files:**
- Modify: `src/features/play/wilds-landmarks.ts`
- Modify: `src/features/play/wilds-biome.ts`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildsAtlasCanvas.tsx`
- Modify: `src/features/play/WildsWorldMap.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Test: `tests/wilds-world-atlas.test.ts`
- Test: `tests/wilds-biome.test.ts`

**Interfaces:**
- Produces: `MORTAL_ARENA_POSITION = { x: 0, z: 0 }`, center landmark `arena-of-echoes`, and relocated `hearttree-sanctum` at `{ x: 96, z: 144 }`.

- [ ] **Step 1: Change tests to require the Arena at the literal center**

```ts
test("the Mortal Arena is the atlas center", () => {
  assert.equal(landmarkAtPosition({ x: 0, z: 0 })?.id, "arena-of-echoes");
  assert.deepEqual(WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === "arena-of-echoes")?.position, { x: 0, z: 0 });
  assert.notDeepEqual(WILDS_FLAGSHIP_LANDMARKS.find((item) => item.id === "hearttree-sanctum")?.position, { x: 0, z: 0 });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test`
Expected: FAIL because Hearttree currently occupies `{ x: 0, z: 0 }`.

- [ ] **Step 3: Move landmark truth and center biome projection**

```ts
export const MORTAL_ARENA_POSITION = Object.freeze({ x: 0, z: 0 });
```

Set Arena radius to 12 and subtitle to `Every choice becomes history`. Relocate Hearttree without deleting its recovery function. The atlas and minimap use the existing trophy icon and gold accent, with a subtle mortal ring projected from the landmark kind; no new HUD control is added.

- [ ] **Step 4: Upgrade the center-world structure**

Rename the center environment group to `mortal-arena-world-anchor`. Use instanced stone, an open central bowl, four original split arches, animated proof-light seams, spectator silhouettes, distant banners, and low-cost atmospheric particles. Preserve collision approach space and provide low/medium/high quality branches using existing quality profile.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: atlas, biome, environment contracts, and typecheck pass.

```bash
git add src/features/play/wilds-landmarks.ts src/features/play/wilds-biome.ts src/features/play/WildsEnvironment.tsx src/features/play/WildsAtlasCanvas.tsx src/features/play/WildsWorldMap.tsx src/features/play/PlayCampaign.tsx tests/wilds-world-atlas.test.ts tests/wilds-biome.test.ts
git commit -m "feat: establish Mortal Arena at the world center"
```

### Task 2: Arena Simulation State and Fixed-Step Module

**Files:**
- Create: `src/features/games/mortal-arena/types.ts`
- Create: `src/features/games/mortal-arena/module.ts`
- Create: `src/features/games/mortal-arena/simulation.ts`
- Test: `tests/mortal-arena-simulation.test.ts`

**Interfaces:**
- Produces: `MortalArenaSetup`, `MortalArenaState`, `MortalArenaInput`, `MortalArenaResult`, and `MORTAL_ARENA_MODULE`.

- [ ] **Step 1: Write failing identical-replay tests**

```ts
test("replays the same match at any render cadence", () => {
  const at60 = replayArena(setup, frames, [16, 17]);
  const at30 = replayArena(setup, frames, [33]);
  assert.equal(at60.digest, at30.digest);
  assert.deepEqual(at60.result, at30.result);
});
```

- [ ] **Step 2: Implement authoritative state**

```ts
export type MortalArenaState = {
  tick: number; phase: "intro" | "fight" | "resolution" | "complete";
  arena: { id: string; bounds: FixedAabb; hazards: readonly ArenaHazardState[] };
  sides: readonly [ArenaSideState, ArenaSideState];
  pickups: readonly ArenaPickupState[]; rng: number; winnerSide: 0 | 1 | null;
};
```

Tick at 60Hz, sort two input frames by side and sequence, and cap v1 at 21,600 ticks. State contains only integers, booleans, stable IDs, and bounded arrays.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: simulation tests pass.

```bash
git add src/features/games/mortal-arena tests/mortal-arena-simulation.test.ts
git commit -m "feat: create Mortal Arena simulation"
```

### Task 3: Free 3D Movement, Collision, and Recovery

**Files:**
- Create: `src/features/games/mortal-arena/movement.ts`
- Create: `src/features/games/mortal-arena/arena-geometry.ts`
- Test: `tests/mortal-arena-movement.test.ts`

**Interfaces:**
- Produces: `stepArenaMovement`, `resolveArenaCollision`, `applyFallRecovery`, and three competitive geometry definitions.

- [ ] **Step 1: Write failing movement tests**

```ts
test("moves freely on both ground axes and resolves the same edge fall", () => {
  const moved = stepArenaMovement(fighter, { moveX: 1000, moveZ: -500, jump: true }, arena);
  assert.ok(moved.position.x > fighter.position.x);
  assert.ok(moved.position.z < fighter.position.z);
  assert.equal(applyFallRecovery(edgeState).vitalityLost, 120);
});
```

- [ ] **Step 2: Implement swept primitive collision**

Use capsules/circles against authored boxes, ramps, floors, and hazard volumes. Support ground acceleration, friction, jump, aerial steering, knockback, ledge grace, fall damage, and declared recovery spawn. Decorative geometry never enters this solver.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test`
Expected: movement, collision, fall, and geometry digest tests pass.

```bash
git add src/features/games/mortal-arena/movement.ts src/features/games/mortal-arena/arena-geometry.ts tests/mortal-arena-movement.test.ts
git commit -m "feat: add free 3D Arena movement"
```

### Task 4: Vitality, Break, Combat, Guard, Focus, and Abilities

**Files:**
- Create: `src/features/games/mortal-arena/combat.ts`
- Create: `src/features/games/mortal-arena/abilities.ts`
- Create: `src/features/games/mortal-arena/matchups.ts`
- Test: `tests/mortal-arena-combat.test.ts`

**Interfaces:**
- Produces: `stepArenaCombat`, `resolveArenaHit`, `projectAbility`, and `projectMatchupModifiers`.

- [ ] **Step 1: Write failing counterplay tests**

```ts
test("perfect guard restores Break and a soft counter never makes damage zero", () => {
  const guarded = resolveArenaHit(perfectGuardState, heavyHit);
  assert.ok(guarded.defender.break > perfectGuardState.defender.break);
  assert.ok(projectMatchupModifiers(disadvantaged, advantaged).damagePermille >= 650);
});
```

- [ ] **Step 2: Implement declared combat phases**

Attacks have startup, active, recovery, range, Vitality damage, Break damage, launch, cost, and tags. Guard, dodge, parry, Focus reads, two card abilities, cancels, pickups, and arena interactions submit legal actions through the same input alphabet. Clamp soft matchup multipliers to 650–1,350 permille.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: combat tests pass.

```bash
git add src/features/games/mortal-arena/combat.ts src/features/games/mortal-arena/abilities.ts src/features/games/mortal-arena/matchups.ts tests/mortal-arena-combat.test.ts
git commit -m "feat: add strategic Mortal Arena combat"
```

### Task 5: Roster Swap, Flee, Mortality, and Warnings

**Files:**
- Create: `src/features/games/mortal-arena/roster.ts`
- Create: `src/features/games/mortal-arena/mortality.ts`
- Test: `tests/mortal-arena-mortality.test.ts`

**Interfaces:**
- Produces: `beginArenaSwap`, `beginArenaFlee`, `projectMortalityWarning`, and `completeMortalResult`.

- [ ] **Step 1: Write failing boundary tests**

```ts
test("flee before zero preserves life and zero permanently proposes retirement", () => {
  assert.equal(completeMortalResult(fledAtOne).events.some((event) => event.kind === "retirement"), false);
  assert.equal(completeMortalResult(hitZero).events.filter((event) => event.kind === "retirement").length, 1);
});
```

- [ ] **Step 2: Implement roster and mortality rules**

Swap uses a cancelable vulnerable channel and admits only a living reserve. Flee uses a declared channel, concedes on completion, and preserves the active creature above zero. Warning bands are `strained` at 35%, `grave` at 15%, and `final` when the next known legal hit can reach zero. Warnings drive existing HUD color, pulse, audio, and haptic channels without visible tutorial copy during combat.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test`
Expected: roster and mortality tests pass.

```bash
git add src/features/games/mortal-arena/roster.ts src/features/games/mortal-arena/mortality.ts tests/mortal-arena-mortality.test.ts
git commit -m "feat: make Arena choices carry real consequence"
```

### Task 6: Fair NPCs and Multi-Phase Bosses

**Files:**
- Create: `src/features/games/mortal-arena/npc-controller.ts`
- Create: `src/features/games/mortal-arena/boss-controller.ts`
- Modify: `src/features/play/wilds-boss-ecology.ts`
- Test: `tests/mortal-arena-npc.test.ts`

**Interfaces:**
- Produces: `createArenaNpc`, `stepArenaNpc`, and `adaptWildsBossToArena`.

- [ ] **Step 1: Write failing fairness tests**

```ts
test("NPC output is legal, delayed, deterministic, and blind to future inputs", () => {
  const frame = stepArenaNpc(npc, publicState, seed);
  assert.ok(frame.sequence > npc.lastSequence);
  assert.equal(frame.atTick >= publicState.tick + npc.reactionTicks, true);
  assert.deepEqual(stepArenaNpc(npc, publicState, seed), frame);
});
```

- [ ] **Step 2: Implement five NPC tiers and boss phases**

Teaching rivals signal one concept; scouts use simple spacing; veterans punish repeated choices; champions combine legal tactics; bosses adapt existing eight family tells, hazards, weaknesses, and transformations into the same input/state interface. None read hidden inputs or bypass cooldowns.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: NPC and boss tests pass.

```bash
git add src/features/games/mortal-arena/npc-controller.ts src/features/games/mortal-arena/boss-controller.ts src/features/play/wilds-boss-ecology.ts tests/mortal-arena-npc.test.ts
git commit -m "feat: add fair Arena rivals and bosses"
```

### Task 7: Persistent Arena Path and Natural Learning

**Files:**
- Create: `src/features/games/mortal-arena/arena-path.ts`
- Create: `src/features/games/mortal-arena/campaign.ts`
- Test: `tests/mortal-arena-path.test.ts`

**Interfaces:**
- Produces: `WildzArenaPath`, `advanceArenaPath`, `resumeArenaPath`, `projectArenaLesson`, and `projectCampaignOpponent`.

- [ ] **Step 1: Write failing checkpoint tests**

```ts
test("resumes the next stage with prior discoveries and memorials", () => {
  const path = advanceArenaPath(basePath, verifiedStageResult);
  assert.equal(resumeArenaPath(path).stage, verifiedStageResult.stage + 1);
  assert.ok(path.history.some((entry) => entry.creatureId === fallenCreatureId));
});
```

- [ ] **Step 2: Implement escalating but winnable campaign stages**

Persist stage, checkpoint digest, unlocked opponent/arena/boss, learned techniques, matchup knowledge, story branch, rewards, retreats, deaths, and memorials. Lessons emerge through opponent behavior, safe early consequences, replay ghosts, and contextual highlights rather than modal text.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test`
Expected: campaign and checkpoint tests pass.

```bash
git add src/features/games/mortal-arena/arena-path.ts src/features/games/mortal-arena/campaign.ts tests/mortal-arena-path.test.ts
git commit -m "feat: persist the Arena Path"
```

### Task 8: Live Match Protocol, NPC Fallback, and Verification

**Files:**
- Create: `src/features/games/mortal-arena/online-protocol.ts`
- Create: `src/features/games/mortal-arena/reconciliation.ts`
- Create: `app/api/wilds/arena/match/route.ts`
- Create: `app/api/wilds/arena/result/route.ts`
- Modify: `src/features/play/multiplayer-core.ts`
- Test: `tests/mortal-arena-online.test.ts`

**Interfaces:**
- Produces: `queueMortalMatch`, `submitArenaFrames`, `reconcileArenaSnapshot`, and result verification endpoints.

- [ ] **Step 1: Write failing reconciliation tests**

```ts
test("rolls back only the bounded divergent window", () => {
  const reconciled = reconcileArenaSnapshot(local, signedSnapshot, localFrames);
  assert.ok(reconciled.replayedTicks <= 120);
  assert.equal(reconciled.state.digest, signedSnapshot.digest);
});
```

- [ ] **Step 2: Implement compact frame and snapshot protocol**

Frames bind match, side, sequence, tick, bit-packed action, movement axes, and prior digest. Server validates admission and emits snapshots every 12 ticks. Queue waits up to eight seconds for a compatible live player, then returns a declared NPC option. Final route recomputes the entire admitted trace and returns a signed receipt.

- [ ] **Step 3: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: protocol, rollback, fallback, idempotency, and verification tests pass.

```bash
git add src/features/games/mortal-arena/online-protocol.ts src/features/games/mortal-arena/reconciliation.ts app/api/wilds/arena src/features/play/multiplayer-core.ts tests/mortal-arena-online.test.ts
git commit -m "feat: connect live Mortal Arena matches"
```

### Task 9: Lightweight R3F Arena Experience and Existing Controls

**Files:**
- Create: `src/features/games/mortal-arena/MortalArenaExperience.tsx`
- Create: `src/features/games/mortal-arena/MortalArenaScene.tsx`
- Create: `src/features/games/mortal-arena/MortalArenaHud.tsx`
- Create: `src/features/games/mortal-arena/use-mortal-arena.ts`
- Modify: `src/features/play/WildsLandmarkExperience.tsx`
- Modify: `src/features/play/WildsWorldControls.tsx`
- Modify: `app/globals.css`
- Test: `tests/mortal-arena-ui.test.ts`

**Interfaces:**
- Produces: center-landmark Arena entry and UI projection over simulation snapshots.

- [ ] **Step 1: Write failing UI source contracts**

```ts
test("reuses Wildz control language for Arena actions", async () => {
  const source = await readFile("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
  for (const action of ["Strike", "Guard", "Focus", "Swap", "Flee"]) assert.match(source, new RegExp(action));
  assert.match(source, /WildzDpad/);
});
```

- [ ] **Step 2: Render interpolated snapshots**

Reuse deterministic creature shapes and modular anatomy with one active high-detail creature per side, low-detail reserves, instanced environment, pooled particles, compressed textures, and quality branches. Camera fits both fighters and the nearest immediate hazard. Renderer reads state but cannot mutate it.

- [ ] **Step 3: Bind existing mobile controls**

Trackpad emits movement axes; current action rails become Strike, Guard, Focus, two abilities, Swap, and Flee only while inside Arena. Context button confirms entry and ready states. Preserve button size, icon treatment, dock position, drawer relationship, keyboard/controller accessibility, and reduced-motion behavior.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: UI contracts and typecheck pass.

```bash
git add src/features/games/mortal-arena src/features/play/WildsLandmarkExperience.tsx src/features/play/WildsWorldControls.tsx app/globals.css tests/mortal-arena-ui.test.ts
git commit -m "feat: render the Mortal Arena flagship"
```

### Task 10: Opt-In, Burial Ritual, Sacrifice Honor, and Memorial

**Files:**
- Create: `src/features/games/mortal-arena/MortalArenaCovenant.tsx`
- Create: `src/features/games/mortal-arena/CreatureBurialRitual.tsx`
- Modify: `src/features/play/WildsCard.tsx`
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `src/features/play/WildsWorldMap.tsx`
- Test: `tests/mortal-arena-ritual.test.ts`

**Interfaces:**
- Consumes: sealed retirement record.
- Produces: explicit Arena covenant, sealed end-of-life ritual, dead Vault card projection, and Monument constellation link.

- [ ] **Step 1: Write failing safety and honor tests**

```ts
test("requires covenant and honors a winning sacrifice without commerce", async () => {
  assert.equal(canEnterMortalArena({ covenantVersion: null }), false);
  const ritual = projectBurialRitual(victoriousSacrifice);
  assert.equal(ritual.honor, "victorious-sacrifice");
  assert.equal(ritual.actions.some((action) => action.kind === "purchase"), false);
});
```

- [ ] **Step 2: Implement entry covenant**

Before the first mortal entry per covenant version, show exact zero-Vitality consequence, available flee/swap/recovery choices, roster condition, and hold-to-confirm consent. Repeat a concise confirmation when entering with a grave creature. Never surprise the player.

- [ ] **Step 3: Implement the sealed ritual**

After verified retirement, show the creature’s final card, remembered moments, scars, lineage, team outcome, and final append seal. The creature rises as original Wildz proof-light and joins the memorial constellation. A victorious sacrifice receives distinct team honor. The card remains visible but disabled in the Vault.

- [ ] **Step 4: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: covenant, ritual, dead-card, accessibility, and no-commerce tests pass.

```bash
git add src/features/games/mortal-arena/MortalArenaCovenant.tsx src/features/games/mortal-arena/CreatureBurialRitual.tsx src/features/play/WildsCard.tsx src/features/play/WildsInventory.tsx src/features/play/WildsWorldMap.tsx tests/mortal-arena-ritual.test.ts
git commit -m "feat: honor creatures lost in Mortal Arena"
```

### Task 11: Adaptive Arena Audio, Offline Play, and Production Verification

**Files:**
- Modify: `src/features/play/wilds-audio-director.ts`
- Modify: `src/features/games/mortal-arena/MortalArenaExperience.tsx`
- Modify: `public/sw.js`
- Create: `tests/mortal-arena-offline.test.ts`

**Interfaces:**
- Produces: battle escalation, critical warnings, flee/swap cues, final-hit silence, victory-sacrifice resolution, offline NPC play, and pending receipt sync.

- [ ] **Step 1: Write failing offline and audio-scene tests**

```ts
test("offline boss progress commits before displaying completion", async () => {
  const result = await finishOfflineArenaMatch(match, artifactStore);
  assert.equal(result.saved, true);
  assert.equal(result.pendingReceipt.status, "queued");
  assert.equal(projectArenaAudioScene(match).combatPhase, "resolution");
});
```

- [ ] **Step 2: Integrate adaptive score and artifact-first completion**

Arena phase, Break pressure, warning band, boss phase, team death, and result drive the audio scene. At zero, briefly clear battle layers before the ritual cue. Offline solo, NPC, boss, care, and campaign matches atomically save card/Vault history and queue a replayable receipt before rendering success.

- [ ] **Step 3: Run full verification**

Run: `node scripts/audit-wildz-audio.mjs && pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: every command passes.

Browser verification at 390x844 and 430x932 in WebKit:
- center map selects and enters Mortal Arena;
- drawer never overlaps trackpad;
- first gesture unlocks audio and district-to-Arena transition crossfades;
- one full NPC match supports movement, jump, Strike, Guard, Focus, abilities, Swap, and Flee;
- grave warnings are visible/audible/haptic and covenant is explicit;
- offline result persists across reload and later syncs;
- low-power mode maintains competitive geometry with reduced effects;
- no console error, clipped control, horizontal overflow, or eager Arena chunk on the base world.

- [ ] **Step 4: Commit the verified flagship**

```bash
git add src/features/play/wilds-audio-director.ts src/features/games/mortal-arena/MortalArenaExperience.tsx public/sw.js tests/mortal-arena-offline.test.ts
git commit -m "feat: ship Mortal Arena production loop"
```
