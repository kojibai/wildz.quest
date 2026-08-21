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

- [ ] Add failing tests for distinct walk/wade/swim/climb modes, bounded speeds, safe blocked entry, and shore/ledge exit.
- [ ] Extend analytical movement results without changing saved `{x,z}` coordinates.
- [ ] Integrate selected-creature capabilities into digital and analog movement.
- [ ] Preserve ordinary walking behavior and latency.
- [ ] Commit water and climbing integration.

## Task 3: Player-facing teaching and qualification

- [ ] Surface concise capability/blocked-route feedback without interrupting control.
- [ ] Run focused tests, full tests, production build, WebKit traversal checks, and benchmark.
- [ ] Confirm proof/save schemas and offline behavior remain unchanged.
- [ ] Record evidence and commit Phase 4 qualification.
