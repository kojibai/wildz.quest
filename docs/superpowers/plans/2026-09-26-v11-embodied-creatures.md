# Wildz v11 Embodied Creatures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make wild and companion creatures respond visibly to their world, retain consequential memories, and recognize their first meeting place.

**Architecture:** A fixed-cadence pure intent reducer consumes a bounded local perception snapshot, proven creature traits, care, and history. Rendering interpolates the chosen intent without deciding gameplay. Admitted events enter existing creature history; transient animation stays disposable.

**Tech Stack:** TypeScript, React Three Fiber, Three.js, existing Wildz care/continuity/journey modules.

**Spec:** docs/superpowers/specs/2026-09-26-wildz-v11-unbounded-world-creatures-rarity-design.md

**Dependency:** Complete docs/superpowers/plans/2026-09-26-v11-world-addressing.md and docs/superpowers/plans/2026-09-26-v11-creature-rarity-proof.md first.

## Global Constraints

- The everyday creature loop must work offline without model/network calls.
- Only admitted material events enter portable history; frame animation never writes a proof.
- Rare class cannot secretly multiply base combat power or replace meaningful Trail play.
- Active perception radius and companion count remain bounded; distant creatures use level of detail.
- Begin with a 250 ms intent cadence, 12-world-unit perception radius, three active companions, and at most 16 perceived nearby objects; tune only from measured browser evidence.
- V10 variant-3 verified discovery locations are valid homecoming sites; other variants do not gain invented coordinates.

## Review Focus

- Flying and aquatic bodies never inherit ground footsteps; Task 2 test.
- A tired creature can refuse an order with a readable reason and recovery path; Task 1 test.
- Reopening dialogue cannot invent a history event; Task 3 test.
- Revisiting a site cannot mint repeated rewards or a new rarity roll; Task 4 test.
- A transferred or deceased creature never appears falsely active at its meeting place; Task 4 test.

---

### Task 1: Pure embodied intent

**Files:** Create src/features/play/wilds-creature-embodiment.ts; Modify src/features/play/creature-care.ts and src/features/play/companion-command-model.ts; Test tests/wilds-creature-embodiment.test.ts.

**Interfaces:** embodiedIdentityFromCard(card: PortableCardAsset): WildsEmbodiedIdentity adapts v10 genome or v11 birth; projectCreaturePerception(worldLocal: WildsLocalWorldSnapshot, creatureId: string): WildsCreaturePerception; chooseCreatureIntent(identity: WildsEmbodiedIdentity, care: CreatureCareState, history: CreatureHistoryProjection, perception: WildsCreaturePerception, kaiPulse: number): WildsCreatureIntent. Result includes action, target, reason, and next fixed-cadence tick. Actions are rest, follow, investigate, play, forage, help, avoid, socialize, and seek-care.

- [ ] Step 1: Test fixed input replay, trait-dependent choice, no offscreen knowledge, tired refusal/recovery, and bounded neighbor inspection.
- [ ] Step 2: Run pnpm test; expect new intent tests to fail.
- [ ] Step 3: Implement the pure reducer and event-driven perception adapter; keep render-frame work free of full decision scans.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit intent and tests.

### Task 2: World-body presentation

**Files:** Modify src/features/play/WildsWorldCanvas.tsx, src/features/play/wilds-companion-gait.ts, src/features/play/creature-visual-identity.ts, src/features/play/creature-voice-playback.ts; Test tests/wilds-creature-body-presentation.test.ts.

**Interfaces:** renderWildsCreatureIntent(intent, body, localSurface, elapsed): pose/motion/audio projection. World Canvas uses this projection for wild individuals and up to the active pack's companions.

- [ ] Step 1: Test water/slope contact, flying/aquatic locomotion, gaze and rest cues, distance audio/LOD, and no teleport pop on region rebase.
- [ ] Step 2: Run pnpm test; expect new presentation tests to fail.
- [ ] Step 3: Implement body-specific animation and feedback from the pure intent output.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm build; expect all to pass.
- [ ] Step 5: Commit presentation and tests.

### Task 3: Shared activity and honest memory

**Files:** Modify src/features/play/creature-continuity.ts, src/features/play/creature-history.ts, src/features/play/creature-consciousness.ts, src/features/play/PlayCampaign.tsx; Test tests/wilds-creature-shared-activity.test.ts.

**Interfaces:** admitCreatureSharedActivity(card, witnessedAction, worldState): PortableCardAsset; append only actual play/care/exploration/cooperation outcomes. Conversation reads the new history but cannot create it.

- [ ] Step 1: Test approach/play/explore/assist consequences, rejected click-spam, no event from dialogue or idle animation, and restore replay.
- [ ] Step 2: Run pnpm test; expect new activity tests to fail.
- [ ] Step 3: Connect player controls and admitted events to existing living-history rails, keeping user-facing feedback concise.
- [ ] Step 4: Run pnpm test and pnpm typecheck; expect both to pass.
- [ ] Step 5: Commit shared activity and tests.

### Task 4: First-meeting homecoming

**Files:** Create src/features/play/wilds-creature-homecoming.ts; Modify src/features/play/wilds-exploration-atlas.ts, src/features/play/wilds-journey.ts, src/features/play/PlayCampaign.tsx; Test tests/wilds-creature-homecoming.test.ts.

**Interfaces:** provenMeetingPlace(card): WildsWorldAddress | null; projectHomecoming(card, playerAddress, siteState): WildsHomecomingOffer | null; completeHomecoming(card, offer): { card: PortableCardAsset; journalMemory: WildsJourneyMemory }. The first completion is idempotent by creature ID and verified site.

- [ ] Step 1: Test v11 and v10-v3 verified locations, journal-only unverified marker, first/repeat visit, absent companion, transfer, retirement/death, and no new rarity roll.
- [ ] Step 2: Run pnpm test; expect homecoming tests to fail.
- [ ] Step 3: Add atlas marker, embodied response, short player choice, one witnessed history event, and distinct journal recollection.
- [ ] Step 4: Run pnpm test, pnpm typecheck, and pnpm build; expect all to pass.
- [ ] Step 5: Commit homecoming and tests.
