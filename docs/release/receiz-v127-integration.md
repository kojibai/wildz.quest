# Wildz v10 / Receiz v127 integration evidence

All three public npm packages are pinned to 127.0.0. Registry digest:
`8d0b5b839d02d9efbd4306cc99410595a183705c2670b76d2567eaaaade99065`.
60-operation matrix digest:
`eadd171a45fcc51e275a1c57de1eb8e67614757a5723d141793641edf7207a10`.
Compatible SDK range: `>=127.0.0 <128.0.0`.

Published npm SHA-512 integrity values were independently read and checked
against the lockfile. The installed public compiler regenerated framework
metadata. The v127 public function inventory contains 678 functions. Historical
V124/V125 identifiers, v126 exact-source storage schema and export idempotency
keys remain stable.

## Official offline runtime

The application now imports `@receiz/sdk/offline`; it no longer carries Receiz
main-app sealing source or a separate snarkjs script. Packaged proof resources
are copied through public package exports before dev/build. A dedicated worker
serializes proving and uses SDK IndexedDB custody. Existing origin-local device
custody is verified before migration. Background prewarming cannot enroll;
explicit saves may perform first-time enrollment through the public-key-only
same-origin proxy. No private recovery keys or game payloads enter that endpoint.

Saved PNGs retain the entire signed game envelope inside the canonical basis,
including identity recovery, original proofs/history and unknown namespaces.
The SDK verifier admits the exact enclosing bytes; transport extraction must
match its admitted payload digest. Inner identity and game proofs are separately
verified. Existing native artifacts are reused; newly sealed backup documents
are not promoted into native ownership or transfer admission. See
[the exact save contract](../game-image-export-verification.md).

## Executed checks

The final serialized `pnpm release:check` completed successfully.

- Full ordinary suite: 2,740 tests, 2,739 passed, zero failed, one explicit skip.
- Enrolled-device integration separately: all three tests passed, including all
  four image types with real proving, canonical verification, exact payload
  restoration, import, direct SDK identity reading, tamper rejection and refusal
  to reseal existing proofs. Network calls: zero.
- Official MCP `initialize`, offline readiness, file sealing and file verification
  passed in a fresh process with global fetch blocked. Independent SDK verify
  passed; tampering failed. Network calls: zero. Reproduce with private
  `WILDZ_TEST_SEAL_DIRECTORY` and `pnpm receiz:offline-qualification`.
- `pnpm typecheck`, `pnpm receiz:architecture-lock`, `pnpm receiz:check`,
  `pnpm receiz:conformance`, `pnpm build`, `pnpm secret:scan`: passed.
- `pnpm lint`: zero errors, two existing warnings (fixture image and a scene
  hook dependency). Build reports upstream bundler warnings.
- `pnpm receiz:doctor`: package alignment passed; live API/checkout/webhooks
  report `needs-env`. This is not a strict-live production qualification.
- Local production browser: existing identity and 46 creatures loaded. Wallet
  authorization reported `receiz_wallet_application_required` because the
  local preview had no registered client ID configuration. This does not
  describe the deployed Vercel Preview environment.

### Browser qualification follow-up

The development-only `/test-fixtures/offline-seal` page exercises the actual
application worker with disposable card, vault, identity and map payloads,
offers downloads, and checks reopened files against their original bytes.
Type checking passed. Browser readiness executed successfully and reported no
enrolled signer for this browser origin; sealing remains pending enrollment.

Vercel CLI authentication succeeded. The existing `wildz-quest` project has
17 application variables scoped to Production and Preview, none to Development.
Vercel refuses to export their sensitive values and returns placeholders;
those placeholders were removed from the ignored local environment. Local
live-wallet qualification therefore remains blocked on usable configuration
or an authenticated session on the deployed site. No remote variables changed.

## Exact limits

This run did not perform production deployment, real PHI settlement, recipient
receipt acceptance, browser Save through the new worker, physical Safari/iOS
Camera Roll round trips, or full native ownership genesis through an admitted
Identity Record. No success claim is made for these unobserved operations.
A device certificate is not identity ownership; backup integrity is not transfer
admission. Production-readiness assertions must respect those boundaries.

v127 disables historical HTTP proof queries, store portability and release
pinning by default. They are not the game's local save pipeline and have no
current default-server implementation in the published capability evidence.
The live doctor now qualifies its current identity, wallet, checkout and world
read routes and reports the historical categories as unavailable. It does not
invent a compatibility host or turn disabled historical operations back on.

The major-release recap and complete post-v9 ledger are in [v10.0.0.md](v10.0.0.md).
Pushing, tagging, GitHub publication and deployment remain with the maintainer.
