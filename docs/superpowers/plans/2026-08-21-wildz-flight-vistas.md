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

- [ ] Run focused/full tests, production build, benchmarks, and mobile WebKit flight/vista checks.
- [ ] Confirm aerial visibility remains inside renderer and streaming budgets.
- [ ] Record evidence, run `git diff --check`, and commit Phase 5 qualification.
