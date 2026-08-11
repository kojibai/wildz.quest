# Profile Vault Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display every explorer's published Vault cards as real card artwork in Profile, open one complete verified front/back card viewer at a time, and suppress browser zoom across gameplay without changing world-map zoom.

**Architecture:** A pure profile-card resolver validates the public index against owner-local admitted assets or verified public records. A focused `WildzProfileVaultGallery` renders lightweight published card images and mounts one complete card scene only for the active selection. `WildzApp` supplies private admitted assets only to the owner's own Profile, while CSS defines a scoped gesture boundary that preserves native Profile scrolling and the map's custom controls.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js/R3F card renderer, Node test runner, CSS touch-action gesture policy.

## Global Constraints

- Public Profile data stays limited to the existing sanitized 120-card index.
- Remote profiles resolve only published same-origin `/api/cards/[assetId]` records.
- Owner-local assets are usable only when their exact IDs also occur in the public Profile index.
- Render lightweight exact card images in the gallery and mount at most one full `WildsCardScene`.
- Do not add global `maximum-scale=1` or document-wide touch cancellation.
- Gameplay and game UI must not browser-zoom; Profile vertical scrolling stays native; world-map custom pan/zoom remains unchanged.
- Camera code is out of scope and must remain unchanged.

---

### Task 1: Verified Profile Card Resolution

**Files:**
- Create: `src/features/profile/profile-vault-card.ts`
- Create: `tests/wildz-profile-vault-gallery.test.ts`
- Reference: `src/features/play/public-card-registry.ts`
- Reference: `src/features/play/portable-card.ts`

**Interfaces:**
- Produces: `profileVaultCardImageUrl(assetId: string): string`
- Produces: `ownerProfileVaultAssets(cards: readonly PublicWildzCard[], assets: readonly PortableCardAsset[]): ReadonlyMap<string, PortableCardAsset>`
- Produces: `parseProfileVaultPublicAsset(card: PublicWildzCard, value: unknown): PortableCardAsset | null`

- [ ] **Step 1: Write failing resolver tests**

```ts
test("owner Profile admits only exact assets present in its public Vault index", () => {
  const publicCard = {
    id: publicAsset.id,
    name: publicAsset.manifest.name,
    proofDigest: publicAsset.proof.digest,
    visibility: "public" as const
  };
  const result = ownerProfileVaultAssets([publicCard], [publicAsset, privateAsset]);
  assert.deepEqual([...result.keys()], [publicAsset.id]);
});

test("remote Profile accepts only an exact verified published record", () => {
  const validRecord = createPublicWildsCardRecord(publicAsset, "https://wildz.quest/cards/test", "2026-08-11T00:00:00.000Z");
  assert.equal(parseProfileVaultPublicAsset(publicCard, { record: validRecord })?.id, publicCard.id);
  assert.equal(parseProfileVaultPublicAsset(publicCard, { record: { ...validRecord, assetId: "foreign" } }), null);
  assert.equal(parseProfileVaultPublicAsset(publicCard, { record: {} }), null);
});

test("profile card image URLs encode the exact public asset ID", () => {
  assert.equal(profileVaultCardImageUrl("wilds:a/b"), "/api/cards/wilds%3Aa%2Fb/image");
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run: `pnpm test`

Expected: TypeScript compilation fails because `profile-vault-card.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal pure resolver**

```ts
export function profileVaultCardImageUrl(assetId: string) {
  return `/api/cards/${encodeURIComponent(assetId)}/image`;
}

export function ownerProfileVaultAssets(cards, assets) {
  const publicIds = new Set(cards.map((card) => card.id));
  return new Map(assets.filter((asset) => publicIds.has(asset.id)).map((asset) => [asset.id, asset]));
}

export function parseProfileVaultPublicAsset(card, value) {
  const record = parsePublicWildsCardRecord((value as { record?: unknown } | null)?.record);
  return record && record.assetId === card.id && record.asset.id === card.id ? record.asset : null;
}
```

- [ ] **Step 4: Run the new test and full suite to verify GREEN**

Run: `pnpm test`

Expected: all suites pass, including exact-ID rejection cases.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/features/profile/profile-vault-card.ts tests/wildz-profile-vault-gallery.test.ts
git commit -m "feat: validate Profile Vault card records"
```

### Task 2: Responsive Profile Gallery and One-Card Viewer

**Files:**
- Create: `src/features/profile/WildzProfileVaultGallery.tsx`
- Modify: `src/features/profile/WildzProfileSheet.tsx`
- Modify: `src/features/play/WildsCardScene.tsx`
- Modify: `tests/wildz-profile-vault-gallery.test.ts`

**Interfaces:**
- Consumes: Task 1 resolver functions.
- Produces: `WildzProfileVaultGallery({ cards, ownerAssets? })`
- Updates: `WildzProfileSheet` accepts `vaultAssets?: readonly PortableCardAsset[]`.
- Updates: `WildsCardScene` accepts optional `tapToFlip?: boolean` while preserving its default standalone behavior.

- [ ] **Step 1: Add failing component and interaction contracts**

```ts
test("Profile mounts the real lightweight gallery and one selected complete card scene", () => {
  assert.match(profile, /<WildzProfileVaultGallery cards=\{profile\.vault\} ownerAssets=\{vaultAssets\}/);
  assert.match(gallery, /profileVaultCardImageUrl\(card\.id\)/);
  assert.match(gallery, /<WildsCardScene[^>]*asset=\{selectedAsset\}[^>]*tapToFlip/);
  assert.doesNotMatch(gallery, /cards\.map[\s\S]*<WildsCardScene/);
});

test("selected viewer aborts stale requests and restores its exact origin", () => {
  for (const token of ["AbortController", "controller.abort()", "originRef", "canRestoreFocus", "aria-modal=\"true\"", "inert"])
    assert.match(gallery, new RegExp(token));
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run: `pnpm test`

Expected: failure because the gallery component, viewer lifecycle, and `tapToFlip` prop are absent.

- [ ] **Step 3: Implement the gallery**

```tsx
<section className="wildz-profile-vault" aria-label="Published companion cards">
  <header><span>Published Vault</span><strong>{cards.length} cards</strong></header>
  <div className="wildz-profile-card-grid">
    {cards.map((card) => (
      <button aria-label={`Open ${card.name} card`} key={card.id} onClick={(event) => openCard(card, event.currentTarget)}>
        <img alt={`${card.name} card front`} src={profileVaultCardImageUrl(card.id)} />
        <span>{card.name}</span>
      </button>
    ))}
  </div>
</section>
```

Implement selection with these exact rules:

- Check `ownerProfileVaultAssets` first.
- Otherwise fetch `/api/cards/${encodeURIComponent(id)}` with one active `AbortController`.
- Parse through `parseProfileVaultPublicAsset`; never trust raw JSON.
- Opening stores the exact button in `originRef`.
- Escape closes the viewer before the shell overlay handler sees it.
- Viewer focus is trapped; gallery is inert and `aria-hidden` while selected.
- Close cancels fetch and restores the connected enabled origin in a cancellable RAF.
- Loading and unavailable states remain inside the focused viewer.
- `WildsCardScene tapToFlip` flips only for a short stationary tap whose target is not an interactive descendant.

- [ ] **Step 4: Run focused/full tests to verify GREEN**

Run: `pnpm test`

Expected: all suites pass; existing standalone card scene contracts remain unchanged by default.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/features/profile/WildzProfileVaultGallery.tsx src/features/profile/WildzProfileSheet.tsx src/features/play/WildsCardScene.tsx tests/wildz-profile-vault-gallery.test.ts
git commit -m "feat: show complete cards in explorer Profiles"
```

### Task 3: Owner Wiring, Premium Responsive Layout, and Scoped Zoom Boundary

**Files:**
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-profile-vault-gallery.test.ts`
- Modify: `tests/wildz-mobile-performance.test.ts`

**Interfaces:**
- Consumes: `WildzProfileSheet.vaultAssets` from Task 2.
- Owner Profile passes `ownerPlayState.inventory`; remote Profile passes no local assets.
- Produces CSS boundaries `.wildz-app`, `.wildz-shell-overlay`, `.wildz-profile-sheet`, `.wildz-profile-card-grid`, and `.wilds-atlas-canvas canvas` with distinct gesture semantics.

- [ ] **Step 1: Add failing shell/privacy/layout/gesture contracts**

```ts
test("only the owner Profile receives admitted local Vault assets", () => {
  assert.match(shell, /vaultAssets=\{viewingOwnProfile \? ownerPlayState\.inventory : undefined\}/);
});

test("game zoom is suppressed without breaking Profile scroll or map zoom", () => {
  assert.match(css, /\.wildz-app\s*\{[^}]*touch-action:\s*none/);
  assert.match(css, /\.wildz-profile-sheet\s*\{[^}]*touch-action:\s*pan-y/);
  assert.match(css, /\.wilds-atlas-canvas canvas\s*\{[^}]*touch-action:\s*none/);
  assert.doesNotMatch(layout, /maximumScale|max(?:imum)?-scale|userScalable:\s*false/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm test`

Expected: owner asset wiring, gallery CSS, and explicit scoped gesture assertions fail.

- [ ] **Step 3: Implement shell wiring and CSS**

```tsx
<WildzProfileSheet
  profile={(viewingOwnProfile ? localPublicProfile : remoteProfile)!}
  vaultAssets={viewingOwnProfile ? ownerPlayState.inventory : undefined}
  editable={viewingOwnProfile}
  publicationStatus={viewingOwnProfile && profileStatus !== "ready" ? "local" : "published"}
  shareEnabled={!viewingOwnProfile || profileStatus === "ready"}
/>
```

CSS requirements:

- `wildz-profile-card-grid`: responsive two-column mobile grid with exact card aspect ratio and no crop.
- Each card button: at least 44×44, scroll-safe `touch-action: pan-y`, visible focus ring, selected/active marker.
- Viewer: contained above the Profile, one-card maximum, safe-area-aware, dark Wildz surface, no background interaction.
- Reduced motion: remove flip transition.
- `.wildz-app`: prevent browser gestures over live gameplay.
- `.wildz-shell-overlay`: prevent browser pinch/double-tap outside its native scroll surface.
- `.wildz-profile-sheet` and focused card-back scroll: native `pan-y` momentum scrolling.
- Preserve `.wilds-atlas-canvas canvas { touch-action: none; }` so its existing custom controls continue unchanged.

- [ ] **Step 4: Run full tests, typecheck, lint, and diff check**

Run: `pnpm test && pnpm typecheck && pnpm lint && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 5: Commit Task 3**

```bash
git add src/features/shell/WildzApp.tsx app/globals.css tests/wildz-profile-vault-gallery.test.ts tests/wildz-mobile-performance.test.ts
git commit -m "fix: scope Profile and game touch gestures"
```

### Task 4: Production Verification and Release Commit

**Files:**
- Modify only if verification finds a Profile-specific defect.

**Interfaces:**
- Verifies the completed public resolver, owner fast path, front/back interaction, focus lifecycle, responsiveness, scroll, and gesture boundaries.

- [ ] **Step 1: Run the production build**

Run: `pnpm build`

Expected: exit 0 with only already-documented dependency warnings.

- [ ] **Step 2: Start the production artifact**

Run: `pnpm start -p 49817`

Expected: `Ready` on the existing local address.

- [ ] **Step 3: Verify in the user's chosen browser**

Verify at 390×844 and 844×390:

- Owner Profile shows every public-index card as exact uncropped artwork.
- Remote Profile progressively resolves published artwork without local private fallback.
- Selecting a card mounts one complete viewer; front/back tap, swipe, Enter, and Space work.
- Escape closes the card viewer first and returns focus to the exact gallery origin.
- One failed record leaves other cards usable.
- Profile and card-back scrolling are native and smooth.
- Double-tap/pinch does not browser-zoom gameplay or game UI.
- World map custom zoom still works.
- Console/page/request errors are zero except explicitly expected offline/authority responses.

- [ ] **Step 4: Run final fresh gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && git diff --check`

Expected: every command exits 0 with exact test counts recorded.

- [ ] **Step 5: Commit any verification-only correction**

```bash
git add src/features/profile/WildzProfileVaultGallery.tsx src/features/profile/WildzProfileSheet.tsx src/features/profile/profile-vault-card.ts src/features/play/WildsCardScene.tsx src/features/shell/WildzApp.tsx app/globals.css tests/wildz-profile-vault-gallery.test.ts tests/wildz-mobile-performance.test.ts
git commit -m "fix: qualify Profile Vault gallery"
```

- [ ] **Step 6: Confirm clean tracked worktree and report exact evidence**

Run: `git status --short && git log -4 --oneline`

Expected: no tracked changes and the design/feature commits are visible.
