# Kai uPulse Runtime Authority Design

## Purpose

Wildz gameplay continuity is governed by the Kai Klok deterministic state machine. Its exact non-negative safe-integer `uPulse`, counted continuously from the fixed Genesis anchor, is the sole runtime temporal authority. Chapters, progression windows, cooldowns, lifecycle transitions, world phases, replay ordering, and conflict resolution must derive from `uPulse` rather than from mutable server snapshots, scheduler ticks, ISO timestamps, or browser wall-clock comparisons.

This change repairs `wilds_story_chapter_inactive` at its architectural source and establishes the same invariant across gameplay. A server may persist, verify, publish, and synchronize an admitted transition. It may not invent, delay, advance, rewind, or veto the Kai state that deterministic `uPulse` arithmetic selects.

## Constitutional Invariants

1. `uPulse` is the only gameplay time coordinate with ordering authority.
2. Kai moments are derived through `deriveKaiKlokMomentFromUPulse`; authoritative gameplay code does not round-trip through ISO time.
3. A persisted event cursor orders admitted causal transitions. It never represents “now.”
4. ISO timestamps are descriptive interoperability metadata. Changing ISO metadata while retaining the same `uPulse` cannot change a gameplay result.
5. A later valid `uPulse` cannot be rejected because a cached projection or scheduler is stale.
6. State never rewinds below the greatest valid local or admitted `uPulse` already observed.
7. Identical inputs, rules, causal parents, and `uPulse` reproduce identical state offline and online.
8. Receiz admission proves and persists a transition; it does not become temporal authority.

## Scope

This implementation covers gameplay continuity:

- current Kai runtime state and UI projection;
- daily saga chapters, objectives, trainers, tournaments, and chapter memories;
- player exploration and durable progression events;
- creature discovery, capture, training, recovery, growth, fusion, evolution, ascension, life, and retirement consequences;
- ecology activation, resolution, expiry, and historicization;
- boss and raid gameplay windows, action cooldowns, and durable raid consequences;
- Arena season/rating windows and durable match consequences where current code still consults conventional time.

This implementation does not change animation clocks, renderer deltas, input repeat cadence, network retry backoff, payment settlement, authentication expiry, market reservation expiry, transient multiplayer presence, or connection leases. Those operational and economy/session clocks require a separate audit because their safety contracts are not equivalent to gameplay progression.

## Runtime Clock

### Kai pulse source

A focused runtime clock owns the current Kai `uPulse`. It performs deterministic Genesis arithmetic once when the application establishes its runtime baseline, then advances from that baseline using a monotonic elapsed-time source. The clock exposes integer pulse state, never an ISO string as temporal authority.

The runtime clock follows these rules:

- establish a baseline `uPulse` from the fixed Genesis count at runtime startup;
- retain the greatest valid local or admitted `uPulse` as a non-rewind floor;
- advance from the baseline using monotonic elapsed duration;
- on visibility restoration or runtime reactivation, reconcile to the greatest of the newly observed Genesis count, the monotonic projection, and the retained non-rewind floor;
- emit a new gameplay moment only when the integer `uPulse` changes;
- derive display labels, day, Ark, beat, step, chakra, palette, and geometry from `deriveKaiKlokMomentFromUPulse`.

Wall-clock and ISO values may help establish or describe a runtime observation, but they are immediately converted to `uPulse` at the boundary. They are not stored or compared as gameplay truth.

### Kai temporal root

Durable commands and consequences carry a `KaiTemporalRoot` containing the exact `uPulse`, coarse pulse, causal sequence, coordinate, and admitted/local authority label. Domain systems consume that root or its exact `uPulse`; they do not accept an ISO timestamp as their only temporal input.

## World Chapter State Machine

The saga director already deterministically projects a chapter from a `KaiKlokMoment`. The world service will treat that projection as the chapter authority.

Before executing any chapter-scoped command, the world service will:

1. derive the exact Kai moment from the command authority’s `uPulse`;
2. project the saga for that moment and existing admitted chapter memories;
3. settle any prior projected chapter whose Kai day has ended, using deterministic objective totals and outcome hooks;
4. materialize the current chapter, trainers, and eligible tournament state if not already present;
5. execute the command against that derived chapter;
6. append all resulting events in causal sequence within the same `uPulse`.

`projection.story.activeChapter` remains a useful replayed cache and public projection. It is not a precondition for determining which chapter is active. A missing or stale cached chapter is reconciled deterministically during command execution rather than producing `wilds_story_chapter_inactive`.

A command with a chapter ID that does not match the chapter derived from its own valid Kai root fails as a genuine chapter mismatch. A command matching the derived chapter cannot fail merely because a scheduler has not run.

Scheduled world ticks may proactively materialize time-derived projections, ecology, or public events. They are optional accelerators and maintenance triggers. Command correctness never depends on their arrival.

## Gameplay Progression

### Player and creature transitions

Gameplay actions that currently carry `at`, `searchedAt`, `capturedAt`, `trainedAt`, `fusedAt`, `evolvedAt`, or similar ISO-only fields will gain or consume an exact Kai temporal root. During migration, ISO fields may remain in serialized schemas for compatibility and presentation, but all ordering and eligibility decisions use `uPulse`.

Recovery and cooldown boundaries are represented as integer Kai deadlines. For example, a training recovery is `recoveryUntilUPulse`, not an ISO value compared with `Date.parse`. UI copy may project that deadline into a human-readable label.

Creature history appends continue to evaluate causal ancestry first. A valid descendant advances its parent. Only verified divergent siblings compare admitted `uPulse`; equal-slot non-identical claims fail closed under the existing law.

### World phases

Ecology, boss, raid, tournament, and season phase boundaries become Kai pulse ranges. Generated state stores exact activation, resolution, closing, expiry, and historicization `uPulse` values. ISO forms, where retained, are derived metadata and never drive phase transitions.

High-frequency simulation and animation remain frame/delta based. Only durable gameplay consequences receive a Kai temporal root. This prevents per-frame history churn while preserving exact causal continuity.

## Client, Server, and Persistence Boundaries

### Client

The client owns responsive current-Kai projection and can execute deterministic local/practice gameplay from the runtime `uPulse`. It queues proof-bearing commands with the exact Kai root when offline or disconnected.

### Server and Receiz rails

The server verifies actor, card, command schema, exact Kai root, causal parent/head, idempotency, and bounded effects. It replays deterministic rules and persists or publishes the result. It rejects forged, malformed, regressive, non-causal, or conflicting Kai roots. It does not require a prior scheduler tick and does not substitute its wall-clock time for the command’s valid Kai root.

For commands whose fairness requires an admitted coordinate, admission upgrades the authority label without changing the underlying `uPulse`-derived outcome. Ranked or globally contested systems may require admission before durable public settlement, while local/practice gameplay remains deterministic and replayable.

### Persistence and recovery

Stored projections carry the latest causal cursor and relevant Kai floors/deadlines. Recovery replays events in causal order and re-derives all time-dependent projections from their `uPulse` roots. The current runtime Kai is resolved independently from the persisted event cursor.

## Compatibility and Migration

The migration is incremental and fail-closed:

1. introduce a pure Kai runtime clock and exact temporal-input helpers;
2. migrate PlayCampaign current-Kai state from ISO storage to `uPulse` storage;
3. make world commands carry exact Kai roots and reconcile chapters during execution;
4. migrate player and creature progression deadlines and append inputs;
5. migrate ecology, raid, tournament, and season gameplay windows;
6. retain legacy ISO fields only where readers, artifacts, or external schemas still require them;
7. verify legacy records by deriving their historical `uPulse` once at the compatibility boundary, then operate on the exact integer value;
8. reject records where existing exact Kai evidence conflicts with ISO metadata.

No migration rewrites immutable card bases or previously admitted history. Derived compatibility values are used to replay legacy records; new durable events carry exact Kai roots.

## Error Handling

Internal temporal error codes remain structured for tests and diagnostics, but raw codes are never shown in player-facing HUD copy.

- stale cached chapter: reconcile from command `uPulse` and continue;
- chapter ID inconsistent with command `uPulse`: reject as a deterministic chapter mismatch;
- regressive `uPulse`: reject without changing state;
- malformed or unsafe `uPulse`: reject without changing state;
- equal causal slot with non-identical events: fail closed;
- unavailable persistence: keep a locally deterministic pending command without claiming global admission;
- failed publication: preserve the prior admitted head and report recovery-pending state.

## Testing Strategy

### Runtime clock

- Genesis produces `uPulse = 0`.
- Monotonic elapsed time advances integer `uPulse` deterministically.
- visibility/re-anchoring never rewinds below the retained floor.
- the same `uPulse` produces the same complete Kai moment regardless of ISO metadata.

### Chapter continuity

- a command for the current Kai chapter succeeds from an empty world without a prior tick;
- a command after a Kai day boundary settles the prior chapter and opens the new chapter before applying the command;
- practice and live execution derive the same chapter from the same `uPulse`;
- a stale cached chapter cannot produce `wilds_story_chapter_inactive`;
- a genuinely mismatched chapter ID fails deterministically;
- replay of the emitted events reproduces the exact projection.

### Progression

- eligibility and cooldown results depend on `uPulse`, not ISO ordering;
- identical causal input at the same `uPulse` is idempotent;
- later causal `uPulse` advances progression even if its descriptive ISO timestamp is earlier;
- a lower `uPulse` cannot advance or overwrite later state;
- offline and admitted replay produce identical gameplay projections.

### World phases

- ecology, raid, tournament, and season boundaries transition at exact Kai deadlines;
- missing scheduler ticks do not suppress or delay phase transitions;
- animation and networking timers cannot mutate durable gameplay state without a Kai-rooted command.

### Integration and release

- focused Kai, saga, world-service, progression, ecology, raid, Arena, replay, and continuity suites pass;
- full typecheck and full test suite pass;
- browser QA confirms the Living Story action succeeds without “chapter inactive,” current Kai continues visibly, and no raw temporal error code reaches the HUD;
- existing proof, Vault, market, multiplayer, and Arena authority tests remain green.

## Success Criteria

The implementation is complete when a player can enter or continue the current Kai chapter in local, offline-pending, or connected gameplay without depending on a server tick; every migrated gameplay transition is ordered by exact `uPulse`; stale projections cannot veto current Kai state; replay and recovery reproduce identical outcomes; ISO timestamps remain descriptive only; and all affected focused, full-suite, typecheck, and rendered-flow checks pass.
