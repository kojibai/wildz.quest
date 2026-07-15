# Wildz V3 Player Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the complete V3 world, settlement, ecology, boss, raid, social, mastery, crafting, lineage, and narrative behavior into the accepted standalone Wildz presentation while adding the Trail Pack / Wilds Heartbeat, complete card access and ordering, canonical profile sharing, and production-grade interaction accessibility.

**Architecture:** Keep the current full-screen canvas, HUD, battle telemetry, D-pad, minimap, bottom social deck, and sheet composition as the presentation authority. Add pure selectors between the V3 kernel and React, then merge their projections into the existing components without duplicating game rules. The active leader remains `PlayState.selectedAssetId`; the continuity plan's final V8 owns the exact two-slot `PlayState.supportAssetIds` tuple, while the one card-order display preference lives in owner-scoped settings. Both card surfaces consume one immutable ordering selector, and all profile/deep-link controls reuse canonical standalone routes.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Three.js 0.182, React Three Fiber 9.6, Drei 10.7, V3 kernel selectors from the preceding plan, owner-scoped IndexedDB continuity, Node test runner, CSS.

## Global Constraints

- Complete `2026-07-15-wildz-v3-identity-authority.md`, `2026-07-15-wildz-v3-public-economy.md`, and every Phase A/Phase B task in `2026-07-15-wildz-v3-kernel-continuity.md` first.
- Work on `main`, use path-specific staging, commit each task, and do not push.
- Preserve the accepted changes in `app/globals.css`, `PlayCampaign.tsx`, `WildsBattle.tsx`, `WildsCommandDock.tsx`, `WildsCreatureThumbnail.tsx`, `WildsWorldCanvas.tsx`, `WildzSocialDeck.tsx`, and their modified contract tests. Merge surgically; never replace these files wholesale with upstream blobs.
- React components consume V3 selectors and emit existing typed game/world commands. They never create a second settlement, ecology, raid, social, mastery, crafting, lineage, narrative, progression, or ownership rule.
- The accepted visible dock has exactly six unique slots in this order: Card Vault, Field Guide, Player Profile, Social Market, Trail Pack / Wilds Heartbeat, Foraging Satchel.
- `PlayState.selectedAssetId` is the sole active-leader authority. Consume the continuity plan's persisted `PlayState.supportAssetIds: readonly [string | null, string | null]`; do not add a duplicate support field to `WildzOwnerState.settings`, another save file, a persisted leader ID, or a second progression model.
- Persist one `cardOrder` preference inside the owner state keyed by `wildzOwnerScope(identityKeyId, actorId)`. Do not add a global or unscoped localStorage preference.
- Card ordering never mutates `PlayState.inventory`, never changes `selectedAssetId`, and never changes any displayed card fact.
- Every owned card is reachable in the horizontal rail. No `slice`, hidden page cap, or import-order-derived fact is allowed.
- Card facts come from the verified manifest, catalog form, admitted ownership projection, `companionProgress`, and V3 mastery/lineage selectors.
- The market remains an embedded game sheet. Do not add `/market` navigation or a seventh dock slot.
- Public profile links are canonical `/u/[handle]`; already-published aliases remain compatible.
- No new npm dependency is required.

## File Structure

- `src/features/play/wilds-v3-presentation.ts` — pure V3-to-current-UI projection and detailed-render caps.
- `src/features/play/WildsV3ActivitySheet.tsx` — settlement/ecology/boss/raid actions inside the existing sheet language.
- `src/features/play/WildsV3WorldLayer.tsx` — bounded detailed ecology/boss presence for the shared canvas.
- `src/features/play/wilds-trail-pack.ts` — leader/support validation and V3-derived Trail Pack projection.
- `src/features/play/WildsTrailPackSheet.tsx` — party, synergy, reactions, memory, and whispers.
- `src/features/play/wilds-card-order.ts` — one immutable rarity/newest/oldest ordering contract.
- `src/features/profile/profile-sharing.ts` — canonical profile URL, Share, and Copy Link behavior.
- `src/features/shell/use-wildz-dialog.ts` — reusable focus trap, Escape, and focus restoration.

## Common Focused Test Loop

Each task starts with its named failing test, runs the exact compile/patch/test commands printed in that task, and repeats the same commands after implementation. The red run must fail for the named missing behavior; the green run must report zero failures before the task commit.

---

### Task 1: Define the V3 Presentation Projection

**Files:**
- Create: `src/features/play/wilds-v3-presentation.ts`
- Create: `tests/wilds-v3-presentation.test.ts`

**Interfaces:**
- Consumes: `PlayState`, `WildsWorldProjection`, `WildsWorldClientMode`, `settlementAtPosition`, `projectWildsCivicHistory`, `projectWildsEcologyHistory`, and `projectWildsRaidHistory`.
- Produces: `WildsDetailedWorldSelection`, `WildsV3Presentation`, `rankWildsWorldPresence`, `selectWildsDetailedWorld`, and `projectWildsV3Presentation`.

- [ ] **Step 1: Write the failing deterministic-cap test**

Create `tests/wilds-v3-presentation.test.ts` with no undeclared fixture helpers:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { projectWildsV3Presentation, rankWildsWorldPresence } from "../src/features/play/wilds-v3-presentation";

test("detailed world presence is nearest-first, ID-stable, and bounded", () => {
  const candidates = [
    { id: "ecology:c", position: { x: 8, z: 0 } },
    { id: "ecology:b", position: { x: 2, z: 0 } },
    { id: "ecology:a", position: { x: -2, z: 0 } },
    { id: "ecology:d", position: { x: 30, z: 0 } }
  ];
  assert.deepEqual(
    rankWildsWorldPresence(candidates, { x: 0, z: 0 }, 2).map((item) => item.id),
    ["ecology:a", "ecology:b"]
  );
  assert.deepEqual(candidates.map((item) => item.id), ["ecology:c", "ecology:b", "ecology:a", "ecology:d"]);
});

test("a missing world keeps local receipts but fabricates no canonical entity", () => {
  const projection = projectWildsV3Presentation({ state: initialPlayState, world: null, mode: "connecting" });
  assert.equal(projection.mode, "connecting");
  assert.deepEqual(projection.detailedWorld, { settlement: null, ecology: [], boss: null, raid: null });
  assert.deepEqual(projection.teams, []);
  assert.equal(projection.league, null);
  assert.deepEqual(projection.defeatedBossIds, []);
  assert.deepEqual(projection.recentEventIds, []);
  assert.deepEqual(projection.civic.events, initialPlayState.civicEvents);
  assert.deepEqual(projection.ecologyHistory.events, initialPlayState.ecologyEvents);
  assert.deepEqual(projection.raidHistory.events, initialPlayState.raidEvents);
});
```

- [ ] **Step 2: Run the red compile**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript reports `TS2307` because `wilds-v3-presentation.ts` does not exist.

- [ ] **Step 3: Implement the pure selection boundary**

Use the exact kernel projection types and keep distance/order logic independent of React:

```ts
import type { PlayState } from "./game-state";
import { projectWildsCivicHistory } from "./wilds-civic-history";
import { projectWildsEcologyHistory } from "./wilds-ecology-history";
import { projectWildsRaidHistory } from "./wilds-raid-history";
import { settlementAtPosition } from "./wilds-settlements";
import type {
  WildsWorldBossProjection,
  WildsWorldEcologyProjection,
  WildsLeagueProjection,
  WildsWorldProjection,
  WildsWorldRaidProjection,
  WildsWorldTeamProjection
} from "./wilds-world-state";
import type { WildsWorldClientMode } from "./use-wilds-world";

export type WildsWorldPresence = {
  id: string;
  position: { x: number; z: number };
};

export function rankWildsWorldPresence<T extends WildsWorldPresence>(
  values: readonly T[],
  player: { x: number; z: number },
  limit: number
) {
  return [...values]
    .sort((left, right) => {
      const leftDistance = (left.position.x - player.x) ** 2 + (left.position.z - player.z) ** 2;
      const rightDistance = (right.position.x - player.x) ** 2 + (right.position.z - player.z) ** 2;
      return leftDistance - rightDistance || left.id.localeCompare(right.id);
    })
    .slice(0, Math.max(0, limit));
}

export type WildsDetailedWorldSelection = {
  settlement: ReturnType<typeof settlementAtPosition>;
  ecology: readonly WildsWorldEcologyProjection[];
  boss: { projection: WildsWorldBossProjection; position: { x: number; z: number } } | null;
  raid: WildsWorldRaidProjection | null;
};

export function selectWildsDetailedWorld(input: {
  world: WildsWorldProjection | null;
  player: Pick<PlayState, "player">["player"];
}): WildsDetailedWorldSelection {
  const settlement = settlementAtPosition(input.player);
  if (!input.world) return { settlement, ecology: [], boss: null, raid: null };

  const ecology = rankWildsWorldPresence(
    Object.values(input.world.ecologySites).filter((site) => site.phase !== "historical" && site.phase !== "expired"),
    input.player,
    2
  );
  const selectedBoss = rankWildsWorldPresence(
    Object.values(input.world.bosses).flatMap((candidate) => {
      const site = input.world?.sites[candidate.siteId];
      return site && !["defeated", "memorialized", "withdrawn"].includes(candidate.phase)
        ? [{ id: candidate.id, position: site.position, candidate }]
        : [];
    }),
    input.player,
    1
  )[0] ?? null;
  const boss = selectedBoss
    ? { projection: selectedBoss.candidate, position: selectedBoss.position }
    : null;
  const raid = boss
    ? Object.values(input.world.raids)
      .filter((candidate) => candidate.bossId === boss.projection.id && candidate.phase !== "settled" && candidate.phase !== "expired")
      .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null
    : null;
  return { settlement, ecology, boss, raid };
}

export type WildsV3Presentation = {
  mode: WildsWorldClientMode;
  detailedWorld: WildsDetailedWorldSelection;
  civic: ReturnType<typeof projectWildsCivicHistory>;
  ecologyHistory: ReturnType<typeof projectWildsEcologyHistory>;
  raidHistory: ReturnType<typeof projectWildsRaidHistory>;
  teams: readonly WildsWorldTeamProjection[];
  league: WildsLeagueProjection | null;
  defeatedBossIds: readonly string[];
  recentEventIds: readonly string[];
};

export function projectWildsV3Presentation(input: {
  state: PlayState;
  world: WildsWorldProjection | null;
  mode: WildsWorldClientMode;
}): WildsV3Presentation {
  return {
    mode: input.mode,
    detailedWorld: selectWildsDetailedWorld({ world: input.world, player: input.state.player }),
    civic: projectWildsCivicHistory(input.state.civicEvents),
    ecologyHistory: projectWildsEcologyHistory(input.state.ecologyEvents),
    raidHistory: projectWildsRaidHistory(input.state.raidEvents),
    teams: input.world ? Object.values(input.world.teams).sort((left, right) => left.id.localeCompare(right.id)) : [],
    league: input.world?.league ?? null,
    defeatedBossIds: input.world ? [...input.world.defeatedBossIds] : [],
    recentEventIds: input.world ? [...input.world.recentEventIds] : []
  };
}
```

`selectWildsDetailedWorld` must:

- resolve the physical settlement with `settlementAtPosition(player)`;
- exclude ecology phases `historical` and `expired` from detailed rendering;
- select no more than two ecology projections with `rankWildsWorldPresence`;
- resolve boss positions through their V3 site projection and select no more than one non-terminal boss;
- select only the raid associated with that selected boss;
- leave all remaining sites available to atlas, field-guide, and history projections without detailed Three.js meshes.

`projectWildsV3Presentation` composes already-admitted V3 outputs. A null `world` returns the physical settlement plus empty world-entity selections and truthful client mode; it does not fabricate canonical state. The selector may format labels, cap arrays, and correlate IDs; it may not calculate contribution acceptance, mastery XP, crafting output, raid damage, civic reputation, or canonical history.

- [ ] **Step 4: Run the focused green test**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-v3-presentation.test.js
```

Expected: the test passes; candidate input order is unchanged and the deterministic cap is two.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/wilds-v3-presentation.ts tests/wilds-v3-presentation.test.ts
git commit -m "feat: define the Wildz V3 presentation boundary"
```

---

### Task 2: Merge V3 World Activity Into the Accepted UI

**Files:**
- Create: `src/features/play/WildsV3ActivitySheet.tsx`
- Create: `src/features/play/WildsV3WorldLayer.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsBattle.tsx`
- Modify: `src/features/play/WildsLandmarkExperience.tsx`
- Modify: `src/features/play/WildsCommandDock.tsx`
- Modify: `app/globals.css`
- Create: `tests/wilds-v3-ui-integration.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `useWildsWorld`, `WildsDetailedWorldSelection`, the current context-action resolver, V3 typed world commands, current landmark experiences, and current battle telemetry.
- Produces: one reachable settlement/ecology/boss/raid presentation inside the persistent game shell.

- [ ] **Step 1: Write the failing standalone integration contract**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("V3 activity extends the accepted Wildz composition", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  const activity = readFileSync("src/features/play/WildsV3ActivitySheet.tsx", "utf8");
  assert.match(campaign, /useWildsWorld/);
  assert.match(campaign, /projectWildsV3Presentation/);
  assert.match(campaign, /<WildsV3ActivitySheet/);
  assert.match(world, /<WildsV3WorldLayer/);
  for (const label of ["Settlement", "Ecology", "Boss", "Raid"]) assert.match(activity, new RegExp(label));
  assert.doesNotMatch(campaign + activity, /CommerceShell|MerchantDashboard|href=["']\/market/);
});
```

- [ ] **Step 2: Run the red focused test**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-v3-ui-integration.test.js
```

Expected: the test fails with `ENOENT` for `WildsV3ActivitySheet.tsx` because the current accepted UI has not yet created or wired the V3 activity layer.

- [ ] **Step 3: Wire the world hook and typed actions**

In `PlayCampaign`, call the exact V3 hook once with the active verified asset:

```ts
const v3World = useWildsWorld({
  enabled: Boolean(avatarStyle),
  guestId: multiplayer.guestId,
  activeCard: activeAsset ?? null
});

const v3Presentation = useMemo(
  () => projectWildsV3Presentation({
    state,
    world: v3World.snapshot,
    mode: v3World.mode
  }),
  [state, v3World.mode, v3World.snapshot]
);
```

Create `WildsV3ActivitySheet.tsx` with this exact action boundary; pass the matching methods returned by `useWildsWorld` from `PlayCampaign`:

```tsx
import type { WildsRaidIntent } from "./wilds-raid-encounter";
import type { WildsV3Presentation } from "./wilds-v3-presentation";

export function WildsV3ActivitySheet({
  presentation,
  pendingCommand,
  onDiscoverEcology,
  onContributeEcology,
  onTrackBoss,
  onEnterRaid,
  onRaidAction
}: {
  presentation: WildsV3Presentation;
  pendingCommand: string | null;
  onDiscoverEcology(siteId: string, position: { x: number; z: number }): Promise<unknown>;
  onContributeEcology(siteId: string, position: { x: number; z: number }, amount: number): Promise<unknown>;
  onTrackBoss(bossId: string, position: { x: number; z: number }): Promise<unknown>;
  onEnterRaid(bossId: string, roundId: string, position: { x: number; z: number }): Promise<unknown>;
  onRaidAction(bossId: string, roundId: string, intent: WildsRaidIntent["type"]): Promise<unknown>;
}) {
  const selection = presentation.detailedWorld;
  const disabled = Boolean(pendingCommand) || presentation.mode === "connecting" || presentation.mode === "reconnecting";
  return (
    <section aria-label="Wildz V3 activity" className="wilds-v3-activity">
      <section><h3>Settlement</h3><p>{selection.settlement?.name ?? "No settlement in range."}</p></section>
      <section>
        <h3>Ecology</h3>
        {selection.ecology.length ? selection.ecology.map((site) => (
          <article key={site.id}>
            <strong>{site.familyId}</strong><span>{site.phase}</span>
            <button disabled={disabled} onClick={() => void onDiscoverEcology(site.id, site.position)} type="button">Discover</button>
            <button disabled={disabled} onClick={() => void onContributeEcology(site.id, site.position, 1)} type="button">Contribute</button>
          </article>
        )) : <p>No detailed ecology site in range.</p>}
      </section>
      <section>
        <h3>Boss</h3>
        {selection.boss ? (
          <article>
            <strong>{selection.boss.projection.id}</strong><span>{selection.boss.projection.phase}</span>
            <button disabled={disabled} onClick={() => void onTrackBoss(selection.boss!.projection.id, selection.boss!.position)} type="button">Track</button>
          </article>
        ) : <p>No active boss in range.</p>}
      </section>
      <section>
        <h3>Raid</h3>
        {selection.boss && selection.raid ? (
          <article>
            <strong>{selection.raid.id}</strong><span>{selection.raid.phase}</span>
            <button disabled={disabled} onClick={() => void onEnterRaid(selection.boss!.projection.id, selection.raid!.id, selection.boss!.position)} type="button">Enter raid</button>
            {(["strike", "guard", "stabilize"] as const).map((intent) => (
              <button disabled={disabled} key={intent} onClick={() => void onRaidAction(selection.boss!.projection.id, selection.raid!.id, intent)} type="button">{intent}</button>
            ))}
          </article>
        ) : <p>No active raid in range.</p>}
      </section>
      <p aria-live="polite">{pendingCommand ? "Submitting world action…" : presentation.mode.replaceAll("_", " ")}</p>
    </section>
  );
}
```

Mount it in the current command-sheet content without replacing the HUD:

```tsx
<WildsV3ActivitySheet
  onContributeEcology={v3World.contributeEcology}
  onDiscoverEcology={v3World.discoverEcology}
  onEnterRaid={v3World.enterRaid}
  onRaidAction={v3World.actRaid}
  onTrackBoss={v3World.trackBoss}
  pendingCommand={v3World.pendingCommand}
  presentation={v3Presentation}
/>
```

Do not add local stand-ins when `snapshot` is null. Render `connecting`, `local_practice`, or `reconnecting` truthfully and disable canonical-only mutations.

Map the admitted features into existing surfaces:

- physical Wayfinder Hollow entry continues through `WildsLandmarkExperience`;
- nearby ecology and one boss use `WildsV3WorldLayer` inside the shared Canvas;
- ecology discovery/contribution, boss tracking, raid entry, and raid actions call the typed methods returned by `useWildsWorld`;
- recurring raid telegraphs and health extend `WildsBattle` instead of creating a second battle HUD;
- ecology/boss knowledge appears in Field Guide;
- civic receipts, crafting inventory/output, artifacts, and mastery appear in Foraging Satchel;
- team/league and public records remain Profile/Social surfaces;
- narrative memory and world whispers feed the Trail Pack task below.

- [ ] **Step 4: Implement bounded canvas presence**

`WildsV3WorldLayer` accepts exactly the selector output:

```ts
function WildsEcologyPresence({
  site,
  reducedMotion
}: {
  site: WildsWorldEcologyProjection;
  reducedMotion: boolean;
}) {
  return (
    <group
      name={`wilds-ecology-${site.id}`}
      position={[site.position.x, 0, site.position.z]}
      userData={{ familyId: site.familyId, phase: site.phase, reducedMotion }}
    >
      <mesh castShadow position={[0, 0.35, 0]} receiveShadow>
        <cylinderGeometry args={[Math.max(0.6, site.radius * 0.16), Math.max(0.9, site.radius * 0.22), 0.7, 12]} />
        <meshStandardMaterial color="#6ccf9b" emissive="#153f32" emissiveIntensity={0.55} roughness={0.78} />
      </mesh>
    </group>
  );
}

function WildsBossPresence({
  presence,
  reducedMotion
}: {
  presence: NonNullable<WildsDetailedWorldSelection["boss"]>;
  reducedMotion: boolean;
}) {
  const healthRatio = Math.max(0, Math.min(1, presence.projection.health / Math.max(1, presence.projection.maxHealth)));
  return (
    <group
      name={`wilds-boss-${presence.projection.id}`}
      position={[presence.position.x, 1.25, presence.position.z]}
      scale={1.4 + healthRatio * 0.6}
      userData={{ phase: presence.projection.phase, reducedMotion }}
    >
      <mesh castShadow receiveShadow>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial color="#b472ff" emissive="#381759" emissiveIntensity={0.7} metalness={0.18} roughness={0.42} />
      </mesh>
    </group>
  );
}

export function WildsV3WorldLayer({
  selection,
  reducedMotion
}: {
  selection: WildsDetailedWorldSelection;
  reducedMotion: boolean;
}) {
  return (
    <group name="wilds-v3-world-layer">
      {selection.ecology.map((site) => (
        <WildsEcologyPresence key={site.id} site={site} reducedMotion={reducedMotion} />
      ))}
      {selection.boss ? <WildsBossPresence presence={selection.boss} reducedMotion={reducedMotion} /> : null}
    </group>
  );
}
```

The implementation must not call `.slice` in the renderer; the selector owns the cap. Reuse instancing/materials where applicable, dispose manual resources, and do not add another `<Canvas>`.

Pass `v3Presentation.detailedWorld` and the existing `reducedMotion` preference through `WildsWorldCanvas` to its current `WildsScene`, then render exactly:

```tsx
<WildsV3WorldLayer reducedMotion={reducedMotion} selection={v3Presentation.detailedWorld} />
```

- [ ] **Step 5: Run focused and preserved render tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-v3-ui-integration.test.js .test-build/tests/wilds-render-contract.test.js .test-build/tests/wilds-context-action.test.js
pnpm typecheck
```

Expected: all listed tests pass; one shared canvas remains; V3 actions are reachable without a commerce route or replacement HUD.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/WildsV3ActivitySheet.tsx src/features/play/WildsV3WorldLayer.tsx src/features/play/PlayCampaign.tsx src/features/play/WildsWorldCanvas.tsx src/features/play/WildsBattle.tsx src/features/play/WildsLandmarkExperience.tsx src/features/play/WildsCommandDock.tsx app/globals.css tests/wilds-v3-ui-integration.test.ts tests/wilds-render-contract.test.ts
git commit -m "feat: integrate V3 activity into the Wildz world"
```

---

### Task 3: Normalize and Project the Trail Pack

**Files:**
- Create: `src/features/play/wilds-trail-pack.ts`
- Modify: `src/features/play/game-state.ts`
- Modify: `tests/play-game-state.test.ts`
- Create: `tests/wilds-trail-pack.test.ts`

**Interfaces:**
- Consumes: kernel-owned V8 `PlayState.supportAssetIds`, `PlayState.selectedAssetId`, inventory, companion progress, `projectWildsCardMastery`, `deriveLoadoutSynergy`, `currentWildzOwner`, admitted civic/ecology/raid receipts, and V3 narrative records.
- Produces: `normalizeWildsSupportAssetIds`, `assignWildsSupport`, `projectWildsTrailPack`, and the `assign-support` reducer input without changing the V8 envelope.

- [ ] **Step 1: Write self-contained failing support tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWildzMarketState } from "../src/lib/receiz/wildz-market-state";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { assignWildsSupport, normalizeWildsSupportAssetIds, projectWildsTrailPack } from "../src/features/play/wilds-trail-pack";

const leader = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "fern", encounterId: "encounter:leader", capturedAt: "2026-07-15T10:00:00.000Z" });
const firstSupport = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "fern", encounterId: "encounter:support-one", capturedAt: "2026-07-15T11:00:00.000Z" });
const secondSupport = sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "fern", encounterId: "encounter:support-two", capturedAt: "2026-07-15T12:00:00.000Z" });
const inventory = [leader, firstSupport, secondSupport];

test("V8 support slots contain exactly two non-leader verified inventory IDs", () => {
  const state = { ...initialPlayState, inventory, selectedAssetId: leader.id, supportAssetIds: [null, null] as const };
  const first = applyWildsInput(state, { type: "assign-support", slot: 0, assetId: firstSupport.id });
  const second = applyWildsInput(first, { type: "assign-support", slot: 1, assetId: secondSupport.id });
  assert.deepEqual(second.supportAssetIds, [firstSupport.id, secondSupport.id]);
  assert.deepEqual(
    assignWildsSupport({ inventory, leaderAssetId: leader.id, supportAssetIds: second.supportAssetIds, slot: 0, assetId: null }),
    [null, secondSupport.id]
  );
  assert.throws(() => assignWildsSupport({ inventory, leaderAssetId: leader.id, supportAssetIds: second.supportAssetIds, slot: 0, assetId: leader.id }), /wilds_trail_pack_leader_duplicate/);
  assert.deepEqual(normalizeWildsSupportAssetIds([firstSupport.id, firstSupport.id], inventory, leader.id), [firstSupport.id, null]);
  const leaderChanged = applyWildsInput(second, { type: "select-asset", assetId: firstSupport.id });
  assert.deepEqual(leaderChanged.supportAssetIds, [null, secondSupport.id]);
});

test("Trail Pack facts come from verified cards and kernel selectors", () => {
  const state = {
    ...initialPlayState,
    inventory,
    selectedAssetId: leader.id,
    supportAssetIds: [firstSupport.id, secondSupport.id] as const
  };
  const pack = projectWildsTrailPack({
    state,
    marketState: emptyWildzMarketState(),
    world: null,
    playerName: "Fern",
    regionId: "grove",
    seasonSeed: "v3-genesis",
    narrativeMemories: []
  });
  assert.equal(pack.leader?.asset.id, leader.id);
  assert.deepEqual(pack.supports.map((member) => member?.asset.id), [firstSupport.id, secondSupport.id]);
  assert.equal(pack.leader?.currentOwnerReceizId, leader.manifest.ownerReceizId);
  assert.equal(pack.leader?.traitFingerprint, leader.manifest.variant.traitsDigest);
  assert.ok(pack.synergy);
  assert.deepEqual(pack.memories, []);
  assert.deepEqual(pack.returnContinuity.recap, []);
});
```

- [ ] **Step 2: Run the red compile**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript reports the missing `wilds-trail-pack` module and rejects the not-yet-added `assign-support` input.

- [ ] **Step 3: Add support assignment to the existing V8 reducer**

Import the kernel-defined `WildsSupportAssetIds` type; do not redeclare it. Add exactly one input to `WildsInput` in `game-state.ts`:

```ts
| { type: "assign-support"; slot: 0 | 1; assetId: string | null }
```

Implement these pure helpers in `wilds-trail-pack.ts`:

```ts
import type { WildsSupportAssetIds } from "./game-state";
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";

export function normalizeWildsSupportAssetIds(
  values: readonly (string | null)[],
  inventory: readonly PortableCardAsset[],
  leaderAssetId: string
): WildsSupportAssetIds {
  const admittedIds = new Set(
    inventory.filter((asset) => verifyAnyWildsCard(asset).ok).map((asset) => asset.id)
  );
  const seen = new Set<string>();
  const normalized = [0, 1].map((slot) => {
    const value = values[slot];
    if (!value || value === leaderAssetId || !admittedIds.has(value) || seen.has(value)) return null;
    seen.add(value);
    return value;
  });
  return [normalized[0], normalized[1]] as WildsSupportAssetIds;
}

export function assignWildsSupport(input: {
  inventory: readonly PortableCardAsset[];
  leaderAssetId: string;
  supportAssetIds: WildsSupportAssetIds;
  slot: 0 | 1;
  assetId: string | null;
}): WildsSupportAssetIds {
  if (input.assetId === input.leaderAssetId) throw new Error("wilds_trail_pack_leader_duplicate");
  if (input.assetId !== null) {
    const asset = input.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !verifyAnyWildsCard(asset).ok) throw new Error("wilds_trail_pack_support_invalid");
    const otherSlot: 0 | 1 = input.slot === 0 ? 1 : 0;
    if (input.supportAssetIds[otherSlot] === input.assetId) throw new Error("wilds_trail_pack_support_duplicate");
  }
  const next: [string | null, string | null] = [input.supportAssetIds[0], input.supportAssetIds[1]];
  next[input.slot] = input.assetId;
  return normalizeWildsSupportAssetIds(next, input.inventory, input.leaderAssetId);
}
```

Handle `assign-support` in `applyWildsInput` by calling `assignWildsSupport`; invalid input returns the unchanged loadout with a truthful `lastEvent` message. When `select-asset` changes the leader, call `normalizeWildsSupportAssetIds` with the new leader so that card is removed from its former support slot. The dependency plan already owns V2-V7 migration, V8 serialization, player-Vault round trips, and the sole persisted `PlayState.supportAssetIds` tuple; do not modify or duplicate those contracts here.

- [ ] **Step 4: Implement the V3-derived Trail Pack projection**

```ts
import { currentWildzOwner, type WildzMarketState } from "../../lib/receiz/wildz-market-state";
import { creatureForm } from "./creature-catalog";
import type { PlayState } from "./game-state";
import { deriveLoadoutSynergy, projectWildsCardMastery, type WildsCardMasteryProjection } from "./wilds-card-mastery";
import { projectWildsCivicHistory } from "./wilds-civic-history";
import { projectWildsEcologyHistory } from "./wilds-ecology-history";
import {
  projectHistoricalAtlas,
  projectRegionalStory,
  projectReturnContinuity,
  type NarrativeMemoryRecord
} from "./wilds-narrative-memory";
import { projectWildsRaidHistory } from "./wilds-raid-history";
import type { WildsWorldProjection } from "./wilds-world-state";

export type WildsTrailPackMember = {
  asset: PortableCardAsset;
  level: number;
  bond: number;
  element: string;
  stage: number;
  power: number;
  currentOwnerReceizId: string;
  temperament: string;
  traitFingerprint: string;
  mastery: WildsCardMasteryProjection;
  mood: "resting" | "steady" | "alert" | "strained";
};

export type WildsTrailPackProjection = {
  leader: WildsTrailPackMember | null;
  supports: readonly [WildsTrailPackMember | null, WildsTrailPackMember | null];
  synergy: ReturnType<typeof deriveLoadoutSynergy> | null;
  reactions: readonly { id: string; assetId: string; label: string }[];
  memories: readonly { id: string; label: string; occurredAt: string }[];
  whispers: readonly { id: string; label: string }[];
  returnContinuity: ReturnType<typeof projectReturnContinuity>;
};

function projectWildsTrailPackMember(input: {
  asset: PortableCardAsset;
  state: PlayState;
  marketState: WildzMarketState;
  world: WildsWorldProjection | null;
}): WildsTrailPackMember | null {
  if (!verifyAnyWildsCard(input.asset).ok) return null;
  const form = creatureForm(input.asset.manifest.formId);
  if (!form) return null;
  const progress = input.state.companionProgress[input.asset.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
  const raidActive = Object.values(input.world?.raids ?? {}).some((raid) =>
    raid.phase === "forming" || raid.phase === "active" || raid.phase === "transformation_lock"
  );
  const mood: WildsTrailPackMember["mood"] = input.state.energy <= 20
    ? "strained"
    : raidActive
      ? "alert"
      : progress.bond >= 25
        ? "steady"
        : "resting";
  return {
    asset: input.asset,
    level: progress.level,
    bond: progress.bond,
    element: form.element,
    stage: input.asset.manifest.stage,
    power: input.asset.manifest.stats.power,
    currentOwnerReceizId: currentWildzOwner(input.marketState, input.asset),
    temperament: form.temperament,
    traitFingerprint: input.asset.manifest.variant.traitsDigest,
    mastery: projectWildsCardMastery(input.asset),
    mood
  };
}

export function projectWildsTrailPack(input: {
  state: PlayState;
  marketState: WildzMarketState;
  world: WildsWorldProjection | null;
  playerName: string;
  regionId: string;
  seasonSeed: string;
  narrativeMemories: readonly NarrativeMemoryRecord[];
}): WildsTrailPackProjection {
  const leaderAsset = input.state.inventory.find((asset) => asset.id === input.state.selectedAssetId) ?? null;
  const leader = leaderAsset
    ? projectWildsTrailPackMember({ asset: leaderAsset, state: input.state, marketState: input.marketState, world: input.world })
    : null;
  const supportIds = normalizeWildsSupportAssetIds(
    input.state.supportAssetIds,
    input.state.inventory,
    input.state.selectedAssetId
  );
  const supportMembers = supportIds.map((assetId) => {
    const asset = assetId ? input.state.inventory.find((candidate) => candidate.id === assetId) : null;
    return asset
      ? projectWildsTrailPackMember({ asset, state: input.state, marketState: input.marketState, world: input.world })
      : null;
  });
  const supports: WildsTrailPackProjection["supports"] = [supportMembers[0] ?? null, supportMembers[1] ?? null];
  const packAssets = [leader?.asset, supports[0]?.asset, supports[1]?.asset]
    .filter((asset): asset is PortableCardAsset => Boolean(asset));

  const civic = projectWildsCivicHistory(input.state.civicEvents);
  const ecology = projectWildsEcologyHistory(input.state.ecologyEvents);
  const raid = projectWildsRaidHistory(input.state.raidEvents);
  const reactionFacts = [
    ...civic.events.map((event) => ({
      id: event.eventId,
      proofDigest: event.cardProofDigest,
      occurredAt: event.occurredAt,
      label: `${event.kind} · ${event.sourceId}`
    })),
    ...ecology.events.map((event) => ({
      id: event.receiptId,
      proofDigest: event.cardProofDigest,
      occurredAt: event.occurredAt,
      label: `${event.kind} · ${event.familyId}`
    })),
    ...raid.events.map((event) => ({
      id: event.receiptDigest,
      proofDigest: event.cardProofDigest,
      occurredAt: event.occurredAt,
      label: `${event.kind} · ${event.result}`
    }))
  ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id));
  const reactions = reactionFacts.flatMap((reaction) => {
    const asset = reaction.proofDigest
      ? packAssets.find((candidate) => candidate.proof.digest === reaction.proofDigest)
      : null;
    return asset ? [{ id: reaction.id, assetId: asset.id, label: reaction.label }] : [];
  }).slice(-6);

  const historical = projectHistoricalAtlas(input.narrativeMemories);
  const memories = historical.layers.slice(-3).map((memory) => ({
    id: memory.memoryId,
    label: memory.title,
    occurredAt: memory.occurredAt
  }));
  const story = projectRegionalStory({ regionId: input.regionId, seasonSeed: input.seasonSeed });
  const whispers = story.chapters.slice(0, 3).map((chapter) => ({ id: chapter.id, label: chapter.premise }));
  const returnContinuity = projectReturnContinuity({
    playerName: input.playerName,
    regionId: input.regionId,
    memories: historical.layers.map((memory) => ({ title: memory.title, occurredAt: memory.occurredAt }))
  });

  return {
    leader,
    supports,
    synergy: leader ? deriveLoadoutSynergy(packAssets, input.regionId) : null,
    reactions,
    memories,
    whispers,
    returnContinuity
  };
}
```

The public/economy dependency owns `currentWildzOwner` and its fallback to the immutable manifest owner. The selector above admits no unverified member, associates reactions only through an exact card proof digest, and bounds presentation arrays without changing kernel selector results. React must not add another owner, mastery, mood, synergy, memory, or whisper rule.

- [ ] **Step 5: Run support reducer and existing V8 continuity tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-trail-pack.test.js .test-build/tests/play-game-state.test.js .test-build/tests/wilds-player-vault.test.js
pnpm typecheck
```

Expected: all tests pass; assignment and leader changes maintain exactly two normalized support slots, while the dependency plan's V8/player-Vault tests continue to preserve the tuple and existing leader ID.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/wilds-trail-pack.ts src/features/play/game-state.ts tests/play-game-state.test.ts tests/wilds-trail-pack.test.ts
git commit -m "feat: add the Wildz Trail Pack loadout"
```

---

### Task 4: Replace Active Deck With Trail Pack / Wilds Heartbeat

**Files:**
- Create: `src/features/play/WildsTrailPackSheet.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Modify: `src/features/play/WildsCommandDock.tsx`
- Modify: `src/features/play/WildsCreatureActor.tsx`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wilds-command-dock.test.ts`
- Modify: `tests/wildz-social-deck.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`
- Create: `tests/wilds-trail-pack-presentation.test.ts`

**Interfaces:**
- Consumes: `WildsTrailPackProjection`, dependency-owned admitted `WildzMarketState`, support assignment callback, existing leader selection, existing six social actions, and current creature actor/thumbnail components.
- Produces: the fifth dock slot, party-management sheet, and optional two-support world presence.

- [ ] **Step 1: Write the failing six-slot contract**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the visible dock has six unique slots in the accepted order", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const labels = [
    "Open card vault",
    "Open field guide",
    "Open player profile",
    "Open social market",
    "Open Trail Pack and Wilds Heartbeat",
    "Open foraging satchel"
  ];
  const offsets = labels.map((label) => source.indexOf(`aria-label="${label}"`));
  assert.ok(offsets.every((offset) => offset >= 0));
  assert.deepEqual(offsets, [...offsets].sort((left, right) => left - right));
  assert.doesNotMatch(source, /Open active deck/);
  assert.doesNotMatch(readFileSync("src/features/shell/WildzApp.tsx", "utf8"), /wildz-utility-dock/);
});

test("the shared canvas renders only the two normalized support slots", () => {
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  const actor = readFileSync("src/features/play/WildsCreatureActor.tsx", "utf8");
  assert.match(world, /pack\.supports\.map/);
  assert.doesNotMatch(world, /pack\.supports\.slice/);
  assert.match(world, /<WildsCreatureActor/);
  assert.match(actor, /reducedMotion/);
});
```

- [ ] **Step 2: Run the red focused test**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-social-deck.test.js .test-build/tests/wilds-trail-pack-presentation.test.js
```

Expected: the new test fails because the fifth label is still `Open active deck`, the `deck` command exists, and `WildzApp` still renders the duplicate utility dock.

- [ ] **Step 3: Replace the command key and sheet**

Pass the admitted market read state already loaded by the public/economy market controller through `WildzApp` into `PlayCampaign`; use it only as the `marketState` input to `projectWildsTrailPack` and `currentWildzOwner`. Do not cache or infer ownership in the player UI.

```ts
export type WildsCommandKey = "mission" | "fieldGuide" | "satchel" | "trailPack" | "vault";
```

Replace the current `deck` command item with:

```tsx
{
  key: "trailPack",
  label: "Trail Pack · Wilds Heartbeat",
  icon: <Icons.assets size={21} />,
  content: (
    <WildsTrailPackSheet
      pack={trailPack}
      inventory={state.inventory}
      onAssignSupport={(slot, assetId) => dispatch({ type: "assign-support", slot, assetId })}
      onSelectLeader={(assetId) => dispatch({ type: "select-asset", assetId })}
    />
  )
}
```

The visible fifth button becomes:

```tsx
<button aria-label="Open Trail Pack and Wilds Heartbeat" className="wildz-action-companion" onClick={onOpenTrailPack} type="button">
  {activeCard ? <WildsCreatureThumbnail asset={activeCard} /> : <Icons.assets size={25} />}
</button>
```

`WildsTrailPackSheet` renders one leader, two support slots, verified artwork, element, level, stage, power, bond, mastery role/affinity, temperament, mood, synergy, bounded reactions, memory, and admitted whispers. Empty memory/whisper arrays produce truthful empty states. Support assignment dispatches `assign-support` through the existing owner-scoped V8 save path; leader selection still dispatches `select-asset`.

Implement the sheet itself without another loadout or fact selector:

```tsx
import { verifyAnyWildsCard, type PortableCardAsset } from "./portable-card";
import type { WildsTrailPackMember, WildsTrailPackProjection } from "./wilds-trail-pack";
import { WildsCreatureThumbnail } from "./WildsCreatureThumbnail";

function TrailPackMemberView({ label, member }: { label: string; member: WildsTrailPackMember | null }) {
  if (!member) return <article className="wilds-trail-member is-empty"><h4>{label}</h4><p>Open slot</p></article>;
  return (
    <article className="wilds-trail-member">
      <h4>{label}</h4>
      <WildsCreatureThumbnail asset={member.asset} />
      <strong>{member.asset.manifest.name}</strong>
      <span>Lv. {member.level} · Stage {member.stage} · {member.element}</span>
      <span>{member.power} PWR · {member.bond} bond · {member.temperament}</span>
      <span>{member.mastery.primary} / {member.mastery.secondary} · {member.mastery.affinity}</span>
      <span>{member.mood} · owner {member.currentOwnerReceizId}</span>
      <code>{member.traitFingerprint}</code>
    </article>
  );
}

export function WildsTrailPackSheet({
  pack,
  inventory,
  onAssignSupport,
  onSelectLeader
}: {
  pack: WildsTrailPackProjection;
  inventory: readonly PortableCardAsset[];
  onAssignSupport(slot: 0 | 1, assetId: string | null): void;
  onSelectLeader(assetId: string): void;
}) {
  const candidates = inventory.filter((asset) => verifyAnyWildsCard(asset).ok);
  return (
    <section aria-label="Trail Pack and Wilds Heartbeat" className="wilds-trail-pack">
      <header><p>Trail Pack</p><h3>Wilds Heartbeat</h3><span>{pack.returnContinuity.greeting}</span></header>
      <label>
        Leader
        <select onChange={(event) => onSelectLeader(event.currentTarget.value)} value={pack.leader?.asset.id ?? ""}>
          {candidates.map((asset) => <option key={asset.id} value={asset.id}>{asset.manifest.name}</option>)}
        </select>
      </label>
      <TrailPackMemberView label="Leader" member={pack.leader} />
      {([0, 1] as const).map((slot) => (
        <section className="wilds-trail-support" key={slot}>
          <label>
            Support {slot + 1}
            <select
              onChange={(event) => onAssignSupport(slot, event.currentTarget.value || null)}
              value={pack.supports[slot]?.asset.id ?? ""}
            >
              <option value="">Open slot</option>
              {candidates.filter((asset) => asset.id !== pack.leader?.asset.id).map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.manifest.name}</option>
              ))}
            </select>
          </label>
          <TrailPackMemberView label={`Support ${slot + 1}`} member={pack.supports[slot]} />
        </section>
      ))}
      <section><h4>Synergy</h4><p>{pack.synergy ? `${pack.synergy.score} · ${pack.synergy.roles.join(" · ")}` : "Choose a verified leader."}</p></section>
      <section><h4>Reactions</h4>{pack.reactions.length ? pack.reactions.map((reaction) => <p key={reaction.id}>{reaction.label}</p>) : <p>No admitted reactions yet.</p>}</section>
      <section><h4>Memory</h4>{pack.memories.length ? pack.memories.map((memory) => <p key={memory.id}>{memory.label}</p>) : <p>No admitted memories yet.</p>}</section>
      <section><h4>Whispers</h4>{pack.whispers.length ? pack.whispers.map((whisper) => <p key={whisper.id}>{whisper.label}</p>) : <p>No regional whisper yet.</p>}</section>
    </section>
  );
}
```

- [ ] **Step 4: Remove duplicate navigation and add support presence**

Remove `wildz-utility-dock` from `WildzApp`. Keep `WildsCommandDock`'s internal trigger row hidden by the accepted `.wildz-social-stack > .wilds-command-system > .wilds-command-dock { display: none; }` rule; it remains the sheet state machine, not a second visible dock.

Add `reducedMotion?: boolean` to `WildsCreatureActor`. At the top of its existing `useFrame` callback, preserve a static pose and return when the flag is true:

```ts
if (reducedMotion) {
  root.current.position.y = 0.46;
  root.current.rotation.set(0, 0, 0);
  root.current.scale.setScalar(1);
  if (head.current) head.current.rotation.set(0, 0, 0);
  if (limbs.current) limbs.current.rotation.set(0, 0, 0);
  if (aura.current) aura.current.rotation.set(0, 0, 0);
  return;
}
```

Pass the Trail Pack projection and existing `reducedMotion` preference into `WildsWorldCanvas`, then add this component beside `ActiveCompanion` inside the existing `WildsScene`; do not add another Canvas or telemetry state:

```tsx
function TrailPackSupportActors({
  pack,
  reducedMotion
}: {
  pack: WildsTrailPackProjection;
  reducedMotion: boolean;
}) {
  const offsets: readonly [readonly [number, number, number], readonly [number, number, number]] = [
    [-1.82, 0.38, 0.82],
    [-0.34, 0.38, 0.82]
  ];
  return (
    <group name="wilds-trail-pack-supports">
      {pack.supports.map((member, slot) => {
        if (!member) return null;
        const form = creatureForm(member.asset.manifest.formId);
        if (!form) return null;
        return (
          <group key={member.asset.id} position={slot === 0 ? offsets[0] : offsets[1]} scale={0.58}>
            <WildsCreatureActor
              accent={form.palette.accent}
              familyId={member.asset.manifest.familyId}
              formId={member.asset.manifest.formId}
              pose="curious"
              primary={form.palette.primary}
              reducedMotion={reducedMotion}
            />
          </group>
        );
      })}
    </group>
  );
}
```

The tuple is already bounded to two positions. Support actors have reduced scale, no leader telemetry, and no independent command state.

- [ ] **Step 5: Run focused dock, pack, and renderer tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-command-dock.test.js .test-build/tests/wildz-social-deck.test.js .test-build/tests/wilds-trail-pack-presentation.test.js .test-build/tests/wilds-render-contract.test.js
pnpm typecheck
```

Expected: all listed tests pass; the only visible dock has six ordered functions, Trail Pack is not a duplicate card list, and the canvas contains at most one leader plus two support companions.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/WildsTrailPackSheet.tsx src/features/play/PlayCampaign.tsx src/features/play/WildzSocialDeck.tsx src/features/play/WildsCommandDock.tsx src/features/play/WildsCreatureActor.tsx src/features/play/WildsWorldCanvas.tsx src/features/shell/WildzApp.tsx app/globals.css tests/wilds-command-dock.test.ts tests/wildz-social-deck.test.ts tests/wilds-render-contract.test.ts tests/wilds-trail-pack-presentation.test.ts
git commit -m "feat: add Trail Pack and Wilds Heartbeat"
```

---

### Task 5: Add One Immutable Card-Ordering Contract

**Files:**
- Create: `src/features/play/wilds-card-order.ts`
- Modify: `src/features/identity/use-wildz-continuity.ts`
- Create: `tests/wilds-card-order.test.ts`
- Modify: `tests/wildz-player-state-repository.test.ts`

**Interfaces:**
- Consumes: `WildzOwnerScope`, `wildzOwnerScope(keyId, actorId)`, `WildzPlayerStateRepository.load(scope)`, and `WildzPlayerStateRepository.save(state)` from the continuity dependencies.
- Produces: `WildsCardOrder`, `WildsCardFilter`, `isWildsCardOrder`, `orderWildsCards`, `filterWildsCards`, `setCardOrder(order)`, owner-scoped default/normalization, and a persisted display preference per identity/actor scope.

- [ ] **Step 1: Write the self-contained failing ordering tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { sealCollectedCard, type PortableCardAsset } from "../src/features/play/portable-card";
import { filterWildsCards, isWildsCardOrder, orderWildsCards } from "../src/features/play/wilds-card-order";
import type { CreatureRarity } from "../src/features/play/creature-catalog";

function card(encounterId: string, rarity: CreatureRarity, capturedAt: string): PortableCardAsset {
  const sealed = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "fern", encounterId, capturedAt: "2026-07-15T12:00:00.000Z" });
  return { ...sealed, manifest: { ...sealed.manifest, rarity, capturedAt } };
}

test("rarity, date validity, and ID tie-breaks are deterministic without mutation", () => {
  assert.equal(isWildsCardOrder("rarity"), true);
  assert.equal(isWildsCardOrder("recent"), false);
  const cards = [
    card("encounter:trail", "trail", "2026-07-12T00:00:00.000Z"),
    card("encounter:eternal", "eternal", "2026-07-10T00:00:00.000Z"),
    card("encounter:mythic", "mythic", "not-a-date"),
    card("encounter:rare", "rare", "2026-07-14T00:00:00.000Z"),
    card("encounter:uncommon", "uncommon", "2026-07-11T00:00:00.000Z")
  ];
  const originalIds = cards.map((asset) => asset.id);
  assert.deepEqual(orderWildsCards(cards, "rarity").map((asset) => asset.manifest.rarity), ["eternal", "mythic", "rare", "uncommon", "trail"]);
  assert.equal(orderWildsCards(cards, "newest").at(-1)?.manifest.capturedAt, "not-a-date");
  assert.equal(orderWildsCards(cards, "oldest").at(-1)?.manifest.capturedAt, "not-a-date");
  const tied = [
    card("encounter:tie-b", "rare", "2026-07-14T00:00:00.000Z"),
    card("encounter:tie-a", "rare", "2026-07-14T00:00:00.000Z")
  ];
  const expectedTieOrder = tied.map((asset) => asset.id).sort((left, right) => left.localeCompare(right));
  for (const order of ["rarity", "newest", "oldest"] as const) {
    assert.deepEqual(orderWildsCards(tied, order).map((asset) => asset.id), expectedTieOrder);
  }
  assert.deepEqual(filterWildsCards(cards, { query: "", rarity: "all" }).map((asset) => asset.id), originalIds);
  assert.deepEqual(cards.map((asset) => asset.id), originalIds);
});
```

- [ ] **Step 2: Run the red compile**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: TypeScript reports the missing `wilds-card-order` module.

- [ ] **Step 3: Implement the exact comparator**

```ts
import { creatureForm, type CreatureRarity } from "./creature-catalog";
import type { PortableCardAsset } from "./portable-card";

export type WildsCardOrder = "rarity" | "newest" | "oldest";

export function isWildsCardOrder(value: unknown): value is WildsCardOrder {
  return value === "rarity" || value === "newest" || value === "oldest";
}

const rarityRank = {
  eternal: 0,
  mythic: 1,
  rare: 2,
  uncommon: 3,
  trail: 4
} as const;

function capturedTime(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function orderWildsCards(cards: readonly PortableCardAsset[], order: WildsCardOrder) {
  return [...cards].sort((left, right) => {
    if (order === "rarity") {
      const difference = rarityRank[left.manifest.rarity] - rarityRank[right.manifest.rarity];
      return difference || left.id.localeCompare(right.id);
    }
    const leftTime = capturedTime(left.manifest.capturedAt);
    const rightTime = capturedTime(right.manifest.capturedAt);
    if (leftTime === null || rightTime === null) {
      if (leftTime !== null) return -1;
      if (rightTime !== null) return 1;
      return left.id.localeCompare(right.id);
    }
    const difference = order === "newest" ? rightTime - leftTime : leftTime - rightTime;
    return difference || left.id.localeCompare(right.id);
  });
}

export type WildsCardFilter = {
  query: string;
  rarity: CreatureRarity | "all";
};

export function filterWildsCards(cards: readonly PortableCardAsset[], filter: WildsCardFilter) {
  const query = filter.query.trim().toLowerCase();
  return cards.filter((asset) => {
    const form = creatureForm(asset.manifest.formId);
    const haystack = [
      asset.manifest.name,
      asset.manifest.species,
      asset.manifest.formId,
      form?.habitat ?? "",
      form?.cardNumber ?? "",
      ...(form?.abilities.map((ability) => ability.name) ?? [])
    ].join(" ").toLowerCase();
    return (filter.rarity === "all" || asset.manifest.rarity === filter.rarity)
      && (!query || haystack.includes(query));
  });
}
```

Invalid dates sort after valid dates in both date modes. Every final tie uses asset ID. Rarity is the default. `filterWildsCards` never sorts or slices; with `{ query: "", rarity: "all" }` it preserves every input asset in the order supplied.

- [ ] **Step 4: Persist one owner-scoped preference**

Consume the dependency plan's existing `WildzOwnerState.settings.cardOrder`, which is stored at `wildzOwnerScope(session.keyId, session.actorId)`; do not add it to `PlayState` or redefine the owner-state schema. Add `setCardOrder(order: WildsCardOrder): Promise<void>` to `useWildzContinuity`; it updates only the active owner state's settings and persists through the existing repository transaction. Tests must create two owner scopes in the memory repository, write different orders, reopen the repository, and assert each owner receives only its own value.

```ts
const setCardOrder = useCallback(async (order: WildsCardOrder) => {
  if (!isWildsCardOrder(order) || !session) throw new Error("wildz_card_order_invalid");
  const scope = wildzOwnerScope(session.keyId, session.actorId);
  const current = await repository.load(scope);
  if (!current) throw new Error("wildz_owner_state_missing");
  const next: WildzOwnerState = {
    ...current,
    settings: { ...current.settings, cardOrder: order },
    updatedAt: new Date().toISOString()
  };
  await repository.save(next);
  setOwnerState(next);
}, [repository, session]);
```

- [ ] **Step 5: Run ordering and repository tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wilds-card-order.test.js .test-build/tests/wildz-player-state-repository.test.js
pnpm typecheck
```

Expected: all tests pass; rarity/newest/oldest are deterministic, invalid dates are last, input arrays are unchanged, and preferences remain isolated by `{ keyId, actorId }`.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/wilds-card-order.ts src/features/identity/use-wildz-continuity.ts tests/wilds-card-order.test.ts tests/wildz-player-state-repository.test.ts
git commit -m "feat: add owner-scoped Wildz card ordering"
```

---

### Task 6: Render Every Card in the Rail and Share Ordering With Card Vault

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `src/features/play/inventory-pagination.ts`
- Modify: `app/globals.css`
- Modify: `tests/wildz-social-deck.test.ts`
- Create: `tests/wilds-card-surfaces.test.ts`
- Modify: `tests/wildz-continuity-integration.test.ts`

**Interfaces:**
- Consumes: owner-state `cardOrder`, `orderWildsCards`, `filterWildsCards`, `verifyAnyWildsCard`, actual inventory, selected asset ID, catalog forms, admitted ownership, and companion progress.
- Produces: `inventoryPageItems`, one complete horizontal rail, and one Card Vault view with identical ordering semantics and exhaustive post-restore ID reachability.

- [ ] **Step 1: Write failing complete-surface contracts**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the quick rail renders the entire ordered collection", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  assert.doesNotMatch(source, /nearbyCards\.slice/);
  assert.match(source, /nearbyCards\.map/);
  assert.match(source, /data-wildz-card-rail/);
  assert.match(source, /data-wildz-card-id=\{card\.id\}/);
  assert.match(source, /data-wildz-rail-card-id=\{card\.id\}/);
  assert.match(source, /aria-pressed=\{activeCard\?\.id === card\.id\}/);
  assert.match(source, /currentWildzOwner\(marketState, card\)/);
  for (const fact of ["manifest.stage", "manifest.stats.power", "currentOwnerReceizId", "companionProgress[card.manifest.familyId]"]) {
    assert.match(source, new RegExp(fact.replaceAll(".", "\\.")));
  }
});

test("rail and Card Vault consume the shared order prop", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  assert.match(campaign, /orderWildsCards\(state\.inventory, cardOrder\)/);
  assert.match(campaign, /cardOrder=\{cardOrder\}/);
  assert.match(inventory, /filterWildsCards\(cards, \{ query, rarity \}\)/);
  assert.match(inventory, /inventoryPageItems/);
  assert.match(inventory, /data-wildz-vault-card-id=\{asset\.id\}/);
  assert.match(inventory, /data-wildz-card-id=\{asset\.id\}/);
  assert.match(inventory, /data-wildz-vault-page=\{page\}/);
  assert.match(inventory, /Next card page/);
  assert.doesNotMatch(inventory, /\.sort\(/);
});
```

Extend the continuity plan's existing cold-restart test rather than creating another identity-activation fixture. Merge these imports into `tests/wildz-continuity-integration.test.ts`:

```ts
import { inventoryPageItems, inventoryPageSize } from "../src/features/play/inventory-pagination";
import { verifyAnyWildsCard } from "../src/features/play/portable-card";
import { filterWildsCards, orderWildsCards, type WildsCardOrder } from "../src/features/play/wilds-card-order";
```

Inside that test, immediately after the continuity plan's successful `reopened` assertions, add this block. `reopened` and `exportedPlayer` are the values constructed by that test's already-required combined-Vault cold restore; this task does not change identity activation or its assertions.

```ts
const restoredState = reopened.ownerState.playState;
const inventoryBeforeOrdering = restoredState.inventory.map((asset) => asset.id);
const selectionBeforeOrdering = restoredState.selectedAssetId;
const uniqueVerifiedImportedIds = [...new Set(
  exportedPlayer.playState.inventory
    .filter((asset) => verifyAnyWildsCard(asset).ok)
    .map((asset) => asset.id)
)].sort((left, right) => left.localeCompare(right));

assert.ok(uniqueVerifiedImportedIds.length >= 6);

for (const order of ["rarity", "newest", "oldest"] as readonly WildsCardOrder[]) {
  const ordered = orderWildsCards(restoredState.inventory, order);
  const railIds = ordered.map((asset) => asset.id);
  const vaultMatches = filterWildsCards(ordered, { query: "", rarity: "all" });
  const pageSize = inventoryPageSize(true);
  const pageCount = Math.ceil(vaultMatches.length / pageSize);
  const vaultIds = Array.from({ length: pageCount }, (_, page) =>
    inventoryPageItems(vaultMatches, page, pageSize)
  ).flat().map((asset) => asset.id);

  assert.ok(pageCount > 1);
  assert.deepEqual([...new Set(railIds)].sort((left, right) => left.localeCompare(right)), uniqueVerifiedImportedIds);
  assert.deepEqual([...new Set(vaultIds)].sort((left, right) => left.localeCompare(right)), uniqueVerifiedImportedIds);
  assert.deepEqual(vaultIds, railIds);
  assert.equal(new Set(railIds).size, uniqueVerifiedImportedIds.length);
  assert.deepEqual(restoredState.inventory.map((asset) => asset.id), inventoryBeforeOrdering);
  assert.equal(restoredState.selectedAssetId, selectionBeforeOrdering);
}
```

- [ ] **Step 2: Run the red focused tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-social-deck.test.js .test-build/tests/wilds-card-surfaces.test.js .test-build/tests/wildz-continuity-integration.test.js
```

Expected: failures identify `nearbyCards.slice(0, 4)`, the missing shared order props, the missing active `aria-pressed` contract, and the absent `inventoryPageItems` export used by the post-restore reachability assertion.

- [ ] **Step 3: Make `PlayCampaign` the one display-order owner**

Read `cardOrder` from owner-scoped continuity and compute one copy:

```ts
const orderedCards = useMemo(
  () => orderWildsCards(state.inventory, cardOrder),
  [cardOrder, state.inventory]
);
```

Pass `nearbyCards={orderedCards}` to `WildzSocialDeck` and `cards={orderedCards}` to `WildsInventory`; pass `cardOrder` and `onCardOrderChange` to both. Sorting must not dispatch `select-asset`, rewrite inventory, or change `selectedAssetId`.

- [ ] **Step 4: Implement complete, accessible card surfaces**

In `WildzSocialDeck`:

- remove `nearbyCards.slice(0, 4)` and map the entire ordered list;
- add an accessible compact select with `rarity`, `newest`, and `oldest` values;
- mark the active card with `aria-pressed`;
- use a horizontal `role="list"`, `role="listitem"`, scroll snapping, bounded widths, visible focus, touch scrolling, and keyboard-operable controls;
- after an order change, scroll the active card into view without selecting it;
- render actual thumbnail/proof state, level, stage, element, power, bond, `currentOwnerReceizId` from the admitted ownership projection, mastery affinity/role, variant trait fingerprint, and temperament.

Set `data-wildz-card-rail` on the horizontal scroll container and both `data-wildz-card-id={card.id}` and `data-wildz-rail-card-id={card.id}` on each rendered rail item. Label the shared sort select `Card order`. These attributes expose only already-visible public card IDs and exist so release browsers can prove exhaustive DOM order and actual horizontal reachability without bypassing the UI.

Inside the card map, derive the owner exactly once with `const currentOwnerReceizId = currentWildzOwner(marketState, card)`; do not read `manifest.ownerReceizId` directly for the displayed current-owner label and do not mutate the signed manifest.

Add this generic page selector to `inventory-pagination.ts` and use it in `WildsInventory`:

```ts
export function inventoryPageItems<T>(items: readonly T[], page: number, pageSize: number): readonly T[] {
  const size = Math.max(1, Math.floor(pageSize));
  const safePage = clampInventoryPage(page, items.length, size);
  return items.slice(safePage * size, safePage * size + size);
}
```

In `WildsInventory`, compute `filterWildsCards(cards, { query, rarity })` from the already ordered `cards` prop, then call `inventoryPageItems` for the larger detail surface. Empty query plus `all` rarity must retain the entire list, and every page control from `0` through `Math.ceil(matches.length / pageSize) - 1` must remain reachable. Set `data-wildz-vault-page={page}` on the paginated list and both `data-wildz-card-id={asset.id}` and `data-wildz-vault-card-id={asset.id}` on every card in the current page, label the shared select `Card order`, and label pagination controls `Previous card page` and `Next card page`; changing order resets the page to zero before rendering the new ordering. Do not call `.sort()` or rebuild a different comparator. Keep selected Vault detail by asset ID when order changes.

- [ ] **Step 5: Run surface, state, and continuity tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-social-deck.test.js .test-build/tests/wilds-card-surfaces.test.js .test-build/tests/play-game-state.test.js .test-build/tests/wildz-continuity-integration.test.js
pnpm typecheck
```

Expected: every listed test passes; after combined-Vault cold restore, every unique verified imported ID appears in the unsliced rail and across the complete no-filter Card Vault page sequence in the same order for all three modes; active leader, inventory source order, and real facts remain unchanged. Identity activation continues to be owned and tested by the continuity plan.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/PlayCampaign.tsx src/features/play/WildzSocialDeck.tsx src/features/play/WildsInventory.tsx src/features/play/inventory-pagination.ts app/globals.css tests/wildz-social-deck.test.ts tests/wilds-card-surfaces.test.ts tests/wildz-continuity-integration.test.ts
git commit -m "feat: expose every owned Wildz card"
```

---

### Task 7: Add Canonical Profile Share and Copy Link

**Files:**
- Create: `src/features/profile/profile-sharing.ts`
- Modify: `src/features/profile/WildzProfileSheet.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `app/globals.css`
- Create: `tests/wildz-profile-sharing.test.ts`
- Modify: `tests/wildz-profile.test.ts`

**Interfaces:**
- Consumes: the public/economy plan's `canonicalWildzHandle`, `canonicalWildzProfilePath`, canonical `app/u/[handle]/page.tsx`, and compatible username alias.
- Produces: `canonicalWildzProfileUrl`, `shareWildzProfile`, `copyWildzProfileLink`, and explicit share result states without creating another route or handle rule.

- [ ] **Step 1: Write self-contained failing sharing tests**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalWildzProfileUrl, copyWildzProfileLink, shareWildzProfile } from "../src/features/profile/profile-sharing";

test("profile Share uses native share and unsupported Share falls back to canonical copy", async () => {
  const writes: string[] = [];
  const url = canonicalWildzProfileUrl("@Fern.Path", "https://wildz.quest");
  assert.equal(url, "https://wildz.quest/u/fern.path");
  assert.deepEqual(await shareWildzProfile({ port: { share: async () => undefined }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "shared", message: "Profile shared." });
  assert.deepEqual(await shareWildzProfile({ port: { clipboard: { writeText: async (value) => { writes.push(value); } } }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "copied", message: "Profile link copied." });
  assert.deepEqual(await copyWildzProfileLink({ port: { clipboard: { writeText: async (value) => { writes.push(value); } } }, username: "@fern.path", origin: "https://wildz.quest" }), { status: "copied", message: "Profile link copied." });
  assert.deepEqual(await shareWildzProfile({ port: { share: async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); } }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "cancelled", message: "Share cancelled." });
  assert.deepEqual(await shareWildzProfile({ port: { share: async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); } }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "denied", message: "Profile sharing was denied." });
  assert.deepEqual(await copyWildzProfileLink({ port: {}, username: "@fern.path", origin: "https://wildz.quest" }), { status: "unavailable", message: "Profile link is unavailable on this device." });
  assert.deepEqual(writes, [url, url]);
});
```

- [ ] **Step 2: Run the red compile**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
```

Expected: `TS2307` reports the missing `profile-sharing` module.

- [ ] **Step 3: Implement canonical URL and browser-port behavior**

```ts
import { canonicalWildzProfilePath } from "./public-profile";

export type WildzSharePort = {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText(value: string): Promise<void> };
};

export type WildzShareResult =
  | { status: "shared"; message: "Profile shared." }
  | { status: "copied"; message: "Profile link copied." }
  | { status: "cancelled"; message: "Share cancelled." }
  | { status: "denied"; message: "Profile sharing was denied." }
  | { status: "unavailable"; message: "Profile link is unavailable on this device." };

export function canonicalWildzProfileUrl(username: string, origin: string) {
  return new URL(canonicalWildzProfilePath(username), origin).toString();
}

export async function copyWildzProfileLink(input: {
  port: WildzSharePort;
  username: string;
  origin: string;
}): Promise<WildzShareResult> {
  if (!input.port.clipboard) return { status: "unavailable", message: "Profile link is unavailable on this device." };
  try {
    await input.port.clipboard.writeText(canonicalWildzProfileUrl(input.username, input.origin));
    return { status: "copied", message: "Profile link copied." };
  } catch {
    return { status: "unavailable", message: "Profile link is unavailable on this device." };
  }
}

export async function shareWildzProfile(input: {
  port: WildzSharePort;
  username: string;
  displayName: string;
  origin: string;
}): Promise<WildzShareResult> {
  const url = canonicalWildzProfileUrl(input.username, input.origin);
  if (!input.port.share) return copyWildzProfileLink(input);
  try {
    await input.port.share({ title: `${input.displayName} on Wildz`, text: `Explore ${input.displayName}'s verified Wildz profile.`, url });
    return { status: "shared", message: "Profile shared." };
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "AbortError") return { status: "cancelled", message: "Share cancelled." };
    if (name === "NotAllowedError") return { status: "denied", message: "Profile sharing was denied." };
    return { status: "unavailable", message: "Profile link is unavailable on this device." };
  }
}
```

Native Share success returns `shared`; `AbortError` returns `cancelled`; `NotAllowedError` returns `denied`; unsupported Share uses clipboard; Copy Link always uses clipboard; unavailable or failed clipboard returns `unavailable` without throwing private browser details into the UI.

- [ ] **Step 4: Add controls that consume the canonical public route**

Make `WildzProfileSheet` a client component. Render compact Share and Copy Link buttons and one `aria-live="polite"` status region. Buttons must be at least 44 by 44 CSS pixels and respect reduced motion.

Add this client-side behavior to `WildzProfileSheet` and render the returned controls beside the accepted profile header:

```tsx
import { useState } from "react";
import {
  copyWildzProfileLink,
  shareWildzProfile,
  type WildzSharePort,
  type WildzShareResult
} from "./profile-sharing";

const [shareResult, setShareResult] = useState<WildzShareResult | null>(null);

const browserPort = (): WildzSharePort => ({
  share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
  clipboard: navigator.clipboard?.writeText
    ? { writeText: (value) => navigator.clipboard.writeText(value) }
    : undefined
});

const share = async () => setShareResult(await shareWildzProfile({
  port: browserPort(),
  username: profile.username,
  displayName: profile.displayName,
  origin: window.location.origin
}));

const copy = async () => setShareResult(await copyWildzProfileLink({
  port: browserPort(),
  username: profile.username,
  origin: window.location.origin
}));

const sharingControls = (
  <div className="wildz-profile-sharing">
    <button onClick={() => void share()} type="button">Share</button>
    <button onClick={() => void copy()} type="button">Copy Link</button>
    <p aria-live="polite" role="status">{shareResult?.message ?? ""}</p>
  </div>
);
```

```css
.wildz-profile-sharing {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.wildz-profile-sharing button {
  min-block-size: 44px;
  min-inline-size: 44px;
}

.wildz-profile-sharing [role="status"] {
  flex-basis: 100%;
}
```

Feed the already-resolved public profile handle from `WildzApp` into both helpers. The public/economy plan already owns public verification projection, `app/u/[handle]/page.tsx`, and the compatible username redirect; do not modify or recreate those routes, identity rules, or authority fields. Keep the route test in the green gate to prove sharing still targets the dependency-owned `/u` path.

- [ ] **Step 5: Run sharing and profile tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-profile-sharing.test.js .test-build/tests/wildz-profile.test.js .test-build/tests/wildz-profile-route.test.js
pnpm typecheck
```

Expected: all tests pass; native, fallback, cancellation, denial, and unavailable states are explicit; URLs come from `canonicalWildzProfilePath` and use the dependency-owned `/u` route; sharing adds no identity authority.

- [ ] **Step 6: Commit**

```bash
git add src/features/profile/profile-sharing.ts src/features/profile/WildzProfileSheet.tsx src/features/shell/WildzApp.tsx app/globals.css tests/wildz-profile-sharing.test.ts tests/wildz-profile.test.ts
git commit -m "feat: add canonical Wildz profile sharing"
```

---

### Task 8: Complete Player-Surface Accessibility

**Files:**
- Create: `src/features/shell/use-wildz-dialog.ts`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/play/WildsCommandDock.tsx`
- Modify: `src/features/play/WildzSocialDeck.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `tests/wildz-accessibility.test.ts`
- Modify: `tests/wilds-command-dock.test.ts`

**Interfaces:**
- Produces: `useWildzDialog`, keyboard terrain scan, focus trap/restoration, enabled browser zoom, 44-pixel primary targets, and accessible live status.

- [ ] **Step 1: Write failing source contracts for focus, scan, and zoom**

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("dialogs trap and restore focus and terrain scan is keyboard reachable", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const dock = readFileSync("src/features/play/WildsCommandDock.tsx", "utf8");
  const social = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  assert.match(shell, /useWildzDialog/);
  assert.match(dock, /useWildzDialog/);
  assert.match(social, /onScan/);
  assert.match(campaign, /key === "e"/);
  assert.match(campaign, /Math\.sin\(cameraHeading\)/);
  assert.match(campaign, /Math\.cos\(cameraHeading\)/);
});

test("the viewport permits user zoom", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.doesNotMatch(layout, /maximumScale/);
  assert.match(layout, /viewportFit:\s*"cover"/);
});
```

- [ ] **Step 2: Run the red focused tests**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-accessibility.test.js .test-build/tests/wilds-command-dock.test.js
```

Expected: the accessibility test fails because the reusable focus hook, explicit scan action/key, and zoom correction are absent.

- [ ] **Step 3: Implement the reusable dialog lifecycle**

```ts
import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function useWildzDialog(input: {
  open: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  restoreFocusTo?: HTMLElement | null;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const onDismiss = useRef(input.onDismiss);
  onDismiss.current = input.onDismiss;

  useEffect(() => {
    if (!input.open) return;
    const dialog = input.dialogRef.current;
    if (!dialog) return;

    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => !element.matches("[aria-hidden='true']") && element.getClientRects().length > 0);
    const frame = window.requestAnimationFrame(() => (focusable()[0] ?? dialog).focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      dialog.removeEventListener("keydown", onKeyDown);
      const restoreTarget = input.restoreFocusTo ?? previousFocus.current;
      if (restoreTarget?.isConnected) restoreTarget.focus();
    };
  }, [input.dialogRef, input.open, input.restoreFocusTo]);
}
```

Give each consuming dialog `tabIndex={-1}` and use the hook in `WildzApp` and `WildsCommandDock`. While the shell overlay is open, make its sibling world subtree inert; do not inert an ancestor containing the dialog. Preserve current body-scroll restoration and pointer-drag dismissal.

In `WildzApp`, attach `worldRef` to the accepted `.wildz-app` world subtree and `dialogRef` to `.wildz-shell-overlay`, then use this exact lifecycle:

```tsx
const worldRef = useRef<HTMLDivElement>(null);
const dialogRef = useRef<HTMLElement>(null);
const overlayOpen = Boolean(overlay);

useWildzDialog({
  open: overlayOpen,
  dialogRef,
  onDismiss: () => setOverlay(null)
});

useEffect(() => {
  const world = worldRef.current;
  if (!world) return;
  world.inert = overlayOpen;
  return () => { world.inert = false; };
}, [overlayOpen]);
```

Set `ref={worldRef}` on the existing `.wildz-app` div. Set `ref={dialogRef}` and `tabIndex={-1}` on the existing `.wildz-shell-overlay` section. `WildsCommandDock` applies the same hook to its current sheet ref and passes the button that opened the sheet as `restoreFocusTo`.

- [ ] **Step 4: Add scan and target accessibility**

Add `onScan` to the first exploration button; native button Enter/Space invokes it. Add the `e` shortcut to the existing campaign key handler while retaining the editable/control-target guard:

```ts
const scanAhead = () => dispatch({
  type: "search-point",
  x: state.player.x + Math.sin(cameraHeading) * 1.8,
  z: state.player.z - Math.cos(cameraHeading) * 1.8,
  searchedAt: new Date().toISOString(),
  ownerReceizId
});
```

Set primary buttons/links/selects in the social dock, Trail Pack, Card Vault toolbar, profile sharing, and sheet headers to at least 44 by 44 CSS pixels. Add visible `:focus-visible`, high-contrast readable states, `aria-live` for asynchronous status, and reduced-motion overrides. Remove `maximumScale: 1` from the viewport.

```ts
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: WILDZ_PRODUCT.themeColor
};
```

```css
.wildz-social-actions button,
.wildz-play-control-rail button,
.wilds-trail-pack button,
.wilds-trail-pack select,
.wilds-inventory button,
.wilds-inventory select,
.wildz-profile-sharing button,
.wilds-command-sheet header button {
  min-block-size: 44px;
  min-inline-size: 44px;
}

:is(.wildz-social-deck, .wilds-trail-pack, .wilds-inventory, .wildz-profile-sheet, .wilds-command-sheet) :focus-visible {
  outline: 3px solid #fff2a8;
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .wilds-trail-pack *,
  .wildz-profile-sharing *,
  .wilds-command-sheet * {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 5: Run accessibility and full player-experience gates**

```bash
node scripts/clean-test-build.mjs
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-accessibility.test.js .test-build/tests/wilds-command-dock.test.js .test-build/tests/wildz-social-deck.test.js .test-build/tests/wilds-card-surfaces.test.js .test-build/tests/wildz-profile-sharing.test.js
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands exit zero; dialogs trap and restore focus, Escape closes, keyboard scanning works, user zoom remains available, every owned card remains reachable, and the accepted standalone shell builds without a `/market` page.

- [ ] **Step 6: Commit**

```bash
git add src/features/shell/use-wildz-dialog.ts src/features/shell/WildzApp.tsx src/features/play/WildsCommandDock.tsx src/features/play/WildzSocialDeck.tsx src/features/play/PlayCampaign.tsx app/layout.tsx app/globals.css tests/wildz-accessibility.test.ts tests/wilds-command-dock.test.ts
git commit -m "fix: complete Wildz player-surface accessibility"
```

## Plan Completion Gate

Run from the completed player-experience tree:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

Expected: all tests and static gates pass; production build succeeds; the accepted canvas/HUD/dock composition remains; V3 activity is reachable; the dock has six unique ordered slots; Trail Pack uses one leader plus two owner-scoped supports; every card is reachable in both ordered surfaces; Share and Copy Link use canonical `/u`; accessibility contracts pass; worktree is clean after the final task commit.
