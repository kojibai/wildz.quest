# Game image export verification — v127

Creature cards, Identity Seals, combined identity/player cards, Vaults and map
images share the official `@receiz/sdk/offline` sealing boundary. Diagnostic
playtest JSON is not a game proof export.

## Runtime and custody

SDK, MCP and AI skills are pinned to 127.0.0. No copied Receiz main-application
runtime remains. The package supplies the sealer, production verification roots
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

## Executed evidence

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
