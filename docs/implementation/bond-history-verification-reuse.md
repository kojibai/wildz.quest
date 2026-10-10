# Bond growth history verification reuse

Implementation contract written before code changes on 2026-10-10.

The affected path is `applyWildsInput(train)` → exact-card growth →
`appendLivingCardHistory` → `verifyLivingCard` → `verifyCreatureHistory`,
followed by `appendCreatureHistoryEvent` → the same history verifier. The
existing synchronous verifier replays every predecessor event both times.

The change is limited to reusing a successful complete card and history
verification for the same runtime object when every nested value is frozen
plain data. A newly constructed append may retain that private provenance
only after the existing history verifier validates its new suffix from the
exact verified immutable prefix. The successor is frozen before retention.
There is no new admission API or serialized cache marker. Mutable data, shallow
freezes, accessors, non-plain prototypes, and copied objects must verify their
complete histories normally. A new imported successor independently verifies
its complete history. The private WeakSets cannot
retain discarded objects. Failed histories never enter the cache. The
existing cooperative verifier must obey the same reuse eligibility rule.

Fixture budgets: a 68-card state with one 301-event selected creature must
append exactly one event to that creature and retain the other 67 exact
card objects. Admission must replay each card completely once. A subsequent
growth operation must replay zero predecessor events and validate its one
new event, compared with the current repeated replay. After a full successful
verification, repeat verification of that exact immutable history must replay
zero events. Fresh imported successors and copies still replay every event;
changed bytes with unchanged claimed
digests must fail before append. Measurements describe local CPU work,
not an iPhone frame-time or universal zero-latency guarantee.

Receiz SDK, MCP, and AI skills remain the unmodified published `128.0.0`
release, registry digest
`8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`
and operation matrix digest
`940c316b5b7d6212240e699d03b3c1fd419cbbecc6ee51ddd7aa7783d9e523b0`.
Applicable installed performance laws are
`receiz.performance.known-truth-first`, `receiz.first-paint.known-truth`,
and `receiz.truth.stronger-first`. Exact enclosing artifacts, SDK-issued
runtime custody, first-seal identity, complete history, signatures,
Kai ordering, namespace preservation, and the crash-durable journal retain
their existing boundaries. This cache is an application verification
optimization and cannot create Receiz authority or authorize a command.

Verification requires RED/GREEN event-work counters on real helpers,
tamper/mutable/accessor tests, fresh-copy replay, complete successor
validation, and the existing history, authority, portability, and
game-state tests. Compilation uses a private `/private/tmp` directory.
The coordinating agent owns full-suite, typecheck, architecture lock,
release lock, and MCP conformance verification. No live transaction,
enrollment, commit, push, or deployment is authorized by this contract.

## Local verification evidence

RED on the real 68-card bond fixture encoded 603 history events during the
operation: two complete 301-event predecessor replays and the new event.
GREEN encodes two events: construction of the new event and the independent
suffix check. A second bond retains that two-encoding budget. First admission
still independently replays 368 events (301 selected plus 67 other births),
and an imported 303-event successor independently replays all 303 events.

Standalone workstation samples measured 94.93 ms before and 14.89 ms after
for that bond operation. These are synthetic CPU samples, not physical
iPhone results or a zero-latency promise. The enclosing whole-manifest digest
still hashes all canonical manifest bytes once per changed card, and event
membership/reference checks still inspect the prefix without replaying it.
Complete source history remains attached, byte-for-byte in its existing
events, and no journal or artifact write moved behind an unverified shortcut.

The new regression file includes 11 behavioral tests. The related history,
authority, game-state, portability, inventory, and card-proof run passed all
82 tests across 18 files. Focused TypeScript compilation and ESLint passed;
`git diff --check` passed. Private logs are under
`/private/tmp/wildz-bond-history-Sf0hQe/`: `red-incremental.log`,
`red-invariants.log`, `green-related.log`, and `lint.log`.
The coordinating agent's full release gates remain separate.

The subsequent combined `pnpm release:check` passed: 4,077 tests, zero failures,
one existing offline-seal fixture skip, plus architecture lock, typecheck,
v128 check, conformance, lint, secret scan, production build, and doctor. In the
production preview's synthetic 68-card account, clicking Bond displayed 40 XP
and one additional bond, then continued rendering the same world document.
This browser observation does not quantify physical iPhone frame timing.
