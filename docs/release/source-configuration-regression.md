# Source transport and application binding contract

Written before implementation for the iPhone report of
`wilds_resource_source_configuration_unavailable` in Card Vault and Market.
Production was inspected read-only at commit `8bc95c8`. Its environment values
were unavailable to the current deployment connector. No live listing, payment,
source publication, identity enrollment, or host configuration is authorized by
this diagnostic work.

Wildz keeps the published SDK/MCP/AI-skills packages at 128.0.0, ruleset 127.0.0,
registry `8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`,
and operation matrix
`940c316b5b7d6212240e699d03b3c1fd419cbbecc6ee51ddd7aa7783d9e523b0`.
The inspected public inventory contains native identity challenge/sign/exchange,
actor admission, runtime authority sessions, sealed source publication, replay,
and public source locator primitives. These operations remain native v128 calls.

## Required behavior

- Native sources, Phi consent, and bearer acceptance bind to the existing
  `WILDZ_RECEIZ_APPLICATION_ID`, also used by baseline wallet read authority.
  OAuth client credentials remain solely OAuth/introspection credentials.
- Configuration preserves its authenticated account, exact Identity Seal,
  scope, and retained native continuation checks. A missing or expired read
  grant can be renewed using the existing signed wallet-read authorization.
  A missing native continuation can reconnect that same locally verified Seal.
  Retry configuration at most twice, with at most one read-grant renewal and one
  continuation reconnect; it performs no native source/value writes.
- Successful configuration must precede loading a signing key and opening
  resource storage. A blocked configuration starts **zero source signing-key
  reads, zero source SDK calls, and zero source database opens**. A healthy
  configuration adds **zero authorization or reconnect calls**.
- The existing proxy continues to enforce exact current-account/key/scopes,
  bounded paths/bodies, signed consent, full proof bytes, source heads and native
  idempotency. No receipt, session, metadata, app object, or SDK method presence
  becomes asset authority. No new database, SDK patch, reload, timer, or polling
  enters gameplay.

## Verification

Regression tests must exercise metadata application binding independently of
OAuth configuration, missing/expired grant recovery, missing continuation
recovery, retry limits, and zero source work on blocked configuration. Existing
SDK tests must exercise list/buy/accept, lost replies, complete source archives,
amount/recipient binding, and one-use native custody. Full tests, typecheck,
lint, build, architecture lock, SDK/MCP conformance and release checks remain
required. Fixture evidence cannot establish a funded production transaction or
an iOS process-kill diagnosis.

## Completed local checks

`pnpm release:check` passed after the combined source, panel, and history fixes:
4,077 tests passed, none failed, and one existing real offline-seal fixture was
skipped because `WILDZ_TEST_SEAL_DIRECTORY` was not supplied. Architecture lock,
typecheck, published v128 package/registry checks, conformance, lint, secret scan,
production build, and doctor passed. Doctor still labels environment-dependent
live API/checkout/webhook capabilities `needs-env`; this is not a funded live
transaction result. The build retains its existing SDK `web-worker` dynamic
dependency warning.

The source regressions verify the real wallet authority GET challenge's
`wildz` application/audience with both absent and separate OAuth client IDs,
authenticated metadata/proxy rejection, bounded same-key renewal/reconnect,
and zero source work before configuration succeeds. Existing connected-wallet
tests now use the actual production application default for send, consent, and
recovery. Read-only installed MCP conformance and release qualification also
passed 15 checks with zero network/database calls and zero writes.

The production preview rendered at `http://127.0.0.1:3110` in an isolated Chrome
context. Its synthetic 68-card fixture exercised food consumption, Wallet,
Profile, Card Vault selection, Market opening, and bonding at 390 × 844 and
1280 × 800. It retained the same document through 216 seconds with no page
errors, automatic export requests, or signing-worker commands. The fixture
contains no real Identity Seal key or grant, so its expected authorization and
unpublished-card lookup failures do not verify native funded Market success.
The installed iPhone PWA and its service worker still need device verification.
