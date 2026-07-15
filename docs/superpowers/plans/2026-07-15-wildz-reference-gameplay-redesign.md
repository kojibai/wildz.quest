# Wildz Reference Gameplay Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the complete Wildz gameplay presentation to match the approved portrait reference while preserving every existing game function and fixing visible portable Receiz identity restoration.

**Architecture:** Existing game engines, reducers, proof rules, routes, and persistence remain authoritative. New focused projection, HUD, party, world-kit, and social-deck components consume current state and emit current commands; the shell composes those components into a portrait-first full-screen experience. Identity admission is corrected independently so authoritative Receiz artifacts produce visible continuity before explorer genesis.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, React Three Fiber, Three.js 0.182, `@receiz/sdk` 100.x, Node test runner, CSS, PWA service worker.

## Global Constraints

- Preserve all current game functions, rules, routes, portable proofs, market boundaries, and saved-state keys.
- The supplied 852 × 1848 image is the primary visual target for hierarchy, density, proportions, depth, softness, and control placement.
- The human explorer remains the player identity; Sealcub is the default active companion.
- The D-pad is horizontally centered immediately above the bottom social deck.
- Marketplace actions remain inside gameplay; no `/market` page or navigation may be introduced.
- No ownership transfer may be shown before an admitted Receiz settlement.
- Authoritative identity restore accepts an owner-exported Identity Record or Receiz Key, not an ordinary public profile image without embedded key authority.
- Primary authored viewport is 390 × 844 CSS pixels; verify 360 × 640, 430 × 932, 768 × 1024, and desktop.
- Touch targets are at least 44 × 44 CSS pixels and must clear device safe areas.
- New behavior follows test-first red-green-refactor cycles.

---

### Task 1: Receiz identity admission and visible restore result

**Files:**
- Modify: `src/lib/receiz/wildz-identity-adapter.ts`
- Modify: `src/features/identity/WildzGenesis.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `tests/wildz-restore.test.ts`
- Modify: `tests/wildz-shell.test.ts`

**Interfaces:**
- Consumes: `readReceizIdentityArtifact(input)` and `projectReceizIdentityAccount(keyFile)` from `@receiz/sdk`.
- Produces: `friendlyWildzRestoreError(cause: unknown): string` and a genesis success state bound to `StoredWildzIdentity`.

- [ ] **Step 1: Write failing restore-classification tests**

Add tests asserting the friendly translation and visible restored identity contract:

```ts
import { friendlyWildzRestoreError } from "../src/lib/receiz/wildz-identity-adapter";

test("profile artwork without embedded authority names the required portable artifact", () => {
  assert.match(
    friendlyWildzRestoreError(new Error("receiz_key_identity_record_missing")),
    /owner-only Identity Record or Receiz Key/i
  );
});

test("genesis renders admitted Receiz identity continuity", () => {
  const source = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");
  assert.match(source, /Restored Receiz ID/);
  assert.match(source, /identity\.identity\.username/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm test -- tests/wildz-restore.test.ts tests/wildz-shell.test.ts`

Expected: FAIL because `friendlyWildzRestoreError` and restored identity copy do not exist.

- [ ] **Step 3: Implement one error classifier and visible success state**

Add the classifier:

```ts
export function friendlyWildzRestoreError(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "wildz_restore_invalid";
  if (code === "receiz_key_identity_record_missing") {
    return "This image is identity artwork, not account authority. Download your owner-only Identity Record or Receiz Key from Receiz and choose that file.";
  }
  if (code === "receiz_key_file_too_large") return "This Receiz identity artifact is too large.";
  if (code === "receiz_key_invalid") return "This file is not a valid Receiz Identity Record or Receiz Key.";
  return code;
}
```

Use it in `WildzGenesis.restore`. Track the admitted identity in the existing `identity` prop and render a compact success capsule containing `Restored Receiz ID`, `@${identity.identity.username}`, and `identity.identity.displayName`. In `WildzApp`, pass the newly saved record immediately so the capsule updates without refresh.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm test -- tests/wildz-restore.test.ts tests/wildz-shell.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit identity restoration**

```bash
git add src/lib/receiz/wildz-identity-adapter.ts src/features/identity/WildzGenesis.tsx src/features/shell/WildzApp.tsx tests/wildz-restore.test.ts tests/wildz-shell.test.ts
git commit -m "fix: clarify and surface Receiz identity restoration"
```

### Task 2: Gameplay HUD projection and default Sealcub party

**Files:**
- Create: `src/features/play/wildz-gameplay-hud.ts`
- Create: `src/features/play/wildz-party.ts`
- Create: `tests/wildz-gameplay-hud.test.ts`
- Create: `tests/wildz-party.test.ts`
- Modify: `src/features/play/game-state.ts`

**Interfaces:**
- Consumes: existing `WildsGameState`, movement context, mission state, inventory, and creature catalog types.
- Produces: `projectWildzHud(state, identity): WildzHudModel`, `createDefaultWildzParty(identityRef): WildzParty`, and `activePartyCompanion(party)`.

- [ ] **Step 1: Write failing projection and party tests**

```ts
test("default party keeps the human explorer and activates Sealcub", () => {
  const party = createDefaultWildzParty("receiz:key:one");
  assert.equal(party.explorerIdentityRef, "receiz:key:one");
  assert.equal(party.activeCompanion.speciesId, "sealcub");
});

test("HUD projection exposes existing energy XP mission and action state", () => {
  const model = projectWildzHud(stateFixture(), { username: "minttrail", displayName: "Mint Trail" });
  assert.equal(model.player.username, "minttrail");
  assert.equal(model.energy.current, stateFixture().energy);
  assert.equal(model.action.intent, stateFixture().contextAction.intent);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm test -- tests/wildz-gameplay-hud.test.ts tests/wildz-party.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement minimal typed view models**

Define bounded models:

```ts
export type WildzParty = {
  schema: "wildz.party.v1";
  explorerIdentityRef: string;
  activeCompanion: { speciesId: "sealcub" | string; name: string; level: number };
};

export function createDefaultWildzParty(identityRef: string): WildzParty {
  return {
    schema: "wildz.party.v1",
    explorerIdentityRef: identityRef,
    activeCompanion: { speciesId: "sealcub", name: "Sealcub", level: 1 }
  };
}
```

Implement `projectWildzHud` as a pure projection over existing state. Do not mutate or recalculate game rules inside the projection.

- [ ] **Step 4: Run focused and game-state tests**

Run: `pnpm test -- tests/wildz-gameplay-hud.test.ts tests/wildz-party.test.ts tests/play-game-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit party and projection**

```bash
git add src/features/play/wildz-gameplay-hud.ts src/features/play/wildz-party.ts src/features/play/game-state.ts tests/wildz-gameplay-hud.test.ts tests/wildz-party.test.ts
git commit -m "feat: project Wildz HUD and default Sealcub party"
```

### Task 3: Reference-faithful floating HUD and touch controls

**Files:**
- Create: `src/features/play/WildzReferenceHud.tsx`
- Create: `src/features/play/WildzDpad.tsx`
- Create: `src/features/play/WildzMinimap.tsx`
- Create: `src/features/play/WildzContextButton.tsx`
- Create: `tests/wildz-reference-hud.test.ts`
- Modify: `src/components/icons.tsx`

**Interfaces:**
- Consumes: `WildzHudModel`, `WildsMoveIntent`, and existing context action intents.
- Produces: DOM HUD callbacks `onMove(intent)`, `onMoveEnd()`, and `onContextAction()`.

- [ ] **Step 1: Write failing source and intent tests**

```ts
test("reference HUD exposes player status minimap and mission clusters", () => {
  const source = readFileSync("src/features/play/WildzReferenceHud.tsx", "utf8");
  for (const token of ["wildz-player-capsule", "wildz-status-rail", "WildzMinimap", "WildzDpad", "WildzContextButton"]) {
    assert.match(source, new RegExp(token));
  }
});

test("D-pad has four movement intents and no independent movement reducer", () => {
  const source = readFileSync("src/features/play/WildzDpad.tsx", "utf8");
  for (const direction of ["north", "east", "south", "west"]) assert.match(source, new RegExp(direction));
  assert.doesNotMatch(source, /useReducer/);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `pnpm test -- tests/wildz-reference-hud.test.ts`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Build focused HUD components**

Compose the HUD without game-rule duplication:

```tsx
export function WildzReferenceHud({ model, onMove, onMoveEnd, onContextAction }: Props) {
  return <div className="wildz-reference-hud">
    <section className="wildz-player-capsule">{/* player, Sealcub, level */}</section>
    <section className="wildz-status-rail">{/* energy, XP, mission */}</section>
    <WildzMinimap model={model.minimap} />
    <WildzDpad onMove={onMove} onMoveEnd={onMoveEnd} />
    <WildzContextButton action={model.action} onActivate={onContextAction} />
  </div>;
}
```

Use the existing icon component set for game actions. Add only missing functional icons; do not replace a current game action with decoration.

- [ ] **Step 4: Verify focused tests**

Run: `pnpm test -- tests/wildz-reference-hud.test.ts tests/wilds-command-dock.test.ts tests/wilds-context-action.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit HUD components**

```bash
git add src/features/play/WildzReferenceHud.tsx src/features/play/WildzDpad.tsx src/features/play/WildzMinimap.tsx src/features/play/WildzContextButton.tsx src/components/icons.tsx tests/wildz-reference-hud.test.ts
git commit -m "feat: add reference-style Wildz gameplay HUD"
```

### Task 4: Bottom social deck with every existing game function

**Files:**
- Create: `src/features/play/WildzSocialDeck.tsx`
- Create: `src/features/play/wildz-social-deck.ts`
- Create: `tests/wildz-social-deck.test.ts`
- Modify: `src/features/play/WildsCommandDock.tsx`
- Modify: `src/features/market/WildzMarketSheet.tsx`

**Interfaces:**
- Consumes: existing command dock actions, nearby players/creatures, vault cards, market listings, and overlay callbacks.
- Produces: `projectWildzDeckItems(...)`, collapsed/expanded deck UI, and embedded market confirmations.

- [ ] **Step 1: Write failing preservation and no-navigation tests**

```ts
test("social deck preserves every existing command function", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  for (const action of ["mission", "rewards", "deck", "vault", "map", "profile", "market", "audio"]) {
    assert.match(source, new RegExp(action));
  }
});

test("social deck keeps market interactions embedded", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  assert.doesNotMatch(source, /router\.push|href=["']\/market/);
  assert.match(source, /WildzMarketSheet/);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `pnpm test -- tests/wildz-social-deck.test.ts`

Expected: FAIL because the deck does not exist.

- [ ] **Step 3: Implement the social deck as a presentation adapter**

Create a deck with a drag handle, nearby collectible cards, compact Trade controls, and an action rail. Map every current command to an icon and callback. Reuse `WildzMarketSheet` in an in-deck expansion state and preserve its pending/failure/settled copy.

- [ ] **Step 4: Verify market and command contracts**

Run: `pnpm test -- tests/wildz-social-deck.test.ts tests/wildz-market-presentation.test.ts tests/wildz-market-routes.test.ts tests/wilds-command-dock.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit social deck**

```bash
git add src/features/play/WildzSocialDeck.tsx src/features/play/wildz-social-deck.ts src/features/play/WildsCommandDock.tsx src/features/market/WildzMarketSheet.tsx tests/wildz-social-deck.test.ts
git commit -m "feat: embed Wildz functions in social gameplay deck"
```

### Task 5: Low-poly forest world kit and explorer-Sealcub party scene

**Files:**
- Create: `src/features/play/WildzForestWorld.tsx`
- Create: `src/features/play/WildzPartyActor.tsx`
- Create: `src/features/play/WildzWorldLabels.tsx`
- Create: `src/features/play/wildz-forest-kit.ts`
- Create: `tests/wildz-forest-world.test.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`

**Interfaces:**
- Consumes: current world state, geography, movement position, quality profile, explorer genesis, active companion, and visible entities.
- Produces: a reference-framed forest scene; no new game-state authority.

- [ ] **Step 1: Write failing scene contract tests**

```ts
test("forest world composes paths water foliage party and world labels", () => {
  const source = readFileSync("src/features/play/WildzForestWorld.tsx", "utf8");
  for (const token of ["WildzPartyActor", "WildzWorldLabels", "trail", "pond", "foliage", "fog"]) {
    assert.match(source, new RegExp(token, "i"));
  }
});

test("party scene contains both explorer and Sealcub", () => {
  const source = readFileSync("src/features/play/WildzPartyActor.tsx", "utf8");
  assert.match(source, /explorer/i);
  assert.match(source, /sealcub/i);
});
```

- [ ] **Step 2: Run scene contract and verify RED**

Run: `pnpm test -- tests/wildz-forest-world.test.ts`

Expected: FAIL because the scene modules do not exist.

- [ ] **Step 3: Implement the environment kit and scene composition**

Use instanced/repeated low-poly vegetation and props, authored dirt trail meshes, a bounded pond, layered fog, contact shadows, and a fixed elevated camera composition. Render the deterministic explorer and a following Sealcub in `WildzPartyActor`. Project visible entities into `WildzWorldLabels` using HTML labels with distance and occlusion limits.

The first implementation must reuse existing geometry/material recipes and current quality tiers. External hero/environment assets may replace high-value surfaces only after generator output is inspected and performance-safe.

- [ ] **Step 4: Verify scene contracts and render compatibility**

Run: `pnpm test -- tests/wildz-forest-world.test.ts tests/wilds-render-contract.test.ts tests/wilds-presentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit world rebuild**

```bash
git add src/features/play/WildzForestWorld.tsx src/features/play/WildzPartyActor.tsx src/features/play/WildzWorldLabels.tsx src/features/play/wildz-forest-kit.ts src/features/play/WildsWorldCanvas.tsx src/features/play/WildsEnvironment.tsx tests/wildz-forest-world.test.ts
git commit -m "feat: rebuild Wildz as a low-poly forest world"
```

### Task 6: Integrate the reference shell and responsive styling

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `app/globals.css`
- Create: `tests/wildz-reference-layout.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: components from Tasks 2–5 and all existing overlay/command callbacks.
- Produces: the final full-screen portrait composition.

- [ ] **Step 1: Write failing layout contract tests**

```ts
test("gameplay composes the forest HUD and social deck", () => {
  const source = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  for (const token of ["WildzForestWorld", "WildzReferenceHud", "WildzSocialDeck"]) assert.match(source, new RegExp(token));
});

test("D-pad is horizontally centered above the safe-area deck", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-dpad[\s\S]*left:\s*50%[\s\S]*translateX\(-50%\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
```

- [ ] **Step 2: Run layout test and verify RED**

Run: `pnpm test -- tests/wildz-reference-layout.test.ts`

Expected: FAIL before integration and CSS are present.

- [ ] **Step 3: Integrate components and author responsive CSS**

Replace the current primary presentation path with the new scene, HUD, and deck while retaining current panels as deck/overlay content. Use charcoal glass capsules, mint progress, warm-gold action emphasis, soft borders, portrait-relative anchors, and desktop max-width constraints. Add reduced-motion and quality-tier fallbacks.

- [ ] **Step 4: Verify layout and all presentation contracts**

Run: `pnpm test -- tests/wildz-reference-layout.test.ts tests/wilds-render-contract.test.ts tests/wildz-shell.test.ts tests/wildz-market-presentation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit reference shell**

```bash
git add src/features/play/PlayCampaign.tsx src/features/shell/WildzApp.tsx app/globals.css tests/wildz-reference-layout.test.ts tests/wilds-render-contract.test.ts
git commit -m "feat: integrate reference-faithful Wildz game shell"
```

### Task 7: Browser QA, performance evidence, and release verification

**Files:**
- Create: `design-qa.md`
- Modify: `docs/release/verification.md`
- Modify: `docs/release/feature-parity.md`

**Interfaces:**
- Consumes: final running application and the supplied reference image.
- Produces: visual comparison, interaction evidence, renderer diagnostics, and final release record.

- [ ] **Step 1: Run the complete automated verification suite**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm secret:scan
```

Expected: every command exits 0 with no failed tests or secret findings.

- [ ] **Step 2: Start the production-equivalent local app**

Run: `pnpm start -p 3001`

Expected: Next.js serves the Wildz app at `http://127.0.0.1:3001`.

- [ ] **Step 3: Verify the complete interaction loop in a real browser**

At 390 × 844 exercise: fresh identity creation, authoritative identity restore, gender selection, world entry, D-pad movement, context action, social-deck expansion, vault/profile/mission/reward/map/audio functions, listing selection, and checkout-unavailable safety. Confirm page title, nonblank scene, no framework overlay, no relevant console errors, and visible state changes after each action.

- [ ] **Step 4: Capture responsive and visual evidence**

Capture 360 × 640, 390 × 844, 430 × 932, 768 × 1024, and desktop. Compare 390 × 844 against the supplied reference for HUD anchors, open center view, path/world depth, D-pad placement, action button, bottom deck, spacing, palette, and softness.

- [ ] **Step 5: Write and pass `design-qa.md`**

Record each mismatch as P0–P3. Fix every P0, P1, and P2; repeat screenshots until the file ends with:

```md
final result: passed
```

- [ ] **Step 6: Update release verification and feature parity**

Document the preserved systems, identity behavior, controls, viewport evidence, performance observations, and any remaining P3 polish.

- [ ] **Step 7: Commit final verification**

```bash
git add design-qa.md docs/release/verification.md docs/release/feature-parity.md
git commit -m "test: verify reference-faithful Wildz gameplay"
```

