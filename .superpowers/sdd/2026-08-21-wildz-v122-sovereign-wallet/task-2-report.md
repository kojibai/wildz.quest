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
