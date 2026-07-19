# Wildz v111 Proof-World Integration Implementation Plan

> **For Codex:** Execute this plan inline with the `superpowers:executing-plans` workflow. Keep every task red-green-refactor and stop on any Receiz admission or verification failure.

**Goal:** Make the authenticated Wildz world a single globally synchronized Receiz proof object, while preserving seamless offline play, portable creature/card progression, Vault recovery, and append-only bearer ownership continuity.

**Architecture:** The sealed Receiz v111 artifact and its admitted proof history are the strongest truth. World, card, creature, and Vault data are projections of that history. Online commands and snapshots share one canonical head; offline commands append causal records locally and reconcile through Receiz admission when connectivity returns. Legacy Wildz formats remain readable only so they can be migrated through the native v111 pipeline.

**Receiz contract:** Active registry `cf02d0bce6ad1541cfe84e27bfb1036777b29616bf8a1e5aeafb899a945e359a`. Use SDK commands and exported v111 primitives; do not reimplement admission, merging, recovery, or ownership laws.

---

## Task 1: Remove the world split-brain and require real Connect authority

**Files:**

- Modify: `src/lib/receiz/wilds-multiplayer-server.ts`
- Modify: `src/lib/receiz/wilds-world-server.ts`
- Modify: `src/lib/receiz/wildz-session-bridge.ts`
- Modify: `app/api/wilds/world/bootstrap/route.ts`
- Modify: `app/api/wilds/world/snapshot/route.ts`
- Modify: `src/features/shell/WildzApp.tsx`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `src/features/play/WildsLivingWorldHud.tsx`
- Test: `tests/wilds-world-bootstrap.test.ts`
- Test: `tests/wilds-world-client.test.ts`
- Test: `tests/wilds-living-world-hud.test.ts`
- Test: `tests/wildz-auth-session.test.ts`

- [ ] Write failing tests proving that a valid Receiz Identity session plus its scoped OIDC cookie resolves to the same actor and access token for bootstrap, snapshot, and command routes.
- [ ] Write failing tests proving that an authenticated player without delegated Connect authority receives `wilds_world_connect_required` and a Connect start URL—not `local_practice`.
- [ ] Write failing tests proving the UI never converts a practice snapshot into `receiz_live` merely because a boolean session flag is true.
- [ ] Run the focused red tests:

  ```bash
  npx tsx --test tests/wilds-world-bootstrap.test.ts tests/wilds-world-client.test.ts tests/wilds-living-world-hud.test.ts tests/wildz-auth-session.test.ts
  ```

- [ ] Change multiplayer actor resolution so an OIDC token is retained only when its scoped session profile matches the proof-session Receiz ID; reject mismatches fail-closed.
- [ ] Make player-driven world repository calls use the actor token. Keep any environment credential isolated to explicit unattended service work.
- [ ] Await world bootstrap before marking the proof session connected. Propagate structured Connect-required failures and begin the existing Receiz Connect flow automatically.
- [ ] Remove HUD mode rewriting. Show canonical mode and sync state exactly as returned by the server.
- [ ] Ensure authenticated snapshot/bootstrap responses are `private, no-store` and never fall back to practice data.
- [ ] Run focused tests until green, then run `pnpm typecheck`.
- [ ] Commit: `fix: unify authenticated world authority`

## Task 2: Admit world mutations into the v111 proof and causal history

**Files:**

- Create: `src/features/play/wilds-proof-history.ts`
- Modify: `src/features/play/wilds-world-event.ts`
- Modify: `src/features/play/wilds-world-state.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Modify: `src/lib/receiz/wilds-world-repository.ts`
- Modify: `src/lib/receiz/wilds-world-types.ts`
- Test: `tests/wilds-proof-history.test.ts`
- Test: `tests/wilds-world-service.test.ts`
- Test: `tests/wilds-world-repository.test.ts`

- [ ] Write failing tests for `state.append` proof-history nodes, causal records, evidence roots, exact registry binding, deterministic replay, duplicate admission, and invalid/missing receipt rejection.
- [ ] Run:

  ```bash
  npx tsx --test tests/wilds-proof-history.test.ts tests/wilds-world-service.test.ts tests/wilds-world-repository.test.ts
  ```

- [ ] Implement a thin Wildz adapter around `createReceizProofHistoryNode`, `normalizeReceizProofHistory`, `mergeReceizProofHistoryPrefix`, `createReceizCausalRecord`, and `createReceizCausalHistory`.
- [ ] Bind every admitted world command to actor, Kai pulse/moment, prior head, command digest, registry, and evidence roots.
- [ ] Persist the admitted history/artifact identity with the repository record and derive the snapshot revision/head from it.
- [ ] Preserve existing gameplay reducers as deterministic projections; do not let them independently decide canonical admission.
- [ ] Run focused tests, `pnpm typecheck`, and `pnpm receiz:check`.
- [ ] Commit: `feat: anchor world commands in receiz proof history`

## Task 3: Replace the parallel offline ledger with a causal outbox

**Files:**

- Create: `src/features/play/wilds-causal-outbox.ts`
- Modify: `src/features/arena/offline-ledger.ts`
- Modify: `src/features/play/use-wilds-world.ts`
- Modify: `src/features/play/wilds-world-client.ts`
- Modify: `src/lib/receiz/wilds-world-types.ts`
- Test: `tests/wilds-causal-outbox.test.ts`
- Test: `tests/wilds-offline-reconciliation.test.ts`
- Test: `tests/wilds-world-client.test.ts`

- [ ] Write failing tests for offline first paint, ordered local appends, restart persistence, retry idempotence, deduplication, reconnect reconciliation, structured conflicts, and no visible gameplay mode switch.
- [ ] Run:

  ```bash
  npx tsx --test tests/wilds-causal-outbox.test.ts tests/wilds-offline-reconciliation.test.ts tests/wilds-world-client.test.ts
  ```

- [ ] Store SDK causal records and their dependencies in the durable local outbox; expose the optimistic projection from the same reducer used online.
- [ ] On reconnect, submit pending records in causal order and replace provisional heads only with Receiz admission receipts.
- [ ] Retain rejected records and structured recovery information without corrupting the last verified projection.
- [ ] Adapt legacy arena ledger reads into the causal format and stop writing the old format.
- [ ] Run focused tests and `pnpm typecheck`.
- [ ] Commit: `feat: reconcile offline world actions causally`

## Task 4: Append card and creature progression to the same history

**Files:**

- Create: `src/features/living/wildz-progression-proof.ts`
- Modify: `src/features/living/wildz-game-state.ts`
- Modify: `src/features/living/wildz-player-state.ts`
- Modify: `src/features/living/living-card-asset.ts`
- Modify: `src/features/play/wilds-world-service.ts`
- Test: `tests/wildz-progression-proof.test.ts`
- Test: `tests/wildz-game-state.test.ts`
- Test: `tests/living-card-asset.test.ts`

- [ ] Write failing tests proving XP, scores, level, growth, life, evolution, inventory, and encounter outcomes survive offline restart and verified replay.
- [ ] Write failing tests proving every progression mutation shares the world/card prior head and cannot silently overwrite a concurrent history.
- [ ] Run:

  ```bash
  npx tsx --test tests/wildz-progression-proof.test.ts tests/wildz-game-state.test.ts tests/living-card-asset.test.ts
  ```

- [ ] Define stable Wildz namespaces beneath v111 `state.append`; keep unknown namespaces byte-preserved.
- [ ] Derive current card and creature stats from verified history, with the local causal outbox supplying optimistic pending additions.
- [ ] Remove the custom local digest as an authority boundary; retain it only as a legacy import hint.
- [ ] Run focused tests and `pnpm typecheck`.
- [ ] Commit: `feat: persist creature progression in proof history`

## Task 5: Make Vault save and cross-app restore native proof-object operations

**Files:**

- Modify: `src/lib/receiz/wildz-proof-object-export.ts`
- Modify: `src/lib/receiz/wildz-artifact-custody.ts`
- Modify: `src/features/living/wildz-player-vault.ts`
- Modify: `app/api/receiz/vault/route.ts`
- Test: `tests/wildz-proof-object-export.test.ts`
- Test: `tests/wildz-artifact-custody.test.ts`
- Test: `tests/wildz-player-vault.test.ts`
- Test: `tests/wildz-cross-app-recovery.test.ts`

- [ ] Write failing tests for native Record→Seal save, exact-byte download/readmission, `verifyAndOpen`, `admitAndRecover`, `commitRecovery`, evidence roots, verifier context, and unknown namespace preservation.
- [ ] Run:

  ```bash
  npx tsx --test tests/wildz-proof-object-export.test.ts tests/wildz-artifact-custody.test.ts tests/wildz-player-vault.test.ts tests/wildz-cross-app-recovery.test.ts
  ```

- [ ] Build the portable proof object using `assets.createProofObject`; store its sealed identity and admitted head in Vault and the saved card.
- [ ] Restore with native artifact admission/recovery operations and derive projections only after successful verification.
- [ ] Ensure any failed verify/admit/recover path performs zero canonical writes.
- [ ] Run focused tests, `pnpm typecheck`, and independent verifier tests.
- [ ] Commit: `feat: recover wildz state from native proof objects`

## Task 6: Enforce append-only bearer ownership continuity

**Files:**

- Create: `src/features/living/wildz-card-ownership.ts`
- Modify: `src/features/living/living-card-asset.ts`
- Modify: `src/features/living/wildz-player-vault.ts`
- Test: `tests/wildz-card-ownership.test.ts`
- Test: `tests/wildz-ten-hop-offline-ownership.test.ts`

- [ ] Write failing tests for ten sequential offline handoffs that reconcile into one append-only ownership chain whose final admitted transition is the current owner.
- [ ] Write failing tests for duplicate claims, divergent prior heads, forged provenance, invalid receipts, and partial reconciliation; all must fail closed without losing accepted history.
- [ ] Run:

  ```bash
  npx tsx --test tests/wildz-card-ownership.test.ts tests/wildz-ten-hop-offline-ownership.test.ts
  ```

- [ ] Use `appendReceizPortableAssetOwnership`, `deriveReceizPortableOwnershipContinuity`, and the SDK bearer claim operation. Do not implement a separate winner algorithm.
- [ ] Preserve every prior Receiz ID and pulse transition in provenance while exposing only the latest admitted owner as current.
- [ ] Run focused tests, `pnpm typecheck`, and `pnpm receiz:check`.
- [ ] Commit: `feat: preserve portable card ownership continuity`

## Task 7: Migrate legacy state and prove release conformance

**Files:**

- Create: `src/lib/receiz/wildz-v111-migration.ts`
- Modify: `receiz.app.json`
- Modify: `receiz.generated.json` only through SDK commands
- Modify: `docs/receiz/receiz-integration-index.json` only through SDK commands
- Test: `tests/wildz-v111-migration.test.ts`
- Test: `tests/receiz-v111-artifact-laws.test.ts`
- Test: `tests/receiz-v111-world-release.test.ts`

- [ ] Write failing migration tests for legacy world checkpoints, V3 Vault payloads, local card seals, and old arena ledgers. Migration must be deterministic, idempotent, provenance-preserving, and admitted through v111.
- [ ] Generate the final Receiz SDK plan, record its exact digest, and obtain/validate the matching execution permit before canonical SDK writes.
- [ ] Apply only the reviewed SDK changes. Never hand-edit SDK-owned generated files.
- [ ] Run the complete conformance suite:

  ```bash
  pnpm typecheck
  pnpm test
  pnpm exec receiz app check --root . --json
  pnpm receiz:check
  pnpm test:release-freeze
  ```

- [ ] Verify exact-byte readmission, independent verification, causal replay equivalence, mutation rejection, compatibility reads, MCP conformance, signing challenge binding, plan/attempt identities, and zero-write failure paths.
- [ ] Inspect the production boss flow: authenticated snapshot and command must use the same verified head, and the original `wilds_world_raid_missing` split-brain reproduction must be impossible.
- [ ] Run `git diff --check` and review all changed files for unintended generated or user-owned edits.
- [ ] Commit: `feat: ship v111 global proof world`

## Completion criteria

- A player with a valid Receiz Identity Seal and Connect session always enters the canonical world when online.
- Missing/expired delegated access initiates Connect; it never silently becomes an authenticated local-practice world.
- Online and offline gameplay use one deterministic projection and one append-only causal/proof history.
- World actions, boss state, card stats, creature advancement, XP, score, and ownership survive Vault save and cross-app recovery.
- Ten sequential offline bearer handoffs reconcile with complete provenance and the latest admitted owner at the head.
- No legacy custom merge, digest, or database row can supersede a verified v111 artifact.
- All focused, full, Receiz conformance, release-freeze, and production-flow checks pass.
