# Truth of Breath — runtime alignment

The user-supplied v0.1 source is preserved verbatim in `TRUTH-OF-BREATH-v0.1.md`. Its SHA-256 is pinned in `wilds-constitution.ts`. Changing the source requires an explicit successor; the code does not infer constitutional authority from a deployment, founder or vote.

## Active gameplay enforcement

- `WildsWorldService.execute` requires a registered bounded command law, runs existing source/ownership/mandate/material/state checks, produces a constitutional decision, and restores the predecessor if any later predicate fails. System ticks have a separate fixed simulation delegation.
- All new command events bind the original command digest and type. Actor/digest receipts survive checkpoints. Reusing a command ID for another actor or intent is rejected. Historic events remain replayable without retroactively invented metadata.
- Continuous construction reserves exact lots and embeds them once. Component work has a baseline player path. A project grants authority over its produced improvements, not title to the underlying Earth. Functional workshops and storage require valid funded component histories.
- Squad assembly checks current captain/officer standing before execution and at event replay, including scope limits on the proposed squad update.
- Social reports preserve claimant, subject, proposition and source event as `ALLEGED`. They have no automatic punitive consequence.
- A publication conflict returns both candidate records as an unresolved fork and keeps local source work. It does not replace the source branch with a competing server branch.
- World-command ledger entries expose the recorded source and rule trace. The `/laws` page exposes the exact source and current implementation boundary.
- `exportWildsConstitutionalProof` packages predecessor checkpoint, exact command/context, resulting events and decision. `verifyWildsConstitutionalProof` replays against a separately accepted source checkpoint and rejects altered derivations. Digest integrity and deterministic replay are **not** a detached human signature or proof that a supplied checkpoint has lawful standing; existing Receiz/card/source admission remains responsible for authenticating those inputs.

## Predicate library and unavailable authority

The library covers ownership eligibility, valid acquisition mechanisms, scoped/expiring permission and prospective revocation, fruit versus revenue, retained externalities, causal responsibility independent of intent, omission duties, capacity return, emergency/defense limits, completion, succession/forks/stale replay, sabotage protection, scarcity, coercive dependency and amendment contradictions.

The 25 source examples have predicate conformance checks. These are not a claim that a complete court, debt system, housing allocator or stewardship abandonment process now exists. Those domains have no gameplay transition registered, so they cannot gain authority through the generic command endpoint. Undefined commands return an unresolved derivation and mutate nothing.

Specific procedures still need source adoption: community jurisdiction and participants; evidence acceptance and conflict procedures; abandonment indicators and interruption review; scarcity priority predicates; guardianship capacity review; remedy/appeal procedure; insolvency; amendment ratification and fork resolution. v0.1 intentionally calls for these to be *defined* and does not supply their concrete predicates. No numeric thresholds or adjudicator supremacy are invented here.

## Mechanism review (section 77)

| Actor | Attempt | Runtime result / residual scope |
|---|---|---|
| Cooperative / resource-poor | Plan without materials; contribute gradually; work alone | Plans are free; exact materials and work remain required. |
| Self-interested / free rider | Use the same material in two builds | Exact reservations and consumed-lot heads reject reuse. |
| Hostile / wealthy coalition | Replace an admitted command or exploit retries | Persistent actor+command digest rejects conflicting reuse. |
| Administrator / founder | Invoke an unregistered confiscation or override | No transition law; unresolved authority; no state write. |
| Majority coalition | Reassign a squad without team jurisdiction | Current role and scope checks reject it. No personal title is transferred by team voting. |
| Monopolist | Demand personal rights for essential access | No such authority exists in game commands; coercive-dependency predicate rejects the proposed basis when its source facts are established. |
| Machine | Expand deterministic simulation into player authority | Fixed simulation delegation; no original human standing. |

This review is qualitative, not a measured economic equilibrium or proof that exploitation can never occur. New economic/governance commands require a bounded law entry and corresponding source validation before they compile.
