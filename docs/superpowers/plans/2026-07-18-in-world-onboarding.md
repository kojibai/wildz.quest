# In-World Wildz Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount the real Wildz gameplay console before explorer selection, keep every visitor’s current Receiz ID visible, merge Vault uploads into that active ID, and allow only Profile Identity Seal/Record restore to change identity while retaining the working Vault.

**Architecture:** Add an explicit restore intent at the existing artifact-adapter boundary so Vault merge and identity activation cannot drift into one another. Replace the standalone genesis branch with a focused in-world onboarding dialog over a preview-character `PlayCampaign`; the shell gates persistence and networking until character admission. Reuse `WildzProfileSheet` for Identity Seal/Record activation and carry the current working Vault into the admitted identity atomically.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js/React Three Fiber, Receiz SDK v111, Node test runner, Playwright CLI.

## Global Constraints

- A Vault upload never changes the active Receiz ID.
- An Identity Seal or Record restored from Profile becomes the active Receiz ID.
- Changing identity retains the current working Vault; future saves and exports bind that Vault to the newly active Receiz ID.
- Individual card proof provenance is never rewritten.
- A typed username alone never authenticates ownership.
- Background persistence and shared-world mutation remain disabled until a real character is committed.
- The required onboarding dialog cannot be dismissed and neither the dialog nor page may viewport-scroll.
- No second artifact parser, Vault merger, or identity repository may be introduced.

---

### Task 1: Make restore intent explicit at the shared adapter boundary

**Files:**
- Modify: `src/lib/receiz/wildz-identity-adapter.ts`
- Modify: `src/features/identity/wildz-restore.ts`
- Modify: `tests/wildz-full-vault-regression.test.ts`
- Modify: `tests/wildz-vault-login-coordinator.test.ts`
- Modify: `tests/wildz-owner-continuity.test.ts`

**Interfaces:**
- Produces: `type WildzRestoreIntent = "merge-vault" | "activate-identity"`.
- Produces: an `intent: WildzRestoreIntent` argument on `restoreWildzFileForSurface`.
- Produces: low-level `preserveActiveIdentity` and `carryCurrentVault` options consumed only by the shared restore implementation.
- Consumes: `reconcileWildsPlayerVault`, `sameWildzPlayerCoordinate`, `restoreWildzArtifactForSurface`, and the existing atomic continuity database transaction.

- [ ] **Step 1: Replace the foreign-Vault-login expectation with active-ID merge tests**

Add test cases with two distinct sessions and two distinct cards. The assertions must establish this invariant:

```ts
const restored = await restoreWildzFileForSurface(
  foreignVaultFile,
  "card-vault",
  false,
  activeSnapshot,
  activeSnapshot.playState,
  "merge-vault"
);
assert.equal(restored.session.actorId, activeSnapshot.session.actorId);
assert.deepEqual(
  restored.playState.inventory.map((asset) => asset.id).sort(),
  [activeCard.id, importedCard.id].sort()
);
```

Add a second test where an Identity Seal is restored after that merge:

```ts
const activated = await restoreWildzFileForSurface(
  identitySealFile,
  "card-vault",
  false,
  mergedSnapshot,
  mergedSnapshot.playState,
  "activate-identity"
);
assert.equal(activated.session.actorId, sealedIdentityActorId);
assert.deepEqual(activated.playState.inventory.map((asset) => asset.id).sort(), mergedIds);
```

- [ ] **Step 2: Run the full test command and confirm the old coordinator routing fails**

Run: `pnpm test`

Expected: FAIL in Vault restore tests because a foreign player Vault still calls `defaultVaultLoginCoordinator.begin` and changes the active session.

- [ ] **Step 3: Add the explicit restore intent**

In `wildz-identity-adapter.ts`, define and require:

```ts
export type WildzRestoreIntent = "merge-vault" | "activate-identity";

export async function restoreWildzFileForSurface(
  file: File,
  surface: "genesis" | "card-vault",
  confirmCardOnly: WildzCardOnlyConfirmation,
  continuity: WildzContinuitySnapshot,
  currentPlayState: PlayState | null | undefined,
  intent: WildzRestoreIntent
): Promise<WildzUiArtifactRestore>;
```

Inspect once with `defaultArtifactCodec`. Enforce these branches:

```ts
if (intent === "activate-identity" && inspection.kind !== "identity-seal") {
  throw new Error("wildz_identity_seal_required");
}
if (intent === "merge-vault" && inspection.kind === "identity-seal") {
  throw new Error("wildz_vault_required");
}
```

Do not call `defaultVaultLoginCoordinator.begin` for `merge-vault`. Pass `preserveActiveIdentity: true` into the existing low-level restore. For `activate-identity`, pass `carryCurrentVault: true` so the new session receives the current play state and continuity inside the same database transaction.

- [ ] **Step 4: Update low-level atomic restore policy**

Extend `restoreWildzArtifactForSurface` options:

```ts
preserveActiveIdentity?: boolean;
carryCurrentVault?: boolean;
currentPlayerContinuity?: WildzPlayerContinuity | null;
currentCharacter?: WildzCharacterGenesis | null;
```

Select the session and owner state with explicit policy rather than artifact owner inference:

```ts
const session = input.preserveActiveIdentity
  ? active
  : verifiedIdentity?.session ?? active;
```

When `carryCurrentVault` is true, normalize `input.currentPlayState` to the new session actor, preserve `currentPlayerContinuity`, and retain `currentCharacter`. The database transaction must write the admitted identity and its owner state together; failure must leave both unchanged.

- [ ] **Step 5: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test`

Expected: Typecheck passes; all 897+ tests pass, including the new merge-then-identity-switch cases.

---

### Task 2: Build the in-world onboarding dialog

**Files:**
- Create: `src/features/identity/WildzInWorldOnboarding.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-genesis-living-entry.test.ts`
- Create: `tests/wildz-in-world-onboarding.test.ts`

**Interfaces:**
- Consumes: `WildzIdentitySession`, `WildzGender`, `friendlyWildzRestoreError`.
- Produces: `WildzInWorldOnboarding` with `identity`, `busy`, `error`, `onChooseExplorer`, `onAddVault`, and `onOpenProfile` props.

- [ ] **Step 1: Write source-contract tests for the new dialog**

Assert that the component exposes the exact required actions and accessibility boundary:

```ts
assert.match(source, /role="dialog"/);
assert.match(source, /aria-modal="true"/);
assert.match(source, /Choose your explorer/);
assert.match(source, /Female explorer/);
assert.match(source, /Male explorer/);
assert.match(source, /Add Vault/);
assert.match(source, /Continue or change Receiz ID/);
assert.doesNotMatch(source, /onKeyDown=.*Escape|setOpen\(false\)/s);
```

Assert CSS uses a fixed, non-scrolling overlay and compact short-height rules:

```ts
assert.match(css, /\.wildz-in-world-onboarding\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*overflow:\s*hidden/s);
assert.match(css, /@media \(max-height: 700px\)[\s\S]*\.wildz-onboarding-card/s);
```

- [ ] **Step 2: Run tests and confirm the component is missing**

Run: `pnpm test`

Expected: FAIL because `WildzInWorldOnboarding.tsx` does not exist.

- [ ] **Step 3: Implement the focused component**

Create this public interface:

```tsx
export function WildzInWorldOnboarding({
  identity,
  busy,
  error,
  onChooseExplorer,
  onAddVault,
  onOpenProfile
}: {
  identity: WildzIdentitySession;
  busy: "explorer" | "vault" | null;
  error: string;
  onChooseExplorer: (gender: WildzGender) => void;
  onAddVault: (file: File) => Promise<void>;
  onOpenProfile: () => void;
})
```

Render the active `@username`, two explorer buttons, an `Add Vault` file label, and a Profile button. Reset the file input value after selection. Put friendly error copy in `role="alert"` and busy progress in `aria-live="polite"`. Focus the heading on mount with `requestAnimationFrame` and restore no background focus because this dialog is required.

- [ ] **Step 4: Add non-scrolling responsive styles**

Use `.wildz-in-world-onboarding` as a full-stage overlay with `pointer-events: auto`, `overscroll-behavior: none`, and `touch-action: none`. Use a centered `.wildz-onboarding-card` sized with `min()` and compact its gaps/buttons under `max-height: 700px`. Do not add `overflow-y: auto`.

- [ ] **Step 5: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test`

Expected: all tests pass and the old standalone entry CSS test now describes the in-world modal.

---

### Task 3: Mount gameplay before explorer selection and gate side effects

**Files:**
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `tests/wildz-shell.test.ts`
- Modify: `tests/wildz-continuity-and-shell.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: `WildzInWorldOnboarding`, `generateWildzCharacter`, and the intent-aware `restoreWildzFileForSurface` defined in Task 1.
- Produces: `interactionEnabled?: boolean` on `PlayCampaign`; it defaults to `true` and gates mutable controls/effects.
- Produces: a deterministic preview character scoped to the current identity.

- [ ] **Step 1: Write failing shell and campaign contracts**

Assert the standalone branch is gone and gameplay mounts whenever continuity and identity exist:

```ts
assert.doesNotMatch(app, /identity && !character \? <WildzGenesis/);
assert.match(app, /const campaignCharacter = character \?\? previewCharacter/);
assert.match(app, /<PlayCampaign/);
assert.match(app, /<WildzInWorldOnboarding/);
assert.match(app, /networkEnabled=\{Boolean\(character\) && proofSessionConnected\}/);
assert.match(app, /interactionEnabled=\{Boolean\(character\)\}/);
```

Assert `PlayCampaign` gates persistence and mutable UI using `interactionEnabled` and still paints `WildsWorldCanvas` when false.

- [ ] **Step 2: Run tests and confirm the standalone genesis branch fails the contract**

Run: `pnpm test`

Expected: FAIL in the new shell-flow assertions.

- [ ] **Step 3: Add a deterministic preview character**

In `WildzApp`, derive without saving:

```ts
const previewCharacter = useMemo(() => identity ? generateWildzCharacter({
  identityRef: identity.keyId,
  kaiPulse: String(Math.max(1, Date.parse(identity.createdAt))),
  gender: "female",
  version: 1
}) : null, [identity]);
const campaignCharacter = character ?? previewCharacter;
```

Do not include the preview in `acceptSnapshot`, `saveWildzContinuityPlayState`, exports, or profile publication.

- [ ] **Step 4: Mount and gate `PlayCampaign`**

Render the campaign when `continuity && identity && campaignCharacter`. Keep its key stable across explorer choice:

```tsx
<PlayCampaign
  key={`${identity.actorId}:${continuity.restoreEpoch}`}
  campaignName="Wildz"
  character={campaignCharacter}
  enabled
  initialPlayerContinuity={continuity.playerContinuity}
  initialState={ownerPlayState}
  interactionEnabled={Boolean(character)}
  networkEnabled={Boolean(character) && proofSessionConnected}
  ownerReceizId={ownerUsername}
  playerDisplayName={identity.displayName ?? `@${ownerUsername}`}
  onPlayStateChange={character ? persistPlayState : () => {}}
  onExportVault={(assets, player) => downloadWildzIdentityPlayerVault(identity, assets, player)}
  onRestoreArtifact={(file, confirmCardOnly, currentPlayState) => restoreArtifact(file, "card-vault", confirmCardOnly, currentPlayState, "merge-vault")}
  onOpenProfile={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })}
  onOpenMarket={() => setOverlay({ kind: "market" })}
/>
```

Retain the existing optional `onListAsset` callback unchanged between the identity/display props and the open-surface callbacks.

Overlay `WildzInWorldOnboarding` when `!character`. Disable or no-op mutable campaign controls through `interactionEnabled`; keep canvas, NPCs, HUD, camera, and console visible.

- [ ] **Step 5: Wire explorer and Vault actions**

Explorer choice creates and commits the real character with:

```ts
const next = generateWildzCharacter({
  identityRef: identity.keyId,
  kaiPulse: String(Date.now()),
  gender,
  version: 1
});
void completeGenesis(next);
```

Vault upload calls the shared adapter with `"merge-vault"`, accepts the merged snapshot, and leaves onboarding open until an explorer exists. Use `restoreEpoch` to refresh the preview campaign after a Vault merge without remounting merely for explorer commit.

- [ ] **Step 6: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test`

Expected: all tests pass; no persistence/network mutation occurs before committed explorer selection.

---

### Task 4: Make Profile the only identity-switch surface and retain the working Vault

**Files:**
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/profile/WildzProfileSheet.tsx`
- Modify: `tests/wildz-profile-identity-editing.test.ts`
- Modify: `tests/wildz-profile-route.test.ts`
- Modify: `tests/wildz-owner-continuity.test.ts`

**Interfaces:**
- Consumes: the intent-aware `restoreWildzFileForSurface` from Task 1 with intent `"activate-identity"`, plus current `continuityRef.current`.
- Produces: Profile Identity Seal/Record restore before or after explorer selection.

- [ ] **Step 1: Add failing Profile identity-switch tests**

Assert the utility dock is visible for any admitted identity, not only after character creation:

```ts
assert.match(app, /\{identity \? <nav className="wildz-utility-dock"/);
```

Assert Profile uses local profile data while the current explorer is unpublished and calls the adapter with `"activate-identity"`. Extend continuity tests so the activated identity receives every card loaded before the switch.

- [ ] **Step 2: Run tests and confirm pre-character Profile is unavailable**

Run: `pnpm test`

Expected: FAIL because the utility dock currently requires `identity && character` and the restore callback has no explicit identity intent.

- [ ] **Step 3: Expose Profile during onboarding**

Render the Profile utility when `identity` exists. For the active local profile, render `WildzProfileSheet` from `localPublicProfile` even when no remote publication exists. Keep share disabled until publication succeeds.

- [ ] **Step 4: Activate Identity Seal/Record while carrying the Vault**

Wire `onAuthenticateIdentitySeal` to:

```ts
const outcome = await restoreArtifact(
  file,
  "card-vault",
  false,
  continuityRef.current?.playState,
  "activate-identity"
);
if (outcome.artifactKind !== "identity-seal") throw new Error("wildz_identity_seal_required");
```

The accepted outcome must retain current inventory/continuity, clear stale publication identity, and show the newly active `@username`. Closing Profile returns to onboarding if no character is committed.

- [ ] **Step 5: Update Profile copy**

Change the upload action’s accessible/title copy to `Upload Identity Seal or Record`. Preserve the existing proof verification and error states; do not add username-only login.

- [ ] **Step 6: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test`

Expected: all tests pass, including Vault-first then Identity-Seal switching with retained cards.

---

### Task 5: Remove obsolete entry code and verify the complete experience

**Files:**
- Delete: `src/features/identity/WildzGenesis.tsx`
- Modify: `app/globals.css`
- Modify: any tests still importing `WildzGenesis.tsx`
- Verify: all files changed by Tasks 1–4 plus the existing vault/camera/NPC/boss/drawer fixes.

**Interfaces:**
- Consumes: the completed in-world onboarding and restore-intent APIs.
- Produces: one production-ready, non-scrolling onboarding and gameplay build.

- [ ] **Step 1: Remove the obsolete component and CSS**

Delete the `WildzGenesis` import/branch and component file. Remove `.wildz-genesis*` layout/animation rules that no longer serve loading or the new modal. Retain shared identity-loading and brand assets.

- [ ] **Step 2: Check the patch and compile**

Run: `git diff --check && pnpm typecheck`

Expected: no whitespace errors and no TypeScript errors.

- [ ] **Step 3: Run the complete automated suite**

Run: `pnpm test`

Expected: 897+ tests, zero failures.

- [ ] **Step 4: Build the production application**

Run: `pnpm build`

Expected: exit 0. The existing `web-worker` critical-dependency warning from `snarkjs` may remain; no new warnings or build errors are allowed.

- [ ] **Step 5: Verify desktop first entry with Playwright CLI**

Start: `pnpm start -p 3001`

Open a fresh WebKit session, snapshot before each interaction, and verify:

- the actual Three.js world, HUD, NPC trainer labels, and console are visible behind the dialog;
- the dialog shows the generated/current Receiz ID;
- the page and dialog have zero scroll range;
- Profile opens and exposes Identity Seal/Record upload;
- Add Vault is reachable and does not change the displayed active ID;
- choosing an explorer closes onboarding and enables gameplay.

Save: `output/playwright/wildz-in-world-onboarding-desktop.png`.

- [ ] **Step 6: Verify mobile first entry and drawer regression**

Use a 390×844 WebKit session and verify the same entry flow, safe areas, no viewport scroll, immediate drawer content paint, native single-row horizontal scrolling, visible NPC guidance, and no blank canvas.

Save: `output/playwright/wildz-in-world-onboarding-mobile.png`.

- [ ] **Step 7: Review console and commit implementation**

Accept only expected unauthenticated session responses before proof connection; there must be no React, Three.js, hydration, uncaught, or accessibility errors.

Run:

```bash
git status --short
git diff --check
git add app src tests
git commit -m "feat: align Wildz continuity and in-world onboarding"
```

Expected: one implementation commit containing the approved onboarding plus the already-verified Vault, camera, NPC, boss, and drawer fixes. Do not push.
