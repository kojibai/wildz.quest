# Task 2 — No-store wallet read/receive routes

## Scope

Implemented the five Task 2 routes and their route-contract coverage:

- `app/api/wilds/wallet/summary/route.ts`
- `app/api/wilds/wallet/ledger/route.ts`
- `app/api/wilds/wallet/recipient/route.ts`
- `app/api/wilds/wallet/request/route.ts`
- `app/api/wilds/wallet/capabilities/route.ts`
- `tests/wilds-wallet-routes.test.ts`

Every successful route response is a strict Task 1 projection or a deliberately non-authoritative public receive locator. Routes resolve the cookie/proof-bound Task 1 authority server-side and never return an adapter/SDK result directly.

## RED evidence

Command:

```text
pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-routes.test.js
```

Result before route implementation: 7/7 route-contract tests failed as expected because the five wallet route files were absent. The first failure was:

```text
AssertionError: expected wallet route app/api/wilds/wallet/summary/route.ts
false !== true
```

An additional RED iteration covered malformed JSON input. The new test required `readJsonBody` to convert parser failure into the safe `wilds_wallet_request_fields_invalid` code; it failed before the helper existed.

## GREEN evidence

Command:

```text
pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-projections.test.js .test-build/tests/wilds-wallet-authority.test.js .test-build/tests/wilds-wallet-routes.test.js
```

Result: 23 tests passed, 0 failed.

Command:

```text
pnpm typecheck
```

Result: passed. During the first typecheck, the ledger adapter boundary rejected `null` for `cursor`; the route now omits the cursor (`undefined`) while retaining the projected `null` cursor response.

Command:

```text
git diff --check
```

Result: passed with no whitespace errors.

## Route behavior

- Summary: authenticated adapter read -> `WalletSummaryProjection`; private no-store response.
- Ledger: validates a server-owned cursor, requests at most 50 entries, then returns only `WalletLedgerPageProjection`.
- Recipient: accepts only `{ username }`, normalizes it, applies a bounded six-lookups-per-minute-per-actor process guard, resolves the public profile, insists that its sanitized username exactly matches, and returns only `WalletRecipientProjection`. All lookup failures collapse to `receiz_wallet_recipient_unavailable`.
- Request: accepts only an optional `amountPhiMicro`, returns a `wildz:receive:<public-username>` locator and a clearly `non-authoritative` Phi request. It invokes no ledger, reserve, plan, or execution rail.
- Capabilities: authenticated return of the fixed Task 1 V123-gated capability projection.

All routes set `cache-control: no-store`, use exact safe status codes, and export only `runtime`, `dynamic`, and their Next.js method handler. The test suite checks those export fields, allowlists, malformed values, no-store use, rate-limit code, projection boundaries, and redaction boundary.

## Self-review

- Confirmed success responses project immediately at the server boundary; no raw adapter result crosses a response.
- Confirmed recipient response is the strict recipient projection and never serializes the `worldProfile` response.
- Confirmed error paths expose known safe codes only, never a caught error message unless it is an explicit internal safe code.
- Confirmed read/receive endpoints cannot invoke transfer, reservation, planning, or execution rails.
- Confirmed no unrelated tracked files were modified.

## Concerns

The recipient throttle is intentionally bounded process-local protection because this task has no durable deployment rate-limit rail. It enforces the requested boundary within a runtime but is not cross-instance durable; production should place an identity-keyed durable limiter at the edge before treating it as complete enumeration-abuse protection.

## Commit

Created with `git commit -m "feat: add Wilds wallet read routes"`; final SHA is supplied in the task handoff.

## Fix round 1/5 — durable recipient privacy boundary

### Changes

- Replaced source-regex route tests with behavioral tests that invoke injected handler functions and import each actual Next route only to verify its exports.
- Moved all route behavior into `src/lib/receiz/wilds-wallet-route-handlers.ts`; the five route modules now export only `runtime`, `dynamic`, and `GET` or `POST`.
- Added one exact safe-code/status allowlist classifier shared by every wallet handler. Unknown exceptions—including unknown `receiz_wallet_*` strings—collapse to each handler's generic safe unavailable code.
- Removed the recipient module `Map` throttle. Recipient lookup consumes an injected durable limiter port with a six-per-60-second actor scope; absent, malformed, or failing limiter integration returns `503 { error: "receiz_wallet_recipient_lookup_unavailable" }` and makes no profile lookup.
- Recipient SDK misses, malformed SDK profile shapes, exact-username mismatches, and SDK lookup throws now all return exactly `404 { error: "receiz_wallet_recipient_unavailable" }`.

### RED evidence

Command:

```text
pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-routes.test.js
```

Result before the handler module existed: 8 behavior tests failed (route export import check still passed) with the expected missing production-module error:

```text
ERR_MODULE_NOT_FOUND: Cannot find module .../wilds-wallet-route-handlers.js
```

Those tests specified the production behavior before implementation: sanitized summary/ledger projection, safe auth and input errors, recipient miss equivalence, malformed profile and upstream throw handling, non-authoritative receive requests, zero transfer-capable rail calls, durable six/seventh boundary across fresh factories, no-limiter failure, capability response, and actual route export imports.

### GREEN evidence

Command:

```text
pnpm exec tsc -p tsconfig.test.json && node scripts/patch-test-imports.mjs && node --test .test-build/tests/wilds-wallet-projections.test.js .test-build/tests/wilds-wallet-authority.test.js .test-build/tests/wilds-wallet-routes.test.js
```

Result: 25 tests passed, 0 failed.

Command:

```text
pnpm typecheck
pnpm exec eslint app/api/wilds/wallet src/lib/receiz/wilds-wallet-route-handlers.ts tests/wilds-wallet-routes.test.ts
git diff --check
```

Result: all passed. The first scoped lint run found the Next rule prohibiting a local variable named `module`; renamed it to `handlerModule` and reran all checks cleanly.

### Fix-round self-review and concern

The route's production dependency deliberately supplies no limiter implementation, so public recipient lookup is unavailable until deployment wires an actual durable server/edge rate-limit port into the handler factory. This is intentional fail-closed behavior, not a fallback; summary, ledger, request, and capabilities remain available under Task 1 authority. The durable-port binding itself remains a deployment integration task.
