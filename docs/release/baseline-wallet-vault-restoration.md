# Wallet and Vault baseline restoration

The physical iPhone report overrides the zero-background-export policy in
`panel-memory-regression.md`. Removing preparation changed first-tap Save and
did not cure the reported reload. Desktop synthetic accounts did not establish
live Wallet compatibility or an iPhone memory-pressure fix.

Before implementation, compare against `8bc95c8a11a7825752bc5924e4df332a960a53cd`:

- Restore the configured `RECEIZ_CLIENT_ID` for existing wallet authorization,
  Connect consent, bearer claim and source proxy. Native signed proof audience,
  current key/account/scopes, and transport validation remain required. A source
  configuration read may renew the same Seal's missing grant once, using the
  existing published v128 APIs. Healthy reads add zero authorization calls.
- Restore opened-surface preparation and the prepared Save path. After a file
  is ready, a Save tap reaches the platform adapter in the same event task:
  zero new frames, snapshots or preparations before the share/download call.
  Selected-card preparation carries one card, never the 68-card collection.
  Presentation renders and movement schedule zero repeated Vault preparations.
- Restore reusable signing/export workers instead of rebuilding their runtime
  after each request. Keep at most one of each per active identity and preserve
  worker error cleanup and exact complete carrier verification.
- Preserve admitted-history append reuse and complete imported-byte verification.
  No gameplay, profile, ownership, native send/trade or SDK/core repository changes.

The installed SDK, MCP and AI packages remain 128.0.0, ruleset 127.0.0,
registry `8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`
and matrix `940c316b5b7d6212240e699d03b3c1fd419cbbecc6ee51ddd7aa7783d9e523b0`.
Inspected public primitives are `createReceizClient`,
`createReceizProofAuthorityChallenge`, `createReceizOfflineSealer`, and
`verifyReceizArtifact`. SDK types accept the actual registered application;
tooling descriptors do not authorize replacing its connected-wallet audience.
All sealing and independent verification boundaries remain in the SDK.

Regression evidence must cover a configured application different from `wildz`,
same-audience challenge/configuration, bounded renewal, actual panel effects,
prepared and cold Save, worker reuse/errors, full SDK carrier round trips and
release checks. A physical iPhone reload cure requires physical-device evidence;
restoring the baseline is not such evidence. Investigate remaining pressure
separately instead of representing desktop tests as an iPhone cure.

## Live incident evidence

The first hostname metadata lookup returned the older baseline deployment. The
deployment ID on the actual production error logs and a fresh deployment list
instead identify `dpl_3Lzc1G5uTWC14vKiuNr8yQ7MUDop`, commit `d25a3af`, as the
new production version. Repeated `/api/auth/wildz/wallet-authority` POST failures
at 15:00–15:02 UTC on 2026-10-10 report `APPLICATION_NOT_AUTHORIZED`; one request
reports `IDENTITY_NOT_BOUND`. No key, account record or wallet value was read.
This verifies the live authorization failure independently of the synthetic
panel fixture. Restoring the baseline audience is necessary; final live account
success still needs the corrected version deployed and the user's normal grant
renewal, rather than a fabricated success or a new Receiz capability grant.

## Completed verification

The registered-application regressions failed against `d25a3af`: configuration
and wallet challenges returned `wildz` rather than the configured client, and
the browser rejected a valid non-literal application ID. The prepared-card tap
regression failed because the platform adapter was delayed until another frame.
Worker reuse regressions failed because each completed request terminated the
runtime. After restoration, all focused regressions passed, including explicit
cold Save fallback and actual SDK Connect send/recovery tests.

`pnpm release:check` completed successfully: 4,083 tests passed, zero failed,
one existing offline-seal environment fixture skipped. Architecture lock,
typecheck, the published v128 integration checker, conformance, lint, secret
scan, production build and doctor passed. The build retains the existing SDK
`web-worker` dynamic dependency warnings; doctor reports live API, checkout and
webhooks as `needs-env`. Read-only MCP conformance and release verification each
passed 15 checks with zero network/DB calls and zero writes. Independent source
review found no critical or important introduced defect.

Browser plugin was unavailable, and the project has no installed Playwright
CLI. Cached regular Playwright with installed Chrome exercised the production
preview and a synthetic 68-card account at 390×844 and 1280×800. The same
document survived 116 seconds, eating food then opening Wallet, six Vault
open/select/close cycles, card flipping, and full proof-details opening. Closed
details held zero proof-text nodes; opened details held the full 13,209-character
current proof. The inventory computed `transform: none` and `will-change: auto`,
and its 3,413-pixel content still scrolled in the 636-pixel mobile viewport.
There were no page errors or horizontal overflow; screenshots were inspected.
Reduced motion and a pointer click were used to avoid the pre-existing floating
card animation obstructing automated actionability checks.

The fixture has no real Identity Seal key/grant, and service workers were
blocked. Its 401 wallet and 404 unpublished-card/profile responses are expected;
they are not live connection evidence. Existing ONNX CPU-placement warnings
remain. Actual SDK round-trip/export/native-share tests provide the separate
exact carrier and synchronous prepared Save evidence. The physical iPhone
reload and corrected live account connection still require the deployed patch
and device observation. Local preview/browser sessions were stopped afterward.
