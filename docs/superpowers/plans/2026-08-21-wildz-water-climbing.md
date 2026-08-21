# Wildz Water And Climbing Implementation Plan

> **Execution:** Complete test-first in bounded commits; use only already-admitted local card state in the movement hot path.

**Goal:** Make active creatures unlock deterministic swimming and climbing without card reverification, schema changes, traps, or gameplay latency.

**Architecture:** A bounded pure capability projector reads the selected admitted asset plus its existing condition. The movement resolver consumes that projection synchronously, derives transient traversal mode from the terrain sample, and keeps safe shore/ledge behavior analytical. No traversal state is persisted and no caller-supplied elevation becomes authority.

## Task 1: Exact local capability projection

- [x] Add failing tests for aquatic, climbing, glide, flight, injury, fatigue, death, and deterministic cache behavior.
- [x] Implement a bounded capability projection from admitted anatomy, abilities, upgrades, and condition.
- [x] Prove the projector imports and calls no proof verifier.
- [x] Commit capability projection.

## Task 2: Swimming and climbing resolution

- [x] Add failing tests for distinct walk/wade/swim/climb modes, bounded speeds, safe blocked entry, and shore/ledge exit.
- [x] Extend analytical movement results without changing saved `{x,z}` coordinates.
- [x] Integrate selected-creature capabilities into digital and analog movement.
- [x] Preserve ordinary walking behavior and latency.
- [x] Commit water and climbing integration.

## Task 3: Player-facing teaching and qualification

- [x] Surface concise capability/blocked-route feedback without interrupting control.
- [x] Run focused tests, full tests, production build, WebKit traversal checks, and benchmark.
- [x] Confirm proof/save schemas and offline behavior remain unchanged.
- [x] Record evidence and commit Phase 4 qualification.

## Qualification evidence

- Focused traversal gate: 50 capability, movement, and game-state tests passed.
- Full automated gate: 1,359 tests across 123 suites passed with zero failures.
- Production build: compilation, linting, type checking, static generation, and route generation passed. The pre-existing Receiz worker dynamic-import warning remains unchanged.
- The capability source audit proves the movement projector neither imports nor invokes card proof verification. Identical admitted state reuses a bounded 128-entry cache.
- A 10,000-resolution swimming benchmark completed in 78.694 ms total (0.007869 ms per movement resolution).
- Mobile WebKit production run at 390×844 sustained trackpad travel for eight seconds from `X -2 · Z -1` to `X 10 · Z -59`; both canvases remained live and the console reported zero errors and zero warnings.
- Deep water blocks without swimming, aquatic anatomy enables bounded swimming, declared steep terrain blocks without climbing, and compatible anatomy enables bounded climbing. Tests cover shore/ledge exit after capability loss so the player cannot be trapped.
- Movement continues to save only `{x,z}`. Traversal mode and elevation remain locally derived transient state; no proof, player, or Vault schema changed.
- Production WebKit screenshot: `output/playwright/terrain-phase4-mobile-production.png`.
