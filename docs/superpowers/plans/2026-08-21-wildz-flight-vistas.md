# Wildz Flight And Vistas Implementation Plan

> **Execution:** Complete test-first after the independently qualified terrain, grounding, and water/climbing phases.

**Goal:** Add earned gliding/flight and optional overlooks without turning flight into a proof bypass, save-schema mutation, camera seizure, or mobile performance regression.

**Architecture:** A pure transient aerial controller owns height, stamina, launch, landing, ceilings, and safe fallback. Horizontal coordinates continue through the existing local movement authority. A frame-local ref advances airborne presentation without React renders or persistence. Deterministic overlook definitions expose safe approach, reveal, and player-controlled vista composition.

## Task 1: Aerial controller

- [x] Add failing tests for takeoff, glide launch, height/range conversion, flight ceiling, stamina, landing, collision floor, capability loss, and deterministic replay.
- [x] Implement the pure bounded controller with safe ground anchors.
- [x] Prove no proof, network, persistence, timers, or React dependency enters the controller.
- [x] Commit aerial authority.

## Task 2: Authored overlooks and reveal

- [x] Add failing tests for deterministic ids, safe walkable approaches, stable platforms, landmark reveal, and vista exit.
- [x] Add authored overlook definitions and local reveal projection.
- [x] Render visible overlook markers from the same definitions.
- [x] Commit overlooks.

## Task 3: Frame-local world integration

- [x] Add a capability-aware traversal control without changing ordinary movement controls.
- [x] Advance altitude and camera composition through refs on the render frame.
- [x] Keep player `{x,z}` saves and proof schemas unchanged.
- [x] Add player-controlled vista entry/exit and restore prior camera control.
- [x] Commit integration.

## Task 4: Qualification

- [x] Run focused/full tests, production build, benchmarks, and mobile WebKit flight/vista checks.
- [x] Confirm aerial visibility remains inside renderer and streaming budgets.
- [x] Record evidence, run `git diff --check`, and commit Phase 5 qualification.

## Qualification evidence

- Focused gates passed for aerial authority (5), authored overlooks (3), aerial integration (3), game state (39), render contracts (33), mobile performance (11), controls recovery (7), controls UI (1), and stage modal ownership (4).
- Full automated gate: 1,371 tests across 126 suites passed with zero failures.
- Production build passed compilation, linting, type checking, static generation, and route generation. The pre-existing Receiz worker dynamic-import warning remains unchanged.
- A 100,000-advance aerial-controller benchmark completed in 10.304 ms total (0.000103 ms per frame-local advance).
- Mobile WebKit production run at 390×844 sustained trackpad travel for eight seconds from `X -2 · Z -1` to `X -36 · Z -50`; measured animation frames were 16.66 ms median, 17.76 ms p95, and 17.82 ms maximum. Both canvases remained live and the console reported zero errors and zero warnings.
- Aerial advancement runs from a render-frame ref and changes React state only when the traversal mode changes. Ordinary horizontal movement remains the same synchronous analytical path.
- Overlook rendering is streamed by the existing player-relative projection: only authored markers within 34 metres exist in the scene, and HTML guidance is restricted to 12 metres. No global terrain, physics, or particle layer was added.
- Flight authority requires the exact selected admitted creature capability. Capability loss falls back to gliding or safe grounding; protected airspace fails closed; vista exit restores the exact prior camera.
- Player saves remain `{x,z}` and the PlayState, proof, Identity Seal, card, and Vault schemas contain no aerial or vista state. No verifier, network request, persistence call, timer, or React dependency exists in the pure aerial controller.
- Production WebKit screenshot: `output/playwright/terrain-phase5-mobile-production.png`.
