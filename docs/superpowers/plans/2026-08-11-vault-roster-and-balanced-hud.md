# Vault Roster and Balanced World HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ambiguous companion carousel and top status toggle with an admitted-Vault-only creature selector and a balanced, always-visible mobile HUD.

**Architecture:** A pure roster projection derives selectable living creatures and display stats from authoritative PlayState inputs. `PlayCampaign` owns the short-lived newly-captured marker and persistent HUD domain wiring; `WildzWorldControls` forwards the projected roster; the companion command and drawer remain presentation/gesture boundaries. The status fan is removed and its existing live, audio, and Kai components are placed into semantic persistent homes without duplicating their domain state.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js/R3F world canvas, CSS safe-area/container rules, Node test runner, Playwright production-browser qualification.

## Global Constraints

- The player lands in the playable world; no new setup or selection screen is introduced.
- The bottom-right command is the sole closed-state companion and roster trigger.
- Selectable roster entries come only from the admitted active player's `state.inventory` and exclude retired creatures.
- Every visible creature name is the exact sealed `asset.manifest.name`.
- Retired creatures remain in the existing Memorial/Vault experience and never become selectable through the world roster.
- Tap, horizontal swipe, upward swipe, hold-slide, keyboard, focus recovery, pointer cancellation, and haptics must remain functional.
- Persistent interactive targets are at least 44 CSS pixels; the D-pad retains its larger existing target floor.
- The top-right status toggle and fan are removed; live/social status remains near the minimap, while Kai and audio occupy a persistent left-side home.
- No new dependency is added.
- Existing modal ownership and capture/reward recovery must remain green.
- Selecting a living card from Card Vault or the world roster must update the same active asset, portrait, real name, world companion, and battle leader, then survive reload.

---

### Task 1: Project the admitted selectable Vault roster

**Files:**
- Create: `src/features/play/vault-companion-roster.ts`
- Create: `tests/wildz-vault-companion-roster.test.ts`
- Modify: `src/features/play/PlayCampaign.tsx`

**Interfaces:**
- Consumes: `PortableCardAsset[]`, `PlayState["companionProgress"]`, `PlayState["adventureConditions"]`, active asset id, and optional new asset id.
- Produces: `projectVaultCompanionRoster(input): readonly VaultCompanionRosterEntry[]` where each entry contains `asset`, `name`, `level`, `xp`, `bond`, `fatigue`, `injuryCount`, `conditionLabel`, `element`, `species`, `active`, and `newlyCaptured`.

- [ ] **Step 1: Write failing behavioral projection tests**

```ts
test("projects only living cards from the admitted inventory with sealed names and stats", () => {
  const roster = projectVaultCompanionRoster({
    inventory: [ownedAlive, ownedRetired],
    companionProgress: { [ownedAlive.manifest.familyId]: { level: 4, xp: 275, bond: 31 } },
    cardConditions: {
      [ownedAlive.id]: { ...emptyAdventureCondition(ownedAlive.id), fatigue: 18 },
      [ownedRetired.id]: { ...emptyAdventureCondition(ownedRetired.id), life: "dead", retiredAt: NOW, retirementCauseEventId: "arena:1" }
    },
    activeAssetId: ownedAlive.id,
    newAssetId: ownedAlive.id
  });
  assert.deepEqual(roster.map((entry) => entry.asset.id), [ownedAlive.id]);
  assert.equal(roster[0]?.name, ownedAlive.manifest.name);
  assert.deepEqual(roster[0] && {
    level: roster[0].level,
    xp: roster[0].xp,
    bond: roster[0].bond,
    fatigue: roster[0].fatigue,
    active: roster[0].active,
    newlyCaptured: roster[0].newlyCaptured
  }, { level: 4, xp: 275, bond: 31, fatigue: 18, active: true, newlyCaptured: true });
});

test("never synthesizes catalogue, nearby, remote, or family fallback creatures", () => {
  const roster = projectVaultCompanionRoster({
    inventory: [ownedAlive],
    companionProgress: {},
    cardConditions: {},
    activeAssetId: null,
    newAssetId: null
  });
  assert.deepEqual(roster.map((entry) => entry.asset.id), [ownedAlive.id]);
});

test("Card Vault and world-roster selection converge on one persisted active asset", () => {
  const fromVault = reducePlayState(twoCardState, { type: "select-asset", assetId: second.id });
  const fromRoster = reducePlayState(twoCardState, { type: "select-asset", assetId: second.id });
  assert.equal(fromVault.selectedAssetId, second.id);
  assert.equal(fromRoster.selectedAssetId, second.id);
  assert.equal(selectedCard(restorePlayState(JSON.parse(JSON.stringify(fromVault)))).id, second.id);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test`

Expected: FAIL during test compilation because `projectVaultCompanionRoster` does not exist.

- [ ] **Step 3: Implement the pure roster projection**

```ts
export type VaultCompanionRosterEntry = Readonly<{
  asset: PortableCardAsset;
  name: string;
  level: number;
  xp: number;
  bond: number;
  fatigue: number;
  injuryCount: number;
  conditionLabel: "Ready" | "Tired" | "Recovering" | "Injured";
  element: string;
  species: string;
  active: boolean;
  newlyCaptured: boolean;
}>;

export function projectVaultCompanionRoster(input: VaultCompanionRosterInput) {
  return input.inventory.flatMap((asset) => {
    const condition = input.cardConditions[asset.id] ?? emptyAdventureCondition(asset.id);
    const retired = condition.life === "dead"
      || (isLivingCardAsset(asset) && Boolean(currentRevision(asset).growth.life?.retired));
    if (retired) return [];
    const progress = input.companionProgress[asset.manifest.familyId]
      ?? input.companionProgress[asset.id]
      ?? { level: 1, xp: 0, bond: 0 };
    const form = creatureForm(asset.manifest.formId);
    return [{
      asset,
      name: asset.manifest.name,
      level: progress.level,
      xp: progress.xp,
      bond: progress.bond,
      fatigue: condition.fatigue,
      injuryCount: condition.injuries.length,
      conditionLabel: projectRosterConditionLabel(condition),
      element: form?.element ?? "Unknown",
      species: asset.manifest.species,
      active: asset.id === input.activeAssetId,
      newlyCaptured: asset.id === input.newAssetId
    }];
  });
}
```

- [ ] **Step 4: Track the newly captured id from authoritative inventory growth**

In `PlayCampaign`, retain the prior inventory id set in a ref. When exactly one or more ids appear after a committed reducer update, set `newRosterAssetId` to the newest admitted asset by `manifest.capturedAt`; clear it after selection or after a 6-second timeout. Do not add the marker to persisted PlayState.

```ts
const priorVaultIdsRef = useRef(new Set(state.inventory.map((asset) => asset.id)));
const [newRosterAssetId, setNewRosterAssetId] = useState<string | null>(null);

useEffect(() => {
  const prior = priorVaultIdsRef.current;
  const added = state.inventory.filter((asset) => !prior.has(asset.id));
  priorVaultIdsRef.current = new Set(state.inventory.map((asset) => asset.id));
  if (!added.length) return;
  setNewRosterAssetId([...added].sort((a, b) => Date.parse(b.manifest.capturedAt) - Date.parse(a.manifest.capturedAt))[0]!.id);
}, [state.inventory]);
```

- [ ] **Step 5: Run tests and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`

Expected: projection tests and the full suite pass; no type or lint diagnostics.

```bash
git add src/features/play/vault-companion-roster.ts src/features/play/PlayCampaign.tsx tests/wildz-vault-companion-roster.test.ts
git commit -m "feat: project the selectable Vault roster"
```

---

### Task 2: Rebuild the roster drawer as a premium stat selector

**Files:**
- Modify: `src/features/play/WildzCreatureDrawer.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-creature-drawer-ui.test.ts`
- Modify: `tests/wildz-card-rail-ui.test.ts`

**Interfaces:**
- Consumes: `readonly VaultCompanionRosterEntry[]`, current drawer snap, sort order, and the existing `onSelectCard(assetId)` intent.
- Produces: bounded preview/expanded roster surfaces whose selections close to the companion command and whose focus restores correctly.

- [ ] **Step 1: Write failing drawer contract and render tests**

```ts
test("drawer renders exact Vault names and complete selectable stats without retired controls", () => {
  const drawer = source("src/features/play/WildzCreatureDrawer.tsx");
  assert.match(drawer, /entry\.name/);
  assert.match(drawer, /entry\.level/);
  assert.match(drawer, /entry\.xp/);
  assert.match(drawer, /entry\.bond/);
  assert.match(drawer, /entry\.conditionLabel/);
  assert.match(drawer, /entry\.element/);
  assert.match(drawer, /entry\.species/);
  assert.match(drawer, /entry\.newlyCaptured/);
  assert.doesNotMatch(drawer, /retired \? onInspect|is-retired/);
});
```

Add a runtime component test or Playwright fixture asserting that selecting the newly captured entry invokes its exact asset id once, closes the preview, and returns focus to the companion command.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test`

Expected: FAIL on the old `nearbyCards`/retired-card drawer API and missing stat presentation.

- [ ] **Step 3: Change the drawer boundary from cards to roster entries**

Replace `nearbyCards`, `companionProgress`, and `cardConditions` presentation inputs with `entries`. Keep `cardConditions` only if the memorial portal still requires it; otherwise remove the memorial path from this active selector entirely and leave Memorial access in Card Vault.

```tsx
<button
  aria-label={`${entry.name}, level ${entry.level}, ${entry.xp} XP, bond ${entry.bond}, ${entry.conditionLabel}${entry.active ? ", active" : ""}${entry.newlyCaptured ? ", new" : ""}`}
  aria-pressed={entry.active}
  className="wildz-creature-choice"
  onClick={() => selectAndClose(entry.asset.id)}
  type="button"
>
  <WildsCreatureThumbnail asset={entry.asset} className="wildz-slate-creature-art" />
  <span className="wildz-creature-choice-copy">
    <span className="wildz-creature-choice-kicker"><b>Lv. {entry.level}</b><i>{entry.xp} XP</i></span>
    <strong><span>{entry.name}</span><WildsVerifiedBadge /></strong>
    <span className="wildz-creature-xp-meter" role="progressbar" aria-valuenow={entry.xp % 100} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${entry.xp % 100}%` }} /></span>
    <em>{entry.element} · {entry.species}</em>
    <span className="wildz-creature-stat-row"><b>Bond {entry.bond}</b><b>{entry.conditionLabel}</b></span>
  </span>
  {entry.newlyCaptured ? <span className="wildz-creature-new">New</span> : null}
  {entry.active ? <span className="wildz-creature-choice-active">Active</span> : null}
</button>
```

- [ ] **Step 4: Implement drawer focus and responsive interaction**

When preview/expanded opens, focus the active entry, or the first entry when none is active. Trap focus only while the drawer is treated as the active expanded surface. Escape, resize, orientation change, pointer cancel, and exclusive owner cancellation close it and restore the connected companion command origin. Retain the exception-safe haptic adapter for snapping and selection.

- [ ] **Step 5: Author the premium drawer CSS**

Use an anchored translucent world material, creature-derived accent, 44-pixel minimum choices, compact fixed-width stat rows, and a visible XP meter. Preview must remain a single horizontal thumb rail; expanded must be a bounded grid/list with vertical scrolling. Add explicit 320-pixel portrait and 844x390 short-landscape rules, safe-area offsets, reduced-motion overrides, and no page overflow.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && git diff --check`

Expected: all tests pass, no diagnostics, no whitespace errors.

```bash
git add src/features/play/WildzCreatureDrawer.tsx src/features/play/WildzWorldControls.tsx app/globals.css tests/wildz-creature-drawer-ui.test.ts tests/wildz-card-rail-ui.test.ts
git commit -m "feat: rebuild the mobile Vault roster drawer"
```

---

### Task 3: Make the companion command show only the active owned creature

**Files:**
- Modify: `src/features/play/WildsCompanionCommand.tsx`
- Modify: `src/features/play/WildzWorldControls.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-world-controls-recovery.test.ts`
- Create: `tests/wildz-companion-vault-command.test.ts`

**Interfaces:**
- Consumes: the projected living roster, active entry, selected ability, and existing gesture callbacks.
- Produces: one compact bottom-right command without previous/next peeks, while retaining carousel gestures over owned entries only.

- [ ] **Step 1: Write failing command tests**

```ts
test("closed companion command renders one exact Vault identity and no decorative peeks", () => {
  const command = source("src/features/play/WildsCompanionCommand.tsx");
  assert.match(command, /activeEntry\.name/);
  assert.match(command, /activeEntry\.asset/);
  assert.doesNotMatch(command, /wilds-companion-peek|previous \?|next \?/);
});

test("horizontal cycling can return only ids present in the selectable Vault roster", () => {
  const ids = [entry("owned-a"), entry("owned-b")];
  assert.equal(cycleVaultCompanion(ids, "owned-a", 1), "owned-b");
  assert.equal(cycleVaultCompanion(ids, "owned-b", 1), "owned-a");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test`

Expected: FAIL because the old command accepts `cards` and renders `.wilds-companion-peek` siblings.

- [ ] **Step 3: Implement the simplified command**

Pass `entries` and `activeEntry` instead of raw cards. Keep the existing gesture state machine, but cycle only through `entries.map(entry => entry.asset)`. Render the exact active name, portrait, selected ability, and `position/total`. For a single entry, horizontal release is a no-op. For an empty roster, disable the command with “No selectable creature in this Vault.”

- [ ] **Step 4: Remove obsolete peek CSS and verify recovery**

Delete `.wilds-companion-peek` rules and any reduced-motion selectors that exist only for them. Verify simultaneous D-pad plus companion input, lost capture, owner cancellation, keyboard ability composite, and upward drawer gesture remain green.

- [ ] **Step 5: Run tests and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && git diff --check`

```bash
git add src/features/play/WildsCompanionCommand.tsx src/features/play/WildzWorldControls.tsx app/globals.css tests/wildz-world-controls-recovery.test.ts tests/wildz-companion-vault-command.test.ts
git commit -m "feat: bind the companion command to the Vault roster"
```

---

### Task 4: Replace the top status toggle with balanced persistent HUD homes

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Create: `src/features/play/WildsBalancedStatusHud.tsx`
- Modify: `src/features/play/WildsMultiplayer.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-reference-layout.test.ts`
- Modify: `tests/wildz-stage-modal-ownership.test.ts`
- Create: `tests/wildz-balanced-status-hud.test.ts`

**Interfaces:**
- Consumes: living-world status component, multiplayer controller state, Kai moment, audio state/actions, and `isPlayHomeAvailable` ownership projection.
- Produces: persistent minimap-adjacent live/social indicators plus a left-side Kai/audio cluster; no ellipsis trigger, `worldStatusOpen`, or status fan.

- [ ] **Step 1: Write failing HUD ownership and placement tests**

```ts
test("world HUD has no generic top status toggle or fan", () => {
  const campaign = source("src/features/play/PlayCampaign.tsx");
  assert.doesNotMatch(campaign, /worldStatusOpen|wilds-world-status-trigger|wilds-world-status-fan/);
  assert.match(campaign, /<WildsBalancedStatusHud/);
});

test("balanced HUD exposes persistent left Kai and audio plus minimap-adjacent live status", () => {
  const hud = source("src/features/play/WildsBalancedStatusHud.tsx");
  assert.match(hud, /wilds-left-instrument-home/);
  assert.match(hud, /<WildsAudioSettings/);
  assert.match(hud, /wilds-kai-command-pill/);
  assert.match(hud, /wilds-map-status-home/);
  assert.match(hud, /<WildsLivingWorldHud/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm test`

Expected: FAIL because the current campaign owns `worldStatusOpen`, renders the ellipsis trigger, and conditionally mounts the fan.

- [ ] **Step 3: Extract the balanced status component**

`WildsBalancedStatusHud` renders two sibling semantic homes:

```tsx
return <>
  <div aria-hidden={blocked} className="wilds-map-status-home" inert={blocked ? true : undefined}>
    <WildsLivingWorldHud world={world} player={player} connected={connected} onEnterRaid={onEnterRaid} />
    <WildsMultiplayerStatus multiplayer={multiplayer} />
  </div>
  <div aria-hidden={blocked} className="wilds-left-instrument-home" inert={blocked ? true : undefined}>
    <button className="wilds-kai-command-pill" onClick={onOpenCommandCenter} type="button">…</button>
    <WildsAudioSettings settings={audio.settings} ready={audio.ready} onChange={audio.onChange} onUnlock={audio.onUnlock} />
  </div>
</>;
```

Use existing live, multiplayer, audio, and Kai domain components. Do not duplicate network or audio state.

- [ ] **Step 4: Remove fan state and preserve modal ownership**

Remove `worldStatusOpen`, its Escape effect, trigger click logic, and conditional fan. Update command-panel and modal-owner transitions to close only the actual detail surfaces owned by their components. The persistent homes receive `inert` and `aria-hidden` for every exclusive owner other than their exact allowed owner. No status detail may remain mounted behind map, trainer, combat, reward, profile, market, multiplayer, or command panels.

- [ ] **Step 5: Author responsive placement CSS**

Place `.wilds-map-status-home` immediately beneath/alongside the minimap without overlapping its 44-pixel controls. Place `.wilds-left-instrument-home` on the left world edge between the explorer identity home and quick movement utilities. At 844x390, compress it to a two-control row clear of the D-pad, player focal lane, trainer sheets, and safe areas. Keep Kai and audio targets at least 44 pixels and their expanded sheets in viewport.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint && git diff --check`

```bash
git add src/features/play/PlayCampaign.tsx src/features/play/WildsBalancedStatusHud.tsx src/features/play/WildsMultiplayer.tsx app/globals.css tests/wildz-reference-layout.test.ts tests/wildz-stage-modal-ownership.test.ts tests/wildz-balanced-status-hud.test.ts
git commit -m "feat: balance persistent world status controls"
```

---

### Task 5: Qualify capture-to-roster, selection, and responsive HUD end to end

**Files:**
- Modify: `docs/release/flagship-mobile-experience.md`
- Create: `docs/release/evidence/vault-roster-balanced-hud/validate-vault-roster-hud.mjs`
- Create: `docs/release/evidence/vault-roster-balanced-hud/manifest.json`
- Create: `docs/release/evidence/vault-roster-balanced-hud/browser-replay.js`
- Create: `docs/release/evidence/vault-roster-balanced-hud/browser-result.json`
- Create: `docs/release/evidence/vault-roster-balanced-hud/*.png`

**Interfaces:**
- Consumes: the production build and all tasks above.
- Produces: tracked, fresh-checkout-valid evidence for the exact responsive and interaction claims.

- [ ] **Step 1: Run automated release gates**

Run sequentially:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm release:check
python3 /Users/bjklock/.codex/skills/threejs-game-director/scripts/audit_reference_report.py --premium --audio docs/release/flagship-mobile-experience.md
git diff --check
```

Expected: every command exits 0. Record exact test count, suite count, route first-load size, warnings, and doctor status; do not infer success before terminal exit.

- [ ] **Step 2: Run the seven-viewport production matrix**

Against one exact optimized production build, replay 320x568, 360x800, 390x844, 430x932, 844x390, 768x1024, and 1440x900. For every viewport record:

- canvas/stage rect, DPR, drawing buffer, renderer calls/triangles/geometries/textures;
- all persistent target sizes and safe-area bounds;
- pairwise collisions between explorer, mission, minimap/status, Kai/audio, movement, tools, and companion homes;
- closed command, roster preview, roster expanded, audio sheet, Kai Command Center, live detail, and multiplayer states;
- document overflow and console/page/request/HTTP errors.

- [ ] **Step 3: Replay the real capture-to-roster flow**

Use only player-facing D-pad, battle, capture, reward, roster, and selection controls. Record exact inventory count and card ids/names before capture; capture and settle one new card; verify exactly one reward modal; return to world; open roster; assert the new exact `manifest.name`, “New” state, stats, and asset id; select it; assert the bottom-right portrait/name changes; reload; assert the same card remains in inventory and active.

Then open Card Vault, choose a different living sealed card, press its real “Set as active deck leader” control, close the panel, and assert the bottom-right command, world actor, and next battle leader all use that exact asset id/name. Reload and assert that Card Vault selection remains active. Repeat once from the world roster to prove both surfaces converge on the same authoritative state.

- [ ] **Step 4: Replay all input and recovery paths**

Record tap power, owned-only horizontal cycle, upward roster gesture, preview-to-expanded snap, selection haptic safety with missing/non-callable/throwing vibration, hold-slide abilities, keyboard focus and selection, simultaneous two-touch D-pad plus companion, pointer cancel, lost capture, Escape, resize/orientation cancellation, 200% text, reduced motion, offline/lifecycle recovery, and audio toggle.

- [ ] **Step 5: Track and validate the evidence bundle**

The manifest must enumerate exact paths, SHA-256 hashes, byte sizes, modes, captured product commit, recorded build id, browser user agent, viewport, replay command, raw-to-tracked path mapping, and claim pointers. The validator must independently hard-code the expected bundle contract and exact constituent claims. Verify it from a detached clean worktree without `.next` or ignored output.

- [ ] **Step 6: Update release report and commit**

Document passed claims and every measured residual honestly. Do not increase the overall game score unless the complete experience and performance evidence justifies it.

```bash
git add docs/release/flagship-mobile-experience.md docs/release/evidence/vault-roster-balanced-hud
git commit -m "test: qualify Vault roster and balanced HUD"
```

---

## Plan Self-Review

- Spec coverage: admitted-inventory-only roster, retired exclusion, exact names/stats, new capture, immediate selection, simplified command, persistent Kai/audio, minimap status, touch/keyboard recovery, responsive matrix, and tracked evidence each map to an explicit task.
- Placeholder scan: no `TBD`, `TODO`, “implement later,” or undefined “similar to” steps remain.
- Type consistency: Task 1 produces `VaultCompanionRosterEntry`; Tasks 2 and 3 consume that exact type. `PlayCampaign` remains the authority and `WildzWorldControls` remains the forwarding boundary. Task 4 changes layout without duplicating live/audio/Kai state.
- Scope isolation: modal-authority/capture-deadlock changes already in progress are a prerequisite and must land green before Task 1; this plan does not reimplement them.
