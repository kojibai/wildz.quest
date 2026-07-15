# Wildz V3 Production Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the accepted standalone Wildz PWA with verified Vault/Identity Seal login, complete Wilds V3 gameplay, full card access and ordering, durable public/economy rails, and release-grade mobile/PWA qualification.

**Architecture:** Preserve the accepted full-screen standalone UI while migrating proof authority and V3 domain behavior behind focused adapters. Execute five independently reviewable plan documents across six strict dependency checkpoints: identity authority; V8/combined-Vault continuity; public projection and economy; pure V3 kernel and world; player experience; production qualification. The kernel plan is intentionally split by the public-economy checkpoint so the approved delivery order is preserved without duplicating V3 authority.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Three.js 0.182, React Three Fiber 9.6, Drei 10.7, `@receiz/sdk` 100.0.0, Node test runner, Playwright/WebKit and Chromium browser QA, Web App Manifest, service worker, IndexedDB, Web Crypto.

## Global Constraints

- Work on `main`; do not create a release branch and do not push.
- Preserve the accepted standalone files checkpointed in commit `d1ac904`; merge behavior into those files and never replace them wholesale.
- Feature completeness is pinned to upstream `v3.0.0` commit `1cf84c0154b8cba45b0c0730dc0752235f758be8`.
- Include only audited Wildz fixes through upstream `a9b0f0eaef4af894efd052e40f09299244c4ffd4`; exclude storefront and merchant product code.
- Use the installed `@receiz/sdk` 100.0.0 for identity, artifact, proof, publication, session, and capability decisions.
- Receiz MCP is tooling only; MCP or AI output never outranks verified proof.
- Keep the customer-facing product `Wildz` at `wildz.quest`; do not add commerce navigation, storefront, cart, or merchant administration.
- A verified identity-bearing Vault activates its embedded identity and V3 continuity; an Identity Seal activates its embedded identity; a card-only Vault never invents identity authority.
- Vault/Seal compatibility is proof-based across Receiz Commerce, receiz.app, Signal, sealed-card, original Wildz, and SDK-compatible containers; the writer application never gates a verified Wildz card.
- Restore every unique verified Wildz card ID and the exact embedded username. Identical duplicates may deduplicate once; a conflicting duplicate, dropped unique card, or fallback to the previously active username fails qualification.
- Plaintext key files and raw private key material are forbidden in `localStorage`, logs, analytics, errors, public projections, prompts, screenshots, and MCP output.
- New saves are identity-scoped; legacy global saves migrate once and never leak across owners.
- The existing Safari-safe bound `window.fetch` adapter remains covered by regression tests.
- Preserve the six-slot dock order: Card Vault, Field Guide, Player Profile, Social Market, Trail Pack / Wilds Heartbeat, Foraging Satchel.
- Render every owned card in the horizontal rail; shared ordering is rarity, newest, or oldest using real manifest data.
- Final WebKit and Chromium gates must each prove content-aware Seal/Vault restore, exact embedded username after cold relaunch, complete horizontally scrollable rail, complete Card Vault pagination, and all three source-computed orders.
- Remote authority fails closed when credentials or Receiz capabilities are unavailable; never simulate publication, settlement, or ownership transfer.
- No new npm runtime dependency is required for V3.
- Every implementation task uses TDD, focused verification, and a task-scoped commit.
- Final implementation is committed on `main`; push remains the user's action.

---

## Plan Set and Ownership

| Checkpoint | Plan | Independently testable deliverable |
|---|---|---|
| 1 | `2026-07-15-wildz-v3-identity-authority.md` | Secure automatic identity, source-compatible Seal import/export, content-aware artifact classification, and authenticated Receiz session bridge |
| 2 | `2026-07-15-wildz-v3-kernel-continuity.md`, Phase A | V8 saves, owner-bound combined Vault continuity, atomic owner restore, and identity-scoped persistence |
| 3 | `2026-07-15-wildz-v3-public-economy.md` | Durable public profiles/cards, authenticated listings/trades, verified Connect settlement, and append-only ownership projection |
| 4 | `2026-07-15-wildz-v3-kernel-continuity.md`, Phase B | Complete pure V3 domain kernel, canonical world repository, and exact snapshot/client API |
| 5 | `2026-07-15-wildz-v3-player-experience.md` | Settlements, ecology, bosses/raids, social/mastery/narrative UI, Trail Pack, complete card rail, and profile sharing in the accepted shell |
| 6 | `2026-07-15-wildz-v3-production-release.md` | Offline/update PWA, security, accessibility, performance, release scripts, browser evidence, and final release commit |

## Shared Interface Map

- `src/lib/receiz/wildz-identity-repository.ts` owns protected local identity persistence and emits `WildzIdentitySession`.
- `src/lib/receiz/wildz-artifact-codec.ts` emits `WildzArtifactInspection` without mutating active state.
- `src/lib/receiz/wildz-continuity-coordinator.ts` consumes `WildzArtifactInspection`, `WildsPlayerVaultPayload`, `WildzIdentityRepository`, and `WildzPlayerStateRepository` to commit an owner-coherent restore.
- `src/features/play/wilds-player-vault.ts` retains the V3 `receiz.wilds_player_vault.v3` payload and reconciliation contract.
- `src/lib/receiz/wilds-world-repository.ts` separates canonical Receiz publication from local-practice state.
- `src/features/play/use-wilds-world.ts` consumes the exact `{ projection, mode }` snapshot response.
- `src/features/play/wilds-card-order.ts` is the only card-order comparator used by the rail and Card Vault.
- `src/features/play/wilds-trail-pack.ts` projects leader/support composition, synergy, mood, memory, and whispers from V8/V3 state.
- `src/lib/receiz/wildz-public-repository.ts` owns durable public profile/card projections; `src/lib/receiz/wildz-market-repository.ts` requires remote compare-and-append admission for listings, trades, ownership, and receipts.
- Production routes derive actors from `receizRequestSession`; request JSON never supplies trusted actor identity.

---

### Task 0: Verify the Existing Accepted Standalone Checkpoint

**Files:**
- Verify only: accepted standalone source and tests recorded by commit `d1ac904`
- Verify only: `docs/superpowers/specs/2026-07-15-wildz-v3-production-continuity-design.md`

**Interfaces:**
- Consumes: already-finished standalone UI, Safari-safe SDK fetch correction, and approved design.
- Produces: evidence that implementation begins from the accepted checkpoint without redoing or recommitting completed work.

- [ ] **Step 1: Confirm the branch and checkpoint ancestry**

```bash
git branch --show-current
git merge-base --is-ancestor d1ac904 HEAD
git status --short
```

Expected: branch is `main`; the ancestry command exits 0; only plan-document edits from the current planning pass may be present.

- [ ] **Step 2: Confirm the preserved file set exists in the checkpoint**

```bash
git show --format= --name-only d1ac904 -- \
  app/globals.css \
  src/features/play/PlayCampaign.tsx \
  src/features/play/WildsBattle.tsx \
  src/features/play/WildsCommandDock.tsx \
  src/features/play/WildsCreatureThumbnail.tsx \
  src/features/play/WildsWorldCanvas.tsx \
  src/features/play/WildzSocialDeck.tsx \
  src/lib/receiz/receiz-commerce-vault.ts \
  tests/wilds-command-dock.test.ts \
  tests/wilds-render-contract.test.ts \
  tests/wildz-continuity-and-shell.test.ts \
  tests/wildz-social-deck.test.ts
```

Expected: all twelve paths print. Do not recreate, restage, or reimplement this checkpoint.

- [ ] **Step 3: Re-run the current baseline**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm secret:scan
pnpm receiz:doctor
```

Expected: the complete current test suite passes; typecheck, lint, and secret scan exit 0; doctor reports local identity/artifact/proof rails available and truthfully marks unconfigured remote rails `needs-env`.

- [ ] **Step 4: Record a no-op checkpoint result**

```bash
git status --short
```

Expected: no source or test file changed during Task 0. Planning-doc changes may remain until the plan-set documentation commit; no baseline commit is created.

---

### Task 1: Execute Identity Authority Plan

**Files:**
- Plan: `docs/superpowers/plans/2026-07-15-wildz-v3-identity-authority.md`

**Interfaces:**
- Consumes: the clean accepted baseline from Task 0 and installed SDK 100.0.0.
- Produces: `WildzIdentitySession`, `WildzArtifactInspection`, protected identity repository, Identity Seal PNG codec, and authenticated session routes.

- [ ] **Step 1: Complete every checkbox in the identity-authority plan**

Run each task in the linked plan in order. Do not begin the kernel plan while any focused identity test is red.

- [ ] **Step 2: Verify the plan-level deliverable**

```bash
pnpm test
pnpm typecheck
pnpm lint
git status --short
```

Expected: all tests pass; source-compatible Identity Seal import/export and secure identity relaunch are covered; the worktree is clean.

---

### Task 2: Execute V8 and Combined-Vault Continuity

**Files:**
- Plan: `docs/superpowers/plans/2026-07-15-wildz-v3-kernel-continuity.md`

**Interfaces:**
- Consumes: identity/session interfaces from Task 1 and exact V3 tag blobs.
- Produces: V8 state, combined identity-bearing Vault, atomic owner restore, and owner-scoped shell continuity.

- [ ] **Step 1: Complete Phase A, Tasks 1–4, in the kernel-continuity plan**

Stop at the explicit inter-plan gate after Task 4. Do not begin pure settlement, ecology, boss, social, or world behavior yet.

- [ ] **Step 2: Verify the plan-level deliverable**

```bash
pnpm test
pnpm typecheck
pnpm lint
git status --short
```

Expected: a generated identity-bearing Vault restores the embedded owner and full V8 state after a cold repository reload; identity-scoped state remains isolated; the worktree is clean.

---

### Task 3: Execute Public Projection and Economy Plan

**Files:**
- Plan: `docs/superpowers/plans/2026-07-15-wildz-v3-public-economy.md`

**Interfaces:**
- Consumes: authenticated Receiz sessions, public-card proofs, V8 ownership, and profile projections.
- Produces: durable public profile/card recovery, authenticated listing/trade routes, verified Connect settlement, and append-only ownership projection.

- [ ] **Step 1: Complete every checkbox in the public-economy plan**

Remove process-memory and client-asserted authority paths. Require remote compare-and-append admission for market state and fail closed when that capability or settlement proof is unavailable.

- [ ] **Step 2: Verify the plan-level deliverable**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

Expected: public profile/card deep links survive refresh; unauthenticated actors are rejected; concurrent buyers cannot both reserve one listing; payment failure transfers no ownership; an admitted Connect settlement creates one idempotent ownership receipt without changing the signed manifest; the worktree is clean.

---

### Task 4: Complete the Pure V3 Kernel and World Contract

**Files:**
- Plan: `docs/superpowers/plans/2026-07-15-wildz-v3-kernel-continuity.md`

**Interfaces:**
- Consumes: verified identity/V8 continuity, durable public projections, and exact tagged V3 source blobs.
- Produces: complete pure V3 domain behavior, canonical world service/repository, and the exact `{ projection, mode }` snapshot/client contract.

- [ ] **Step 1: Complete Phase B, Tasks 5–13, in the kernel-continuity plan**

Execute settlement, ecology, boss/raid, social/mastery/crafting/narrative, world event/state/record/service, atlas, and standalone repository tasks in their listed dependency order.

- [ ] **Step 2: Verify the plan-level deliverable**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

Expected: all adapted V3 domain tests pass; world snapshots have exactly one `projection` layer; verified cards gate canonical contributions; the worktree is clean.

---

### Task 5: Execute V3 Player Experience Plan

**Files:**
- Plan: `docs/superpowers/plans/2026-07-15-wildz-v3-player-experience.md`

**Interfaces:**
- Consumes: V3 world client, V8 state, public card/profile routes, card mastery, narrative, settlement, ecology, raid, and identity projections.
- Produces: reachable V3 experiences in the accepted shell, Trail Pack / Heartbeat, six-slot dock, full card rail, shared ordering, and profile Share/Copy controls.

- [ ] **Step 1: Complete every checkbox in the player-experience plan**

Merge upstream behavior into current presentation files; never replace `PlayCampaign.tsx`, `WildsCommandDock.tsx`, `WildsWorldCanvas.tsx`, or `app/globals.css` wholesale.

- [ ] **Step 2: Verify the plan-level deliverable**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

Expected: all tests and build pass; settlement, ecology, boss/raid, social/mastery/narrative, Trail Pack, all-card rail, ordering, and sharing are reachable without leaving the game shell; the worktree is clean.

---

### Task 6: Execute Production Release Plan

**Files:**
- Plan: `docs/superpowers/plans/2026-07-15-wildz-v3-production-release.md`

**Interfaces:**
- Consumes: the complete functional application from Tasks 1–5.
- Produces: installable/offline PWA, security and accessibility hardening, performance evidence, repaired release scripts, production browser qualification, V3 release notes, and final main-branch commit.

- [ ] **Step 1: Complete every checkbox in the production-release plan**

Do not mark an environment-gated live Receiz rail complete without its configured capability check and direct probe.

- [ ] **Step 2: Verify the final tree**

```bash
pnpm release:check
git status --short
git log -1 --oneline
```

Expected: release check exits 0; evidence names every configured and unconfigured external rail; the worktree is clean; the final commit is on `main`; nothing has been pushed.

## Execution Stop Conditions

Stop and report rather than weakening authority when:

- a source artifact fails SDK or V3 verification;
- the identity owner and V3 `playerId` cannot be proven coherent;
- a remote route has no authenticated actor;
- a world publication fails and cannot be rolled back;
- a checkout cannot prove admitted settlement;
- a release gate requires a credential or private historical Vault that has not been supplied.

These are explicit environment/input gates, not permission to simulate success or omit the feature silently.
