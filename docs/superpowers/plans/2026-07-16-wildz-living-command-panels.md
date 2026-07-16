# Wildz Living Command Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the six existing bottom-button panels into compact, premium living-world action sheets whose actions flow through real game state.

**Architecture:** Introduce one small shared presentation component for consequence/action/response hierarchy, then apply it to existing panels without changing Receiz authority boundaries. Keep mutations in `PlayCampaign`, `WildsInventory`, `WildzMarketSheet`, and existing reducers; the shared component contains no game state.

**Tech Stack:** React 19, Next.js 15, TypeScript, existing Wildz reducers and Receiz routes, CSS.

## Global Constraints

- Preserve Vault restore, export, sort, listing, proof, and ownership behavior.
- Preserve all six toolbar positions.
- Use denser layout, not browser zoom.
- Keep touch targets at least 44×44 CSS pixels where required.
- Do not invent success for network- or proof-gated actions.
- Panel actions must invoke authoritative existing state transitions.

---

### Task 1: Shared action-sheet hierarchy and compact density

**Files:**
- Create: `src/features/play/WildzCommandInsight.tsx`
- Modify: `src/features/play/WildsCommandDock.tsx`
- Modify: `app/globals.css`
- Create: `tests/wildz-command-panels-ui.test.ts`

**Interfaces:**
- Produces: `WildzCommandInsight({ label, value, detail, children })` as a presentation-only consequence strip.

- [ ] **Step 1: Add failing source-contract tests**

```ts
assert.match(insight, /export function WildzCommandInsight/);
assert.match(dock, /wilds-command-sheet-status/);
assert.match(css, /\.wilds-command-sheet\s*\{[^}]*--wilds-sheet-density:/s);
assert.match(css, /\.wilds-command-sheet-header\s*\{[^}]*position:\s*sticky/s);
```

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/wildz-command-panels-ui.test.ts`

Expected: FAIL because the shared component and compact density contract do not exist.

- [ ] **Step 3: Implement the shared component**

```tsx
export function WildzCommandInsight({ label, value, detail, children }: {
  label: string; value: string; detail: string; children?: ReactNode;
}) {
  return <section className="wilds-command-insight" aria-label={label}>
    <span><small>{label}</small><strong>{value}</strong></span>
    <p>{detail}</p>
    {children ? <div className="wilds-command-insight-actions">{children}</div> : null}
  </section>;
}
```

- [ ] **Step 4: Tighten the shared sheet shell**

Add a compact sticky header, smaller visual gaps/padding, local content scrolling, restrained dividers, and 44px interactive hit areas. Do not use `transform: scale()` or browser zoom.

- [ ] **Step 5: Run GREEN and typecheck**

Run: `pnpm test -- tests/wildz-command-panels-ui.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/play/WildzCommandInsight.tsx src/features/play/WildsCommandDock.tsx app/globals.css tests/wildz-command-panels-ui.test.ts
git commit -m "feat: add compact living command sheet hierarchy"
```

### Task 2: Connect Field Guide, Trail Pack, Satchel, and Vault

**Files:**
- Modify: `src/features/play/PlayCampaign.tsx`
- Modify: `src/features/play/WildsInventory.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-command-panels-ui.test.ts`
- Modify: `tests/wildz-card-rail-ui.test.ts`

**Interfaces:**
- Consumes: existing `dispatch`, Trail Pack support assignment, active selection, rest/train/mission actions, inventory restore/export/list actions.
- Produces: consequence strips and direct real actions inside the four in-world command sheets.

- [ ] **Step 1: Add failing tests for authoritative actions and Vault preservation**

```ts
assert.match(campaign, /wilds-command-insight[^]*dispatch\(\{ type: "rest" \}\)/);
assert.match(campaign, /wilds-command-insight[^]*dispatch\(\{ type: "train"/);
assert.match(campaign, /assign-support/);
assert.match(inventory, /onRestoreArtifact/);
assert.match(inventory, /onExportVault/);
assert.match(inventory, /onListAsset/);
assert.match(inventory, /wilds-vault-compact-header/);
```

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/wildz-command-panels-ui.test.ts tests/wildz-card-rail-ui.test.ts`

Expected: FAIL on missing insight hierarchy and compact Vault header.

- [ ] **Step 3: Add consequences and actions to command content**

- Field Guide: show the next habitat signal and invoke the existing mission/exploration progression action.
- Trail Pack: show current synergy effect and keep leader/support mutations on existing reducer inputs.
- Satchel: expose rest, train, and mission preparation actions through existing dispatch inputs.
- Vault: preserve all behavior while combining count/search/sort/actions into `.wilds-vault-compact-header`, reducing grid/detail whitespace, and exposing current active/Trail Pack status.

- [ ] **Step 4: Run GREEN and Vault regression tests**

Run: `pnpm test -- tests/wildz-command-panels-ui.test.ts tests/wildz-card-rail-ui.test.ts tests/wildz-full-vault-regression.test.ts tests/wildz-vault-export-ui.test.ts && pnpm typecheck`

Expected: PASS with existing Vault proof/export behavior unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/features/play/PlayCampaign.tsx src/features/play/WildsInventory.tsx app/globals.css tests/wildz-command-panels-ui.test.ts tests/wildz-card-rail-ui.test.ts
git commit -m "feat: connect command panels to the living gameplay loop"
```

### Task 3: Compact Profile and Market consequence surfaces

**Files:**
- Modify: `src/features/profile/WildzProfileSheet.tsx`
- Modify: `src/features/market/WildzMarketSheet.tsx`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `app/globals.css`
- Modify: `tests/wildz-command-panels-ui.test.ts`

**Interfaces:**
- Consumes: current public profile projection and verified market settlement outcomes.
- Produces: dense profile memory/status and market ownership-consequence presentation without changing authority.

- [ ] **Step 1: Add failing tests**

```ts
assert.match(profile, /wildz-profile-impact/);
assert.match(market, /wildz-market-consequence/);
assert.match(market, /Trade settled\. Receiz admitted the ownership transfer\./);
assert.doesNotMatch(market, /setListings\([^)]*selected/);
```

- [ ] **Step 2: Run RED**

Run: `pnpm test -- tests/wildz-command-panels-ui.test.ts`

Expected: FAIL on missing compact impact/consequence regions.

- [ ] **Step 3: Implement compact real-state projections**

Profile shows identity/publication status, reputation/discovery/win facts, and a compact impact sequence derived only from available admitted profile data. Market shows the selected listing's Vault consequence before confirmation and preserves the existing settlement/pending/expired messages as the source of truth.

- [ ] **Step 4: Run market/profile regressions and typecheck**

Run: `pnpm test && pnpm typecheck`

Expected: PASS, including `wildz-market-presentation`, `wildz-market-routes`, `wildz-market-state`, `wildz-profile-sharing`, `wildz-profile`, and `wildz-public-profile-adapter` regressions.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/WildzProfileSheet.tsx src/features/market/WildzMarketSheet.tsx src/features/shell/WildzApp.tsx app/globals.css tests/wildz-command-panels-ui.test.ts
git commit -m "feat: tighten Profile and Market consequence panels"
```

### Task 4: Full verification and responsive QA

**Files:**
- Verify only; do not commit temporary screenshots or scripts.

- [ ] **Step 1: Run the complete automated suite**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`

Expected: all commands exit 0.

- [ ] **Step 2: Run rendered desktop and mobile checks**

Verify page identity, meaningful content, no framework overlay, console health, all six triggers, panel first-viewport density, Vault import/export/sort/detail actions, creature drawer states, and battle nameplates.

- [ ] **Step 3: Record remaining risks**

Report any untested external Receiz settlement/network state explicitly; do not claim it was exercised if only local UI paths were available.
