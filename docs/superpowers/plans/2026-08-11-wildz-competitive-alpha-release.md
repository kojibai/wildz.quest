# Wildz Competitive Alpha Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Use superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before any completion claim.

**Goal:** Ship a production-qualified Wildz competitive alpha whose player-facing Arena uses the advanced deterministic rules, whose creature cards and Vaults carry exact append-only life history, and whose Kai world has a true `00:00:00` sunrise plus readable, star-filled darkness and a player-controlled lantern.

**Architecture:** Keep immutable Receiz proof objects byte-identical and add Wildz history as verified append-only card state. Make `src/features/play/arena` the single combat domain and adapt the existing Mortal Arena presentation to it. Derive world light from one Kai solar projection, with presentation-only accessibility and quality controls that never affect competitive simulation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Three.js / React Three Fiber, Node test runner, Receiz SDK/MCP/AI skills v118, Playwright CLI, pnpm.

**Global constraints:** Preserve the approved UI hierarchy; do not add a database authority; keep `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills` exactly aligned at `118.0.0`; do not rewrite base proof bytes; keep ranked free of permanent death; make Mortal Covenant opt-in; keep high-frequency combat inputs in transcripts rather than card appends; fail closed on malformed, foreign, non-causal, or tampered history.

---

### Task 1: Establish executable contracts for creature history

**Files:**
- Create: `src/features/play/creature-history.ts`
- Create: `tests/creature-history.test.ts`
- Modify: `src/features/play/living-card-types.ts`
- Modify: `src/features/play/living-card-proof.ts`

**Steps:**

1. Write failing tests for a `receiz.wildz.creature-history.v1` chain that covers genesis/migration, progression, bond, mastery, condition, Arena settlement, custody reference, and retirement events.
2. Require exact `assetId`, deterministic `eventId`, idempotency key, parent digest, Kai coordinate, conventional timestamp, source coordinate, bounded effects, and resulting projection digest.
3. Test deterministic projection of level, XP, bond, mastery, condition, loadout, rating history, relationships, and life state.
4. Test duplicate idempotency as a no-op and reject wrong asset, missing parent, digest mutation, invalid bounds, chronology regression, and resurrection after retirement/death.
5. Implement canonical serialization/digest helpers, event verification, append, full-chain verification, and pure projection.
6. Extend living card types with an optional compatible creature-history field; preserve existing revision verification and legacy assets.
7. Run `pnpm test -- creature-history` if supported, otherwise the full `pnpm test` gate.

### Task 2: Make gameplay progression write the exact card history

**Files:**
- Modify: `src/features/play/game-state.ts`
- Modify: `src/features/play/living-card-proof.ts`
- Modify: `src/features/play/vault-companion-roster.ts`
- Modify: `tests/game-state.test.ts`
- Modify: `tests/wildz-vault-companion-roster.test.ts`
- Create: `tests/creature-history-game-state.test.ts`

**Steps:**

1. Write failing tests proving training, travel, battle/settlement, growth, evolution, ascension, injury/recovery, relationship, and mortality actions append once to the exact selected asset rather than only family/player maps.
2. Write migration tests that assign unambiguous legacy family progress once to one exact asset and retain ambiguous legacy state for inspection without duplicating it.
3. Add one state transition helper that appends a history event, replaces the inventory asset, refreshes derived `livingProgress` / `companionProgress`, and queues immediate persistence atomically.
4. Convert routine progression paths to the helper; treat the existing maps as compatibility projections, not independent truth.
5. Ensure current HUD and roster projections read the exact asset history first and retain compatibility fallback for old saves.
6. Run game-state, roster, mortality, living-card, and full test gates.

### Task 3: Carry complete history inside standalone cards and Vaults

**Files:**
- Modify: `src/features/play/card-export.ts`
- Modify: `src/features/play/living-card-dossier.ts`
- Modify: `src/lib/receiz/receiz-vault-package.ts`
- Modify: `tests/wildz-native-proof-download.test.ts`
- Modify: `tests/wildz-proof-object-continuity.test.ts`
- Modify: `tests/wildz-full-vault-regression.test.ts`
- Create: `tests/wildz-creature-history-export.test.ts`

**Steps:**

1. Write failing byte-level tests that save a progressed card, reopen it, and recover its exact history/projection while proving the embedded Receiz base proof bytes are unchanged.
2. Write a 100-card Vault round-trip test with divergent levels, bonds, mastery, scars, relationships, and Arena histories; require exact per-asset recovery after upload by a fresh owner scope.
3. Add a typed creature-history append kind to the existing Wildz PNG append channel or living asset payload without altering the base proof object.
4. Bind each append to exact asset/base digest/history head; reject splices, duplicates, truncation, foreign histories, and a player payload that disagrees with a card head.
5. Project dossier chronology and current stats from verified history, not a stale player map.
6. Preserve v102/v103/v118 compatibility and existing native Record/Seal byte-exact download behavior.
7. Run export, Vault, compatibility, native proof, and full test gates.

### Task 4: Introduce explicit Arena mode policy and ranked rating contracts

**Files:**
- Create: `src/features/play/arena/mode-policy.ts`
- Create: `src/features/play/arena/rating.ts`
- Create: `tests/arena-mode-policy.test.ts`
- Create: `tests/arena-rating.test.ts`
- Modify: `src/features/play/arena/rules.ts`
- Modify: `src/features/play/arena/receipt.ts`

**Steps:**

1. Write failing matrix tests for Practice, Adventure, Ranked, and Mortal Covenant persistence, mortality, rewards, rating, consent, disconnect, withdrawal, and publication policy.
2. Require Ranked to disable death, use versioned rules/stage/roster budgets, and derive rating only from a verified settlement.
3. Implement deterministic Glicko-2 calculations with bounded inputs, versioned policy, inactivity deviation, draw handling, and integer player-facing divisions.
4. Extend Arena receipt/result types with mode-policy and optional rating-settlement coordinates without weakening existing receipt verification.
5. Run Arena receipt, replay, consequences, mode, and rating tests.

### Task 5: Adapt the player-facing Mortal Arena to the canonical advanced runtime

**Files:**
- Create: `src/features/games/mortal-arena/arena-presentation-adapter.ts`
- Modify: `src/features/games/mortal-arena/use-mortal-arena.ts`
- Modify: `src/features/games/mortal-arena/MortalArenaExperience.tsx`
- Modify: `src/features/games/mortal-arena/MortalArenaScene.tsx`
- Modify: `src/features/games/mortal-arena/types.ts`
- Modify: `src/features/games/mortal-arena/presentation.ts`
- Modify: `tests/mortal-arena-flagship.test.ts`
- Modify: `tests/mortal-arena-ui.test.ts`
- Create: `tests/mortal-arena-canonical-runtime.test.ts`

**Steps:**

1. Write failing adapter tests that drive directional light chains, committed heavy attacks, guard/parry/dodge, exact named ability, cooldown, stamina/focus, Break/launch, tag risk, hazard, mechanism, pickup, rescue, withdrawal, boss transition, replay checkpoint, and terminal result through the player-facing hook contract.
2. Project exact living cards into canonical fighters and create a proof-pinned definition from campaign/stage/mode policy.
3. Replace the simplified simulation loop in the hook with the canonical 60 Hz Arena runtime and legal delayed opponent controller.
4. Keep the current scene/HUD entry point, but expose real startup/active/recovery, hit explanation, Break, cooldown, context action, tag window, danger, phase, and consent projections.
5. Ensure all actions are semantic sequenced intents and presentation animation never decides a hit.
6. Settle through replay-verified consequences and append the resulting creature history atomically.
7. Preserve a compatibility adapter only as needed for saved campaign data; stop importing simplified combat/movement/simulation logic from production presentation.
8. Run canonical Arena, Mortal Arena, game-state, settlement, replay, and UI contract tests.

### Task 6: Add competitive mastery and fair opponent affordances

**Files:**
- Create: `src/features/play/arena/training.ts`
- Modify: `src/features/play/arena/opponent.ts`
- Modify: `src/features/games/mortal-arena/MortalArenaExperience.tsx`
- Modify: `src/features/games/mortal-arena/presentation.ts`
- Create: `tests/arena-training.test.ts`
- Modify: `tests/arena-opponent.test.ts`

**Steps:**

1. Write failing tests for repeatable spacing, defense, punish, ability, tag, hazard, and matchup drills with deterministic scoring and local ghost replay.
2. Prove opponents use only observable state, bounded history, reaction delay, telegraphed decisions, and legal affordable actions; reject future-input leakage.
3. Implement optional Practice-only frame/action history and explanations for hit, miss, guard, parry, dodge, punish, stamina, focus, Break, and cooldown.
4. Add difficulty through policy, reaction, habits, stage geometry, team tactics, and boss phase rules—not hidden damage or illegal inputs.
5. Keep training aids and speed reduction out of Ranked.
6. Run training, opponent, replay, accessibility, and UI tests.

### Task 7: Make Kai solar time authoritative from sunrise at zero

**Files:**
- Modify: `src/features/play/kai-moment-expression.ts`
- Modify: `src/features/play/kai-klok-moment.ts`
- Modify: `src/features/play/WildsWorldCanvas.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildsAtmosphere.tsx`
- Modify: `src/features/play/WildsKaiAtmosphereGeometry.tsx`
- Modify: `tests/kai-moment-expression.test.ts`
- Create: `tests/wilds-kai-solar-cycle.test.ts`

**Steps:**

1. Write exact boundary tests proving `00:00:00` is sunrise/horizon, not solar peak, and test dawn, day, dusk, deep-night, wraparound, and deterministic replay coordinates.
2. Create one solar projection consumed by sky, sun/moon direction, fog, exposure, terrain, water, particles, and audio ambience.
3. Remove any component-local noon assumptions or duplicate time curves.
4. Ensure competitive simulation and hit visibility are not altered by client wall-clock or unsealed local time.
5. Run Kai, world, SSR, and deterministic-surface tests.

### Task 8: Ship visibly dark, star-filled night with readable actors and a Wilds lantern

**Files:**
- Create: `src/features/play/WildsNightSky.tsx`
- Create: `src/features/play/WildsLantern.tsx`
- Create: `src/features/play/wilds-night-visibility.ts`
- Modify: `src/features/play/WildsAtmosphere.tsx`
- Modify: `src/features/play/WildsEnvironment.tsx`
- Modify: `src/features/play/WildsCreatureActor.tsx`
- Modify: `src/features/play/WildsExplorer.tsx`
- Modify: `src/features/play/WildsWorldControls.tsx`
- Modify: `src/features/play/WildsAudioSettings.tsx`
- Modify: `src/features/play/wilds-quality-profile.ts`
- Create: `tests/wilds-night-visibility.test.ts`
- Create: `tests/wilds-lantern.test.ts`

**Steps:**

1. Write failing pure tests for night factor, sky/terrain luminance bounds, actor rim/fill/affinity visibility, lantern state, accessibility visibility levels, and quality-tier star budgets.
2. Render deterministic seeded stars and restrained Ark constellations only when the night factor warrants them; avoid per-frame allocations and shadow-heavy light fields.
3. Make sky and terrain visibly dark while preserving threat, path, interaction, explorer, and creature readability through moon/Ark key light, restrained rim/fill, emissive affinity cues, and tone mapping.
4. Add a player-toggleable warm Wilds lantern with settings persistence, accessible label/state, touch-safe control, authored range, low/high quality paths, and no requirement for basic character readability.
5. Define lantern ecology/path/stealth hooks for Adventure while forcing equal authored visibility in Ranked.
6. Respect reduced motion, battery/quality governor, and contrast preferences.
7. Run night, controls, settings, quality, Three.js SSR, and mobile UI tests.

### Task 9: Expand Receiz/MCP/AI operational leverage without changing authority

**Files:**
- Modify: `receiz.app.json` only if a currently supported v118 declared operation is missing
- Modify: `docs/MCP.md`
- Modify: `docs/RECEIZ_RAILS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `ai-skills/wildz-build-skill/SKILL.md`
- Modify: `ai-skills/wildz-release-skill/SKILL.md`
- Create: `docs/release/competitive-integrity.md`
- Modify: `tests/wildz-ai-skills.test.ts`
- Modify: `tests/wildz-release-documentation.test.ts`

**Steps:**

1. Write failing documentation/skill contract tests for creature-history verification, Arena replay audit, tournament/season operations, coaching/simulation boundaries, local-versus-published authority, and strict confirmation for publication/release.
2. Document SDK use for exact proof admission, history append/verification, receipts, public replay projection, custody, audit, and conditional operations that exist in v118.
3. Document MCP as an operator/reviewer surface for read-only audits, tournament health, release readiness, and confirmed commands—never gameplay authority.
4. Document AI skills as reproducible build, replay-review, balance-analysis, incident, market, and release procedures that cite evidence and cannot sign or admit results.
5. Keep deferred or unavailable v119/conditional ownership capabilities explicitly pending rather than simulated.
6. Run AI skill validator, Receiz checker/doctor/conformance, documentation tests, and secret scan.

### Task 10: Production browser, performance, accessibility, and integrity qualification

**Files:**
- Create: `docs/release/evidence/competitive-alpha/` artifacts through the approved capture workflow
- Create: `docs/release/competitive-alpha-verification.md`
- Modify: performance/test files only for real defects found during profiling

**Steps:**

1. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm receiz:check`, the AI-skills validator, `pnpm receiz:conformance`, `pnpm secret:scan`, and an optimized production build.
2. Use Playwright against the production server for representative desktop, iPhone-class portrait/landscape, reduced motion, keyboard, touch, offline/reload, and mobile WebKit paths.
3. Record complete Practice and Mortal matches, replay verification, exact card export/reimport, full Vault export/reimport, `00:00:00` sunrise, deep night, stars, lantern off/on, and actor readability.
4. Capture console/page/request health and deterministic replay equality. Test tampered proof/history/transcript rejection.
5. Profile resting world, deep night, lantern, trainer transition, Arena combat, and resize. Enforce project budgets or document exact measured residuals as non-passes.
6. Run WCAG-focused checks for contrast, labels, focus, reduced motion, touch targets, zoom, and non-color status communication.
7. Commit reproducible scripts/results/screenshots/manifests with hashes where the existing release evidence convention requires them.

### Task 11: Alpha version, release writing, and official publication

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Create: `docs/release/v4.0.0-alpha.0.md`
- Modify: `docs/release/verification.md`
- Modify: `.github` release/PR metadata only where existing convention requires it

**Steps:**

1. After every local and browser gate is green, bump the product to `4.0.0-alpha.0` while keeping all Receiz packages exactly `118.0.0`.
2. Write concise customer-facing release notes: player outcome first, competitive integrity and portability next, technical evidence and explicit external boundaries last.
3. Update the changelog, README release status, verification record, feature parity, and known limitations without claiming credentials, deployment, strict-live, tagging, or publication that did not occur.
4. Run `pnpm release:check` from the exact candidate and re-run the release evidence validators.
5. Request code review, address findings with test-first fixes, and rerun affected plus full gates.
6. Commit the exact candidate, push `kojib/wildz-competitive-alpha`, open a release PR, and publish/tag/deploy only through configured, authorized release rails.
7. Verify the public commit/tag/deployment and perform post-release smoke checks. If production credentials or a release capability is unavailable, report that external gate explicitly and stop before inventing success.

