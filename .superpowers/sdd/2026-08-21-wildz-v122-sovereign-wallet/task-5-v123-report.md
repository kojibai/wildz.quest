# Task 5 — Live V123 transfer routes and controller report

Date: 2026-08-22
Base: `1aa2fdea920f04264ddea17d67cc405b6ad35924`

## Outcome

Task 5 adds thin no-store V123 preview/execute/status routes, an exact send controller/driver state machine, purpose-separated opaque attempt and receive locators, and permanent exact terminal recovery. The default production route remains explicitly fail-closed because this repository does not contain concrete deployment bindings for the required durable cross-instance journal, proof freshness/revocation/owner admission resolver, or exact server transfer-context resolver. Public username lookup separately remains fail-closed without the existing durable distributed limiter.

The browser request allowlist contains only public recipient username or an encrypted receive locator, positive micro-Phi amount, Settlement/Reserve selection, and an operation nonce. Owner/app binding, live scopes, stable semantic idempotency, source proof/value coordinates, destination subject/head, price basis, and current Kai are server-derived. Responses never expose raw intent, source/destination heads or IDs, proof authority/access token, authority digest, price basis, or SDK execution ID.

## Route and recovery architecture

- `createWildsWalletTransferRouteRuntime` is the exact deployment injection contract. It requires a `serverDerived: true` transfer-context port, `durable: true` cross-instance journal, `serverDerived: true` authority admission port, the exact V123 adapter rails, and the existing server secret.
- The server derives idempotency with a purpose-separated HMAC over the authenticated account/actor/profile generation and the operation nonce. Reusing a nonce with different exact semantics conflicts; duplicate identical requests converge on the same journal winner.
- Preview stages the exact SDK intent before returning. Its AES-256-GCM attempt handle is an authenticated encrypted pointer only; it is never storage or authority. Status and execute re-resolve the authenticated actor and consult the injected durable journal.
- Proof-authority exchange remains inside the execute route after a proof-signed consent challenge. The SDK-derived `receizOidcScopesForRails` set is requested and rechecked; there is no redirect or browser proof-authority projection.
- Task 4's delete-on-finalize journal boundary was strengthened after an explicit response-loss RED. Exact committed and attributable bound zero-write outcomes now atomically replace the pending row with a terminal record. The record retains the exact admitted semantic basis plus only a sanitized terminal projection and bounded Kai retention metadata. Lost HTTP response, process restart, or duplicate status returns the identical terminal projection without remote re-execution.
- Unknown, malformed, unbound zero-write, and failed terminal CAS outcomes remain pending/unknown. They cannot be adopted as success.
- Terminal retention is bounded to 86,400 Kai (about 5.24 canonical days at the 5.236-second pulse), with a storage-port `purgeTerminal(currentKai, limit)` contract and per-route bounded cleanup of at most 32 rows. Review/proof consent uses 120 Kai, matching the V123 proof-authority interval exercised by the SDK fixtures (about 10.5 minutes).

## Receive and recipient boundary

- When the complete live runtime is injected, receive generates a separately purpose-bound AES-GCM locator sealing the exact application, destination subject, and destination head. A different server instance with the same secret and shared journal can reopen it without public username lookup; byte tampering fails authentication.
- When runtime dependencies are absent, the historical `wildz:receive:<actor>` response remains explicitly `non-authoritative`. Transfer preview behaviorally rejects it, so it cannot select or authorize a destination.
- Public username lookup is unchanged: no production lookup occurs without the durable distributed limiter.

## Controller behavior

The pure controller now distinguishes recipient, amount, review, stage, authorize, authorize-pending, unknown, zero-write, and committed states. Every async completion is bound to request ID, identity key, and authority generation. Pointer start/cancel is explicit; an unarmed or canceled pointer cannot authorize. Closing, visibility cancellation, and overlay takeover abort active requests while preserving an exact staged/unknown handle. Identity or authority invalidation removes all private transfer state. A staged response is review state only and is never adopted as committed.

The driver synchronously deduplicates stage/execute/status work, rejects malformed 200 projections, converts ambiguous execution to unknown, recovers the exact opaque attempt, and exposes the flow through `useWildsWalletController`. The 10,000-frame diagnostic remains unchanged by wallet work.

## Strict TDD evidence

### Initial route/controller RED

`pnpm exec tsc -p tsconfig.test.json --pretty false` exited 2 after the first tests were added. Errors named the absent transfer routes/runtime interface, missing controller transfer states/events, and missing driver methods. This was the expected missing-feature failure.

### Permanent receipt RED

The new `terminalizes an exact commit so a lost response, restart, and duplicate status recover identically` test exposed Task 4's delete-on-finalize gap: after an exact commit, a fresh status request could no longer load the staged row. The journal contract was changed from conditional removal to atomic terminalization with bounded cleanup. The same focused test is now green and confirms only one remote lookup before durable terminal adoption.

### Driver RED

The test TypeScript compiler again exited 2 when driver tests first referenced the absent `stageTransfer`, pointer authorization, execute, and recovery methods. The methods were then implemented over the pure reducer and request runtime.

## GREEN verification

- Focused wallet route/authority/transfer/controller/driver suite: 61 tests, 61 pass, 0 fail.
- `pnpm exec tsc -p tsconfig.test.json --pretty false`: exit 0.
- `pnpm typecheck`: exit 0.
- `pnpm receiz:check`: exit 0, `ok: true`, exact target `123.0.0` and 36-operation V123 contract.
- `pnpm receiz:architecture-lock`: exit 0, 482 runtime files checked.
- Scoped ESLint for all changed route, transfer, controller, hook, and test files: exit 0.
- `git diff --check`: exit 0.
- Full suite/build intentionally left for the parent Task 5/next release tranche after the focused and architectural gates; no full-suite claim is made here.

## Deployment status

No safe default production write route is claimed. To enable live Phi, deployment must inject all of the following into `createWildsWalletTransferRouteRuntime` and then pass that runtime to `createWildsWalletRouteHandlers`:

1. a genuinely durable, encrypted-at-rest, owner-scoped, cross-instance journal implementing atomic stage, bind, terminalize, exact terminal load, and bounded purge;
2. the server-derived current-Kai and current revocation/owner binding admission port;
3. the exact transfer-context resolver that derives same-request authenticated owner binding, source proof/head/value, destination binding, price basis, and live granted scopes;
4. exact V123 adapter execution/recovery/proof-exchange rails; and
5. the existing purpose-separated server secret of at least 32 bytes.

Capability projection becomes live only through that complete admitted runtime. Missing any dependency returns `receiz_wallet_transfer_dependencies_unavailable`; it does not fall back to a process `Map`, client-carried journal, database balance, or legacy `connect.transfer`.
