# Wildz v11 Conformance and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Publish accurate world and creature explanations, an offline rarity-proof checker, and a fully qualified local v11.0.0 release commit.

**Architecture:** Public pages consume shared versioned game rules and static proof fixtures. The checker verifies selected files entirely in the browser. Release gates compare the finished build to v10.1.0 and publish measured limits and the full change ledger since v10.0.0.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, CSS modules, Node tests, Playwright/browser qualification.

**Spec:** docs/superpowers/specs/2026-09-26-wildz-v11-unbounded-world-creatures-rarity-design.md

**Dependency:** Complete the world, rarity/proof, and embodiment plans before final public claims or release qualification.

## Global Constraints

- The odds page uses the exact five-class/four-band v11 law and states its signed-result trust boundary.
- Starter grants are excluded from eligible encounter probabilities.
- V10 cards keep their original-law label and never claim a retroactive v11 draw.
- Public copy distinguishes unique canonical identity from finite visual resemblance.
- Final release is committed locally for the user to push; no tag, push, deployment, or GitHub release is part of this plan.

## Review Focus

- A viewer does not mistake a 1-in-1,000,000 chance for a guaranteed result after 1,000,000 tries; Task 2 test.
- A malformed or private proof file is never uploaded by the checker; Task 2 test.
- An upgraded v10 card shows original rarity rather than v11 odds; Task 2 test.
- A keyboard/mobile visitor can read every table and operate the checker; Task 3 test.
- A service-worker version mismatch cannot serve stale v10 law copy as v11; Task 4 test.

---

### Task 1: Versioned public law fixtures

**Files:** Create src/features/play/wilds-v11-conformance.ts and public/conformance/v11-test-vectors.json; Test tests/wilds-v11-conformance.test.ts.

**Interfaces:** produce publicRarityTableV11() from rarityOdds; verifyPublicVectorV11(vector) with the same verifier as card admission; export a stable JSON schema/fixtures for each band edge, rarity, starter, v10 continuity, and tampering.

- [ ] Step 1: Test row sums, published class fractions, score rounding, accepted fixture replay, and rejected tamper fixture.
- [ ] Step 2: Run pnpm test; expect the fixture test to fail.
- [ ] Step 3: Generate checked-in vectors from versioned code and review exact expected bytes; no copied manual odds table.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit public fixtures and tests.

### Task 2: World, creatures, and proof pages

**Files:** Create app/world/page.tsx, app/creatures/page.tsx, app/conformance/page.tsx, app/conformance/OfflineProofChecker.tsx, app/conformance/conformance.module.css; Modify app/about/page.tsx, app/guide/page.tsx, app/sitemap.ts; Test tests/wildz-v11-public-pages.test.tsx.

**Interfaces:** OfflineProofChecker accepts a local File, uses verifyWildsV11Card or version-aware verification in browser memory, and returns per-step results without a fetch or upload.

- [ ] Step 1: Test five-class/four-band table, exact score explanation, encounter eligibility, starter exception, v10 continuity label, unique-identity caveat, world size caveat, and no-upload checker behavior.
- [ ] Step 2: Run pnpm test; expect page tests to fail.
- [ ] Step 3: Build the three editorial pages from shared rules, responsive styles, accessible tables and controls, and About/Guide/sitemap links.
- [ ] Step 4: Run pnpm test, pnpm typecheck, pnpm lint, and pnpm build; expect all to pass.
- [ ] Step 5: Commit pages and tests.

### Task 3: Browser gameplay and accessibility qualification

**Files:** Create docs/release/v11.0.0-qualification.md; Modify tests/wildz-release-documentation.test.ts.

**Interfaces:** No product API. Evidence records browser/device, route, viewport, proof fixture, result, measured frame and memory values, and comparison to the same-device v10.1.0 baseline.

- [ ] Step 1: Exercise keyboard, screen-reader labels, mobile layout, checker file input with network disabled after page load, starter Trail issuance, distant movement, rare encounter proof, v10 upgrade, embodied response, and homecoming in production Chromium, Firefox, and Safari/WebKit browsers.
- [ ] Step 2: Record failures as reproducible issues and repair owning code before repeating only the affected checks.
- [ ] Step 3: Measure near/distant frame time, active object count, memory, first playable time, travel latency, and creature-loop cost on the same browser/device as the baseline.
- [ ] Step 4: Record actual evidence and limitations in the qualification document.
- [ ] Step 5: Commit qualification evidence.

### Task 4: Version and release gate

**Files:** Modify package.json, pnpm-lock.yaml, CHANGELOG.md, docs/release/v11.0.0.md, src/features/pwa/PwaController.tsx, .env.example, tests/wildz-release-documentation.test.ts, and public/sw.js shell URLs if the three editorial routes are intentionally cached.

**Interfaces:** Application and installed-PWA release identity become v11.0.0; release notes enumerate every source change since v10.0.0 and identify v10.1.0 continuity.

- [ ] Step 1: Test package/app/service-worker version alignment, sitemap publication, vector digest and release-note coverage.
- [ ] Step 2: Run pnpm test; expect version/documentation assertions to fail before edits.
- [ ] Step 3: Advance versions, update changelog and complete release notes with actual code changes and qualification limits.
- [ ] Step 4: Run pnpm release:check, pnpm secret:scan, and a production browser smoke pass; expect no unqualified failures.
- [ ] Step 5: Review the final diff and commit v11.0.0 locally. Leave push, tag, deployment, and remote publication to the user.
