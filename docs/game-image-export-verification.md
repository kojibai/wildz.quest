# Game image export verification

Creature cards, Identity Seals, combined identity/player cards, Vaults and map
images share the official `@receiz/sdk/offline` sealing boundary. Diagnostic
playtest JSON is not a game proof export.

## Runtime and custody

Wildz pins the SDK, MCP and AI skills to 129.5.0. The SDK supplies the sealer, production verification roots
and Groth16 resources. `pnpm receiz:offline-resources` copies the public package
resources and records their hashes before development and production builds.

Proof generation runs in a dedicated browser worker. After the world paints,
prewarming loads resources without enrolling a device. Explicit Save can perform
one-time enrollment through the same-origin public-key-only proxy. The SDK
retains a nonexportable CryptoKey in IndexedDB. Existing v126 origin-local
custody is migrated only after the official SDK validates its certificate and
key possession. Keys and game payloads never enter a remote sealing endpoint.
Clearing browser storage removes that device's local setup.

## Full payload, identity and authority

Identity trailers are packed inside the PNG before sealing. Every byte of the
original signed game envelope, card proofs, receipts, history and unknown
namespaces is recoverable. The standard SDK identity PNG namespace remains
readable by other SDK consumers. The canonical verifier validates the enclosing
proof; the importer separately validates the inner game proof and identity
signature. Exact admitted payload digests bind transport extraction.

A canonical document seal proves the file's integrity and enrolled signature.
It does not mint native ownership, admit a transfer or settle PHI. Existing native
artifacts are reused without changing their ownership or history. The SDK's
owner-bound creation path additionally requires a genuine admitted Identity
Record; a username or device certificate is not a substitute. Wildz's saved
backup envelope does not invent that admission. Native-only transfer admission
remains separate and unchanged.

Sealed bytes are never modified after issuance. Existing enclosing proofs must
be reused or advanced through their SDK transition workflow, never resealed as
new genesis. Old unsealed saves do not retroactively become canonical objects.

## Current file-size boundary

Profile Save seals the complete signed Wildz PNG with the SDK offline sealer.
Wildz reopens the returned document and checks its exact payload before offering
the download. Profile restore checks the file size before allocating its bytes.
The codec's outer and recursive inspections, the document
reader, and document retention all have a 64 MiB boundary. The codec reports
`wildz_restore_artifact_too_large` before inspecting the proof above that size.
Its `invalid` result in this case describes a size rejection. The underlying
proof validity remains unevaluated.

On 2026-11-17, an unsigned PNG of exactly 67,108,865 bytes reproduced this
boundary offline. Both Wildz entry points rejected its size. The SDK's general
artifact verifier returned `VERIFICATION_RESOURCE_UNAVAILABLE`. The SDK offline
file verifier read that same PNG and reported its missing proof bundle. This
exercise established the dispatch behavior. Successful recovery of a signed
Vault above 64 MiB remains unqualified.

The public SDK offline file verifier accepts one complete byte array. The SDK
spooler can persist bounded chunks, but the PNG proof verifier still consumes
the complete input. Wildz also materializes the extracted PNG, signed player
JSON, and identity trailer, and its pending-restore store limits each record to
64 MiB. Supporting larger existing files with bounded memory requires a
canonical reader for their original enclosing bytes, incremental extraction
and verification of the signed game payload, and durable retention through
restore and cold reopen. The SDK's signed account-state segment format applies
to the portable account snapshot inside an Identity artifact. It cannot verify
an existing Wildz PNG by splitting its bytes after issuance.

## Local v129.5.0 Profile verification

On November 17, 2026, the localhost Profile save enrolled one disposable
browser signer and downloaded a 467,598-byte Identity Seal. Both SDK verifiers
accepted the file with network reads blocked. A separate fresh browser imported
that exact file from Profile, then restored the same owner after a full browser
restart with application API requests blocked.

A second Profile save used that enrolled signer with all API reads blocked. Its
1,546,881-byte Seal carried one card and 792,039 explored regions in 12,004
rows. Both the SDK verifier and the signed Wildz player payload identified the
expected owner. Desktop WebKit with iPhone 15 emulation imported that same Seal
through Profile and reopened the owner after quitting and restarting the
browser with external and application API requests blocked.

The final release build repeated Save using that same signer in 1.78 seconds
with zero enrollment requests. Its 1,547,097-byte file independently verified
offline with the same owner, card proof and complete atlas. WebKit opened
the final file through Profile in 2.40 seconds and reopened the same owner
after a process restart in 0.97 seconds with API and external requests blocked.

In an installed standalone Chromium PWA, 300 movement inputs on that map
previously sent 19 complete atlases to a worker and wrote 21,072,570
characters to localStorage. Repeating the workload with the owner-scoped
checkpoint sent 19 messages containing zero map rows and issued zero
localStorage checkpoint writes during movement. The final run wrote 303,054
bytes of movement strings, 1,748 bytes of movement metadata and 564 bytes
of discoveries to IndexedDB, measured as UTF-8 at the application boundary.
It rendered 576 frames with a 16.7 ms 95th percentile and recorded zero
gameplay navigations, renderer crashes or graphics-context losses. The first
offline map open took 1,063 ms and two repeat opens took 54 ms each.
After a second offline process restart, both the
rendered map and the checkpoint reader showed the same 792,046 regions,
position, and card. These measurements used desktop Chrome in standalone
mode with a mobile viewport.

On that same saved player, a separate 30-cycle map open/close run measured
38.58 MiB of renderer JavaScript heap after collection at the warm baseline
and 40.04 MiB after the final cycle. The DOM node count stayed at 1,993 and
backing storage stayed at 10.73 MiB. No reload, graphics-context loss or
renderer crash occurred. This measures JavaScript retention on the test Mac.
Physical iPhone memory pressure and GPU memory remain unmeasured.

## Earlier v127 executed evidence

`tests/wildz-local-image-seal.test.ts` uses an already-enrolled disposable device
with real SDK Groth16 proving. With network calls blocked, all four save types
passed canonical verification, exact payload reconstruction and tamper rejection.
Cards and Vaults restored through the game codec; identity remained readable
through the public SDK. Rewrapping existing proofs was rejected.

Set `WILDZ_TEST_SEAL_DIRECTORY` to a private directory created by the official
Node offline sealer. The test never enrolls or prints keys. Without private
custody, the integration case is explicitly skipped. Small fixtures took roughly
0.5–0.6 seconds each including repeated verification; this is not a mobile-device
latency guarantee. Cached prepared saves reuse verified bytes. Image editors or
photo services that strip proof metadata cannot preserve a removed proof.
