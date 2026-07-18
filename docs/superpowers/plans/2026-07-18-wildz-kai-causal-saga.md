# Wildz Kai Causal Saga Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared Kai-Klok-directed living saga in which daily chapters always advance, verified actions create permanent consequences, players receive real progression, deterministic NPC trainers keep the world populated, and tournaments always resolve.

**Architecture:** Add a pure authored-story layer that projects nested saga identifiers and daily content from `KaiKlokMoment`, then fold its admitted consequences into the existing append-only `WildsWorldEvent` ledger and `WildsWorldProjection`. Mission, achievement, trainer, and tournament modules remain pure projectors; `WildsWorldService` is the admission boundary, and React only displays admitted or explicitly pending projections.

**Tech Stack:** TypeScript 5.6, React 19, Next.js 15 App Router, Three.js / React Three Fiber, Node test runner, Receiz SDK 108.0.0, existing Wildz V3 world records.

## Global Constraints

- Target only Receiz `108.0.0` and registry digest `126ca9283fee4ef4c398dbcb958e861cbea191724fdab8eb08df55ff0c14bb79`.
- The canonical Kai-Klok moment is the baseline story authority.
- Verified prior events are append-only causal history and may not be rewritten or silently discarded.
- Every Kai day resolves at its canonical boundary as success, partial success, failure, or unopposed.
- Local time may animate presentation but cannot settle chapters, move canonical NPCs, grant achievements, or advance brackets.
- Personal achievements, levels, memories, and rewards are monotonic and deduplicated by deterministic identity.
- Seeded NPCs are always identified as NPCs and never impersonate live users.
- Echo missions can grant personal progression but cannot mutate settled world history.
- Existing exploration, cards, battles, ecology, raids, teams, market, world sites, and Kai visual expression remain available.
- Remove `Brandable reward card`, `brandable merchant reward card`, merchant coupon, and customizable business-use copy from the gameplay mission path.
- Do not add a new runtime dependency.

## File structure

### New gameplay modules

- `src/features/play/wilds-saga-types.ts` — shared immutable story, mission, achievement, trainer, tournament, and projection contracts.
- `src/features/play/wilds-saga-content.ts` — versioned authored framework and the first complete six-day weekly arc.
- `src/features/play/wilds-saga-director.ts` — pure Kai geometry and causal-history story projection.
- `src/features/play/wilds-saga-missions.ts` — mission graph availability and gameplay-verb contribution evaluation.
- `src/features/play/wilds-saga-achievements.ts` — deterministic progress and append-only grant candidates.
- `src/features/play/wilds-saga-trainers.ts` — deterministic NPC identities, placement, tiers, rosters, and rematch evolution.
- `src/features/play/wilds-saga-tournament.ts` — qualification, NPC backfill, bracket projection, deadlines, and settlement.
- `src/features/play/WildsSagaPanel.tsx` — current chapter, next objective, progress, causal recap, achievements, and tournament UI.
- `src/features/play/living-card-dossier.ts` — semantic Birth Pulse interpretation from canonical Kai teachings.
- `src/features/play/WildsCardBack.tsx` — `☤ KAI` symbol and interpreted birth geometry presentation.

### Existing files to extend

- `src/features/play/wilds-world-event.ts` — story event kinds and validation.
- `src/features/play/wilds-world-state.ts` — causal story, player, trainer, and tournament projections plus reducers.
- `src/features/play/wilds-world-service.ts` — story commands, Kai-aligned tick settlement, and event admission.
- `src/features/play/wilds-world-authority.ts` — verified-card requirements for story battle/contribution commands.
- `src/features/play/use-wilds-world.ts` — client story command helpers.
- `src/features/play/WildsLivingWorldHud.tsx` — compact live chapter and nearest story encounter status.
- `src/features/play/PlayCampaign.tsx` — consume the saga projection instead of placeholder `missionCards`.
- `src/features/play/game-state.ts` — remove merchant placeholder definitions and completion copy.
- `app/globals.css` — responsive saga panel, achievement, causal history, trainer, and tournament states.

### Tests

- `tests/wilds-saga-content.test.ts`
- `tests/wilds-saga-director.test.ts`
- `tests/wilds-saga-world-state.test.ts`
- `tests/wilds-saga-missions.test.ts`
- `tests/wilds-saga-achievements.test.ts`
- `tests/wilds-saga-trainers.test.ts`
- `tests/wilds-saga-tournament.test.ts`
- `tests/wilds-saga-world-service.test.ts`
- `tests/wilds-saga-ui.test.ts`
- Existing world, arena, progression, narrative, game-state, and render-contract tests remain regression coverage.

---

### Task 1: Versioned saga contracts and first authored weekly arc

**Files:**
- Create: `src/features/play/wilds-saga-types.ts`
- Create: `src/features/play/wilds-saga-content.ts`
- Create: `tests/wilds-saga-content.test.ts`

**Interfaces:**
- Consumes: `KaiArkName`, `KaiChakra`, `KaiWeekName`, `KaiMonthName`, and `Vec3`.
- Produces: `WILDS_SAGA_FRAMEWORK_VERSION`, `WildsSagaFramework`, `WildsDailyChapterDefinition`, `WildsMissionDefinition`, `WildsAchievementDefinition`, `WildsTrainerDefinition`, `WildsTournamentDefinition`, and `wildsSagaFramework()`.

- [ ] **Step 1: Write the failing content-contract test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WILDS_SAGA_FRAMEWORK_VERSION, wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";

describe("Wilds authored Kai saga framework", () => {
  it("ships one pinned six-day arc with complete Ark, mission, trainer, achievement, and tournament content", () => {
    const framework = wildsSagaFramework();
    assert.equal(WILDS_SAGA_FRAMEWORK_VERSION, "kai-saga.v1");
    assert.equal(framework.version, WILDS_SAGA_FRAMEWORK_VERSION);
    assert.equal(framework.dailyChapters.length, 6);
    assert.deepEqual(framework.dailyChapters.map((chapter) => chapter.dayIndex), [0, 1, 2, 3, 4, 5]);
    for (const chapter of framework.dailyChapters) {
      assert.deepEqual(Object.keys(chapter.acts), ["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"]);
      assert.ok(chapter.missions.some((mission) => mission.primary));
      assert.ok(chapter.trainers.length >= 3);
      assert.ok(chapter.achievements.length >= 1);
      assert.ok(chapter.tournament);
      assert.doesNotMatch(JSON.stringify(chapter), /brandable|merchant reward|coupon|businessUse/i);
    }
  });

  it("pins persistent characters and a recurring rival", () => {
    const framework = wildsSagaFramework();
    assert.deepEqual(framework.characters.slice(0, 3).map((character) => character.name), ["Sola Reed", "Mira Vale", "Oren Moss"]);
    assert.ok(framework.characters.some((character) => character.role === "rival"));
    assert.ok(framework.characters.some((character) => character.role === "champion"));
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `pnpm exec tsc -p tsconfig.test.json`

Expected: FAIL with `Cannot find module '../src/features/play/wilds-saga-content.js'`.

- [ ] **Step 3: Add focused immutable saga contracts**

Create `wilds-saga-types.ts` with these complete public shapes:

```ts
import type { KaiArkName, KaiChakra, KaiMonthName, KaiWeekName } from "./kai-klok-moment";
import type { Vec3 } from "./game-state";

export type WildsSagaScope = "day" | "week" | "month" | "year" | "lifetime";
export type WildsStoryOutcome = "success" | "partial" | "failure" | "unopposed";
export type WildsGameplayVerb = "travel" | "discover" | "capture" | "train" | "battle" | "ecology" | "raid" | "social" | "craft" | "tournament";
export type WildsReward = Readonly<{ id: string; kind: "title" | "technique" | "cosmetic" | "lore" | "sigil" | "reputation" | "artifact"; label: string }>;
export type WildsMissionNodeDefinition = Readonly<{ id: string; title: string; description: string; destinationId: string; acceptedVerbs: readonly WildsGameplayVerb[]; target: number; prerequisites: readonly string[] }>;
export type WildsMissionDefinition = Readonly<{ id: string; primary: boolean; title: string; giverId: string; nodes: readonly WildsMissionNodeDefinition[]; reward: WildsReward }>;
export type WildsAchievementDefinition = Readonly<{ id: string; scope: WildsSagaScope; title: string; description: string; acceptedVerbs: readonly WildsGameplayVerb[]; target: number; reward: WildsReward }>;
export type WildsTrainerTier = "teaching" | "scout" | "veteran" | "champion" | "boss";
export type WildsTrainerDefinition = Readonly<{ id: string; characterId: string | null; name: string; locationId: string; position: Vec3; tier: WildsTrainerTier; affinity: "Grove" | "Spark" | "Tide" | "Ember" | "Prism" | "Stone"; rosterSize: number; recurring: boolean }>;
export type WildsTournamentDefinition = Readonly<{ id: string; name: string; locationId: string; capacity: 8; qualificationAchievementId: string; roundArk: "Purify"; reward: WildsReward }>;
export type WildsDailyChapterDefinition = Readonly<{ id: string; dayIndex: 0 | 1 | 2 | 3 | 4 | 5; title: string; chakra: KaiChakra; gate: string; featuredRegionId: string; acts: Readonly<Record<KaiArkName, string>>; missions: readonly WildsMissionDefinition[]; achievements: readonly WildsAchievementDefinition[]; trainers: readonly WildsTrainerDefinition[]; tournament: WildsTournamentDefinition; outcomeHooks: Readonly<Record<WildsStoryOutcome, string>> }>;
export type WildsSagaCharacter = Readonly<{ id: string; name: string; role: "archivist" | "wayfinder" | "caretaker" | "rival" | "champion"; voice: string }>;
export type WildsSagaFramework = Readonly<{ version: "kai-saga.v1"; title: string; weekNames: readonly KaiWeekName[]; monthNames: readonly KaiMonthName[]; characters: readonly WildsSagaCharacter[]; dailyChapters: readonly WildsDailyChapterDefinition[] }>;
```

- [ ] **Step 4: Author the complete six-day framework**

Create `wilds-saga-content.ts` exporting `WILDS_SAGA_FRAMEWORK_VERSION = "kai-saga.v1"` and a frozen `WildsSagaFramework`. Use the six existing region/gate themes in order: Verdant Crown / Earth Gate, Ember Reach / Water Gate, Tidal Lanterns / Fire Gate, Skyglass Expanse / Air Gate, Umbral Bloom / Will Gate, and Titan Gate / Ether Gate. Each chapter must contain all six exact Ark keys, one three-node primary mission, one optional mission, at least three trainers, one qualification achievement, one game-native reward, and one eight-slot Purify tournament. Define Sola Reed, Mira Vale, Oren Moss, recurring rival Nahl Vey, and champion Ilyra Crown as persistent characters. Return the frozen constant from:

```ts
export function wildsSagaFramework(): WildsSagaFramework {
  return FRAMEWORK;
}
```

- [ ] **Step 5: Compile and run the content test**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-content.test.js`

Expected: PASS with 2 tests.

- [ ] **Step 6: Commit the authored framework**

```bash
git add src/features/play/wilds-saga-types.ts src/features/play/wilds-saga-content.ts tests/wilds-saga-content.test.ts
git commit -m "feat: author first Kai saga arc"
```

### Task 2: Pure Kai saga director and nested timeline

**Files:**
- Create: `src/features/play/wilds-saga-director.ts`
- Create: `tests/wilds-saga-director.test.ts`

**Interfaces:**
- Consumes: `KaiKlokMoment`, `WildsSagaFramework`, and settled `WildsChapterMemory[]`.
- Produces: `WildsSagaProjection`, `wildsSagaInstanceIds(moment)`, and `projectWildsSaga({ moment, framework, memories })`.

- [ ] **Step 1: Write failing deterministic projection tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveKaiKlokMoment } from "../src/features/play/kai-klok-moment.js";
import { wildsSagaFramework } from "../src/features/play/wilds-saga-content.js";
import { projectWildsSaga, wildsSagaInstanceIds } from "../src/features/play/wilds-saga-director.js";

const moment = deriveKaiKlokMoment({ occurredAt: "2026-07-16T22:00:00.000Z", authority: "world" });

describe("Kai saga director", () => {
  it("derives stable day, week, month, and year instances from geometry", () => {
    const ids = wildsSagaInstanceIds(moment);
    assert.deepEqual(ids, wildsSagaInstanceIds(moment));
    assert.match(ids.dayId, /^saga:day:Y-?\d+:M\d+:D\d+$/);
    assert.match(ids.weekId, /^saga:week:/);
    assert.match(ids.monthId, /^saga:month:/);
    assert.match(ids.yearId, /^saga:year:/);
  });

  it("uses the current Ark and prior settlement hook without changing Kai geometry", () => {
    const base = projectWildsSaga({ moment, framework: wildsSagaFramework(), memories: [] });
    const changed = projectWildsSaga({ moment, framework: wildsSagaFramework(), memories: [{ chapterId: "prior", dayId: "prior-day", outcome: "failure", hookId: "route-damaged", settledEventId: "wve:prior", settledAt: "2026-07-16T00:00:00.000Z" }] });
    assert.equal(base.act.ark, moment.ark);
    assert.equal(changed.act.ark, moment.ark);
    assert.equal(changed.momentCoordinate, base.momentCoordinate);
    assert.notDeepEqual(changed.activeConsequences, base.activeConsequences);
  });
});
```

- [ ] **Step 2: Verify the director module is missing**

Run: `pnpm exec tsc -p tsconfig.test.json`

Expected: FAIL on `wilds-saga-director.js`.

- [ ] **Step 3: Implement nested IDs and the pure projection**

Define these contracts in `wilds-saga-director.ts`:

```ts
export type WildsChapterMemory = Readonly<{ chapterId: string; dayId: string; outcome: WildsStoryOutcome; hookId: string; settledEventId: string; settledAt: string }>;
export type WildsSagaProjection = Readonly<{
  frameworkVersion: "kai-saga.v1";
  yearId: string;
  monthId: string;
  weekId: string;
  dayId: string;
  momentCoordinate: string;
  chapter: WildsDailyChapterDefinition;
  act: { ark: KaiArkName; index: number; progress: number; directive: string };
  activeConsequences: readonly WildsChapterMemory[];
  nextTransition: "beat" | "ark" | "day";
}>;
```

`wildsSagaInstanceIds` must use only `year`, `month`, `week`, `day`, and names already carried by the moment. `projectWildsSaga` selects the daily definition by the weekday's canonical zero-based index, validates that the definition chakra and gate match the moment, takes only the latest 32 settled memories, and never calls `Date.now()` or a random API.

- [ ] **Step 4: Run director tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-director.test.js`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit the director**

```bash
git add src/features/play/wilds-saga-director.ts tests/wilds-saga-director.test.ts
git commit -m "feat: project saga from Kai geometry"
```

### Task 3: Saga events and append-only world projection

**Files:**
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Create: `tests/wilds-saga-world-state.test.ts`

**Interfaces:**
- Consumes: existing `WildsWorldEvent`, `WildsSagaProjection`, and `WildsChapterMemory`.
- Produces: new event kinds, `WildsPlayerSagaState`, and saga fields on `WildsWorldProjection`.

- [ ] **Step 1: Write failing replay and divergence tests**

Add a fixture that creates these events in order: `story.chapter_opened`, `story.objective_contributed`, `story.chapter_settled`, `story.achievement_granted`. Assert replay stores the pinned active chapter, adds contribution only once, appends one memory, and adds one player achievement. Replay the same event and assert no change. Create a second achievement event with the same grant ID but a different reward and assert `wilds_story_achievement_divergent`.

Use exact payloads:

```ts
const chapter = { dayId: "saga:day:Y2:M4:D11", chapterId: "chapter:hearttree-signal", frameworkVersion: "kai-saga.v1", openedAt: "2026-07-16T00:00:00.000Z", endsAt: "2026-07-17T00:00:00.000Z" };
const contribution = { dayId: chapter.dayId, objectiveId: "objective:follow-first-light", playerId: "player:ari", verb: "travel", amount: 1 };
const memory = { chapterId: chapter.chapterId, dayId: chapter.dayId, outcome: "partial", hookId: "route-scarred", settledEventId: "wve:settlement", settledAt: "2026-07-17T00:00:00.000Z" };
const grant = { grantId: "grant:player:ari:first-light", playerId: "player:ari", definitionId: "achievement:first-light", scopeInstanceId: chapter.dayId, reward: { id: "title:first-light", kind: "title", label: "First Light" } };
```

- [ ] **Step 2: Run the new test and observe unsupported event failures**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-world-state.test.js`

Expected: FAIL because the story event kinds are invalid or unhandled.

- [ ] **Step 3: Extend event kinds and projection fields**

Add these exact event kinds to the union and validation set:

```ts
| "story.chapter_opened"
| "story.objective_contributed"
| "story.chapter_settled"
| "story.achievement_granted"
| "story.trainer_encountered"
| "story.trainer_battle_settled"
| "story.tournament_opened"
| "story.tournament_entered"
| "story.tournament_round_settled"
| "story.tournament_settled"
```

Extend `WildsWorldProjection` with `story`, `players`, `trainers`, and `tournaments`. Initialize all collections empty. Define `WildsPlayerSagaState` with `trainerXp`, `trainerLevel`, `reputation`, `contributions`, `achievementGrantIds`, and `rewardIds`. Keep projection schema V3 because the world record envelope and proof law remain V3; the additive fields are included in the checkpoint digest.

- [ ] **Step 4: Add strict saga reducers**

Add one switch case per story event family. Reject missing parents, contribution amounts outside `1..100`, divergent same-ID grants, a second settlement for a day, and tournament result changes after settlement. Remove the duplicate existing `social.abuse_reported` case while editing the switch. Every accepted story event must pass through existing `appendEvent` so revision, cursor, and recent IDs remain authoritative.

- [ ] **Step 5: Run saga and existing world replay tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-world-state.test.js .test-build/tests/wilds-world-event.test.js .test-build/tests/wilds-world-repository.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the causal projection**

```bash
git add src/features/play/wilds-world-event.ts src/features/play/wilds-world-state.ts tests/wilds-saga-world-state.test.ts
git commit -m "feat: record causal saga history"
```

### Task 4: Mission graph, player levels, achievements, recaps, and Echo missions

**Files:**
- Create: `src/features/play/wilds-saga-missions.ts`
- Create: `src/features/play/wilds-saga-achievements.ts`
- Create: `tests/wilds-saga-missions.test.ts`
- Create: `tests/wilds-saga-achievements.test.ts`

**Interfaces:**
- Consumes: active `WildsSagaProjection`, authored mission/achievement definitions, world contribution events, and `WildsPlayerSagaState`.
- Produces: `projectMissionGraph`, `evaluateMissionContribution`, `projectPlayerSagaProgress`, `achievementGrantCandidates`, and `projectSagaReturnContinuity`.

- [ ] **Step 1: Write mission graph and Echo safety tests**

Test that the first primary node is recommended, completing it unlocks only nodes whose prerequisites are satisfied, a `battle` event cannot increment a `travel`-only node, and an expired historical mission is projected as `echo: true` with `worldMutable: false`.

```ts
const graph = projectMissionGraph({ saga, playerId: "player:ari", contributions: [], currentDayId: saga.dayId });
assert.equal(graph.recommended?.definition.id, saga.chapter.missions.find((mission) => mission.primary)?.nodes[0]?.id);
assert.equal(graph.recommended?.echo, false);
assert.equal(evaluateMissionContribution({ node: graph.recommended!.definition, verb: "battle", amount: 1 }), 0);
const echo = projectMissionGraph({ saga: priorSaga, playerId: "player:ari", contributions: [], currentDayId: saga.dayId });
assert.equal(echo.nodes[0]?.echo, true);
assert.equal(echo.nodes[0]?.worldMutable, false);
```

- [ ] **Step 2: Write achievement and level tests**

Test daily grant identity, duplicate-cause convergence, weekly/monthly/yearly/lifetime scopes, XP thresholds, and recap causality:

```ts
const candidates = achievementGrantCandidates({ definitions: saga.chapter.achievements, playerId: "player:ari", scopeInstanceIds: ids, events, existingGrantIds: [] });
assert.equal(candidates.length, 1);
assert.deepEqual(candidates, achievementGrantCandidates({ definitions: saga.chapter.achievements, playerId: "player:ari", scopeInstanceIds: ids, events, existingGrantIds: [] }));
assert.match(candidates[0]!.grantId, /^grant:/);
assert.deepEqual(projectPlayerSagaProgress({ trainerXp: 250, achievements: candidates }), { trainerXp: 250, trainerLevel: 3, nextLevelAt: 300, title: "Trail Keeper" });
assert.match(projectSagaReturnContinuity({ playerName: "Ari", saga, memories }).causeSummary, /because/i);
```

- [ ] **Step 3: Confirm both modules are missing**

Run: `pnpm exec tsc -p tsconfig.test.json`

Expected: FAIL on `wilds-saga-missions.js` and `wilds-saga-achievements.js`.

- [ ] **Step 4: Implement mission evaluation**

`projectMissionGraph` returns nodes with exact states `locked | available | active | complete | expired`, current/target progress, `echo`, and `worldMutable`. `evaluateMissionContribution` returns zero unless the verb is accepted and otherwise clamps an integer amount to the remaining target. Historical Echo nodes use the same authored challenge and can emit personal contribution candidates only.

- [ ] **Step 5: Implement deterministic achievement and progression projection**

Generate each grant ID from canonical JSON of `{ playerId, definitionId, scopeInstanceId, causeEventIds }` using `sha256PortableBasis`. Sort and deduplicate cause IDs first. Use trainer levels `1 + floor(trainerXp / 100)` capped at 100 and titles Grove Scout, Trail Keeper, Wilds Ranger, Titan Challenger, and Kai Champion at levels 1, 3, 10, 25, and 50. Return recap, latest three memories, cause summary, and next hook without any generated network text.

- [ ] **Step 6: Run mission and achievement tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-missions.test.js .test-build/tests/wilds-saga-achievements.test.js`

Expected: PASS.

- [ ] **Step 7: Commit player progression**

```bash
git add src/features/play/wilds-saga-missions.ts src/features/play/wilds-saga-achievements.ts tests/wilds-saga-missions.test.ts tests/wilds-saga-achievements.test.ts
git commit -m "feat: add saga missions and achievements"
```

### Task 5: Deterministic seeded trainers and evolving rivals

**Files:**
- Create: `src/features/play/wilds-saga-trainers.ts`
- Modify: `src/features/games/mortal-arena/campaign.ts`
- Create: `tests/wilds-saga-trainers.test.ts`

**Interfaces:**
- Consumes: `WildsSagaProjection`, authored trainer definitions, `WildsPlayerSagaState`, and prior `WildsTrainerBattleMemory[]`.
- Produces: `WildsTrainerProjection`, `projectSagaTrainers`, `trainerArenaNpc`, and `projectCampaignOpponentFromTrainer`.

- [ ] **Step 1: Write failing population tests**

```ts
const first = projectSagaTrainers({ saga, playerLevel: 7, battleMemories: [] });
assert.deepEqual(first, projectSagaTrainers({ saga, playerLevel: 7, battleMemories: [] }));
assert.ok(first.length >= 3);
assert.ok(first.every((trainer) => trainer.kind === "npc"));
assert.ok(first.every((trainer) => trainer.seed >= 0 && trainer.seed <= 0xffffffff));
assert.ok(first.some((trainer) => trainer.recurring));

const rematch = projectSagaTrainers({ saga, playerLevel: 7, battleMemories: [{ trainerId: first[0]!.id, playerId: "player:ari", outcome: "player_victory", settledEventId: "wve:battle", settledAt: "2026-07-16T12:00:00.000Z" }] });
assert.equal(rematch.find((trainer) => trainer.id === first[0]!.id)?.rematchIndex, 1);
assert.notDeepEqual(rematch.find((trainer) => trainer.id === first[0]!.id)?.rosterFormIds, first[0]!.rosterFormIds);
```

- [ ] **Step 2: Verify the trainer module is missing**

Run: `pnpm exec tsc -p tsconfig.test.json`

Expected: FAIL on `wilds-saga-trainers.js`.

- [ ] **Step 3: Implement stable trainer identities and placement**

Define `WildsTrainerProjection` with `id`, `kind: "npc"`, `name`, `locationId`, `position`, `tier`, `affinity`, `seed`, `rosterFormIds`, `rematchIndex`, `recurring`, and `available`. Derive the seed from SHA-256 of `{ frameworkVersion, dayId, trainerDefinitionId, locationId, rematchIndex }`; convert the first eight digest hex characters to an unsigned 32-bit integer. Select roster forms from the existing creature catalog using affinity, authored roster size, seed, and bounded rematch index.

- [ ] **Step 4: Bridge trainers into existing arena NPC and campaign contracts**

Export:

```ts
export function trainerArenaNpc(trainer: WildsTrainerProjection) {
  return createArenaNpc({ actorId: trainer.id, tier: trainer.tier, seed: trainer.seed });
}

export function projectCampaignOpponentFromTrainer(trainer: WildsTrainerProjection): ArenaCampaignOpponent {
  return { id: trainer.id, name: trainer.name, kind: trainer.tier === "boss" ? "boss" : "rival", tier: trainer.tier, affinity: trainer.affinity, phases: trainer.tier === "boss" ? ["Opening", "Awakening", "Last Resonance"] : ["Duel"], vitalityPermille: Math.min(1850, 900 + trainer.rematchIndex * 70), powerPermille: Math.min(1600, 880 + trainer.rematchIndex * 55) };
}
```

Change `ArenaCampaignOpponent.kind` only if needed to admit a clearly labeled `trainer`; do not weaken existing rival/boss behavior or tests.

- [ ] **Step 5: Run trainer and arena regression tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-trainers.test.js .test-build/tests/mortal-arena-simulation.test.js .test-build/tests/arena-campaign.test.js`

Expected: PASS.

- [ ] **Step 6: Commit trainer population**

```bash
git add src/features/play/wilds-saga-trainers.ts src/features/games/mortal-arena/campaign.ts tests/wilds-saga-trainers.test.ts
git commit -m "feat: seed living world trainers"
```

### Task 6: Kai-aligned tournaments with NPC backfill

**Files:**
- Create: `src/features/play/wilds-saga-tournament.ts`
- Create: `tests/wilds-saga-tournament.test.ts`

**Interfaces:**
- Consumes: active saga, qualification grants, live entrants, seeded NPC trainers, admitted match results, and canonical `KaiKlokMoment`.
- Produces: `WildsTournamentProjection`, `projectSagaTournament`, `recordTournamentResult`, and `settleSagaTournament`.

- [ ] **Step 1: Write zero-, sparse-, and full-population tests**

```ts
const zero = projectSagaTournament({ saga, moment: purifyMoment, qualifiedPlayers: [], trainers, results: [] });
assert.equal(zero.entrants.length, 8);
assert.ok(zero.entrants.every((entrant) => entrant.kind === "npc"));

const sparse = projectSagaTournament({ saga, moment: purifyMoment, qualifiedPlayers: [{ id: "player:ari", seedScore: 42 }], trainers, results: [] });
assert.equal(sparse.entrants.length, 8);
assert.equal(sparse.entrants.filter((entrant) => entrant.kind === "player").length, 1);
assert.equal(new Set(sparse.entrants.map((entrant) => entrant.id)).size, 8);

const settled = settleSagaTournament({ tournament: sparse, occurredAt: dreamMomentTime });
assert.equal(settled.phase, "settled");
assert.ok(settled.championId);
assert.deepEqual(settled, settleSagaTournament({ tournament: sparse, occurredAt: dreamMomentTime }));
```

- [ ] **Step 2: Verify the tournament module is missing**

Run: `pnpm exec tsc -p tsconfig.test.json`

Expected: FAIL on `wilds-saga-tournament.js`.

- [ ] **Step 3: Implement bracket identity, seeding, and deadlines**

Use exactly eight unique entrants. Sort players by descending `seedScore` then ID, cap them at eight, and fill remaining slots with the active chapter's projected trainers. If fewer than eight unique authored trainers exist, create deterministic daily challenger identities `npc:daily:<day digest>:<slot>` and label them NPCs. Produce quarterfinal, semifinal, and final match IDs from `{ tournamentInstanceId, round, slot, entrantIds }`.

- [ ] **Step 4: Implement admitted and automatic result projection**

`recordTournamentResult` accepts one winner already present in the match and rejects divergent duplicate match results. `settleSagaTournament` deterministically resolves unfinished NPC or forfeited matches from entrant seed and match ID, advances winners, and always produces a champion after the Dream boundary. It cannot settle before Purify and cannot change after settlement.

- [ ] **Step 5: Run tournament tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-tournament.test.js`

Expected: PASS.

- [ ] **Step 6: Commit tournament director**

```bash
git add src/features/play/wilds-saga-tournament.ts tests/wilds-saga-tournament.test.ts
git commit -m "feat: add Kai daily tournaments"
```

### Task 7: Admit story commands and settle every Kai day

**Files:**
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/features/play/wilds-world-authority.ts`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Modify: `src/lib/receiz/wilds-world-repository.ts`
- Create: `tests/wilds-saga-world-service.test.ts`

**Interfaces:**
- Consumes: all pure projectors from Tasks 2–6 and the existing authenticated actor/world repository boundary.
- Produces: `story.contribute`, `story.trainer_battle`, and `story.tournament_enter` commands plus automatic chapter/tournament lifecycle events from `tick()`.

- [ ] **Step 1: Write failing service lifecycle tests**

Test this exact sequence:

1. Tick in Ignite opens one daily chapter once.
2. Replaying the same tick emits no duplicate story event.
3. An admitted `story.contribute` increments an eligible objective and player trainer XP once.
4. A verified `story.trainer_battle` stores the result once.
5. Purify opens an eight-entrant tournament.
6. The first tick in the next Kai day settles the prior chapter and tournament, then opens the new day.
7. Settlement outcome is success at 100%, partial at 50–99%, failure at 1–49%, and unopposed at 0%.
8. A stale pulse and local-practice authority cannot settle the story.

Use `deriveKaiKlokMoment` fixtures to find Ignite, Purify, Dream, and next-day instants rather than hard-coding Ark assumptions.

- [ ] **Step 2: Verify commands and events are unsupported**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-world-service.test.js`

Expected: FAIL on missing command variants or lifecycle events.

- [ ] **Step 3: Add exact story command variants**

```ts
| { type: "story.contribute"; dayId: string; objectiveId: string; verb: WildsGameplayVerb; amount: number; position?: { x: number; z: number }; cardProofDigest?: string; commandId: string }
| { type: "story.trainer_battle"; dayId: string; trainerId: string; matchId: string; outcome: "player_victory" | "trainer_victory" | "fled"; cardProofDigest: string; commandId: string }
| { type: "story.tournament_enter"; tournamentId: string; qualificationGrantId: string; cardProofDigest: string; commandId: string }
```

Require verified cards for trainer battles and tournament entry. Require them for contribution only when `cardProofDigest` is present. Validate active day, mission verb, destination radius when defined, one match result, and qualification ownership.

- [ ] **Step 4: Integrate the saga lifecycle into canonical tick**

At the start of `tick`, derive the canonical moment from `occurredAt`, project the saga from settled memories, settle any prior open day before opening the current day, open the current chapter if absent, project trainers, and open/advance/settle the tournament at Ark boundaries. Preserve the existing boss/ecology tick after saga lifecycle processing. Every generated event uses the existing `append` method and deterministic `causeId` rooted in the canonical day/Ark, so retries are idempotent.

- [ ] **Step 5: Audit major story events through Receiz**

Add `story.chapter_settled`, `story.achievement_granted`, `story.trainer_battle_settled`, and `story.tournament_settled` to `MAJOR_WORLD_EVENTS`. Keep publish/recovery behavior unchanged and fail closed if a recovered record contains invalid story continuity.

- [ ] **Step 6: Run service, authority, recovery, and repository tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-world-service.test.js .test-build/tests/wilds-world-service.test.js .test-build/tests/wilds-world-card-authority.test.js .test-build/tests/wilds-world-repository.test.js .test-build/tests/wilds-world-hydration.test.js`

Expected: PASS.

- [ ] **Step 7: Commit authoritative saga admission**

```bash
git add src/features/play/wilds-world-service.ts src/features/play/wilds-world-authority.ts src/lib/receiz/wilds-world-server.ts src/lib/receiz/wilds-world-repository.ts tests/wilds-saga-world-service.test.ts
git commit -m "feat: admit and settle Kai saga days"
```

### Task 8: Client commands and living saga UI

**Files:**
- Modify: `src/features/play/use-wilds-world.ts`
- Create: `src/features/play/WildsSagaPanel.tsx`
- Modify: `src/features/play/WildsLivingWorldHud.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/globals.css`
- Create: `tests/wilds-saga-ui.test.ts`

**Interfaces:**
- Consumes: admitted `WildsWorldProjection.story`, current player saga state, director projection, and client command helpers.
- Produces: `contributeStory`, `settleTrainerBattle`, `enterSagaTournament`, and responsive saga UI.

- [ ] **Step 1: Write failing render-contract tests**

Read the component sources and assert the UI contains these labels and semantics:

```ts
assert.match(panel, /Today's living chapter/);
assert.match(panel, /Next objective/);
assert.match(panel, /Why the world changed/);
assert.match(panel, /Trainer level/);
assert.match(panel, /Daily tournament/);
assert.match(panel, /Story so far/);
assert.match(panel, /aria-live="polite"/);
assert.match(panel, /worldMutable/);
assert.doesNotMatch(panel + campaign + gameState, /Brandable reward card|brandable merchant reward|Custom coupon slot|businesses can map/i);
assert.match(hud, /active chapter/i);
```

- [ ] **Step 2: Run the UI test and observe the missing component**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-ui.test.js`

Expected: FAIL because `WildsSagaPanel.tsx` does not exist.

- [ ] **Step 3: Add typed client command helpers**

Expose:

```ts
contributeStory: (input: Omit<Extract<WildsWorldCommand, { type: "story.contribute" }>, "type" | "commandId">) => post({ type: "story.contribute", ...input, commandId: commandId("command:story:contribute") }),
settleTrainerBattle: (input: Omit<Extract<WildsWorldCommand, { type: "story.trainer_battle" }>, "type" | "commandId">) => post({ type: "story.trainer_battle", ...input, commandId: commandId("command:story:trainer") }),
enterSagaTournament: (input: Omit<Extract<WildsWorldCommand, { type: "story.tournament_enter" }>, "type" | "commandId">) => post({ type: "story.tournament_enter", ...input, commandId: commandId("command:story:tournament") })
```

Continue displaying the last admitted snapshot on request failure and use the existing mode label to mark recovery/pending state.

- [ ] **Step 4: Build `WildsSagaPanel`**

Render one panel with five compact sections: live chapter/Ark and remaining progress, directed next objective and destination, player trainer/achievement progression, community consequence meter, and daily tournament status. Add collapsible story-so-far and cause history. Echo objectives must display `Echo · personal history` and disable world-mutating copy. Use only projections passed by props; the component must not derive authority from `Date.now()`.

- [ ] **Step 5: Replace the placeholder mission panel**

In `PlayCampaign.tsx`, compute the active saga from admitted world story state and current `kaiMoment`, then render `WildsSagaPanel` in the `mission` command item. Preserve map, field guide, vault, battle, social, market, and all other command items. Use the saga's recommended destination for the command-center action and map lead. Remove the old `activeMission = missionCards[...]` projection and generic mission percentage display.

- [ ] **Step 6: Add compact world HUD and responsive styling**

Show active chapter, Ark, nearest seeded trainer, tournament phase, and connected/recovery status in `WildsLivingWorldHud`. In `app/globals.css`, provide desktop and mobile styles using existing Wildz tokens, a maximum two-column detail layout, safe-area padding, readable `44px` minimum touch targets, and no horizontal overflow at 390px.

- [ ] **Step 7: Run UI and render regressions**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-ui.test.js .test-build/tests/wilds-render-contract.test.js .test-build/tests/wilds-living-world-hud.test.js .test-build/tests/wildz-command-center-director.test.js`

Expected: PASS.

- [ ] **Step 8: Commit the saga experience**

```bash
git add src/features/play/use-wilds-world.ts src/features/play/WildsSagaPanel.tsx src/features/play/WildsLivingWorldHud.tsx src/features/play/PlayCampaign.tsx app/globals.css tests/wilds-saga-ui.test.ts
git commit -m "feat: surface the living Kai saga"
```

### Task 9: Remove legacy merchant mission rewards and migrate local progression

**Files:**
- Modify: `src/features/play/game-state.ts`
- Modify: `tests/play-game-state.test.ts`
- Modify: `tests/wildz-social-deck.test.ts`

**Interfaces:**
- Consumes: existing `PlayState` and saga-derived game-native reward identifiers.
- Produces: legacy-safe local state without merchant mission definitions or reward copy.

- [ ] **Step 1: Replace the legacy reward test with game-native expectations**

Replace the test named `turns mission completion into a portable merchant reward card` with a regression test that completes the local practice mission and asserts:

```ts
assert.match(next.lastEvent, /mission cleared/i);
assert.doesNotMatch(next.lastEvent, /brandable|merchant|coupon|business/i);
assert.equal(next.completedMissionIds.includes("daily-expedition"), true);
assert.equal(next.achievements.includes("first-light"), true);
```

Update the social-deck source assertion to reject all removed merchant reward phrases.

- [ ] **Step 2: Run the two tests and verify old copy fails**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/play-game-state.test.js .test-build/tests/wildz-social-deck.test.js`

Expected: FAIL because the old completion branch still creates `merchant-perk` and merchant copy.

- [ ] **Step 3: Remove missionCards and merchant-perk emission**

Delete exported `missionCards` and stop appending `merchant-perk` to `rewardCards`. On first local-practice completion, append the `first-light` achievement once and use `Mission cleared. First Light is now part of your story.` Keep legacy `rewardCards` readable for existing saved states, but never emit a new merchant reward. Do not delete or rewrite a user's prior saved reward objects.

- [ ] **Step 4: Run local progression and copy tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/play-game-state.test.js .test-build/tests/wildz-social-deck.test.js .test-build/tests/wilds-saga-ui.test.js`

Expected: PASS.

- [ ] **Step 5: Commit the copy and migration fix**

```bash
git add src/features/play/game-state.ts tests/play-game-state.test.ts tests/wildz-social-deck.test.ts
git commit -m "fix: replace merchant mission placeholder"
```

### Task 10: Interpret card Birth Pulses and use the Caduceus KAI symbol

**Files:**
- Modify: `src/features/play/living-card-dossier.ts`
- Modify: `src/features/play/WildsCardBack.tsx`
- Modify: `tests/wildz-kai-card-dossier.test.ts`
- Modify: `tests/wildz-command-center-ui.test.ts`

**Interfaces:**
- Consumes: the recorded card birth/capture timestamp, `deriveKaiKlokMoment`, and `deriveKaiMomentExpression` from the canonical teaching tables.
- Produces: interpreted `birth.passage`, interpreted `birth.geometry`, `birth.teachings`, and a visible `☤ KAI` label without changing the sealed proof coordinate.

- [ ] **Step 1: Write failing semantic card-back tests**

Extend the dossier tests with assertions that the visible Birth Pulse uses meaning, color, element, and geometry while avoiding calendar-name substitution:

```ts
const dossier = projectLivingCardDossier(asset, "https://wildz.quest");
assert.match(dossier.birth.passage, /Root|Sacral|Solar Plexus|Heart|Throat|Crown/);
assert.match(dossier.birth.passage, /stability|flow|clarity|compassion|expression|remembrance|coherence|integration|purification/i);
assert.ok(dossier.birth.teachings.every((teaching) => teaching.color && teaching.element && teaching.geometry && teaching.meaning));
assert.doesNotMatch(dossier.birth.passage, /\b(?:Solhara|Aquaris|Flamora|Verdari|Sonari|Kaelith|Aethon|Virelai|Solari|Amarin|Kaelus|Umbriel|Noktura|Liora|Ignite|Integrate|Harmonize|Reflekt|Purify|Dream)\b/);
assert.match(cardBackSource, /<dt>☤ KAI<\/dt>/);
assert.doesNotMatch(cardBackSource, /Cadueus KAI|Caduceus KAI/);
```

Keep the existing assertion that `dossier.birth.cadueusKai` starts with `Y`; the exact canonical coordinate is proof data and must not be rewritten.

- [ ] **Step 2: Run the dossier tests and verify old calendar-copy behavior fails**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wildz-kai-card-dossier.test.js .test-build/tests/wildz-command-center-ui.test.js`

Expected: FAIL because the dossier repeats Ark/calendar labels and the card back spells `Cadueus KAI`.

- [ ] **Step 3: Project canonical teachings from the recorded birth instant**

In `projectLivingCardDossier`, derive a local-authority `KaiKlokMoment` from the immutable ISO `asset.manifest.capturedAt`, then call `deriveKaiMomentExpression`. Extend `LivingCardDossier.birth` with:

```ts
teachings: Array<Pick<KaiTeaching, "color" | "element" | "geometry" | "meaning"> & { dimension: "day" | "week" | "month" | "ark" }>;
```

Build the array in day, week, month, Ark order. These are interpretations of recorded proof time; they do not claim new world admission.

- [ ] **Step 4: Replace name-based Birth Pulse prose with meaning-based prose**

Compose the sealed and recovered passages from `expression.day.meaning`, `expression.month.meaning`, and `expression.ark.meaning`, bounded to readable sentences. Build `birth.geometry` from meaning-bearing rows:

```ts
[
  `${expression.day.color} · ${expression.day.element} · ${expression.day.geometry}`,
  `${expression.week.color} · ${expression.week.element} · ${expression.week.geometry}`,
  `${expression.month.color} · ${expression.month.element} · ${expression.month.geometry}`,
  `${expression.ark.color} · ${expression.ark.element} · ${expression.ark.geometry}`,
  `${birthProfile.geometry.sides}-sided living motif · Beat ${moment.beat} · Step ${moment.stepIndex} · Pulse ${moment.pulseInStep}`
]
```

Do not include harmonic day, week, month, or Ark names in `birth.passage`, `birth.title`, or the meaning-bearing geometry rows. Keep the coordinate in `birth.pulse` and `birth.cadueusKai` for exact verification.

- [ ] **Step 5: Use the established symbol on the card back**

Replace `<dt>Cadueus KAI</dt>` with `<dt aria-label="Caduceus KAI">☤ KAI</dt>`. Render the four teaching rows under the Birth Pulse passage so color, element, geometry, and meaning are readable. Do not replace existing correct `☤ KAI` uses in the command-center inspector.

- [ ] **Step 6: Run dossier, teaching, and UI tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wildz-kai-card-dossier.test.js .test-build/tests/wildz-kai-klok-teachings.test.js .test-build/tests/wildz-command-center-ui.test.js`

Expected: PASS.

- [ ] **Step 7: Commit card birth semantics**

```bash
git add src/features/play/living-card-dossier.ts src/features/play/WildsCardBack.tsx tests/wildz-kai-card-dossier.test.ts tests/wildz-command-center-ui.test.ts
git commit -m "fix: interpret card birth pulse geometry"
```

### Task 11: Full verification and gameplay evidence

**Files:**
- Modify only if verification exposes a defect in files already listed above.
- Create screenshots under: `output/playwright/kai-saga/`

**Interfaces:**
- Consumes: completed Tasks 1–10.
- Produces: passing repository checks and desktop/mobile evidence for the complete daily loop.

- [ ] **Step 1: Run focused saga and authority tests**

Run: `pnpm exec tsc -p tsconfig.test.json && node --test .test-build/tests/wilds-saga-*.test.js .test-build/tests/wilds-world-*.test.js .test-build/tests/arena-*.test.js`

Expected: all selected tests PASS with zero failures.

- [ ] **Step 2: Run the complete repository test suite**

Run: `pnpm test`

Expected: exit code 0 and zero failed tests.

- [ ] **Step 3: Run static and production checks**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm receiz:check`

Expected: all commands exit 0; Receiz remains exactly v108 and the registry digest remains unchanged.

- [ ] **Step 4: Start the production server**

Run: `pnpm start -p 3001`

Expected: the Next.js server reports ready on `http://127.0.0.1:3001`.

- [ ] **Step 5: Verify the desktop daily loop in a browser**

At 1440×1000, open `/world`; confirm the page has no console errors, the Three.js canvas is nonblank, the living chapter and current Ark are visible, the next objective names a destination, story NPC and NPC trainers are distinguished, the community consequence meter is readable, and the tournament panel shows qualification or bracket state. Exercise one free-exploration action and one story contribution, then capture `output/playwright/kai-saga/world-desktop.png`.

- [ ] **Step 6: Verify trainer and tournament paths**

Using deterministic test/world fixtures, start a seeded trainer battle, complete or settle its result, enter the daily tournament when qualified, and advance through NPC-backfilled resolution. Confirm the admitted snapshot shows one trainer memory and one tournament result, then capture `output/playwright/kai-saga/trainer-tournament.png`.

- [ ] **Step 7: Verify causal day rollover and return continuity**

With controlled server test fixtures, settle one day at partial success, advance to the next Kai day, and confirm the next chapter explains the inherited consequence. Reload as a returning player and confirm Story so far includes the settled memory and a `because` cause summary. Confirm an Echo mission is personal-only and capture `output/playwright/kai-saga/causal-recap.png`.

- [ ] **Step 8: Verify mobile fit**

At 390×844, repeat navigation to the saga panel and tournament status. Confirm no horizontal overflow, no clipped primary action, and minimum 44px touch targets. Capture `output/playwright/kai-saga/world-mobile.png`.

- [ ] **Step 9: Check runtime diagnostics**

Confirm no page errors, unhandled promise rejections, hydration mismatches, WebGL errors, duplicate story grants, or duplicate settlement events. Confirm the client clearly labels recovery/pending mode if the story command endpoint is made unavailable.

- [ ] **Step 10: Commit verification fixes, if any**

```bash
git add src app tests
git commit -m "test: verify Kai causal saga"
```

Skip this commit when verification required no source or test changes; screenshots remain uncommitted evidence unless the repository's existing release policy explicitly tracks them.

## Plan self-review

- **Spec coverage:** Tasks 1–2 cover geometry-authored nested time and the full daily act grammar; Tasks 3 and 7 cover append-only causal history, authority, settlement, and recovery; Task 4 covers missions, player levels, all achievement scopes, recaps, and Echo safety; Task 5 covers persistent and seeded trainers; Task 6 covers daily tournaments and sparse-population backfill; Task 8 covers direction, map/HUD projections, causality, progression, and responsive UI; Task 9 removes the reported placeholder reward; Task 10 converts card Birth Pulses from calendar labels into canonical chakra/color/math/geometry meaning and replaces the spelled Caduceus label with `☤ KAI`; Task 11 covers desktop, mobile, offline/recovery, trainer, tournament, card-back, and day-rollover verification.
- **Placeholder scan:** The plan contains no undecided implementation placeholders. Uses of “placeholder” refer only to the legacy merchant copy being removed.
- **Type consistency:** Story IDs, event kinds, command names, projection fields, grant IDs, outcome bands, and exported projector names are defined before downstream use and remain consistent across tasks.
