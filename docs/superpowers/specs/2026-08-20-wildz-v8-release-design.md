# Wildz v8.0.0 — Proof-Native Living World release design

Date: 2026-08-20

Status: approved

## Purpose

Ship a complete, evidence-backed `v8.0.0` repository release that documents every product and engineering change between the `v7.0.0` tag (`1741933`) and the final v8 commit. The release must present Wildz at its highest defensible technical frame without turning ambition into unsupported claims.

The release thesis is **Proof-Native Living World**: identity, complete game continuity, Vault custody, public profiles, and immediate gameplay converge around one constitutional rule. Once an exact Proof Object has been admitted, that object remains authority. A server, database row, cache, publication result, MCP response, or AI explanation may transport, project, index, or describe that truth, but cannot create or replace it.

## Scope

The release documents and versions already-implemented work. It does not introduce new gameplay behavior.

The documentation must cover every commit after `v7.0.0` and before the release work:

1. `da3fb96` — richer atlas/world visuals and quality-aware level of detail.
2. `2d21be2` — anatomy-driven creature embodiment and render-performance work.
3. `4f490c1` — game-loop and state-calculation performance improvements.
4. `0b59f6a` — compact profile viewer, exact single-card import, and save behavior.
5. `a6630a6` — one-pass upload preparation and inspection reuse.
6. `e95ecfb` — restored profile-card QR rendering.
7. `95e2958` — saved continuity-seal restoration.
8. `5b42131` — verified-identity activation with exact saved player continuity.
9. `c2351a0` — publication readiness and local/remote profile status alignment.
10. `989829e` — removal of duplicate post-login publication work.
11. `be6ab53` — reuse of admitted Proof Object authority after login.

## Release structure

### Flagship release document

Create `docs/release/v8.0.0.md` as the canonical narrative and technical record. It must serve four readers without splitting into inconsistent stories:

- Players: what visibly and experientially improved.
- Engineers: what changed in rendering, restoration, upload, publication, and hot paths.
- Integrators: what the Proof Object authority boundary means for cross-platform identity and cards.
- Auditors: which claims are supported by source, regression tests, and release gates.

The document will contain:

- Release thesis and player-facing summary.
- Authority model and end-to-end data flow.
- Full identity and game-state restoration behavior.
- Single-card import versus complete-Vault restore semantics.
- Profile publication, complete Vault projection, compact viewer, and QR behavior.
- Hot-path performance and duplicate-work removals.
- World rendering, terrain, water, lighting, LOD, culling, instancing, and creature anatomy.
- Compatibility and preserved laws.
- Exact v7-to-v8 commit ledger.
- Verification evidence and explicitly unperformed external gates.

### Repository release surfaces

Update the following only where the final audit shows they are version-bearing or release-index surfaces:

- `package.json` and its lockfile version coordinate.
- `CHANGELOG.md` with a complete `8.0.0` entry and a clean future `Unreleased` section.
- `README.md` release links/version descriptions where applicable.
- Service-worker/example release coordinate from v7 to v8 where it identifies the installed shell release.
- `docs/release/verification.md` to describe the final v8 tree and observed gate results.
- Any precise release metadata or tests that intentionally bind the application version.

Receiz package versions remain exact `121.0.0`; application v8 does not imply a Receiz package-major change.

## Content pillars

### 1. Admitted Proof Object authority

After identity/Vault admission, gameplay and local projections reuse the already-admitted exact card objects. Per-card background publication must not reload keyfiles, reopen IndexedDB, or repeat client verification. A weaker server projection cannot replace stronger admitted local truth. The card publication route verifies and transports proof projections through the configured public store; it does not treat cookie identity, a server session, or a database record as source authority.

### 2. Complete continuity restoration

A saved Identity Seal restores the embedded verified identity and the saved Wildz player continuity associated with it. The flow must not overwrite that identity with stale account data, merge in unrelated current Vault state, flash briefly into the restored account and fall back, or lose the selected creature and game history. Prepared uploads reuse one byte read and one inspection.

### 3. Exact import semantics

Uploading a single card to the card-Vault imports and selects that card only. It does not smuggle hidden player inventory into the Vault. Uploading a complete Vault remains additive according to verified merge and conflict laws. Exporting an individual card continues to save that exact card; complete-Vault export continues to preserve the full collection.

### 4. Profiles that reflect admitted truth

Profile publication begins only when identity, character continuity, and proof-session connectivity are ready. Publication happens outside the gameplay hot path and remains non-authoritative. The local profile immediately reflects admitted Vault truth, complete verified card coverage, refreshed continuity, compact card viewing, and card QR rendering. “Not yet published” is a remote projection status, not a claim that local identity is invalid.

### 5. Immediate gameplay

The release identifies and documents every removal of avoidable background work: repeated upload inspection, duplicate post-login publication, per-card client verification, repeated region calculations, render work while hidden, state-driven D-pad paint, array slicing in frame windows, save-timer recreation, and production diagnostics. None of these optimizations may weaken proof admission or change gameplay results.

### 6. Living-world fidelity

The world receives richer procedural terrain, water and rivers, natural distributions, lighting, fog, tone mapping, routes that follow terrain, readable materials, quality-aware ecology, and more efficient instancing/culling. Creature rendering receives genome-derived anatomy so body, appendage, and surface traits visibly carry card identity into the world.

### 7. Preserved constitutional laws

- The enclosing admitted Proof Object is authority.
- Server and database state are transport, cache, projection, or index only.
- First admission only, then append forever remains durable-memory law.
- Unknown proof namespaces remain byte-exact.
- Weaker remote projections cannot erase stronger admitted local truth.
- Publication failure cannot invalidate local identity, Vault custody, or gameplay.
- AI, MCP, UI state, and generated explanations never become proof authority.
- Historic verified artifacts remain compatible under the documented v121 read and migration rules.

## Data flow

The canonical restoration and play sequence is:

1. Read bounded upload bytes once.
2. Inspect and admit the exact artifact once.
3. Activate its verified identity and restore its embedded Wildz continuity.
4. Materialize the selected card and complete admitted Vault locally.
5. Begin gameplay immediately from admitted truth.
6. Publish sanitized profile/card projections idempotently in a separate background path when prerequisites exist.
7. Reuse the exact admitted card-object references for local projection and publication preparation.
8. Never allow publication or a server response to replace stronger local Proof Object truth.

Single-card import follows the same admission boundary but changes only the selected/imported card scope. Complete-Vault restore follows verified collection merge and continuity rules.

## Error and honesty policy

- Invalid, malformed, oversized, structurally conflicting, or unverifiable artifacts fail closed before domain state changes.
- Release-created failures are fixed and the full gate rerun.
- Pre-existing failures are investigated and disclosed; tests or laws are never weakened to manufacture a pass.
- Local source evidence is not presented as deployment, remote publication, live authentication, representative-device performance, notification delivery, payment settlement, or store qualification.
- Build warnings are reported with their actual origin and impact.
- No claim of biological consciousness, universal consensus, or server-backed authority is made.

## Verification

The final release must pass the repository's consolidated gate:

- Receiz architecture lock.
- Full Node regression suite.
- TypeScript typecheck.
- Official v121 repository checker.
- SDK/MCP conformance.
- ESLint.
- Secret scan.
- Optimized Next.js production build.
- Receiz doctor.

Focused regression coverage must include identity restoration, prepared upload reuse, card-only and full-Vault admission, profile readiness/gallery/QR behavior, public-card publication, Proof Object admission reuse, save scheduling, mobile performance, and world/render contracts.

The verification record will contain only final observed counts and outcomes.

## Delivery

The final implementation produces one clean, fully verified release commit named:

`release: ship Wildz v8.0.0 Proof-Native Living World`

The user will push the commit. This task does not create a tag, push, deploy, publish a GitHub release, or mutate a remote environment.
