# Wildz v105 Frictionless Vault Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make verified Vault restore hot, bounded, and continuously painted while adding a beautiful bearer Receiz ID Card and canonical username creation backed only by `@receiz/sdk@105.0.0`.

**Architecture:** Keep the mounted gameplay tree stable for same-owner restores and project every imported card through the existing paged inventory. Build the ID Card from the same V3 player/Vault proof as full Vault export, then append the exact SDK identity artifact and existing identity binding. Replace only a fresh automatic bootstrap identity through a new atomic continuity operation that creates the chosen username with the official v105 SDK.

**Tech Stack:** Next.js 15, React 19, TypeScript, IndexedDB continuity repository, `@receiz/sdk@105.0.0`, Node test runner, Canvas/PNG proof trailers.

## Global Constraints

- Keep `@receiz/sdk` and `@receiz/ai-skills` exactly at `105.0.0`; add no dependencies.
- Do not alter the Three.js camera, audio, music, world visuals, existing button language, or gameplay rules.
- Same-owner import must keep the current world, canvas, camera, audio graph, drawer, and command dock mounted and painted.
- Identity changes may remount the owner-scoped gameplay tree.
- Imported collections must use the existing 4-card compact and 8-card wide pagination; never mount a second Commerce gallery.
- The Receiz ID Card and identity-bearing full Vault are passwordless bearer account credentials and must display an explicit warning before save.
- Player progress can restore only under the verified Receiz ID carried by the artifact; it can never merge into a different Receiz ID.
- Do not rewrite SDK key files, synthesize account-state proof, invent global username mutation, or weaken existing fail-closed verification.
- Preserve the unrelated untracked `.superpowers/` directory.

---

### Task 1: Keep same-owner restore mounted and remove the duplicate collection shelf

**Files:**
- Modify: `tests/wildz-continuity-and-shell.test.ts`
- Modify: `src/features/shell/WildzApp.tsx:322-334`
- Modify: `src/features/play/WildsInventory.tsx:17-21,65,100-103,185-196,217-223`
- Modify: `src/features/identity/WildzGenesis.tsx:8,48-56`

**Interfaces:**
- Consumes: existing `PlayCampaign` in-place restore callback returning `WildzCommittedArtifactRestore`.
- Produces: gameplay key `${identity.keyId}:${identity.actorId}` and one bounded inventory projection for local and imported cards.

- [ ] **Step 1: Write the failing source-contract test**

Add this test to `tests/wildz-continuity-and-shell.test.ts`:

```ts
test("same-owner Vault restore preserves the mounted world and one bounded inventory", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const genesis = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");

  assert.match(shell, /key=\{`\$\{identity\.keyId\}:\$\{identity\.actorId\}`\}/);
  assert.doesNotMatch(shell, /key=\{[^}]*restoreEpoch/);
  assert.match(inventory, /inventoryPageSize\(compact\)/);
  assert.doesNotMatch(inventory, /receizVaults|wilds-receiz-vault-library|wilds-receiz-vault-grid/);
  assert.doesNotMatch(inventory, /readReceizCommerceVaultLibrary|saveReceizCommerceVault/);
  assert.doesNotMatch(genesis, /saveReceizCommerceVault/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-continuity-and-shell.test.js
```

Expected: FAIL because the shell key contains `restoreEpoch` and the duplicate Commerce gallery still exists.

- [ ] **Step 3: Implement the stable lifecycle and single collection**

In `WildzApp.tsx`, change only the owner-scoped key:

```tsx
key={`${identity.keyId}:${identity.actorId}`}
```

In `WildsInventory.tsx`, remove the Commerce-library imports, `receizVaults` state, its mount effect, the `outcome.commerceProjection` save block, and the complete `wilds-receiz-vault-library` section. Keep `currentPlayState = outcome.playState`, selected-card adoption, import status, and normal pagination intact.

In `WildzGenesis.tsx`, remove `saveReceizCommerceVault` and the optional projection-save block. The verified committed restore remains authoritative.

- [ ] **Step 4: Run the focused continuity and pagination tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-continuity-and-shell.test.js .test-build/tests/inventory-pagination.test.js .test-build/tests/wildz-full-vault-regression.test.js
```

Expected: all tests PASS, including the existing 97-card restore and 4/8 pagination contracts.

- [ ] **Step 5: Commit the mounted-restore slice**

```bash
git add tests/wildz-continuity-and-shell.test.ts src/features/shell/WildzApp.tsx src/features/play/WildsInventory.tsx src/features/identity/WildzGenesis.tsx
git commit -m "perf: keep Vault restore mounted and bounded"
```

### Task 2: Create a chosen v105 Receiz username only at fresh genesis

**Files:**
- Modify: `tests/wildz-identity-repository.test.ts`
- Modify: `src/lib/receiz/wildz-identity-adapter.ts:1-70,260-350`
- Modify: `src/features/shell/WildzApp.tsx:269-280,356-360`
- Modify: `src/features/identity/WildzGenesis.tsx:14-90`
- Modify: `tests/wildz-genesis-copy.test.ts`

**Interfaces:**
- Consumes: `createReceizIdIdentity({ username, displayName, deviceName })`, `defaultIdentityRepository.prepare`, and the existing continuity transaction.
- Produces: `createNamedWildzIdentity(current: WildzContinuitySnapshot, input: { username: string; displayName?: string }): Promise<WildzContinuitySnapshot>`.
- Produces: `WildzGenesis.onCreateIdentity(username: string): Promise<WildzIdentitySession>`.

- [ ] **Step 1: Write failing adapter and UI contracts**

Add these imports to `tests/wildz-identity-repository.test.ts` (the memory continuity database import already exists):

```ts
import type { WildzCharacterGenesis } from "../src/features/identity/wildz-genesis";
import { initialPlayState } from "../src/features/play/game-state";
import { createNamedWildzIdentity } from "../src/lib/receiz/wildz-identity-adapter";
```

Then add this test:

```ts
test("a chosen SDK username replaces only an untouched automatic identity", async () => {
  const database = createMemoryWildzContinuityDatabase();
  const repository = createWildzIdentityRepository({ database });
  const automatic = await repository.bootstrap();
  const current = {
    session: automatic,
    playState: null,
    character: null,
    playerContinuity: null,
    restoreEpoch: 0
  };
  const named = await createNamedWildzIdentity(
    current,
    { username: "@Trail_Keeper", displayName: "Trail Keeper" },
    { database, repository }
  );

  assert.equal(named.session.username, "trail_keeper");
  assert.equal(named.session.actorId, "trail_keeper");
  assert.equal(named.session.portableStateStatus, "verified");
  assert.deepEqual(await repository.active(), named.session);
  assert.equal(await database.read("ownerStates", wildzOwnerScope(automatic.keyId, automatic.actorId)), null);

  await assert.rejects(
    createNamedWildzIdentity(
      { ...named, playState: structuredClone(initialPlayState) },
      { username: "second_name" },
      { database, repository }
    ),
    /wildz_identity_username_change_not_fresh/
  );
  await assert.rejects(
    createNamedWildzIdentity(
      { ...named, character: { identityRef: named.session.keyId } as unknown as WildzCharacterGenesis },
      { username: "third_name" },
      { database, repository }
    ),
    /wildz_identity_username_change_not_fresh/
  );
});
```

Add these assertions to `tests/wildz-genesis-copy.test.ts`:

```ts
assert.match(source, /aria-label="Choose your Receiz username"/);
assert.match(source, /onCreateIdentity/);
assert.match(source, /Create Receiz ID/);
assert.match(source, /replace\(\/\^@\+\//);
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-identity-repository.test.js .test-build/tests/wildz-genesis-copy.test.js
```

Expected: FAIL because `createNamedWildzIdentity` and the username creation UI do not exist.

- [ ] **Step 3: Implement the fresh identity transaction**

Export this adapter API:

```ts
export async function createNamedWildzIdentity(
  current: WildzContinuitySnapshot,
  input: { username: string; displayName?: string },
  dependencies: {
    database?: WildzContinuityDatabase;
    repository?: Pick<WildzIdentityRepository, "active" | "prepare" | "writePrepared">;
    createIdentity?: typeof createReceizIdIdentity;
  } = {}
): Promise<WildzContinuitySnapshot> {
  if (current.character || current.playState) throw new Error("wildz_identity_username_change_not_fresh");
  const database = dependencies.database ?? defaultContinuityDatabase;
  const repository = dependencies.repository ?? defaultIdentityRepository;
  const active = await repository.active();
  if (!sameOwner(active, current.session)) throw new Error("wildz_identity_username_change_stale");
  const username = normalizedIdentitySealUsername(input.username);
  const identity = await (dependencies.createIdentity ?? createReceizIdIdentity)({
    username,
    displayName: input.displayName?.trim() || "Wildz Explorer",
    deviceName: "Wildz"
  });
  const prepared = await repository.prepare(identity.keyFile);
  await database.transaction(["identities", "meta"], "readwrite", (tx) =>
    repository.writePrepared(tx, prepared, true)
  );
  continuityRestoreEpoch += 1;
  return {
    session: prepared.session,
    playState: null,
    character: null,
    playerContinuity: null,
    restoreEpoch: continuityRestoreEpoch
  };
}
```

Wrap the function body in `enqueueContinuityOperation` so it serializes with restore/save. In `WildzApp`, create an `onCreateIdentity` callback that calls this function, accepts the returned snapshot, and clears the published-profile ref when the identity changes.

In `WildzGenesis`, keep the restore path available and add a compact username field before explorer choice. Disable explorer creation until the user has deliberately created or restored a Receiz ID for this genesis view. Normalize visual input by removing leading `@`, lowercasing, and allowing only `[a-z0-9._-]`; send the canonical value to `onCreateIdentity`. Show the resulting `@username` from the returned session and reuse the existing busy/error presentation.

- [ ] **Step 4: Run adapter, genesis, and owner continuity tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-identity-repository.test.js .test-build/tests/wildz-genesis-copy.test.js .test-build/tests/wildz-owner-continuity.test.js .test-build/tests/wildz-canonical-session-alignment.test.js
```

Expected: all tests PASS and no existing identity/owner boundary is weakened.

- [ ] **Step 5: Commit canonical username creation**

```bash
git add tests/wildz-identity-repository.test.ts tests/wildz-genesis-copy.test.ts src/lib/receiz/wildz-identity-adapter.ts src/features/shell/WildzApp.tsx src/features/identity/WildzGenesis.tsx
git commit -m "feat: create named Receiz IDs at genesis"
```

### Task 3: Build a full-state bearer Receiz ID Card

**Files:**
- Modify: `src/lib/receiz/wildz-identity-seal.ts:83-206`
- Modify: `src/lib/receiz/wildz-identity-adapter.ts:17-25,350-455`
- Modify: `tests/wildz-identity-seal.test.ts`
- Modify: `tests/wildz-full-vault-regression.test.ts`

**Interfaces:**
- Produces: `createWildzIdentityCardArtworkPng(session: WildzIdentitySession): Promise<Uint8Array>`.
- Preserves: `createWildzIdentitySealPng(keyFile, session): Promise<Uint8Array>` for existing callers.
- Produces: `createWildzIdentityPlayerCard(input: { keyFile: ReceizKeyFile; session: WildzIdentitySession; assets: PortableCardAsset[]; player: WildsPlayerVaultPayload; passphrase?: string }): Promise<Uint8Array>`.
- Produces: `downloadWildzIdentityPlayerCard(session, assets, player, options?): Promise<{ identityBound: true }>`.

- [ ] **Step 1: Write the failing round-trip tests**

In `tests/wildz-identity-seal.test.ts`, create a v105 identity, two sealed cards, and a complete `WildsPlayerVaultPayload`. Call `createWildzIdentityPlayerCard`, then assert:

```ts
const restoredIdentity = await readReceizIdentityArtifact(cardBytes);
const account = await projectReceizIdentityAccount(restoredIdentity);
const proof = readPortableVaultFromPng(cardBytes);
const verified = verifyPortableVaultPng(cardBytes);

assert.equal(restoredIdentity.keyId, identity.keyFile.keyId);
assert.equal(account.owner.username, "card_keeper");
assert.equal(account.portableStateStatus, "verified");
assert.equal(proof.schema, "receiz.wilds_vault_png_proof.v3");
assert.deepEqual(proof.assets.map((asset) => asset.id).sort(), assets.map((asset) => asset.id).sort());
assert.equal(proof.player?.playerId, "card_keeper");
assert.equal(verified.ok, true);
assert.ok(verified.player);
```

Extend the 97-card regression to run the generated ID Card through `createWildzArtifactCodec` and both restore/cold-reload assertions already used for the full Vault.

- [ ] **Step 2: Run the identity and 97-card tests and verify failure**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-identity-seal.test.js .test-build/tests/wildz-full-vault-regression.test.js
```

Expected: FAIL because the full-state ID Card creators do not exist.

- [ ] **Step 3: Separate artwork from authority and compose the carrier**

In `wildz-identity-seal.ts`, export the artwork renderer as:

```ts
export async function createWildzIdentityCardArtworkPng(session: WildzIdentitySession) {
  return renderWildzIdentitySealArtwork({
    keyId: session.keyId,
    username: session.username,
    displayName: session.displayName
  });
}
```

Update `createWildzIdentitySealPng` to validate `keyId`, call that renderer, then append authority exactly as before. Refine only the card artwork copy to say `RECEIZ ID`, `PORTABLE ACCOUNT`, `@username`, `BEARER CREDENTIAL`, and a short key fingerprint; do not alter game surfaces.

In `wildz-identity-adapter.ts`, use `embedPortableVaultInPng` to place assets and player into the identity artwork, then call the existing `createWildzIdentityBoundPlayerVault` so the exact SDK identity trailer and identity/player-Vault binding retain the established order and validation:

```ts
export async function createWildzIdentityPlayerCard(input: {
  keyFile: ReceizKeyFile;
  session: WildzIdentitySession;
  assets: PortableCardAsset[];
  player: WildsPlayerVaultPayload;
  passphrase?: string;
}) {
  if (input.keyFile.keyId !== input.session.keyId) throw new Error("wildz_identity_card_key_id_mismatch");
  const artwork = await createWildzIdentityCardArtworkPng(input.session);
  const vaultBytes = embedPortableVaultInPng(artwork, input.assets, input.player);
  return createWildzIdentityBoundPlayerVault({
    keyFile: input.keyFile,
    vaultBytes,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
}
```

Implement `downloadWildzIdentityPlayerCard` with the same protected `withKeyFile`, optional passphrase acquisition, cleanup-safe `downloadBlob`, and normalized filename rules as full Vault export. For the `card_keeper` test identity, the exact filename is `card_keeper.receiz-id-card.png`; production derives the prefix through `normalizedIdentitySealUsername(session.username)`.

- [ ] **Step 4: Run all identity carrier and restore tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-identity-seal.test.js .test-build/tests/wildz-artifact-codec.test.js .test-build/tests/wildz-restore.test.js .test-build/tests/wildz-full-vault-regression.test.js .test-build/tests/wildz-vault-login-integration.test.js
```

Expected: all tests PASS; SDK identity/account projection, V3 player state, cards, binding, owner mismatch, and cold reload remain verified.

- [ ] **Step 5: Commit the bearer ID Card carrier**

```bash
git add src/lib/receiz/wildz-identity-seal.ts src/lib/receiz/wildz-identity-adapter.ts tests/wildz-identity-seal.test.ts tests/wildz-full-vault-regression.test.ts
git commit -m "feat: carry full continuity in Receiz ID Card"
```

### Task 4: Add tactile, explicit ID Card save to the existing Vault controls

**Files:**
- Modify: `tests/wildz-vault-export-ui.test.ts`
- Modify: `src/features/play/WildsInventory.tsx:27-65,132-168`
- Modify: `src/features/play/PlayCampaign.tsx:96-132,790-827`
- Modify: `src/features/shell/WildzApp.tsx:1-20,322-335`

**Interfaces:**
- Consumes: `downloadWildzIdentityPlayerCard(session, assets, player)` from Task 3.
- Produces: `PlayCampaign.onExportIdentityCard(assets, player): Promise<unknown>`.
- Produces: `WildsInventory.onExportIdentityCard(assets, player): Promise<unknown>`.

- [ ] **Step 1: Write the failing UI contract**

Extend `tests/wildz-vault-export-ui.test.ts`:

```ts
assert.match(shell, /downloadWildzIdentityPlayerCard/);
assert.match(campaign, /onExportIdentityCard/);
assert.match(inventory, /aria-label="Save Receiz ID Card"/);
assert.match(inventory, /This image is your Receiz account/);
assert.match(inventory, /giving it away gives account access/);
assert.match(inventory, /aria-busy=\{identityCardSaving\}/);
assert.match(inventory, /wilds-action-feedback/);
```

- [ ] **Step 2: Run the export UI test and verify failure**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-vault-export-ui.test.js
```

Expected: FAIL because the ID Card action is not wired to the live player snapshot.

- [ ] **Step 3: Wire the existing live snapshot into a tactile save action**

Add `onExportIdentityCard` alongside `onExportVault` through `WildzApp`, `PlayCampaign`, and `WildsInventory`. In `WildsInventory`, add `identityCardSaving` state and an icon-only action using the existing `wilds-import-card` and `wilds-action-feedback` classes. Its handler must:

```tsx
if (!window.confirm("This image is your Receiz account. Anyone who has it can access this account; giving it away gives account access. Save it now?")) return;
setIdentityCardSaving(true);
setVaultMessage("Sealing your Receiz ID Card…");
try {
  await onExportIdentityCard(state.inventory, playerVault());
  setVaultMessage("Receiz ID Card saved with your complete verified Wildz continuity.");
} catch (error) {
  setVaultMessage(error instanceof Error ? `ID Card save failed: ${error.message}` : "ID Card save failed. Try again from this browser.");
} finally {
  setIdentityCardSaving(false);
}
```

The button must expose `aria-label`, `aria-busy`, disabled/busy state, pressed animation, and status text without adding a new panel or changing the existing Vault layout. In `WildzApp`, pass `downloadWildzIdentityPlayerCard(identity, assets, player)`.

- [ ] **Step 4: Run UI, render, and action feedback tests**

Run:

```bash
pnpm exec tsc -p tsconfig.test.json
node scripts/patch-test-imports.mjs
node --test .test-build/tests/wildz-vault-export-ui.test.js .test-build/tests/wildz-command-panels-ui.test.js .test-build/tests/wilds-render-contract.test.js .test-build/tests/wildz-mobile-ui-polish.test.js
```

Expected: all tests PASS; the action reuses existing tactile visual behavior and no new panel is introduced.

- [ ] **Step 5: Commit the ID Card action**

```bash
git add tests/wildz-vault-export-ui.test.ts src/features/play/WildsInventory.tsx src/features/play/PlayCampaign.tsx src/features/shell/WildzApp.tsx
git commit -m "feat: add bearer Receiz ID Card save"
```

### Task 5: Verify complete continuity, performance, and production readiness

**Files:**
- Verify: all `tests/*.test.ts`, production build, v105 repository check, and mobile Safari-sized interaction flow.

**Interfaces:**
- Consumes: all outputs from Tasks 1-4.
- Produces: a verified implementation commit on `main` with no dependency, visual-world, camera, or audio changes.

- [ ] **Step 1: Run static and v105 checks**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm receiz:check
```

Expected: all commands exit 0 and the Receiz checker reports exact v105 alignment.

- [ ] **Step 2: Run the complete compiled test suite**

Run:

```bash
pnpm test
```

Expected: every test PASS, including identity authority, different-owner failure, 97-card continuity, pagination, shell, and export UI.

- [ ] **Step 3: Run the production build**

Run:

```bash
pnpm build
```

Expected: Next.js production build exits 0 with no TypeScript or route errors.

- [ ] **Step 4: Verify mobile interaction in WebKit**

Start the production server and inspect `/world` at the existing mobile WebKit profile. Confirm: world is painted before/during/after a same-owner restore; the canvas DOM node survives the restore; the Vault shows only the normal paged card grid; Save Vault and Save Receiz ID Card animate immediately; cancelling the bearer warning downloads nothing; confirming produces a PNG; closing the Vault returns to a still-painted dark world.

- [ ] **Step 5: Review the final diff and task commits**

```bash
git diff --check
git status --short
git log --oneline -6
```

Expected: no whitespace errors, no tracked working-tree changes remain, `.superpowers/` remains untracked and untouched, and each task has its focused commit. If a check fails, return to that task's red-green cycle and amend it with a new focused `fix:` commit before repeating all five verification steps.
