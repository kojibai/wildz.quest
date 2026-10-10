# Panel export and signing-worker memory contract

**Superseded policy:** The user rejected delayed first-tap exports and reported
continued physical-device reloads. The removal of automatic preparation and
idle worker reuse below has been reversed. See
[baseline restoration](baseline-wallet-vault-restoration.md) and
[proof-details pressure](vault-proof-details-pressure.md) for the current work.
The historical desktop checks below never established an iPhone reload cure.

This contract is written before implementation for the installed iPhone PWA
report: Profile name saving persists but the app reloads; Card Vault and Market
listing also reload for an account holding 68 cards. Source inspection exposes
unrequested export work. It does not establish an iOS process-kill diagnosis.

Wildz uses unmodified `@receiz/sdk`, `@receiz/mcp-server`, and `@receiz/ai-skills`
128.0.0, constitutional ruleset 127.0.0, registry digest
`8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`,
and operation-matrix digest
`940c316b5b7d6212240e699d03b3c1fd419cbbecc6ee51ddd7aa7783d9e523b0`.
The inspected native boundary is `createReceizOfflineSealer`: `ready()` verifies
durable custody and resources; `enroll()` is explicit; `seal()` preserves and
independently verifies complete canonical output. Its restart contract reloads
existing IndexedDB custody. MCP offline tools retain the same SDK boundary and
remain tooling. The installed performance, offline-first, and portable
continuity doctrine keeps known verified source truth first and complete.

## Required behavior and fixture budgets

- Opening Profile, opening Card Vault, selecting a card, or listing a card:
  **zero automatic full-account export preparations and zero automatic
  Identity-owned card export preparations**. Viewing still projects admitted
  state and public sharing metadata. Profile name/username/image behavior and
  Market admission are unchanged.
- A user-clicked Save retains the complete account/card payload, exact owner
  binding, current source history, SDK verification, error propagation, and
  existing prepared-artifact reuse. No card count or archive limit is added.
- The local document signing worker remains shared throughout one active
  readiness/enrollment/seal operation and across overlapping requests:
  **at most one worker**, **zero worker restarts within one setup operation**,
  and **zero retained signing workers after all work settles**. Existing
  request deadlines reject rather than simulate success. No cleanup polling,
  idle timer, network dependency, or new durable store is added.
- The Identity/player export worker also retains its complete card delta state
  only while exports are pending: **at most one worker per active identity** and
  **zero retained export workers after the last result**. Concurrent exports
  retain the existing delta mechanism. A later explicit Save reconstructs the
  complete source when it is not already served by the verified artifact cache.
- No new work enters gameplay frames, movement, terrain, or deterministic game
  transitions. Removing background export work changes when export begins;
  the first explicit Save may need to prepare its file before the save panel.

## Evidence and remaining boundary

Behavioral regressions must execute real panel effects/handlers and the browser
worker client, covering unwanted preparation, explicit Save, overlapping
requests, enrollment, worker errors, and subsequent reopening. Existing real
SDK sealing/round-trip tests remain required; lifecycle test replies alone
cannot establish proof validity. Full tests, typecheck, lint, build,
architecture lock, official checker, MCP conformance, and release gate are
performed by the coordinating agent.

An installed iPhone run with the user's actual 68-card Seal, WebKit crash or
jetsam evidence, and interaction/frame measurements is still required to prove
whether this removes the reported reload and to quantify device memory or
latency. A desktop or source test cannot supply that evidence.

## Focused verification

Before the changes, the real 68-card panel regression observed one Vault
preparation, one card preparation, and one player snapshot just from mounting
and selecting the Vault; the zero-work budget failed. Worker lifetime tests
also failed because completed operations retained their workers. Adding an
undecodable export-reply regression exposed the missing `messageerror` cleanup.

After the changes, the private test build's focused panel, worker lifecycle,
owned-card export, complete Vault/restore, worker-delta, and export UI tests ran
42 tests: 41 passed, none failed, one skipped. The skip is the real offline-seal
fixture that requires `WILDZ_TEST_SEAL_DIRECTORY`; it is not a lifecycle pass.
The real SDK 97-card export/restore/cold-load fixture and exact verified artifact
checks passed. Targeted ESLint and `git diff --check` passed. Removing stale-worker
guards and transport cleanup in the private compiled test files caused the
three corresponding regressions to fail; restoring them made all three pass.

The change removes unrequested whole-account work and releases both idle
worker runtimes. It does not remove the synchronous changed-card persistence
journal or any gameplay proof. Those remain the crash-durability boundary.

## Combined production-preview verification

The full combined release gate passed 4,077 tests with zero failures and one
existing environment-dependent offline-seal fixture skip. The production
preview was then exercised for 216 seconds in an isolated synthetic 68-card
Chrome context at 390 × 844 and 1280 × 800. Eating one vegetable changed the
displayed fuel from 50% to 58% and the stored vegetable count from one to zero;
opening Wallet immediately afterward retained the same document. Six Vault
open/select/close cycles, six Profile cycles, five additional Wallet cycles,
Market opening, and a bond action produced zero automatic Identity-owned
exports and zero readiness/enrollment/seal worker commands. The bond action
displayed 40 XP and one additional bond. No page error or horizontal overflow
was observed. World screenshots were visually inspected and their canvas
interiors passed alpha/color-variance sampling.

Browser plugin was unavailable; cached regular Playwright and installed Chrome
were used without dependency changes. Service workers were intentionally
blocked in this isolated context. Wallet 401 and public synthetic profile/card
404 responses were expected because the fixture has no real key, grant, or
publication. Existing local acoustic-worker CPU-placement warnings were also
recorded; voice behavior was not changed. This evidence establishes the tested
browser interaction and zero-work budgets, not physical iPhone memory or an
iOS reload cure. Preview and browser sessions were stopped after verification.
