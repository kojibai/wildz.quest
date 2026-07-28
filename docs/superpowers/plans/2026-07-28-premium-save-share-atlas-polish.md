# Premium Save, Share, and Atlas Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make verified-card saving feel immediate and premium, make invite sharing native, remove periodic atlas camera hitches, and keep world labels behind game overlays.

**Architecture:** Add a small promise-aware prepared-artifact cache beside the card export boundary, then let Save and Send consume one exact proof artifact. Keep atlas terrain inputs stable while live presence updates only instanced player layers, and explicitly bound all Three.js HTML nameplates below interface overlays.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js, React Three Fiber, Drei, CSS, Node test runner.

## Global Constraints

- Do not add dependencies.
- Do not change Receiz proof formats, verification, publication, or ownership behavior.
- Prewarm only the selected eligible card and never trigger a speculative download.
- Key prepared artifacts by exact card proof/revision content, not only asset ID.
- Do not add artificial loading or success delays.
- Haptics are progressive enhancement and never gate an action.
- Reduced motion retains unmistakable working, success, and error states.
- Keep the implementation limited to save/share, atlas rendering, and world-label layering.

---

### Task 1: Prepared Card Artifact Cache

**Files:**
- Create: `src/features/play/prepared-card-artifact.ts`
- Create: `tests/prepared-card-artifact.test.ts`
- Modify: `src/features/play/card-export.ts`

**Interfaces:**
- Consumes: `PortableCardAsset`, `portableCreatureFilename`, `portableCardPngBlob`, and `createReceizProofObjectArtifact`.
- Produces:
  - `type PreparedCardArtifact = { bytes: Uint8Array; filename: string; mimeType: string; fingerprint: string }`
  - `cardArtifactFingerprint(asset: PortableCardAsset): string`
  - `createPreparedCardArtifactCache(prepare): { prepare(asset), peek(asset), clear(asset?) }`
  - `preparePortableCardArtifact(asset, options?): Promise<PreparedCardArtifact>`
  - `downloadPreparedCardArtifact(artifact): void`

- [ ] **Step 1: Write failing cache tests**

Cover exact-fingerprint reuse, concurrent promise joining, revision invalidation, and rejected-promise eviction:

```ts
test("joins preparation for the same exact card and retries rejected work", async () => {
  let calls = 0;
  const cache = createPreparedCardArtifactCache(async (asset) => {
    calls += 1;
    if (calls === 1) throw new Error("prepare_failed");
    return artifactFor(asset);
  });
  await assert.rejects(cache.prepare(card()), /prepare_failed/);
  const [left, right] = await Promise.all([cache.prepare(card()), cache.prepare(card())]);
  assert.equal(calls, 2);
  assert.strictEqual(left, right);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm test -- --test-name-pattern="prepared card artifact"`

Expected: FAIL because `prepared-card-artifact.ts` does not exist.

- [ ] **Step 3: Implement the cache and export preparation boundary**

Use canonical card content to derive the fingerprint. Store one promise per fingerprint, delete it on rejection, and bound resolved entries to the current selected-card lifecycle. Move the existing publication, PNG rendering, and native proof-object creation into `preparePortableCardArtifact`; make `downloadPortableCard` call prepare then download so existing callers preserve behavior.

- [ ] **Step 4: Run focused proof and cache tests**

Run: `pnpm test -- --test-name-pattern="prepared card artifact|native proof|Card export"`

Expected: PASS with byte-exact native artifacts and anonymous-publication requirements unchanged.

### Task 2: Premium Save and Shared Save/Send Preparation

**Files:**
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-vault-export-ui.test.ts`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Consumes: the prepared-artifact cache and download helper from Task 1.
- Produces: explicit save presentation states and a prepared artifact shared by Save and Send.

- [ ] **Step 1: Write failing UI contract tests**

Require explicit action states, premium copy, `aria-live`, a selected-card prewarm effect, prepared artifact reuse in Send, reduced-motion rules, and tactile button CSS:

```ts
assert.match(inventory, /type CardSaveState = "idle" \| "preparing" \| "saving" \| "success" \| "error"/);
assert.match(inventory, /Card secured/);
assert.match(inventory, /prepare\(selected\)/);
assert.match(styles, /\.wilds-save-card-button\[data-state="success"\]/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
```

- [ ] **Step 2: Run UI contract tests and verify failure**

Run: `pnpm test -- --test-name-pattern="Vault|rendering contract"`

Expected: FAIL on missing save states and premium selectors.

- [ ] **Step 3: Implement real-promise state transitions**

Prewarm only the selected non-retired card. Save downloads the completed artifact or joins its in-flight promise. Send uses the same prepared bytes. Add supported-device vibration calls after press, real success, and failure. Ignore speculative preparation errors until an explicit action fails. Disable duplicate Save clicks while resolving.

- [ ] **Step 4: Implement premium motion and reduced-motion CSS**

Add:

```css
.wilds-save-card-button:active:not(:disabled) { transform: translateY(2px) scale(.965); }
.wilds-save-card-button[data-state="working"] { /* restrained gold sweep + emerald glow */ }
.wilds-save-card-button[data-state="success"] { /* resolved premium success */ }
@media (prefers-reduced-motion: reduce) {
  .wilds-save-card-button,
  .wilds-card-save-celebration { animation: none; transition-duration: .01ms; }
}
```

Place the foil sweep and light motes on a pointer-events-none selected-card celebration layer. Do not insert timers before download; use only a short post-success reset timer.

- [ ] **Step 5: Run focused tests**

Run: `pnpm test -- --test-name-pattern="Vault|prepared card artifact|rendering contract"`

Expected: PASS.

### Task 3: Native Multiplayer Invite Share

**Files:**
- Modify: `src/features/play/use-wilds-multiplayer.ts`
- Modify: `src/features/play/WildsMultiplayer.tsx`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- Produces: `createInviteLink(): Promise<string>` with no clipboard side effect.
- Consumes: the returned URL in a native-share-first click handler.

- [ ] **Step 1: Update the rendering contract to require Share**

Require `aria-label="Share Wildz invite"`, `navigator.share`, neutral `AbortError`, and clipboard fallback. Require the controller’s invite-link function not to call `navigator.clipboard`.

- [ ] **Step 2: Run the multiplayer render test and verify failure**

Run: `pnpm test -- --test-name-pattern="live multiplayer"`

Expected: FAIL because the button still says Copy and the controller still copies.

- [ ] **Step 3: Separate URL creation from sharing**

Return the invite URL after updating history, with no clipboard call. In the button handler:

```ts
const url = await multiplayer.createInviteLink();
try {
  await navigator.share({ title: "Join me in Wildz", text: "Explore the living Wildz with me.", url });
  setNotice("Wildz invite shared.");
} catch (cause) {
  if (cause instanceof DOMException && cause.name === "AbortError") return;
  await navigator.clipboard.writeText(url);
  setNotice("Invite link copied.");
}
```

Branch directly to clipboard when `navigator.share` is absent, and retain an actionable notice if copying also fails.

- [ ] **Step 4: Run focused multiplayer tests**

Run: `pnpm test -- --test-name-pattern="live multiplayer|multiplayer"`

Expected: PASS.

### Task 4: Stable Atlas Terrain During Live Refresh

**Files:**
- Modify: `src/features/play/WildsWorldMap.tsx`
- Modify: `src/features/play/WildsAtlasCanvas.tsx`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- `WildsAtlasCanvas` continues consuming one projection publicly.
- Internally, static terrain dependencies use `projection.nodes`, `projection.centerRegion.x`, `projection.centerRegion.z`, and derived size—not the full projection object.

- [ ] **Step 1: Write failing atlas performance contracts**

Require a non-overlapping refresh guard and terrain memo dependencies that exclude the full projection:

```ts
assert.match(map, /refreshInFlight/);
assert.match(canvas, /\[projection\.centerRegion\.x, projection\.centerRegion\.z, projection\.nodes, size\]/);
assert.doesNotMatch(canvas, /\}, \[projection, size\]\)/);
```

- [ ] **Step 2: Run atlas contracts and verify failure**

Run: `pnpm test -- --test-name-pattern="atlas|rendering contract"`

Expected: FAIL on the full-projection terrain dependency and missing refresh guard.

- [ ] **Step 3: Isolate stable scene work**

Key terrain geometry only to terrain inputs. Memoize static scene units where inputs are stable. Keep live players and clusters as instanced meshes whose matrices update when only presence changes. Do not remount Canvas or OrbitControls.

- [ ] **Step 4: Prevent overlapping and stale presence refreshes**

Use an in-flight ref and generation token. Skip interval ticks while a request is running, ignore responses after close or after a newer generation, and clear the in-flight flag in `finally`.

- [ ] **Step 5: Run atlas tests**

Run: `pnpm test -- --test-name-pattern="atlas|sparkles|rendering contract"`

Expected: PASS with Sparkles remount behavior preserved.

### Task 5: World Labels Behind Overlays

**Files:**
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wilds-render-contract.test.ts`

**Interfaces:**
- All non-battle world HTML labels use explicit low `zIndexRange` values.
- `multiplayer-roster-open` suppresses active creature, remote-player, and trainer labels.

- [ ] **Step 1: Write failing layering contracts**

Require `zIndexRange={[10, 0]}` on the active companion label and a selector that covers both `.wilds-world-label` and `.wilds-remote-nameplate` while the roster is open.

- [ ] **Step 2: Run the layering contract and verify failure**

Run: `pnpm test -- --test-name-pattern="live multiplayer"`

Expected: FAIL because the active companion label is unbounded and not suppressed.

- [ ] **Step 3: Bound and suppress world labels**

Add an explicit low range to active creature and other non-critical world labels. Update the roster-open selector without lowering battle telemetry’s `[64, 56]` range.

- [ ] **Step 4: Run focused rendering tests**

Run: `pnpm test -- --test-name-pattern="live multiplayer|authored biome|rendering contract"`

Expected: PASS.

### Task 6: Full Verification and Commit

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run static verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Run rendered desktop and mobile interaction checks**

Flow:

```text
Open Vault -> select card -> Save -> real download -> Card secured
Open world -> Share -> native share or copy fallback
Open atlas -> rotate through multiple presence refresh intervals
Open Everyone live now -> world labels remain behind the sheet
```

Check page identity, nonblank content, framework overlays, console errors, screenshots, reduced-motion behavior, and at least one target interaction.

- [ ] **Step 3: Review the final diff**

Confirm no proof semantics, unrelated UI, dependencies, generated reports, or temporary screenshots entered the repository.

- [ ] **Step 4: Commit implementation**

```bash
git add src/features/play/prepared-card-artifact.ts src/features/play/card-export.ts src/features/play/WildsInventory.tsx src/features/play/use-wilds-multiplayer.ts src/features/play/WildsMultiplayer.tsx src/features/play/WildsWorldMap.tsx src/features/play/WildsAtlasCanvas.tsx src/features/play/WildsWorldCanvas.tsx app/globals.css tests/prepared-card-artifact.test.ts tests/wildz-vault-export-ui.test.ts tests/wilds-render-contract.test.ts docs/superpowers/plans/2026-07-28-premium-save-share-atlas-polish.md
git commit -m "Polish Wildz save share and atlas interactions"
```
